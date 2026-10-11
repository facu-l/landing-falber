-- =============================================================================
-- 0003 — Admin de catálogo (Fase 7, decisiones 91 a 98)
--
-- Primera migración después del deploy: 0001 está congelada. Las reglas viven acá
-- y valen también para Supabase Studio, no solo para el panel.
--   1. Los productos nacen sin publicar (91).
--   2. Publicar exige foto y una presentación disponible; un publicado nunca queda
--      sin foto (93).
--   3. El slug no cambia nunca (94).
--   4. Productos y presentaciones se ocultan, no se borran (95).
--   5. Tipo y ml de una presentación quedan fijos al crearla (98).
--   6. Nadie desde la API vacía una tabla con TRUNCATE (TODOS.md).
--   7. Límites del bucket de fotos (97).
-- Tests: supabase/tests/schema.test.cjs → [14].
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Un producto nuevo no se ve en la tienda a medio cargar.
-- -----------------------------------------------------------------------------

alter table public.products alter column status set default 'inactive';

-- -----------------------------------------------------------------------------
-- 2. Publicar. La foto se exige siempre que el producto quede publicado: no tiene un
--    estado intermedio válido. Las presentaciones se miran solo al publicar: sacar la
--    última de un publicado no lo despublica (la tienda ya muestra el caso sin opciones).
--    Sin stock sí se publica: agotado lleva a "Encargar".
--    detail = 'image' | 'variant': el panel lo usa para decir qué falta.
-- -----------------------------------------------------------------------------

create or replace function public.guard_product_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  if new.image_path is null or length(trim(new.image_path)) = 0 then
    raise exception using
      message = 'PRODUCT_NOT_PUBLISHABLE',
      detail  = 'image',
      hint    = 'Un producto publicado necesita foto.';
  end if;

  if (tg_op = 'INSERT' or old.status <> 'active') and not exists (
    select 1 from public.product_variants v
    where v.product_id = new.id and v.is_available
  ) then
    raise exception using
      message = 'PRODUCT_NOT_PUBLISHABLE',
      detail  = 'variant',
      hint    = 'Para publicar hace falta al menos una presentación disponible.';
  end if;

  return new;
end;
$$;

create trigger products_guard_publish
  before insert or update on public.products
  for each row execute function public.guard_product_publish();

-- -----------------------------------------------------------------------------
-- 3. El slug se arma al crear el producto y no cambia: los links compartidos y
--    /encargos?producto=<slug> siguen andando aunque se corrija el nombre.
-- -----------------------------------------------------------------------------

create or replace function public.guard_product_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception using
      message = 'SLUG_LOCKED',
      detail  = old.slug,
      hint    = 'El slug no cambia: es el link del producto.';
  end if;
  return new;
end;
$$;

create trigger products_slug_locked
  before update of slug on public.products
  for each row execute function public.guard_product_slug();

-- -----------------------------------------------------------------------------
-- 4. Ocultar, nunca borrar: pedidos e historial de stock los referencian. La policy
--    "for all" del admin dejaba borrar un producto sin historial (y el cascade se
--    llevaba sus presentaciones).
-- -----------------------------------------------------------------------------

revoke delete on public.products, public.product_variants from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Si "Decant 5 ml" pasara a ser "Decant 10 ml", su historial de stock y sus
--    pedidos hablarían de otra cosa. Para corregir: crear la correcta y marcar la
--    otra no disponible. Precio y disponible se siguen editando.
-- -----------------------------------------------------------------------------

revoke update (variant_type, size_ml) on public.product_variants from authenticated;

-- -----------------------------------------------------------------------------
-- 6. TRUNCATE no pasa por RLS y Supabase lo otorga por defecto. PostgREST no lo
--    expone, pero contradice "nadie borra el historial". También para las tablas
--    que se creen después (las crea el mismo rol que corre las migraciones).
-- -----------------------------------------------------------------------------

revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Bucket de fotos: 5 MiB, WebP o JPEG. El navegador achica la foto antes de subir,
--    pero esa validación se saltea; la del bucket no. En local lo hace también
--    supabase/config.toml; si Storage no tiene tablas todavía (local), no hay nada
--    que actualizar (0001 ya decidió si eso es válido).
-- -----------------------------------------------------------------------------

do $storage$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
    set file_size_limit    = 5 * 1024 * 1024,
        allowed_mime_types = array['image/webp', 'image/jpeg']
    where id = 'product-images';
  end if;
end
$storage$;
