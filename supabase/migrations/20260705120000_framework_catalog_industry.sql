-- Frameworks as an enterprise catalog: tag every framework with an industry
-- vertical, issuing authority, and region so the buyer-side library can default
-- to the buyer's own industry and let them browse others. Seeds the full
-- landing-page catalog (16 standards) as global catalog entries. Frameworks
-- with published requirement versions are "ready" (activatable → generate
-- requests); the rest are catalog entries surfaced as "available".

alter table public.requirement_frameworks
  add column if not exists industry text,
  add column if not exists authority text,
  add column if not exists region text,
  add column if not exists sort_order integer not null default 100;

-- Tag existing frameworks
update public.requirement_frameworks set industry='Food & Beverage', authority='SQF Institute (GFSI)', region='Global', sort_order=1 where code='SQF';
update public.requirement_frameworks set industry='Food & Beverage', authority='US FDA', region='United States', sort_order=2 where code='FSMA-204';
update public.requirement_frameworks set industry='Food & Beverage', authority='Codex Alimentarius', region='Global', sort_order=3 where code='HACCP';
update public.requirement_frameworks set industry='Consumer Products', authority='US CPSC', region='United States', sort_order=50 where code='US-CPSC';
update public.requirement_frameworks set industry='Internal', authority='TraceR2C', region='Global', sort_order=99 where code='TR2C-LEGACY';

-- Seed the rest of the catalog (global, regulatory) with rich metadata.
-- Paraphrased descriptions only — no reproduced standard text.
insert into public.requirement_frameworks (code, name, description, framework_type, owner_buyer_id, industry, authority, region, sort_order)
values
  ('BRCGS', 'BRCGS Global Standard — Food Safety', 'GFSI-benchmarked food safety certification scheme covering product, process and site controls.', 'regulatory', null, 'Food & Beverage', 'BRCGS', 'Global', 4),
  ('ISO-22000', 'ISO 22000 — Food Safety Management', 'Food safety management system requirements across the supply chain.', 'regulatory', null, 'Food & Beverage', 'ISO', 'Global', 5),
  ('GMP-21-CFR-211', 'cGMP — 21 CFR Part 211', 'Current Good Manufacturing Practice for finished pharmaceuticals.', 'regulatory', null, 'Pharmaceutical', 'US FDA', 'United States', 10),
  ('21-CFR-PART-11', '21 CFR Part 11 — Electronic Records', 'Controls for electronic records and electronic signatures in regulated industries.', 'regulatory', null, 'Pharmaceutical', 'US FDA', 'United States', 11),
  ('ISO-9001', 'ISO 9001 — Quality Management', 'Quality management system requirements applicable across industries.', 'regulatory', null, 'Quality', 'ISO', 'Global', 20),
  ('ISO-27001', 'ISO 27001 — Information Security', 'Information security management system (ISMS) requirements.', 'regulatory', null, 'Information Security', 'ISO', 'Global', 30),
  ('SOC-2', 'SOC 2 — Trust Services Criteria', 'Controls for security, availability, processing integrity, confidentiality and privacy.', 'regulatory', null, 'Information Security', 'AICPA', 'United States', 31),
  ('NIST-CSF', 'NIST Cybersecurity Framework', 'Risk-based cybersecurity framework: identify, protect, detect, respond, recover.', 'regulatory', null, 'Information Security', 'NIST', 'United States', 32),
  ('GDPR', 'GDPR — General Data Protection Regulation', 'EU personal-data protection and processing obligations.', 'regulatory', null, 'Privacy', 'European Union', 'European Union', 40),
  ('HIPAA', 'HIPAA — Health Information Privacy', 'Protection of health information for covered entities and business associates.', 'regulatory', null, 'Privacy', 'US HHS', 'United States', 41),
  ('EUDR', 'EUDR — EU Deforestation Regulation', 'Due-diligence obligations to keep deforestation-linked commodities off the EU market.', 'regulatory', null, 'Sustainability', 'European Union', 'European Union', 60),
  ('UFLPA', 'UFLPA — Forced Labor Prevention', 'US import due diligence to exclude goods linked to forced labor.', 'regulatory', null, 'Sustainability', 'US CBP', 'United States', 61),
  ('CSRD-CSDDD', 'CSRD / CSDDD — Sustainability Due Diligence', 'EU corporate sustainability reporting and supply-chain due-diligence obligations.', 'regulatory', null, 'Sustainability', 'European Union', 'European Union', 62)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  industry = excluded.industry, authority = excluded.authority,
  region = excluded.region, sort_order = excluded.sort_order;

-- Coverage summary: catalog + which frameworks are activated for whom + how
-- compliant each supplier is per framework. Single source of truth for the
-- buyer-side frameworks page. Security definer + buyer access check.
create or replace function public.framework_coverage_v1(p_buyer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if not (auth.role() = 'service_role' or private.has_organization_access(v_actor, p_buyer_id, 'buyer')) then
    raise exception 'Buyer access required';
  end if;

  return jsonb_build_object(
    -- Full catalog with readiness + activation counts
    'catalog', coalesce((
      select jsonb_agg(row_to_json(c) order by c.sort_order, c.code) from (
        select f.code, f.name, f.description, f.industry, f.authority, f.region, f.sort_order,
          exists(select 1 from public.requirement_framework_versions v where v.framework_id=f.id and v.status='published') as ready,
          (select count(*) from public.buyer_framework_activations a
             where a.buyer_id=p_buyer_id and a.framework_id=f.id and a.deactivated_at is null) as activation_rows
        from public.requirement_frameworks f
        where f.owner_buyer_id is null or f.owner_buyer_id = p_buyer_id
      ) c), '[]'::jsonb),
    -- Per (framework × supplier) compliance rollup from computed status
    'coverage', coalesce((
      select jsonb_agg(row_to_json(m)) from (
        select ccs.framework_code,
               ccs.subject_id as supplier_id,
               sup.company_name as supplier_name,
               count(*) as total,
               count(*) filter (where ccs.outcome in ('compliant','not_applicable')) as compliant,
               count(*) filter (where ccs.outcome in ('missing','expired','noncompliant')) as gaps,
               count(*) filter (where ccs.outcome in ('under_review','submitted','requested')) as pending
        from public.compliance_current_status ccs
        join public.suppliers sup on sup.id = ccs.subject_id
        where ccs.buyer_id = p_buyer_id and ccs.subject_type = 'supplier'
        group by ccs.framework_code, ccs.subject_id, sup.company_name
      ) m), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.framework_coverage_v1(uuid) to authenticated;
