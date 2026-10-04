-- =============================================================================
-- FALBER — Tareas programadas (pg_cron)
-- Migración 0002. Separada de 0001 porque pg_cron solo existe en Supabase:
-- así 0001 se puede probar en local con PGlite (supabase/tests/schema.test.cjs).
--
-- Requisito: Supabase Dashboard → Database → Extensions → habilitar "pg_cron".
-- Las funciones que se agendan están definidas y testeadas en 0001.
-- =============================================================================

create extension if not exists pg_cron;

-- Cada hora: cancela pedidos 'pending' de más de 48 h (el trigger devuelve el stock).
select cron.schedule(
  'falber-cancel-stale-orders',
  '0 * * * *',
  $$ select public.cancel_stale_orders(interval '48 hours'); $$
);

-- Todos los días a las 04:00 UTC: borra eventos de anti-abuso de más de un día.
select cron.schedule(
  'falber-purge-rate-limit-events',
  '0 4 * * *',
  $$ select public.purge_rate_limit_events(); $$
);

-- Para ver las ejecuciones:  select * from cron.job_run_details order by start_time desc limit 20;
-- Para desagendar:           select cron.unschedule('falber-cancel-stale-orders');
