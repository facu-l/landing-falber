-- =============================================================================
-- FALBER — Esquema inicial de la tienda (Supabase / PostgreSQL)
-- Migración 0001. Ver docs/FALBER_documento_maestro.md para el porqué de cada decisión.
--
-- Mientras no haya un deploy en producción, este archivo se edita directamente
-- (decisión 15e de la revisión de ingeniería). Después del primer deploy, todo
-- cambio va en una migración nueva (0003_..., 0004_...).
--
-- Principios:
--   1. Las reglas de negocio críticas viven en la DB (constraints, triggers y
--      funciones), no solo en el frontend.
--   2. El stock se mueve SOLO a través de stock_movements (ledger). Un trigger
--      rechaza cualquier otro cambio, incluso desde Supabase Studio.
--   3. Los visitantes no tocan tablas: todo pasa por funciones RPC que solo el
--      servidor (service_role) puede ejecutar.
--   4. Los errores esperables salen con un código estable en `message`
--      (ej. INSUFFICIENT_STOCK) y el dato en `detail`. Next.js los traduce.
-- =============================================================================

-- gen_random_uuid() es nativo desde Postgres 13: no hace falta la extensión pgcrypto.

-- -----------------------------------------------------------------------------
-- Tipos (enums): `supabase gen types` los convierte en uniones de TypeScript
-- ('pending' | 'confirmed' | ...), así los estados no se duplican en el código.
-- -----------------------------------------------------------------------------

create type public.admin_role          as enum ('admin');
create type public.product_status      as enum ('active', 'inactive');
create type public.product_gender      as enum ('male', 'female', 'unisex');
create type public.variant_type        as enum ('decant', 'full_bottle');
create type public.payment_method      as enum ('transfer', 'cash');
create type public.delivery_method     as enum ('pickup', 'delivery');
create type public.order_status        as enum (
  'pending',          -- recién creado, falta que FALBER lo confirme
  'confirmed',        -- confirmado; si es transferencia, espera el pago
  'paid',             -- pago verificado
  'preparing',        -- armando el pedido
  'ready_for_pickup', -- listo para retirar
  'shipped',          -- enviado
  'completed',        -- entregado
  'cancelled'         -- cancelado (devuelve el stock)
);
create type public.stock_movement_type as enum (
  'initial_stock', 'restock', 'sale', 'order_cancelled', 'adjustment', 'damaged'
);
create type public.request_status      as enum (
  'pending', 'contacted', 'quoted', 'sourcing', 'completed', 'cancelled'
);

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Numeración legible de pedidos: FAL-0001, FAL-0002, ...
-- Una secuencia (y no count(*) + 1) evita números duplicados con pedidos simultáneos.
create sequence public.order_number_seq start 1;

create or replace function public.next_order_number()
returns text
language sql
as $$
  -- greatest(4, ...) evita que lpad TRUNQUE al pasar de 9999 (lpad('12345', 4) = '1234').
  select 'FAL-' || lpad(n::text, greatest(4, length(n::text)), '0')
  from (select nextval('public.order_number_seq') as n) s;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles — administradores (vinculado a auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.admin_role not null default 'admin',
  display_name text,
  created_at   timestamptz not null default now()
);

-- security definer: evita la recursión infinita de RLS al consultar profiles
-- desde las políticas de la propia tabla profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. products — el perfume (sin precio ni stock: eso es de la variante)
-- -----------------------------------------------------------------------------

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  -- Mismos límites que un encargo: /encargos?producto=<slug> precarga nombre y marca.
  name        text not null check (length(trim(name)) between 2 and 120),
  brand       text not null check (length(trim(brand)) between 1 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_path  text,  -- ruta dentro del bucket product-images, no la URL completa
  gender      public.product_gender,
  status      public.product_status not null default 'active',
  -- Aparece en "Destacados" de la home. Se marca a mano desde Studio.
  is_featured boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. product_variants — cada presentación vendible (decant 5 ml, frasco 100 ml...)
-- -----------------------------------------------------------------------------

create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  variant_type public.variant_type not null,
  size_ml      integer not null check (size_ml > 0),
  -- Etiqueta para mostrar ("Decant 5 ml"). Una sola fuente: la usan create_order y la UI.
  label        text generated always as (
                 (case variant_type when 'decant' then 'Decant ' else 'Frasco ' end)
                 || size_ml::text || ' ml'
               ) stored,
  price        numeric(12, 2) not null check (price >= 0),
  -- Caché del ledger stock_movements. NUNCA se edita a mano (ver guard_variant_stock).
  stock        integer not null default 0 check (stock >= 0),
  is_available boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, variant_type, size_ml)
);

