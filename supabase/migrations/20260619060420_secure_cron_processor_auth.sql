-- Scheduled Edge Function invocations need a credential, but hosted projects
-- do not expose app.supabase_service_role_key as a database setting. Keep a
-- dedicated random invocation secret in Vault and only store its SHA-256 hash
-- in the private schema for server-side verification.

create table if not exists private.system_cron_secrets (
  name text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

revoke all on table private.system_cron_secrets from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'system_cron_invocation'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'system_cron_invocation',
      'Shared secret for authenticated pg_cron Edge Function invocations'
    );
  end if;
end;
$$;

insert into private.system_cron_secrets (name, secret_hash)
select
  'system_cron_invocation',
  encode(extensions.digest(decrypted_secret, 'sha256'), 'hex')
from vault.decrypted_secrets
where name = 'system_cron_invocation'
on conflict (name) do update
set secret_hash = excluded.secret_hash,
    rotated_at = now();

create or replace function public.verify_system_cron_secret_v1(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.system_cron_secrets s
    where s.name = 'system_cron_invocation'
      and s.secret_hash = encode(
        extensions.digest(coalesce(p_secret, ''), 'sha256'),
        'hex'
      )
  );
$$;

revoke all on function public.verify_system_cron_secret_v1(text) from public, anon, authenticated;
grant execute on function public.verify_system_cron_secret_v1(text) to service_role;

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
    body := '{}'::jsonb
  ) as request_id;
  $$
);
