-- verify-dossier-signature-v1 calls this RPC with the service-role client,
-- where auth.uid() is null, so has_organization_access always failed and the
-- edge function 500'd. Service-role callers perform their own buyer access
-- check (hasBuyerAccess) before invoking, so they may bypass the in-function
-- check; direct client calls keep the original guard.
create or replace function public.verify_dossier_audit_chain_v1(p_dossier_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_row record;
  v_prev_hash text := null;
  v_expected text;
begin
  select buyer_id into v_buyer_id from public.compliance_dossiers where id = p_dossier_id;
  if v_buyer_id is null then
    raise exception 'Dossier not found';
  end if;
  if not (auth.role() = 'service_role'
          or private.has_organization_access(v_actor_id, v_buyer_id, 'buyer')) then
    raise exception 'Buyer access required';
  end if;

  for v_row in
    select * from public.dossier_audit_log
    where dossier_id = p_dossier_id
    order by occurred_at, id
  loop
    if v_row.prev_hash is distinct from v_prev_hash then
      return jsonb_build_object('valid', false, 'broken_at_row_id', v_row.id, 'reason', 'prev_hash mismatch');
    end if;

    v_expected := private.compute_dossier_audit_row_hash(
      v_row.prev_hash, v_row.event_type, v_row.dossier_id, v_row.version_id,
      v_row.actor_id, v_row.occurred_at, v_row.metadata
    );
    if v_expected is distinct from v_row.row_hash then
      return jsonb_build_object('valid', false, 'broken_at_row_id', v_row.id, 'reason', 'row_hash mismatch');
    end if;

    v_prev_hash := v_row.row_hash;
  end loop;

  return jsonb_build_object('valid', true, 'broken_at_row_id', null, 'reason', null);
end;
$function$;