create index product_variants_product_id_idx on public.product_variants (product_id);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- El stock solo cambia desde apply_stock_movement (que enciende 'falber.ledger').
-- Este trigger corre para TODOS, incluido el rol postgres de Supabase Studio:
-- evita que un "arreglo rápido" en el Table Editor desincronice el historial.
-- (No frena a alguien que quiera saltearlo a propósito: es una protección contra errores.)
create or replace function public.guard_variant_stock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.stock <> 0 then
    raise exception using
      message = 'STOCK_IS_LEDGER_MANAGED',
      hint    = 'Creá la variante con stock 0 y cargá un movimiento initial_stock.';
  end if;

  if tg_op = 'UPDATE' and new.stock is distinct from old.stock
     and coalesce(current_setting('falber.ledger', true), '') <> 'on' then
    raise exception using
      message = 'STOCK_IS_LEDGER_MANAGED',
      hint    = 'Insertá un movimiento en stock_movements (restock, adjustment, damaged).';
  end if;

  return new;
end;
$$;

create trigger product_variants_guard_stock
  before insert or update of stock on public.product_variants
  for each row execute function public.guard_variant_stock();

-- -----------------------------------------------------------------------------
-- 4. customers — compradores invitados, identificados por WhatsApp
-- -----------------------------------------------------------------------------

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (length(trim(full_name)) between 2 and 80),
  -- Formato E.164 normalizado por el servidor. Ej: +5492215551234
  whatsapp   text not null unique check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  email      text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. orders — el pedido
-- -----------------------------------------------------------------------------

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default public.next_order_number(),
  -- Idempotencia: el checkout genera este UUID al cargarse. Un doble click o un
  -- reintento de red con el mismo request_id devuelve el pedido ya creado.
  request_id           uuid not null unique,
  customer_id          uuid not null references public.customers (id),
  -- Snapshot de los datos con los que se hizo la compra (no se pisan los del cliente).
  customer_name        text not null,
  customer_email       text,
  status               public.order_status not null default 'pending',
  payment_method       public.payment_method not null,
  delivery_method      public.delivery_method not null,
  shipping_cost        numeric(12, 2) check (shipping_cost >= 0), -- null = a coordinar
  delivery_address     text,
  delivery_city        text,
  delivery_postal_code text,
  delivery_reference   text,
  order_note           varchar(100),
  subtotal             numeric(12, 2) not null check (subtotal >= 0),
  -- Columna generada: el total no puede quedar desincronizado del subtotal + envío.
  total                numeric(12, 2) generated always as (subtotal + coalesce(shipping_cost, 0)) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Red de seguridad: create_order ya valida esto con códigos amigables.
  constraint delivery_requires_address check (
    delivery_method = 'pickup'
    or (delivery_address is not null and delivery_city is not null)
  ),
  constraint cash_only_for_pickup check (
    payment_method <> 'cash' or delivery_method = 'pickup'
  ),
  -- Mismos topes que el checkout (src/lib/forms/limits.ts). length() de null es null: pasa.
  constraint delivery_lengths check (
    length(delivery_address) <= 120
    and length(delivery_city) <= 60
    and length(delivery_postal_code) <= 10
    and length(delivery_reference) <= 120
  )
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_created_at_idx on public.orders (status, created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Los pedidos no se borran: se cancelan (y el stock vuelve solo).
-- Borrar un pedido dejaba su movimiento 'sale' huérfano y esas unidades se perdían.
create or replace function public.prevent_order_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    message = 'ORDERS_ARE_NOT_DELETED',
    hint    = 'Cancelá el pedido: el stock reservado vuelve automáticamente.';
end;
$$;

create trigger orders_prevent_delete
  before delete on public.orders
  for each row execute function public.prevent_order_delete();

-- -----------------------------------------------------------------------------
-- 6. order_items — qué se compró (snapshot de nombre y precio, inmutable)
-- -----------------------------------------------------------------------------

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id),
  variant_id    uuid not null references public.product_variants (id), -- restrict: no se borra una variante vendida
  product_name  text not null,   -- snapshot: "Sauvage EDT"
  variant_label text not null,   -- snapshot: "Decant 5 ml"
  unit_price    numeric(12, 2) not null check (unit_price >= 0), -- snapshot del precio
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) generated always as (unit_price * quantity) stored
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create or replace function public.prevent_order_item_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    message = 'ORDER_ITEMS_ARE_IMMUTABLE',
    hint    = 'Para corregir un pedido, cancelalo y creá uno nuevo.';
