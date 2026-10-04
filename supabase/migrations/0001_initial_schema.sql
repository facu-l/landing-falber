-- =============================================================================
-- FALBER — Esquema inicial de la tienda (Supabase / PostgreSQL)
-- Migración 0001. Ver docs/FALBER_documento_maestro.md para el porqué de cada decisión.
--
-- Principios:
--   1. Las reglas de negocio críticas viven en la DB (constraints + funciones),
--      no solo en el frontend.
--   2. El stock se mueve SOLO a través de stock_movements (ledger).
--   3. Los visitantes no tocan tablas directamente: todo pasa por funciones RPC
--      que solo el servidor (service_role) puede ejecutar.
-- =============================================================================

-- gen_random_uuid() es nativo desde Postgres 13: no hace falta la extensión pgcrypto.

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
  role         text not null default 'admin' check (role in ('admin')),
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
  name        text not null check (length(trim(name)) > 0),
  brand       text not null check (length(trim(brand)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_path  text,  -- ruta dentro del bucket product-images, no la URL completa
  gender      text check (gender in ('male', 'female', 'unisex')),
  status      text not null default 'active' check (status in ('active', 'inactive')),
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
  variant_type text not null check (variant_type in ('decant', 'full_bottle')),
  size_ml      integer not null check (size_ml > 0),
  price        numeric(12, 2) not null check (price >= 0),
  -- Caché del ledger stock_movements. NUNCA se edita a mano (ver permisos abajo).
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
  customer_id          uuid not null references public.customers (id),
  status               text not null default 'pending' check (status in (
                         'pending',          -- recién creado, falta que FALBER lo confirme
                         'confirmed',        -- confirmado; si es transferencia, espera el pago
                         'paid',             -- pago verificado
                         'preparing',        -- armando el pedido
                         'ready_for_pickup', -- listo para retirar
                         'shipped',          -- enviado
                         'completed',        -- entregado
                         'cancelled'         -- cancelado (devuelve el stock)
                       )),
  payment_method       text not null check (payment_method in ('transfer', 'cash')),
  delivery_method      text not null check (delivery_method in ('pickup', 'delivery')),
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

  -- Reglas de negocio, garantizadas por la DB:
  constraint delivery_requires_address check (
    delivery_method = 'pickup'
    or (delivery_address is not null and delivery_city is not null)
  ),
  constraint cash_only_for_pickup check (
    payment_method <> 'cash' or delivery_method = 'pickup'
  ),
  constraint pickup_is_not_shipped check (
    not (delivery_method = 'pickup' and status = 'shipped')
  ),
  constraint delivery_is_not_ready_for_pickup check (
    not (delivery_method = 'delivery' and status = 'ready_for_pickup')
  )
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_created_at_idx on public.orders (status, created_at desc);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. order_items — qué se compró (snapshot de nombre y precio)
-- -----------------------------------------------------------------------------

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  variant_id    uuid not null references public.product_variants (id), -- restrict: no se borra una variante vendida
  product_name  text not null,   -- snapshot: "Dior Sauvage EDT"
  variant_label text not null,   -- snapshot: "Decant 5 ml"
  unit_price    numeric(12, 2) not null check (unit_price >= 0), -- snapshot del precio
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) generated always as (unit_price * quantity) stored
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

-- -----------------------------------------------------------------------------
-- 7. stock_movements — ledger de stock (fuente de verdad)
-- -----------------------------------------------------------------------------

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.product_variants (id) on delete cascade,
  movement_type text not null check (movement_type in (
                  'initial_stock', 'restock', 'sale', 'order_cancelled', 'adjustment', 'damaged'
                )),
  quantity      integer not null check (quantity <> 0), -- con signo: +entra / -sale
  reference_id  uuid,  -- id del pedido cuando aplica
  note          text,
  created_by    uuid references auth.users (id),
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
  update public.product_variants
  set stock = stock + new.quantity
  where id = new.variant_id;
  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- -----------------------------------------------------------------------------
-- 8. perfume_requests — encargos (agotados o perfumes que FALBER no tiene)
-- -----------------------------------------------------------------------------

create table public.perfume_requests (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id),
  variant_id   uuid references public.product_variants (id) on delete set null, -- caso A: existe pero está agotado
  perfume_name text not null check (length(trim(perfume_name)) between 2 and 120),
  brand        text,
  presentation text,
  note         varchar(100),
  status       text not null default 'pending' check (status in (
                 'pending', 'contacted', 'quoted', 'sourcing', 'completed', 'cancelled'
               )),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
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
-- Cancelación de pedidos: devuelve el stock automáticamente
-- -----------------------------------------------------------------------------

create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'ORDER_ALREADY_CANCELLED: un pedido cancelado no se reabre, creá uno nuevo';
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

-- -----------------------------------------------------------------------------
-- RPC: create_order — ÚNICA forma de crear un pedido
-- Atómica: si algo falla (stock, precio, datos), no queda nada a medio crear.
-- -----------------------------------------------------------------------------

create or replace function public.create_order(
  p_full_name            text,
  p_whatsapp             text,
  p_email                text,
  p_payment_method       text,
  p_delivery_method      text,
  p_delivery_address     text,
  p_delivery_city        text,
  p_delivery_postal_code text,
  p_delivery_reference   text,
  p_order_note           text,
  p_items                jsonb  -- [{"variant_id": "uuid", "quantity": 2}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id    uuid;
  v_order_id       uuid;
  v_order_number   text;
  v_subtotal       numeric(12, 2) := 0;
  v_pending_orders integer;
  v_line           record;
  v_variant        record;
begin
  -- 1. Validar el carrito
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- 2. Cliente: upsert por WhatsApp (checkout como invitado)
  insert into customers (full_name, whatsapp, email)
  values (trim(p_full_name), p_whatsapp, nullif(trim(p_email), ''))
  on conflict (whatsapp) do update
    set full_name = excluded.full_name,
        email     = coalesce(excluded.email, customers.email)
  returning id into v_customer_id;

  -- 3. Anti-abuso: los pedidos pendientes reservan stock, así que se limitan
  select count(*) into v_pending_orders
  from orders
  where customer_id = v_customer_id and status = 'pending';

  if v_pending_orders >= 3 then
    raise exception 'TOO_MANY_PENDING_ORDERS';
  end if;

  -- 4. Crear la cabecera del pedido (el subtotal se completa abajo)
  insert into orders (
    customer_id, payment_method, delivery_method,
    delivery_address, delivery_city, delivery_postal_code, delivery_reference,
    order_note, subtotal
  )
  values (
    v_customer_id, p_payment_method, p_delivery_method,
    nullif(trim(p_delivery_address), ''), nullif(trim(p_delivery_city), ''),
    nullif(trim(p_delivery_postal_code), ''), nullif(trim(p_delivery_reference), ''),
    nullif(trim(p_order_note), ''), 0
  )
  returning id, order_number into v_order_id, v_order_number;

  -- 5. Ítems: se agrupan por variante (por si viene repetida) y se ordenan por id
  --    para bloquear filas siempre en el mismo orden (evita deadlocks).
  for v_line in
    select (e ->> 'variant_id')::uuid as variant_id,
           sum((e ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.quantity is null or v_line.quantity < 1 or v_line.quantity > 10 then
      raise exception 'INVALID_QUANTITY: %', v_line.variant_id;
    end if;

    -- Precio y stock REALES, con la fila bloqueada hasta el fin de la transacción
    select v.id, v.price, v.stock, v.is_available, v.variant_type, v.size_ml,
           p.name as product_name, p.status as product_status
    into v_variant
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = v_line.variant_id
    for update of v;

    if not found or not v_variant.is_available or v_variant.product_status <> 'active' then
      raise exception 'VARIANT_UNAVAILABLE: %', v_line.variant_id;
    end if;

    if v_variant.stock < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK: %', v_line.variant_id;
    end if;

    insert into order_items (order_id, variant_id, product_name, variant_label, unit_price, quantity)
    values (
      v_order_id,
      v_variant.id,
      v_variant.product_name,
      case v_variant.variant_type when 'decant' then 'Decant ' else 'Frasco ' end
        || v_variant.size_ml || ' ml',
      v_variant.price,
      v_line.quantity
    );

    -- Reserva el stock (el trigger descuenta product_variants.stock)
    insert into stock_movements (variant_id, movement_type, quantity, reference_id, note)
    values (v_variant.id, 'sale', -v_line.quantity, v_order_id, v_order_number);

    v_subtotal := v_subtotal + v_variant.price * v_line.quantity;
  end loop;

  update orders set subtotal = v_subtotal where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: create_perfume_request — encargo de un perfume
-- -----------------------------------------------------------------------------

create or replace function public.create_perfume_request(
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
  v_customer_id uuid;
  v_request_id  uuid;
begin
  insert into customers (full_name, whatsapp)
  values (trim(p_full_name), p_whatsapp)
  on conflict (whatsapp) do update set full_name = excluded.full_name
  returning id into v_customer_id;

  insert into perfume_requests (customer_id, variant_id, perfume_name, brand, presentation, note)
  values (
    v_customer_id, p_variant_id, trim(p_perfume_name),
    nullif(trim(p_brand), ''), nullif(trim(p_presentation), ''), nullif(trim(p_note), '')
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
    'order_number',    o.order_number,
    'status',          o.status,
    'payment_method',  o.payment_method,
    'delivery_method', o.delivery_method,
    'subtotal',        o.subtotal,
    'shipping_cost',   o.shipping_cost,
    'total',           o.total,
    'created_at',      o.created_at,
    'customer_first_name', split_part(c.full_name, ' ', 1),
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
  join customers c on c.id = o.customer_id
  where o.id = p_order_id;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de las funciones
-- Las RPC públicas solo las ejecuta el SERVIDOR (service_role), nunca el navegador.
-- Así el rate limiting / captcha del Server Action no se puede saltear llamando
-- a la API de Supabase directo con la anon key.
-- -----------------------------------------------------------------------------

revoke execute on function public.create_order(text, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.create_perfume_request(text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.get_order_summary(uuid) from public, anon, authenticated;

grant execute on function public.create_order(text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.create_perfume_request(text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.get_order_summary(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Permisos de columnas: el stock no se puede escribir directo, ni siquiera el admin.
-- Las correcciones se hacen insertando un movimiento 'adjustment'.
-- -----------------------------------------------------------------------------

revoke insert, update on public.product_variants from anon, authenticated;
grant insert (product_id, variant_type, size_ml, price, is_available) on public.product_variants to authenticated;
grant update (variant_type, size_ml, price, is_available) on public.product_variants to authenticated;

-- El ledger es inmutable: se agrega, nunca se edita ni se borra.
revoke update, delete on public.stock_movements from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers        enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.perfume_requests enable row level security;

-- Catálogo: público ve lo activo; admin ve y gestiona todo.
create policy "catalog: public reads active products"
  on public.products for select
  to anon, authenticated
  using (status = 'active' or public.is_admin());

create policy "catalog: admin manages products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "catalog: public reads variants of active products"
  on public.product_variants for select
  to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

create policy "catalog: admin manages variants"
  on public.product_variants for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Datos de negocio y personales: SOLO admin. Sin políticas para anon = sin acceso.
create policy "admin: customers"
  on public.customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin: orders"
  on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin: order_items"
  on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin: read stock movements"
  on public.stock_movements for select to authenticated
  using (public.is_admin());

create policy "admin: add stock movements"
  on public.stock_movements for insert to authenticated
  with check (public.is_admin());

create policy "admin: perfume_requests"
  on public.perfume_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage: fotos de productos (lectura pública, escritura solo admin)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: admin uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- =============================================================================
-- Alta del primer admin (manual, una sola vez):
--   1. Supabase Dashboard → Authentication → Add user (tu email + contraseña).
--   2. Copiar el UUID del usuario y ejecutar:
--        insert into public.profiles (id, display_name) values ('<UUID>', 'Facundo');
-- =============================================================================
