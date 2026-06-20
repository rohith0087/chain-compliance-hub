-- Evidence extraction performs storage download plus model inference and can
-- legitimately exceed pg_net's short default timeout.

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'process-evidence-extraction-jobs';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;

select cron.schedule(
  'process-evidence-extraction-jobs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-evidence-extraction-jobs-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-System-Secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'system_cron_invocation'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
