-- The chain trigger picked the predecessor via ORDER BY occurred_at DESC, id
-- DESC; rows written in the same transaction share occurred_at and random
-- UUIDs break the tie arbitrarily, so appends could link to the wrong row and
-- fork the chain (observed on dossier f4b74591). Introduce a monotonic seq to
-- make append order explicit, serialize appends per dossier, and rebuild the
-- existing (dev) chains in true insertion order.

-- 1) Monotonic sequence column
alter table public.dossier_audit_log add column if not exists seq bigint;
create sequence if not exists public.dossier_audit_log_seq_seq
  owned by public.dossier_audit_log.seq;

-- Backfill in true insertion order. For same-transaction ties, generation
-- events precede signing events; anything else keeps timestamp order.
alter table public.dossier_audit_log disable trigger protect_dossier_audit_log_update;

with ordered as (
  select id, row_number() over (
    order by occurred_at,
             case event_type when 'generated' then 0 when 'signed' then 1 else 2 end,
             id
  ) as rn
  from public.dossier_audit_log
)
update public.dossier_audit_log l set seq = o.rn from ordered o where l.id = o.id;

select setval('public.dossier_audit_log_seq_seq',
  coalesce((select max(seq) from public.dossier_audit_log), 1));
alter table public.dossier_audit_log
  alter column seq set default nextval('public.dossier_audit_log_seq_seq');
alter table public.dossier_audit_log alter column seq set not null;
create unique index if not exists dossier_audit_log_seq_key
  on public.dossier_audit_log (seq);

-- 2) Rebuild each dossier's chain in seq order (repairs the fork; idempotent
-- for already-consistent chains). Dev-data repair, recorded here explicitly.
do $$
declare
  r record;
  v_prev text := null;
  v_dossier uuid := null;
  v_hash text;
begin
  for r in select * from public.dossier_audit_log order by dossier_id, seq loop
    if v_dossier is distinct from r.dossier_id then
      v_prev := null;
      v_dossier := r.dossier_id;
    end if;
    v_hash := private.compute_dossier_audit_row_hash(
      v_prev, r.event_type, r.dossier_id, r.version_id,
      r.actor_id, r.occurred_at, r.metadata);
    update public.dossier_audit_log
      set prev_hash = v_prev, row_hash = v_hash
      where id = r.id;
    v_prev := v_hash;
  end loop;
end $$;

alter table public.dossier_audit_log enable trigger protect_dossier_audit_log_update;

-- 3) Writer trigger: serialize per-dossier appends and follow seq, not
-- timestamps, so the predecessor is always the true latest row.
create or replace function private.chain_dossier_audit_log_row()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_prev_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended('dossier_audit_log:' || new.dossier_id::text, 0));

  select row_hash into v_prev_hash
  from public.dossier_audit_log
  where dossier_id = new.dossier_id
  order by seq desc
  limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := private.compute_dossier_audit_row_hash(
    v_prev_hash, new.event_type, new.dossier_id, new.version_id,
    new.actor_id, new.occurred_at, new.metadata
  );
  return new;
end;
$function$;
