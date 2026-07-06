-- Phase 5+ (plasma_clone): bring-your-own-AI. Each buyer org chooses a provider
-- (OpenAI / Anthropic / xAI), a model, and either uses our platform key or
-- brings their own. Customer keys are stored ONLY in Supabase Vault (encrypted)
-- and never returned to the client — the table holds a vault secret *name*, not
-- the key. Resolution happens server-side in edge functions.

create table if not exists public.organization_ai_settings (
  buyer_id uuid primary key references public.buyers(id) on delete cascade,
  provider text not null default 'openai' check (provider in ('openai','anthropic','xai')),
  model text not null default 'gpt-4o-mini',
  use_own_key boolean not null default false,
  vault_secret_name text,          -- reference into Vault; null when using our key
  has_own_key boolean not null default false,  -- surfaced to UI (never the key)
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.organization_ai_settings enable row level security;

-- Buyers can read their own settings (provider/model/flags) — never the key.
create policy organization_ai_settings_buyer_read
  on public.organization_ai_settings
  for select using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

-- Save settings + optionally store a customer key in Vault. Security definer so
-- the write path (Vault) is controlled; clients call it via RPC.
create or replace function public.set_org_ai_settings_v1(
  p_buyer_id uuid,
  p_provider text,
  p_model text,
  p_use_own_key boolean,
  p_api_key text default null   -- null = leave existing key untouched; '' = clear
) returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_secret_name text := 'org_ai_key_' || replace(p_buyer_id::text, '-', '');
  v_has_key boolean;
begin
  if not private.has_organization_access(v_actor, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if p_provider not in ('openai','anthropic','xai') then
    raise exception 'Unsupported provider %', p_provider;
  end if;
  if coalesce(p_model,'') = '' then
    raise exception 'Model is required';
  end if;

  -- Manage the vault secret when a key value is supplied.
  if p_api_key is not null then
    if length(trim(p_api_key)) = 0 then
      -- explicit clear
      delete from vault.secrets where name = v_secret_name;
    elsif exists (select 1 from vault.secrets where name = v_secret_name) then
      perform vault.update_secret(
        (select id from vault.secrets where name = v_secret_name), trim(p_api_key));
    else
      perform vault.create_secret(trim(p_api_key), v_secret_name, 'AI provider key for buyer ' || p_buyer_id::text);
    end if;
  end if;

  v_has_key := exists (select 1 from vault.secrets where name = v_secret_name);

  insert into public.organization_ai_settings
    (buyer_id, provider, model, use_own_key, vault_secret_name, has_own_key, updated_by, updated_at)
  values
    (p_buyer_id, p_provider, p_model, coalesce(p_use_own_key,false),
     case when v_has_key then v_secret_name else null end, v_has_key, v_actor, now())
  on conflict (buyer_id) do update set
    provider = excluded.provider,
    model = excluded.model,
    use_own_key = excluded.use_own_key,
    vault_secret_name = excluded.vault_secret_name,
    has_own_key = excluded.has_own_key,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object(
    'provider', p_provider, 'model', p_model,
    'use_own_key', coalesce(p_use_own_key,false), 'has_own_key', v_has_key);
end;
$function$;

grant execute on function public.set_org_ai_settings_v1(uuid, text, text, boolean, text) to authenticated;

-- Internal key resolver — service-role only (edge functions). Returns the
-- decrypted customer key, or null. Never granted to authenticated clients.
create or replace function public.get_org_ai_key_v1(p_buyer_id uuid)
 returns text
 language sql
 security definer
 set search_path to ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'org_ai_key_' || replace(p_buyer_id::text, '-', '')
  limit 1;
$function$;

revoke all on function public.get_org_ai_key_v1(uuid) from public, authenticated, anon;
grant execute on function public.get_org_ai_key_v1(uuid) to service_role;
