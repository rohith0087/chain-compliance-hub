-- Slice 6: schedule the recall/enforcement connectors weekly (staggered after OFAC).
-- Idempotent: drop any existing job of the same name first.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-cpsc-recalls-weekly';
SELECT cron.schedule(
  'ingest-cpsc-recalls-weekly', '15 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/ingest-cpsc-recalls',
    headers := jsonb_build_object('Content-Type','application/json',
      'X-System-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'system_cron_invocation')),
    body := '{}'::jsonb, timeout_milliseconds := 150000) AS request_id;
  $$
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-openfda-enforcement-weekly';
SELECT cron.schedule(
  'ingest-openfda-enforcement-weekly', '30 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/ingest-openfda-enforcement',
    headers := jsonb_build_object('Content-Type','application/json',
      'X-System-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'system_cron_invocation')),
    body := '{}'::jsonb, timeout_milliseconds := 150000) AS request_id;
  $$
);
