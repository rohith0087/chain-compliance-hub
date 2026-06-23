begin;
select plan(25);

select has_table('public','email_deliveries','durable email delivery ledger exists');
select has_table('public','email_delivery_requests','deliveries link to document requests');
select has_table('public','email_delivery_events','provider webhook events are retained');
select has_table('public','request_reminder_policies','buyer reminder policies exist');
select has_table('public','supplier_upload_sessions','transactional upload sessions exist');

select ok((select relrowsecurity from pg_class where oid='public.email_deliveries'::regclass),'delivery ledger has RLS');
select ok((select relrowsecurity from pg_class where oid='public.email_delivery_requests'::regclass),'delivery links have RLS');
select ok((select relrowsecurity from pg_class where oid='public.email_delivery_events'::regclass),'webhook events have RLS');
select ok((select relrowsecurity from pg_class where oid='public.request_reminder_policies'::regclass),'reminder policies have RLS');
select ok((select relrowsecurity from pg_class where oid='public.supplier_upload_sessions'::regclass),'upload sessions have RLS');

select has_column('public','email_deliveries','provider_message_id','Resend message ID is retained');
select has_column('public','email_deliveries','dedupe_key','application deduplication is permanent');
select has_column('public','email_deliveries','transport_last_event_at','transport ordering is independent of engagement');
select has_column('public','supplier_upload_sessions','sha256','upload content hash is retained');
select has_column('public','supplier_upload_sessions','scan_status','malware scan state is retained');

select has_function('public','claim_email_deliveries_v1',array['integer'],'delivery claim is atomic');
select has_function('public','create_supplier_upload_session_v1',array['uuid','text','text','text','bigint','date','boolean','text','text','uuid[]'],'upload session creation exists');
select has_function('public','complete_supplier_upload_v1',array['uuid','uuid','text','bigint','text','text','text','jsonb'],'upload completion exists');

select ok(not has_function_privilege('anon','public.create_supplier_upload_session_v1(uuid,text,text,text,bigint,date,boolean,text,text,uuid[])','EXECUTE'),'anonymous users cannot create upload sessions');
select ok(has_function_privilege('authenticated','public.create_supplier_upload_session_v1(uuid,text,text,text,bigint,date,boolean,text,text,uuid[])','EXECUTE'),'authenticated suppliers can attempt session creation');
select ok(not has_function_privilege('authenticated','public.claim_email_deliveries_v1(integer)','EXECUTE'),'users cannot claim delivery jobs');
select ok(has_function_privilege('service_role','public.claim_email_deliveries_v1(integer)','EXECUTE'),'service worker can claim delivery jobs');
select ok(not has_function_privilege('authenticated','public.complete_supplier_upload_v1(uuid,uuid,text,bigint,text,text,text,jsonb)','EXECUTE'),'suppliers cannot bypass malware scanning finalization');

select is((select default_enabled from public.feature_flags where key='request_reminders_v1'),false,'reminders default off');
select is((select default_enabled from public.feature_flags where key='transactional_supplier_upload_v1'),false,'transactional upload defaults off');

select * from finish();
rollback;
