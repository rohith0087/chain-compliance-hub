-- Phase 4 (plasma_clone/update.md): gap detection -> risk signals -> tasks ->
-- notifications, all derived from the Phase 3 chain resolver's computed
-- statuses in compliance_current_status. Set-based across all buyers in one
-- pass so it scales to thousands of suppliers; runs on a 15-minute cron.

-- 1) Risk signals -------------------------------------------------------------
create table if not exists public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  subject_type text not null check (subject_type in ('supplier','facility','product')),
  subject_id uuid not null,
  framework_code text not null,
  framework_version text not null,
  requirement_key text not null,
  requirement_title text,
  signal_type text not null check (signal_type in
    ('missing_evidence','requested_pending','expired_evidence','rejected_evidence','awaiting_review')),
  weight numeric not null,
  explanation text,
  status text not null default 'open' check (status in ('open','resolved')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists risk_signals_open_key
  on public.risk_signals (buyer_id, subject_type, subject_id, framework_code, requirement_key, signal_type)
  where status = 'open';
create index if not exists risk_signals_buyer_open_idx
  on public.risk_signals (buyer_id, weight desc) where status = 'open';

alter table public.risk_signals enable row level security;
create policy risk_signals_buyer_read on public.risk_signals
  for select using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

-- 2) Gap detection engine -----------------------------------------------------
create or replace function public.detect_compliance_gaps_v1(p_buyer_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_signals_opened int := 0;
  v_signals_resolved int := 0;
  v_tasks_created int := 0;
  v_tasks_cancelled int := 0;
begin
  -- Gap statuses derived from the chain resolver's computed outcomes.
  drop table if exists _gaps;
  create temp table _gaps on commit drop as
  select ccs.buyer_id, ccs.subject_type, ccs.subject_id,
         case when ccs.subject_type = 'supplier' then ccs.subject_id else null end as supplier_id,
         ccs.framework_code, ccs.framework_version, ccs.requirement_key, ccs.title,
         ccs.decision_result_id, ccs.explanation,
         case ccs.outcome
           when 'expired' then 'expired_evidence'
           when 'missing' then 'missing_evidence'
           when 'noncompliant' then 'rejected_evidence'
           when 'under_review' then 'awaiting_review'
           when 'requested' then 'requested_pending'
         end as signal_type,
         case ccs.outcome
           when 'expired' then 1.0
           when 'missing' then 0.9
           when 'noncompliant' then 0.9
           when 'under_review' then 0.6
           when 'requested' then 0.5
         end::numeric as weight
  from public.compliance_current_status ccs
  where ccs.outcome in ('expired','missing','noncompliant','under_review','requested')
    and (p_buyer_id is null or ccs.buyer_id = p_buyer_id);

  -- Open signals for current gaps (idempotent on the open-signal key).
  with inserted as (
    insert into public.risk_signals
      (buyer_id, supplier_id, subject_type, subject_id, framework_code, framework_version,
       requirement_key, requirement_title, signal_type, weight, explanation)
    select g.buyer_id, g.supplier_id, g.subject_type, g.subject_id, g.framework_code,
           g.framework_version, g.requirement_key, g.title, g.signal_type, g.weight, g.explanation
    from _gaps g
    on conflict (buyer_id, subject_type, subject_id, framework_code, requirement_key, signal_type)
      where status = 'open'
    do nothing
    returning 1
  )
  select count(*) into v_signals_opened from inserted;

  -- Resolve open signals whose gap no longer exists (status moved on).
  with resolved as (
    update public.risk_signals rs
    set status = 'resolved', resolved_at = now()
    where rs.status = 'open'
      and (p_buyer_id is null or rs.buyer_id = p_buyer_id)
      and not exists (
        select 1 from _gaps g
        where g.buyer_id = rs.buyer_id and g.subject_type = rs.subject_type
          and g.subject_id = rs.subject_id and g.framework_code = rs.framework_code
          and g.requirement_key = rs.requirement_key and g.signal_type = rs.signal_type
      )
    returning 1
  )
  select count(*) into v_signals_resolved from resolved;

  -- Auto-create tasks for actionable gaps (one open task per decision result
  -- and task type). Reviews for awaiting_review; corrective action otherwise.
  with new_tasks as (
    insert into public.compliance_tasks
      (buyer_id, supplier_id, subject_type, subject_id, decision_result_id, task_type, title, description, status)
    select distinct on (g.decision_result_id, task.task_type)
           g.buyer_id, g.supplier_id, g.subject_type, g.subject_id, g.decision_result_id,
           task.task_type, task.title, g.explanation, 'open'
    from _gaps g
    cross join lateral (
      select case when g.signal_type = 'awaiting_review' then 'review' else 'corrective_action' end as task_type,
             case when g.signal_type = 'awaiting_review'
               then 'Review evidence: ' || coalesce(g.title, g.requirement_key)
               else 'Obtain evidence: ' || coalesce(g.title, g.requirement_key)
             end as title
    ) task
    where g.signal_type in ('awaiting_review','missing_evidence','expired_evidence','rejected_evidence')
      and not exists (
        select 1 from public.compliance_tasks t
        where t.decision_result_id = g.decision_result_id
          and t.task_type = task.task_type
          and t.status in ('open','in_progress')
      )
    returning id, buyer_id, subject_type, subject_id, title, task_type
  ), events as (
    insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
    select buyer_id, subject_type, subject_id, 'task_created',
           jsonb_build_object('task_id', id, 'title', title, 'task_type', task_type, 'source', 'gap_detection')
    from new_tasks
    returning 1
  )
  select count(*) into v_tasks_created from new_tasks;

  -- Auto-cancel gap tasks whose requirement is no longer gapped.
  with cancelled as (
    update public.compliance_tasks t
    set status = 'cancelled', updated_at = now()
    where t.status in ('open','in_progress')
      and t.decision_result_id is not null
      and (p_buyer_id is null or t.buyer_id = p_buyer_id)
      and t.created_by is null -- only tasks this engine created
      and not exists (select 1 from _gaps g where g.decision_result_id = t.decision_result_id)
    returning 1
  )
  select count(*) into v_tasks_cancelled from cancelled;

  return jsonb_build_object(
    'signals_opened', v_signals_opened,
    'signals_resolved', v_signals_resolved,
    'tasks_created', v_tasks_created,
    'tasks_cancelled', v_tasks_cancelled
  );
end;
$function$;

-- 3) Command Center summary (single round trip for the dashboard) -------------
create or replace function public.command_center_summary_v1(p_buyer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.has_organization_access(auth.uid(), p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  return jsonb_build_object(
    'outcome_counts', coalesce((
      select jsonb_object_agg(outcome, cnt) from (
        select outcome, count(*) as cnt
        from public.compliance_current_status
        where buyer_id = p_buyer_id group by outcome
      ) oc), '{}'::jsonb),
    'open_signal_count', (select count(*) from public.risk_signals where buyer_id = p_buyer_id and status = 'open'),
    'open_task_count', (select count(*) from public.compliance_tasks where buyer_id = p_buyer_id and status in ('open','in_progress')),
    'top_signals', coalesce((
      select jsonb_agg(row_to_json(s)) from (
        select rs.id, rs.signal_type, rs.weight, rs.framework_code, rs.requirement_title,
               rs.requirement_key, rs.explanation, rs.detected_at, sup.company_name as supplier_name
        from public.risk_signals rs
        left join public.suppliers sup on sup.id = rs.supplier_id
        where rs.buyer_id = p_buyer_id and rs.status = 'open'
        order by rs.weight desc, rs.detected_at asc limit 20
      ) s), '[]'::jsonb),
    'open_tasks', coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select ct.id, ct.task_type, ct.title, ct.status, ct.due_date, ct.created_at,
               sup.company_name as supplier_name
        from public.compliance_tasks ct
        left join public.suppliers sup on sup.id = ct.supplier_id
        where ct.buyer_id = p_buyer_id and ct.status in ('open','in_progress')
        order by ct.created_at desc limit 20
      ) t), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.command_center_summary_v1(uuid) to authenticated;

-- 4) Schedule the engine (15-minute cadence; set-based across all buyers)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'detect-compliance-gaps') then
    perform cron.schedule('detect-compliance-gaps', '*/15 * * * *',
      'select public.detect_compliance_gaps_v1();');
  end if;
end $$;
