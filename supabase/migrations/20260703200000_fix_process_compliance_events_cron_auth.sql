-- The process-compliance-events cron authenticated with
-- 'Bearer ' || current_setting('app.supabase_service_role_key', true), but
-- that GUC is unset, so the bearer token was empty: the request failed JWT
-- verification (401), and once verify_jwt was disabled the function's own
-- service-role check rejected it (403). The dispatcher never ran, so buyer
-- compliance notifications were never delivered.
--
-- Align it with the working sibling processors: send the vault-backed
-- X-System-Secret, which the function now accepts via isAuthorizedCronRequest.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'process-compliance-events';
  if v_job_id is not null then
    perform cron.alter_job(
      job_id := v_job_id,
      command := $cmd$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-compliance-events-v1',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
    );
  end if;
end $$;
