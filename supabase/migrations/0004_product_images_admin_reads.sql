-- =============================================================================
-- 0004 — El admin puede leer los objetos del bucket de fotos (Fase 7)
--
-- Storage borra a través de RLS sobre storage.objects: remove() necesita las policies
-- de delete Y de select. 0001 creó insert, update y delete, pero no select, así que el
-- admin "no veía" los objetos y borrar la foto anterior afectaba 0 filas, sin error.
-- Cada cambio de foto dejaba la anterior huérfana en el bucket.
--
-- Solo el admin: el bucket es público para descargar por URL (no pasa por RLS), pero
-- listar los objetos sigue cerrado para anon y para un usuario sin perfil de admin.
-- Tests: supabase/tests/schema.test.cjs → [15].
-- =============================================================================

do $storage$
begin
  -- Sin las tablas de Storage (arranque local), no hay nada que crear: 0001 ya decidió
  -- si eso es válido.
  if to_regclass('storage.objects') is not null then
    create policy "product-images: admin reads"
      on storage.objects for select to authenticated
      using (bucket_id = 'product-images' and (select public.is_admin()));
  end if;
end
$storage$;
