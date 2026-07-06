-- Phase 1+2 (plasma_clone/update.md): framework activation scoping + first
-- food-vertical framework seeds (SQF, FSMA-204, HACCP).
--
-- Global (owner_buyer_id null) frameworks previously applied to every buyer
-- the moment a version was published. buyer_framework_activations makes
-- inclusion opt-in per buyer, optionally scoped to a single supplier;
-- loadCatalogResults (edge shared code) filters on it.
--
-- Seed content is PARAPHRASED supplier-approval essentials, not standard
-- text (SQF/BRCGS content is copyrighted). Citations reference, they do not
-- reproduce.
--
-- Publication flow respects private.validate_framework_publication(): the
-- version is inserted as draft, requirements are attached, then it is
-- published with an active platform administrator as reviewer.

-- 1) Activation scoping ------------------------------------------------------
create table if not exists public.buyer_framework_activations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  framework_id uuid not null references public.requirement_frameworks(id) on delete cascade,
  -- null supplier_id = active for all of the buyer's connected suppliers
  supplier_id uuid references public.suppliers(id) on delete cascade,
  activated_by uuid references public.profiles(id),
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  notes text
);

create unique index if not exists buyer_framework_activations_active_key
  on public.buyer_framework_activations (
    buyer_id, framework_id,
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where deactivated_at is null;

create index if not exists buyer_framework_activations_buyer_idx
  on public.buyer_framework_activations (buyer_id) where deactivated_at is null;

alter table public.buyer_framework_activations enable row level security;

create policy buyer_framework_activations_buyer_all
  on public.buyer_framework_activations
  for all
  using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'))
  with check (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

-- 2) Food framework seeds ----------------------------------------------------
do $$
declare
  v_admin uuid;
  v_fw uuid;
  v_ver uuid;
  v_req uuid;
begin
  select auth_user_id into v_admin
  from public.platform_administrators where is_active = true limit 1;
  if v_admin is null then
    raise exception 'Seeding requires an active platform administrator as reviewer';
  end if;

  ---------------------------------------------------------------------------
  -- SQF (supplier approval essentials)
  ---------------------------------------------------------------------------
  insert into public.requirement_frameworks (code, name, description, framework_type, owner_buyer_id, created_by)
  values ('SQF', 'SQF Food Safety Code — supplier approval essentials',
          'Paraphrased supplier-approval requirements aligned with SQF Edition 9. Activate per supplier to generate evidence requests.',
          'regulatory', null, v_admin)
  on conflict (code) do nothing;
  select id into v_fw from public.requirement_frameworks where code = 'SQF';

  insert into public.requirement_framework_versions
    (framework_id, version, status, effective_from, source_urls, content_hash, created_by)
  select v_fw, 'Edition-9', 'draft', date '2021-01-01',
         jsonb_build_array('https://www.sqfi.com/what-is-the-sqf-program/'),
         'seed-sqf-edition9-2026-07-03', v_admin
  where not exists (select 1 from public.requirement_framework_versions where framework_id = v_fw and version = 'Edition-9');
  select id into v_ver from public.requirement_framework_versions where framework_id = v_fw and version = 'Edition-9';

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'SQF-FOOD-SAFETY-CERT', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'SQF-FOOD-SAFETY-CERT';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Valid GFSI-benchmarked food safety certification',
    'The supplier must hold a current food safety certification issued under a GFSI-benchmarked scheme covering the supplying site and scope.',
    'SQF Food Safety Code Ed. 9, supplier approval program', 'https://www.sqfi.com/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"food_safety_certificate","name":"GFSI-benchmarked food safety certificate (SQF, BRCGS, FSSC 22000 or ISO 22000)","description":"Current certificate naming the supplier, site scope, certification body, issue and expiry dates.","required_fields":["certificate_number","expiry_date","scope"],"required_standards":["SQF Edition 9","BRCGS Issue 9","FSSC 22000 v6","ISO 22000:2018"]}]'::jsonb,
    'Supplier approval requires a current GFSI-benchmarked food safety certification.',
    date '2021-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'SQF-HACCP-PLAN', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'SQF-HACCP-PLAN';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Documented HACCP-based food safety plan',
    'The supplier must maintain a documented, HACCP-based food safety plan covering hazards, critical control points and controls for supplied products.',
    'SQF Food Safety Code Ed. 9, food safety plan elements', 'https://www.sqfi.com/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"haccp_plan","name":"HACCP-based food safety plan","description":"Current plan covering hazard analysis, CCPs, critical limits, monitoring and verification for supplied products."}]'::jsonb,
    'Supplier approval requires a documented HACCP-based food safety plan.',
    date '2021-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'SQF-RECALL-PROGRAM', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'SQF-RECALL-PROGRAM';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Recall and crisis management program with mock recall',
    'The supplier must maintain a documented product recall and crisis management program, exercised at least annually via a mock recall.',
    'SQF Food Safety Code Ed. 9, recall and withdrawal', 'https://www.sqfi.com/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"recall_program","name":"Recall / crisis management program with latest mock recall record","description":"Program document plus evidence of the most recent mock recall exercise and its outcome."}]'::jsonb,
    'Supplier approval requires a documented, exercised recall program.',
    date '2021-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'SQF-ALLERGEN-MGMT', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'SQF-ALLERGEN-MGMT';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Documented allergen management program',
    'The supplier must maintain a documented allergen management program covering identification, segregation, changeover controls and labeling.',
    'SQF Food Safety Code Ed. 9, allergen management', 'https://www.sqfi.com/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"allergen_management_program","name":"Allergen management program","description":"Current program covering allergen identification, segregation, cleaning validation and label controls."}]'::jsonb,
    'Supplier approval requires a documented allergen management program.',
    date '2021-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  update public.requirement_framework_versions
    set status = 'published', reviewed_by = v_admin, reviewed_at = now(), published_at = now()
    where id = v_ver and status = 'draft';

  ---------------------------------------------------------------------------
  -- FSMA-204 (traceability readiness essentials)
  ---------------------------------------------------------------------------
  insert into public.requirement_frameworks (code, name, description, framework_type, owner_buyer_id, created_by)
  values ('FSMA-204', 'FSMA Section 204 Food Traceability — readiness essentials',
          'Paraphrased readiness requirements for the FDA Food Traceability Final Rule (21 CFR Part 1, Subpart S).',
          'regulatory', null, v_admin)
  on conflict (code) do nothing;
  select id into v_fw from public.requirement_frameworks where code = 'FSMA-204';

  insert into public.requirement_framework_versions
    (framework_id, version, status, effective_from, source_urls, content_hash, created_by)
  select v_fw, '2022-final-rule', 'draft', date '2023-01-20',
         jsonb_build_array('https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods'),
         'seed-fsma204-finalrule-2026-07-03', v_admin
  where not exists (select 1 from public.requirement_framework_versions where framework_id = v_fw and version = '2022-final-rule');
  select id into v_ver from public.requirement_framework_versions where framework_id = v_fw and version = '2022-final-rule';

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'FSMA204-TRACEABILITY-PLAN', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'FSMA204-TRACEABILITY-PLAN';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Written traceability plan for Food Traceability List foods',
    'Suppliers handling foods on the FDA Food Traceability List must maintain a written traceability plan describing how traceability records are kept and provided.',
    '21 CFR 1.1315', 'https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"traceability_plan","name":"Written FSMA 204 traceability plan","description":"Current written plan covering record procedures, traceability lot code assignment, and the point of contact.","jurisdiction":"US"}]'::jsonb,
    'FSMA 204 readiness requires a written traceability plan.',
    date '2023-01-20'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'FSMA204-KDE-RECORDS', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'FSMA204-KDE-RECORDS';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Key Data Element records available within 24 hours',
    'Suppliers must be able to provide Key Data Elements for Critical Tracking Events (harvesting, cooling, packing, shipping, receiving, transformation) within 24 hours of a request.',
    '21 CFR 1.1305–1.1350', 'https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"attestation","document_type":"traceability_records_attestation","name":"KDE/CTE record-keeping attestation with sample records","description":"Attestation of 24-hour KDE availability, with representative sample records for one recent lot.","jurisdiction":"US"}]'::jsonb,
    'FSMA 204 readiness requires retrievable KDE records for Critical Tracking Events.',
    date '2023-01-20'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  update public.requirement_framework_versions
    set status = 'published', reviewed_by = v_admin, reviewed_at = now(), published_at = now()
    where id = v_ver and status = 'draft';

  ---------------------------------------------------------------------------
  -- HACCP (Codex-based essentials)
  ---------------------------------------------------------------------------
  insert into public.requirement_frameworks (code, name, description, framework_type, owner_buyer_id, created_by)
  values ('HACCP', 'HACCP — Codex-based essentials',
          'Paraphrased core HACCP evidence requirements based on the Codex Alimentarius general principles of food hygiene.',
          'regulatory', null, v_admin)
  on conflict (code) do nothing;
  select id into v_fw from public.requirement_frameworks where code = 'HACCP';

  insert into public.requirement_framework_versions
    (framework_id, version, status, effective_from, source_urls, content_hash, created_by)
  select v_fw, 'codex-2023', 'draft', date '2023-01-01',
         jsonb_build_array('https://www.fao.org/fao-who-codexalimentarius/codex-texts/codes-of-practice/en/'),
         'seed-haccp-codex-2026-07-03', v_admin
  where not exists (select 1 from public.requirement_framework_versions where framework_id = v_fw and version = 'codex-2023');
  select id into v_ver from public.requirement_framework_versions where framework_id = v_fw and version = 'codex-2023';

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'HACCP-PLAN', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'HACCP-PLAN';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'Documented hazard analysis and HACCP plan',
    'The supplier must maintain a documented hazard analysis identifying significant hazards and a HACCP plan defining critical control points and critical limits.',
    'Codex Alimentarius CXC 1-1969 (HACCP annex)', 'https://www.fao.org/fao-who-codexalimentarius/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"haccp_plan","name":"HACCP plan with hazard analysis","description":"Current HACCP plan including hazard analysis, CCPs, critical limits and verification procedures."}]'::jsonb,
    'HACCP requires a documented hazard analysis and plan.',
    date '2023-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'HACCP-MONITORING', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'HACCP-MONITORING';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'CCP monitoring and corrective action records',
    'The supplier must keep records demonstrating CCP monitoring at defined frequencies and corrective actions taken when critical limits were exceeded.',
    'Codex Alimentarius CXC 1-1969 (HACCP annex), record keeping', 'https://www.fao.org/fao-who-codexalimentarius/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"ccp_monitoring_records","name":"Recent CCP monitoring and corrective action records","description":"Representative monitoring records for each CCP covering a recent production period, including any corrective actions."}]'::jsonb,
    'HACCP requires demonstrable CCP monitoring records.',
    date '2023-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  insert into public.requirements (framework_id, stable_key, subject_types)
  values (v_fw, 'HACCP-TRAINING', array['supplier']) on conflict do nothing;
  select id into v_req from public.requirements where stable_key = 'HACCP-TRAINING';
  insert into public.requirement_versions
    (requirement_id, framework_version_id, title, description, citation, source_url, applicability_rule, required_evidence, explanation_template, effective_from)
  select v_req, v_ver,
    'HACCP training records for responsible personnel',
    'Personnel responsible for the HACCP system must have documented, current HACCP training.',
    'Codex Alimentarius CXC 1-1969, training', 'https://www.fao.org/fao-who-codexalimentarius/',
    '{"fact":"supplier_id","operator":"present"}'::jsonb,
    '[{"type":"document","document_type":"training_records","name":"HACCP training records","description":"Training certificates or records for the HACCP team and responsible personnel."}]'::jsonb,
    'HACCP requires trained responsible personnel.',
    date '2023-01-01'
  where not exists (select 1 from public.requirement_versions where requirement_id = v_req and framework_version_id = v_ver);

  update public.requirement_framework_versions
    set status = 'published', reviewed_by = v_admin, reviewed_at = now(), published_at = now()
    where id = v_ver and status = 'draft';
end $$;
