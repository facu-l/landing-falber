-- Solo local: `supabase start` / `db reset` ejecutan este archivo ANTES de las migraciones.
-- Nunca se aplica en la nube.
--
-- Rol marcador de entorno local (sin login ni permisos). 0001 lo usa para tolerar
-- que storage-api todavía no creó sus tablas; en la nube el rol no existe y esa
-- misma situación hace fallar la migración.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'falber_local_dev') then
    create role falber_local_dev nologin;
  end if;
end
$$;