end;
$$;

create trigger order_items_immutable
  before update or delete on public.order_items
  for each row execute function public.prevent_order_item_changes();

-- -----------------------------------------------------------------------------
-- 7. stock_movements — ledger de stock (fuente de verdad, solo se agrega)
-- -----------------------------------------------------------------------------

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  -- restrict: una variante con historial no se borra (baja lógica con is_available).
  variant_id    uuid not null references public.product_variants (id),
  movement_type public.stock_movement_type not null,
  quantity      integer not null check (quantity <> 0), -- con signo: +entra / -sale
  reference_id  uuid references public.orders (id),     -- pedido, cuando aplica
  note          text,
  -- Auditoría: quién lo cargó. null = el sistema (create_order con service_role,
  -- cancelación automática de pg_cron). Una cancelación desde el admin queda
  -- firmada por el admin: el trigger hereda su auth.uid().
  created_by    uuid references auth.users (id) default auth.uid(),
  created_at    timestamptz not null default now(),

  -- El signo tiene que ser coherente con el tipo de movimiento.
  constraint quantity_sign_matches_type check (
    (movement_type in ('initial_stock', 'restock', 'order_cancelled') and quantity > 0)
    or (movement_type in ('sale', 'damaged') and quantity < 0)
    or movement_type = 'adjustment'
  )
);

create index stock_movements_variant_id_idx on public.stock_movements (variant_id, created_at desc);

-- Cada movimiento actualiza la caché product_variants.stock.
-- Si el stock quedara negativo, el check (stock >= 0) aborta toda la transacción.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('falber.ledger', 'on', true);
  update public.product_variants
  set stock = stock + new.quantity
  where id = new.variant_id;
  perform set_config('falber.ledger', 'off', true);
  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create or replace function public.prevent_ledger_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    message = 'STOCK_LEDGER_IS_APPEND_ONLY',
    hint    = 'Un error se corrige con un movimiento adjustment, no editando el historial.';
end;
$$;

create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.prevent_ledger_changes();

-- -----------------------------------------------------------------------------
-- 8. perfume_requests — encargos (agotados o perfumes que FALBER no tiene)
-- -----------------------------------------------------------------------------

create table public.perfume_requests (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id),
  customer_name text not null, -- snapshot, igual que en orders
  variant_id    uuid references public.product_variants (id), -- caso A: existe pero está agotado
  perfume_name  text not null check (length(trim(perfume_name)) between 2 and 120),
  brand         text check (length(brand) <= 60),
  presentation  text check (length(presentation) <= 60),
  note          varchar(100),
  status        public.request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index perfume_requests_status_idx on public.perfume_requests (status, created_at desc);
create index perfume_requests_customer_id_idx on public.perfume_requests (customer_id);

create trigger perfume_requests_updated_at
  before update on public.perfume_requests
  for each row execute function public.set_updated_at();

-- Ranking de perfumes más pedidos (para decidir qué comprar).
create view public.perfume_requests_ranking
with (security_invoker = true)
as
select
  lower(trim(perfume_name))        as perfume_key,
  min(perfume_name)                as perfume_name,
  min(brand)                       as brand,
  count(*)                         as total_requests,
  count(*) filter (where status = 'pending') as pending_requests,
  max(created_at)                  as last_requested_at
from public.perfume_requests
where status <> 'cancelled'
group by lower(trim(perfume_name))
order by total_requests desc;

-- -----------------------------------------------------------------------------
-- 9. rate_limit_events — anti-abuso por cliente (IP hasheada en el servidor)
-- -----------------------------------------------------------------------------

