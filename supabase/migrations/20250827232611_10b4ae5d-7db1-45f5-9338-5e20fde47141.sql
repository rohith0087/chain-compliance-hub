-- Create scheduled cron jobs for knowledge base maintenance

-- Daily refresh job (runs at 2 AM UTC)
SELECT cron.schedule(
  'knowledge-daily-refresh',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/knowledge-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'mode', 'daily_refresh'
    )
  ) as request_id;
  $$
);

-- Weekly cleanup job (runs every Sunday at 3 AM UTC)
SELECT cron.schedule(
  'knowledge-weekly-cleanup',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/knowledge-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'mode', 'cleanup'
    )
  ) as request_id;
  $$
);

-- Monthly full refresh job (runs on the 1st of every month at 4 AM UTC)
SELECT cron.schedule(
  'knowledge-monthly-full-refresh',
  '0 4 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/knowledge-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'mode', 'full_refresh'
    )
  ) as request_id;
  $$
);