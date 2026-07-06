-- Consolidation #5: let buyers act on compliance tasks (assign / start /
-- complete / reopen) with proper attribution, and emit a task_completed
-- domain event so notifications and downstream consumers stay in sync.
-- Buyer read policy so the Command Center can list tasks under RLS.

alter table public.compliance_tasks enable row level security;

drop policy if exists compliance_tasks_buyer_read on public.compliance_tasks;
create policy compliance_tasks_buyer_read on public.compliance_tasks
  for select using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create or replace function public.update_compliance_task_v1(
  p_task_id uuid,
  p_action text,               -- 'assign' | 'start' | 'complete' | 'reopen'
  p_assignee_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_task public.compliance_tasks%rowtype;
  v_new_status text;
begin
  select * into v_task from public.compliance_tasks where id = p_task_id;
  if v_task.id is null then raise exception 'Task not found'; end if;
  if not private.has_organization_access(v_actor, v_task.buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  if p_action = 'assign' then
    update public.compliance_tasks
      set assignee_id = p_assignee_id, updated_at = now()
      where id = p_task_id;
  elsif p_action = 'start' then
    update public.compliance_tasks
      set status = 'in_progress', updated_at = now()
      where id = p_task_id;
  elsif p_action = 'complete' then
    update public.compliance_tasks
      set status = 'done', completed_by = v_actor, completed_at = now(), updated_at = now()
      where id = p_task_id;
    insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
    values (v_task.buyer_id, v_task.subject_type, v_task.subject_id, 'task_completed',
      jsonb_build_object('task_id', p_task_id, 'title', v_task.title, 'completed_by', v_actor));
  elsif p_action = 'reopen' then
    update public.compliance_tasks
      set status = 'open', completed_by = null, completed_at = null, updated_at = now()
      where id = p_task_id;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  select status into v_new_status from public.compliance_tasks where id = p_task_id;
  return jsonb_build_object('task_id', p_task_id, 'status', v_new_status);
end;
$function$;

grant execute on function public.update_compliance_task_v1(uuid, text, uuid) to authenticated;