create table public.rate_limit_events (
  id         bigint generated always as identity primary key,
  action     text not null check (action in ('order', 'perfume_request')),
  client_key text not null, -- hash de la IP: nunca se guarda la IP en crudo
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (action, client_key, created_at desc);

create or replace function public.enforce_rate_limit(
  p_action     text,
  p_client_key text,
  p_max        integer,
  p_window     interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_client_key is null or length(p_client_key) < 16 then
    raise exception using message = 'INVALID_CLIENT_KEY';
  end if;

  -- Sin lock, N requests simultáneas de la misma IP leen count < max y pasan todas.
  -- El lock serializa solo las de la misma acción y clave, hasta el fin de la transacción.
  perform pg_advisory_xact_lock(hashtext(p_action || ':' || p_client_key));

  select count(*) into v_count
  from rate_limit_events
  where action = p_action
    and client_key = p_client_key
    and created_at > now() - p_window;

  if v_count >= p_max then
    raise exception using message = 'RATE_LIMITED';
  end if;

  insert into rate_limit_events (action, client_key) values (p_action, p_client_key);
end;
$$;

-- -----------------------------------------------------------------------------
-- Estados del pedido: transiciones válidas
--
--   pending ─► confirmed ─► paid ──────► preparing ─┬─► ready_for_pickup ─► completed  (retiro)
--                  │                        ▲       └─► shipped ─────────► completed  (envío)
--                  └── (efectivo) ──────────┘
--   cancelled: desde cualquier estado salvo shipped / completed. No se reabre.
-- -----------------------------------------------------------------------------

create or replace function public.is_valid_order_transition(
  p_from     public.order_status,
  p_to       public.order_status,
  p_payment  public.payment_method,
  p_delivery public.delivery_method
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to             then true  -- re-guardar el mismo estado no cambia nada
    when p_from = 'cancelled'      then false
    when p_to   = 'cancelled'      then p_from not in ('shipped', 'completed')
    when p_from = 'pending'        then p_to = 'confirmed'
    when p_from = 'confirmed'      then p_to = 'paid' or (p_to = 'preparing' and p_payment = 'cash')
    when p_from = 'paid'           then p_to = 'preparing'
    when p_from = 'preparing'      then (p_to = 'ready_for_pickup' and p_delivery = 'pickup')
                                     or (p_to = 'shipped' and p_delivery = 'delivery')
    when p_from = 'ready_for_pickup' then p_to = 'completed'
    when p_from = 'shipped'        then p_to = 'completed'
    else false
  end;
$$;

create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valid_order_transition(old.status, new.status, old.payment_method, old.delivery_method) then
    raise exception using
      message = 'INVALID_STATUS_TRANSITION',
      detail  = old.status::text || ' -> ' || new.status::text;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.stock_movements (variant_id, movement_type, quantity, reference_id, note)
    select oi.variant_id, 'order_cancelled', oi.quantity, new.id, 'Cancelación ' || new.order_number
    from public.order_items oi
    where oi.order_id = new.id;
  end if;

  return new;
end;
$$;

create trigger orders_status_change
  before update of status on public.orders
  for each row execute function public.handle_order_status_change();

-- Costo de envío: solo en pedidos con envío y antes de que salgan o se cierren.
-- Se mira el estado VIEJO: cargar el costo y pasar a 'shipped' en el mismo update vale.
create or replace function public.guard_shipping_cost()
returns trigger
language plpgsql
as $$
begin
  if new.shipping_cost is not distinct from old.shipping_cost then
    return new;
  end if;

  if old.delivery_method = 'pickup' then
    raise exception using
      message = 'SHIPPING_COST_PICKUP',
      hint    = 'Un pedido con retiro no tiene costo de envío.';
  end if;

  if old.status in ('shipped', 'completed', 'cancelled') then
    raise exception using
      message = 'SHIPPING_COST_LOCKED',
      detail  = old.status::text,
      hint    = 'El costo de envío se carga antes de despachar el pedido.';
  end if;

  return new;
end;
$$;

create trigger orders_shipping_cost_guard
  before update of shipping_cost on public.orders
  for each row execute function public.guard_shipping_cost();

-- -----------------------------------------------------------------------------
-- RPC: create_order — ÚNICA forma de crear un pedido
-- Atómica: si algo falla (stock, precio, datos), no queda nada a medio crear.
-- -----------------------------------------------------------------------------

create or replace function public.create_order(
  p_request_id           uuid,
  p_client_key           text,   -- hash de la IP, calculado en el Server Action
  p_full_name            text,
  p_whatsapp             text,   -- ya normalizado a E.164 por el servidor
  p_email                text,
  p_payment_method       text,
  p_delivery_method      text,
  p_delivery_address     text,
  p_delivery_city        text,
  p_delivery_postal_code text,
  p_delivery_reference   text,
  p_order_note           text,
  p_items                jsonb   -- [{"variant_id": "uuid", "quantity": 2}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name           text := trim(coalesce(p_full_name, ''));
  v_email          text := nullif(trim(coalesce(p_email, '')), '');
  v_address        text := nullif(trim(coalesce(p_delivery_address, '')), '');
  v_city           text := nullif(trim(coalesce(p_delivery_city, '')), '');
  v_postal_code    text := nullif(trim(coalesce(p_delivery_postal_code, '')), '');
  v_reference      text := nullif(trim(coalesce(p_delivery_reference, '')), '');
  v_note           text := nullif(trim(coalesce(p_order_note, '')), '');
  v_payment        public.payment_method;
  v_delivery       public.delivery_method;
  v_existing       record;
  v_item           jsonb;
  v_customer_id    uuid;
  v_order_id       uuid;
  v_order_number   text;
  v_subtotal       numeric(12, 2) := 0;
  v_pending_orders integer;
  v_line           record;
  v_variant        record;
begin
  -- 0. Idempotencia: un reintento con el mismo request_id devuelve el pedido existente
  if p_request_id is null then
    raise exception using message = 'MISSING_REQUEST_ID';
  end if;

  select id, order_number into v_existing from orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
  end if;

  -- 1. Validación de entrada con códigos estables (los constraints quedan como red)
  if length(v_name) not between 2 and 80 then
    raise exception using message = 'INVALID_NAME';
  end if;
  if p_whatsapp is null or p_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception using message = 'INVALID_WHATSAPP';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using message = 'INVALID_EMAIL';
  end if;
  if p_payment_method is null or p_payment_method not in ('transfer', 'cash') then
    raise exception using message = 'INVALID_PAYMENT_METHOD';
  end if;
  if p_delivery_method is null or p_delivery_method not in ('pickup', 'delivery') then
    raise exception using message = 'INVALID_DELIVERY_METHOD';
  end if;

  v_payment  := p_payment_method::public.payment_method;
  v_delivery := p_delivery_method::public.delivery_method;

  if v_payment = 'cash' and v_delivery <> 'pickup' then
    raise exception using message = 'CASH_REQUIRES_PICKUP';
  end if;
  if v_delivery = 'delivery' and (v_address is null or v_city is null) then
    raise exception using message = 'ADDRESS_REQUIRED';
  end if;
  if v_note is not null and length(v_note) > 100 then
    raise exception using message = 'NOTE_TOO_LONG';
  end if;
  -- Mismos topes que el checkout; detail = el campo (el formulario ya marca cuál).
  if length(v_address) > 120 then
    raise exception using message = 'DELIVERY_DATA_TOO_LONG', detail = 'address';
  end if;
  if length(v_city) > 60 then
    raise exception using message = 'DELIVERY_DATA_TOO_LONG', detail = 'city';
  end if;
  if length(v_postal_code) > 10 then
    raise exception using message = 'DELIVERY_DATA_TOO_LONG', detail = 'postal_code';
  end if;
  if length(v_reference) > 120 then
    raise exception using message = 'DELIVERY_DATA_TOO_LONG', detail = 'reference';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using message = 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception using message = 'TOO_MANY_ITEMS';
  end if;

  for v_item in select e from jsonb_array_elements(p_items) e loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
       or (v_item ->> 'quantity') !~ '^[0-9]{1,3}$' then
      raise exception using message = 'INVALID_ITEM', detail = v_item::text;
    end if;
  end loop;

  -- 2. Anti-abuso por cliente (IP hasheada): máximo 5 pedidos por hora
  perform public.enforce_rate_limit('order', p_client_key, 5, interval '1 hour');

  -- 3. Cliente: se crea si no existe. NUNCA se pisan los datos de uno existente
  --    (si no, cualquiera que conozca un número podría cambiarle el nombre).
  insert into customers (full_name, whatsapp, email)
  values (v_name, p_whatsapp, v_email)
  on conflict (whatsapp) do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select id into v_customer_id from customers where whatsapp = p_whatsapp;
  end if;

  -- 4. Anti-abuso por WhatsApp: los pedidos pendientes reservan stock
  select count(*) into v_pending_orders
  from orders
  where customer_id = v_customer_id and status = 'pending';

  if v_pending_orders >= 3 then
    raise exception using message = 'TOO_MANY_PENDING_ORDERS';
  end if;

  -- 5. Cabecera del pedido (el subtotal se completa abajo)
  insert into orders (
    request_id, customer_id, customer_name, customer_email,
    payment_method, delivery_method,
    delivery_address, delivery_city, delivery_postal_code, delivery_reference,
    order_note, subtotal
  )
  values (
    p_request_id, v_customer_id, v_name, v_email,
    v_payment, v_delivery,
    v_address, v_city, v_postal_code, v_reference,
    v_note, 0
  )
  on conflict (request_id) do nothing
  returning id, order_number into v_order_id, v_order_number;

  -- Otra transacción con el mismo request_id ganó la carrera: devolver ese pedido.
  if v_order_id is null then
    select id, order_number into v_existing from orders where request_id = p_request_id;
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
  end if;

  -- 6. Ítems: agrupados por variante (por si viene repetida) y ordenados por id
  --    para bloquear filas siempre en el mismo orden (evita deadlocks).
  for v_line in
    select (e ->> 'variant_id')::uuid as variant_id,
           sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.quantity < 1 or v_line.quantity > 10 then
      raise exception using message = 'INVALID_QUANTITY', detail = v_line.variant_id::text;
    end if;

    -- Precio y stock REALES, con la fila bloqueada hasta el fin de la transacción
    select v.id, v.price, v.stock, v.is_available, v.label,
           p.name as product_name, p.status as product_status
    into v_variant
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = v_line.variant_id
    for update of v;

    if not found or not v_variant.is_available or v_variant.product_status <> 'active' then
      raise exception using message = 'VARIANT_UNAVAILABLE', detail = v_line.variant_id::text;
    end if;

    if v_variant.stock < v_line.quantity then
      raise exception using message = 'INSUFFICIENT_STOCK', detail = v_line.variant_id::text;
    end if;

    insert into order_items (order_id, variant_id, product_name, variant_label, unit_price, quantity)
    values (v_order_id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.price, v_line.quantity);

    -- Reserva el stock (el trigger descuenta product_variants.stock)
    insert into stock_movements (variant_id, movement_type, quantity, reference_id, note)
    values (v_variant.id, 'sale', -v_line.quantity, v_order_id, v_order_number);

    v_subtotal := v_subtotal + v_variant.price * v_line.quantity;
  end loop;

  update orders set subtotal = v_subtotal where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'duplicate', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: create_perfume_request — encargo de un perfume
-- -----------------------------------------------------------------------------

create or replace function public.create_perfume_request(
  p_client_key   text,
  p_full_name    text,
  p_whatsapp     text,
  p_perfume_name text,
  p_brand        text,
  p_presentation text,
  p_note         text,
  p_variant_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name        text := trim(coalesce(p_full_name, ''));
  v_perfume     text := trim(coalesce(p_perfume_name, ''));
  v_brand        text := nullif(trim(coalesce(p_brand, '')), '');
  v_presentation text := nullif(trim(coalesce(p_presentation, '')), '');
  v_note        text := nullif(trim(coalesce(p_note, '')), '');
  v_customer_id uuid;
  v_request_id  uuid;
begin
  if length(v_name) not between 2 and 80 then
    raise exception using message = 'INVALID_NAME';
  end if;
  if p_whatsapp is null or p_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception using message = 'INVALID_WHATSAPP';
  end if;
  -- Con variante, perfume, marca y presentación salen del catálogo, no del cliente:
  -- el formulario los muestra de solo lectura, pero un POST armado a mano podría
  -- mandar otros y dejar el encargo contradiciendo a su variante.
  if p_variant_id is not null then
    -- trim: el check de products mide recortado, así que se copia recortado.
    select trim(p.name), trim(p.brand), v.label
      into v_perfume, v_brand, v_presentation
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = p_variant_id;

    if not found then
      raise exception using message = 'VARIANT_NOT_FOUND', detail = p_variant_id::text;
    end if;
  end if;
  if length(v_perfume) not between 2 and 120 then
    raise exception using message = 'INVALID_PERFUME_NAME';
  end if;
  if length(v_brand) > 60 then
    raise exception using message = 'INVALID_BRAND';
  end if;
  if length(v_presentation) > 60 then
    raise exception using message = 'INVALID_PRESENTATION';
  end if;
  if v_note is not null and length(v_note) > 100 then
    raise exception using message = 'NOTE_TOO_LONG';
  end if;

  perform public.enforce_rate_limit('perfume_request', p_client_key, 5, interval '1 hour');

  insert into customers (full_name, whatsapp)
  values (v_name, p_whatsapp)
  on conflict (whatsapp) do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select id into v_customer_id from customers where whatsapp = p_whatsapp;
  end if;

  insert into perfume_requests (customer_id, customer_name, variant_id, perfume_name, brand, presentation, note)
  values (
    v_customer_id, v_name, p_variant_id, v_perfume, v_brand, v_presentation, v_note
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: get_order_summary — para la página /pedido/[id]
-- Devuelve SOLO datos no sensibles (sin teléfono, email ni dirección).
-- -----------------------------------------------------------------------------

create or replace function public.get_order_summary(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number',        o.order_number,
    'status',              o.status,
    'payment_method',      o.payment_method,
    'delivery_method',     o.delivery_method,
    'subtotal',            o.subtotal,
    'shipping_cost',       o.shipping_cost,
    'total',               o.total,
    'created_at',          o.created_at,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_name',  oi.product_name,
               'variant_label', oi.variant_label,
               'unit_price',    oi.unit_price,
               'quantity',      oi.quantity,
               'line_total',    oi.line_total
             ) order by oi.product_name)
      from order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o
  where o.id = p_order_id;
$$;

-- -----------------------------------------------------------------------------
-- Tareas programadas (las agenda 0002_schedule_jobs.sql con pg_cron)
-- -----------------------------------------------------------------------------

-- Cancela los pedidos 'pending' abandonados; el trigger devuelve el stock.
create or replace function public.cancel_stale_orders(p_older_than interval default interval '48 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update orders
  set status = 'cancelled'
  where status = 'pending'
    and created_at < now() - p_older_than;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- El anti-abuso solo mira la última hora: lo más viejo que un día sobra.
create or replace function public.purge_rate_limit_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from rate_limit_events where created_at < now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de funciones: cerradas por defecto
-- Supabase da EXECUTE a anon/authenticated sobre toda función nueva: se revoca
-- todo y se abre solo lo necesario. Las RPC públicas las ejecuta SOLO el servidor
-- (service_role), así el captcha y el límite por IP no se pueden saltear llamando
-- a la API de Supabase directo con la anon key.
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Las políticas RLS llaman a is_admin() con el rol de quien consulta.
grant execute on function public.is_admin() to anon, authenticated;

grant execute on function public.create_order(uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.create_perfume_request(text, text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.get_order_summary(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Permisos de tablas y columnas (defensa en profundidad, además de RLS)
-- -----------------------------------------------------------------------------

-- Variantes: el stock no se escribe directo (también lo frena guard_variant_stock).
revoke insert, update on public.product_variants from anon, authenticated;
grant insert (product_id, variant_type, size_ml, price, is_available) on public.product_variants to authenticated;
grant update (variant_type, size_ml, price, is_available) on public.product_variants to authenticated;

-- Clientes: el admin puede corregir nombre/email; nadie los borra.
revoke insert, update, delete on public.customers from anon, authenticated;
grant update (full_name, email) on public.customers to authenticated;

-- Pedidos: se crean solo con create_order; el admin cambia estado y costo de envío.
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status, shipping_cost) on public.orders to authenticated;

-- Ítems: inmutables.
revoke insert, update, delete on public.order_items from anon, authenticated;

-- Ledger: el admin agrega movimientos; created_by lo completa la DB (auditoría).
revoke insert, update, delete on public.stock_movements from anon, authenticated;
grant insert (variant_id, movement_type, quantity, note) on public.stock_movements to authenticated;

-- Encargos: se crean con create_perfume_request; el admin solo cambia el estado.
revoke insert, update, delete on public.perfume_requests from anon, authenticated;
grant update (status) on public.perfume_requests to authenticated;

revoke all on public.rate_limit_events from anon, authenticated;
revoke all on public.perfume_requests_ranking from anon;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.perfume_requests  enable row level security;
alter table public.rate_limit_events enable row level security; -- sin políticas: nadie entra

-- Convención: las policies llaman `(select public.is_admin())`, no `public.is_admin()`.
-- Con el select, Postgres lo evalúa una vez por consulta (initPlan); suelto, una vez por
-- fila. Lo verifica schema.test.cjs.

-- Catálogo: público ve lo activo; admin ve y gestiona todo.
create policy "catalog: public reads active products"
  on public.products for select
  to anon, authenticated
  using (status = 'active' or (select public.is_admin()));

create policy "catalog: admin manages products"
  on public.products for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "catalog: public reads variants of active products"
  on public.product_variants for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

create policy "catalog: admin manages variants"
  on public.product_variants for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Datos de negocio y personales: SOLO admin. Sin políticas para anon = sin acceso.
create policy "admin: read customers"
  on public.customers for select to authenticated
  using ((select public.is_admin()));

create policy "admin: update customers"
  on public.customers for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin: read orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "admin: update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin: read order_items"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

create policy "admin: read stock movements"
  on public.stock_movements for select to authenticated
  using ((select public.is_admin()));

-- El admin solo carga movimientos manuales: 'sale' y 'order_cancelled' son del sistema.
create policy "admin: add manual stock movements"
  on public.stock_movements for insert to authenticated
  with check (
    (select public.is_admin())
    and movement_type in ('initial_stock', 'restock', 'adjustment', 'damaged')
    and reference_id is null
  );

create policy "admin: read perfume_requests"
  on public.perfume_requests for select to authenticated
  using ((select public.is_admin()));

create policy "admin: update perfume_requests"
  on public.perfume_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Storage: fotos de productos (lectura pública, escritura solo admin)
-- Las tablas storage.* las crea el servicio de Storage, no Postgres. En la nube
-- ya existen al migrar; con `supabase start` todavía no (storage-api arranca
-- después de las migraciones). Por eso, si las tablas no existen:
--   - en local (existe el rol marcador falber_local_dev, creado en supabase/roles.sql)
--     se omite la sección con un NOTICE;
--   - en cualquier otro entorno la migración FALLA: mejor un deploy frenado que
--     producción sin bucket ni policies de fotos.
-- Ver TODOS.md → "Storage local".
-- -----------------------------------------------------------------------------

do $storage$
begin
  if to_regclass('storage.objects') is null then
    if exists (select 1 from pg_roles where rolname = 'falber_local_dev') then
      raise notice 'storage.objects no existe todavía (local): se omiten bucket y policies de product-images';
      return;
    end if;
    raise exception 'STORAGE_TABLES_MISSING'
      using detail = 'storage.objects no existe: el bucket product-images y sus policies no se pueden crear';
  end if;

  insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

  create policy "product-images: admin uploads"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and (select public.is_admin()));

  create policy "product-images: admin updates"
    on storage.objects for update to authenticated
    using (bucket_id = 'product-images' and (select public.is_admin()));

  create policy "product-images: admin deletes"
    on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and (select public.is_admin()));
end
$storage$;

-- =============================================================================
-- Alta del primer admin (manual, una sola vez):
--   1. Supabase Dashboard → Authentication → Add user (tu email + contraseña).
--   2. Copiar el UUID del usuario y ejecutar:
--        insert into public.profiles (id, display_name) values ('<UUID>', 'Facundo');
--
-- Cargar stock desde Studio: NO edites la columna stock (el trigger lo rechaza).
--   insert into public.stock_movements (variant_id, movement_type, quantity, note)
--   values ('<variant_id>', 'initial_stock', 10, 'Carga inicial');
-- =============================================================================
