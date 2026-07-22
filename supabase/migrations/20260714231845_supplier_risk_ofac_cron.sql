-- Supplier Risk — Slice 2: schedule the OFAC connector weekly (Mon 06:00 UTC).
-- Invokes the ingest-ofac-sanctions edge function via pg_net, authorizing with
-- the vault-backed system cron secret (same pattern as the other scheduled jobs).
-- Idempotent: drop any existing job of the same name first.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-ofac-sanctions-weekly';

SELECT cron.schedule(
  'ingest-ofac-sanctions-weekly',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/ingest-ofac-sanctions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-System-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'system_cron_invocation')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);
