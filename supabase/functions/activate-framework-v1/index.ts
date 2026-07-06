import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { canonicalEvidenceErrorStatus, createCanonicalEvidenceClients } from '../_shared/canonicalEvidence/auth.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { isBuyerFeatureEnabled } from '../_shared/featureFlags.ts';
import { requiredEvidenceDefinitionSchema } from '../_shared/requirements/contracts.ts';

// Phase 2 (plasma_clone/update.md Track B): activating a framework for
// suppliers is what turns requirements into outbound evidence requests. The
// request creation itself goes through create_document_requests_v2 so it
// inherits dedupe, idempotency, supplier notification, and domain events —
// no parallel request system.

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  framework_id: z.string().uuid(),
  supplier_ids: z.array(z.string().uuid()).max(500).default([]),
  // Scales past checkbox lists: activate buyer-wide (one activation row with
  // supplier_id null) and enumerate approved connections server-side.
  all_suppliers: z.boolean().default(false),
  due_date: z.string().date().nullable().optional(),
  generate_requests: z.boolean().default(true),
}).strict().refine((value) => value.all_suppliers || value.supplier_ids.length > 0, {
  message: 'Provide supplier_ids or set all_suppliers',
});

const RPC_CHUNK_SIZE = 50;

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const startedAt = performance.now();
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    const { admin, client, user } = await createCanonicalEvidenceClients(req);
    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await isBuyerFeatureEnabled(admin, input.buyer_id, 'compliance_requirements_v1'))) {
      return jsonResponse(context, { error: 'Requirement engine is disabled for this organization' }, 403);
    }

    const { data: framework, error: frameworkError } = await admin.from('requirement_frameworks')
      .select('id, code, name, owner_buyer_id').eq('id', input.framework_id).maybeSingle();
    if (frameworkError) throw frameworkError;
    if (!framework || (framework.owner_buyer_id !== null && framework.owner_buyer_id !== input.buyer_id)) {
      return jsonResponse(context, { error: 'Framework not found' }, 404);
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: frameworkVersions, error: versionError } = await admin.from('requirement_framework_versions')
      .select('id, version').eq('framework_id', framework.id).eq('status', 'published')
      .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`);
    if (versionError) throw versionError;

    const { data: requirementVersions, error: rvError } = frameworkVersions?.length
      ? await admin.from('requirement_versions')
        .select('id, requirement_id, title, citation, required_evidence, explanation_template')
        .in('framework_version_id', frameworkVersions.map((v) => v.id))
        .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`)
      : { data: [], error: null };
    if (rvError) throw rvError;

    const requirementIds = [...new Set((requirementVersions || []).map((v) => v.requirement_id))];
    const { data: requirements, error: reqError } = requirementIds.length
      ? await admin.from('requirements').select('id, stable_key, subject_types').in('id', requirementIds)
      : { data: [], error: null };
    if (reqError) throw reqError;
    const requirementById = new Map((requirements || []).map((r) => [r.id, r]));

    const supplierRequirementVersions = (requirementVersions || []).filter((version) =>
      requirementById.get(version.requirement_id)?.subject_types?.includes('supplier'));

    // One query resolves approved connections for any fleet size — never a
    // per-supplier round trip.
    const { data: approvedConnections, error: connectionsError } = await admin
      .from('buyer_supplier_connections').select('supplier_id')
      .eq('buyer_id', input.buyer_id).eq('status', 'approved');
    if (connectionsError) throw connectionsError;
    const approvedSupplierIds = new Set((approvedConnections || []).map((row) => row.supplier_id as string));

    const targetSupplierIds = input.all_suppliers
      ? [...approvedSupplierIds]
      : input.supplier_ids.filter((id) => approvedSupplierIds.has(id));
    const skipped = input.all_suppliers
      ? []
      : input.supplier_ids.filter((id) => !approvedSupplierIds.has(id))
        .map((supplier_id) => ({ supplier_id, reason: 'No approved connection with this supplier' }));

    const activations: Array<{ supplier_id: string | null; activation_id: string }> = [];
    if (input.all_suppliers) {
      // Buyer-wide: a single activation row (supplier_id null) covers every
      // current and future approved supplier.
      const { data: existing } = await admin.from('buyer_framework_activations')
        .select('id').eq('buyer_id', input.buyer_id).eq('framework_id', framework.id)
        .is('supplier_id', null).is('deactivated_at', null).maybeSingle();
      if (existing) {
        activations.push({ supplier_id: null, activation_id: existing.id });
      } else {
        const { data: created, error: activationError } = await admin.from('buyer_framework_activations')
          .insert({ buyer_id: input.buyer_id, framework_id: framework.id, supplier_id: null, activated_by: user.id })
          .select('id').single();
        if (activationError) throw activationError;
        activations.push({ supplier_id: null, activation_id: created.id });
      }
    } else if (targetSupplierIds.length) {
      const { data: existingRows, error: existingError } = await admin.from('buyer_framework_activations')
        .select('id, supplier_id').eq('buyer_id', input.buyer_id).eq('framework_id', framework.id)
        .in('supplier_id', targetSupplierIds).is('deactivated_at', null);
      if (existingError) throw existingError;
      const existingBySupplier = new Map((existingRows || []).map((row) => [row.supplier_id as string, row.id as string]));
      const toInsert = targetSupplierIds.filter((id) => !existingBySupplier.has(id))
        .map((supplierId) => ({ buyer_id: input.buyer_id, framework_id: framework.id, supplier_id: supplierId, activated_by: user.id }));
      if (toInsert.length) {
        const { data: created, error: activationError } = await admin.from('buyer_framework_activations')
          .insert(toInsert).select('id, supplier_id');
        if (activationError) throw activationError;
        for (const row of created || []) activations.push({ supplier_id: row.supplier_id, activation_id: row.id });
      }
      for (const [supplierId, activationId] of existingBySupplier) {
        activations.push({ supplier_id: supplierId, activation_id: activationId });
      }
    }

    let requestIdsBySupplier = new Map<string, string[]>();
    if (input.generate_requests && supplierRequirementVersions.length && targetSupplierIds.length) {
      const requestInputs = targetSupplierIds.flatMap((supplier_id) =>
        supplierRequirementVersions.flatMap((version) => {
          const parsedEvidence = requiredEvidenceDefinitionSchema.array().safeParse(version.required_evidence);
          if (!parsedEvidence.success) return [];
          return parsedEvidence.data.map((evidence) => ({
            buyer_id: input.buyer_id,
            supplier_id,
            title: evidence.name,
            document_type: evidence.document_type,
            // document_requests.category is NOT NULL; group framework-sourced
            // requests under the framework code.
            category: framework.code,
            description: `${version.title} — ${version.explanation_template}`,
            priority: 'high',
            due_date: input.due_date ?? null,
            notes: version.citation ? `Framework: ${framework.code} · ${version.citation}` : `Framework: ${framework.code}`,
            subject_type: 'supplier',
            subject_id: supplier_id,
            jurisdiction: evidence.jurisdiction ?? null,
            required_standards: evidence.required_standards ?? [],
            reuse_preference: 'create',
            request_reason_code: 'framework_activation',
            request_reason_notes: `Activated ${framework.code} for this supplier`,
            idempotency_key: `fw:${framework.id}:${supplier_id}:${evidence.document_type}:${input.due_date ?? 'nodue'}`,
          }));
        }));

      if (requestInputs.length) {
        // User-scoped client: the RPC checks auth.uid() for buyer access and
        // records idempotency per actor. Chunked so a 500-supplier fleet
        // stays within sane payload and statement sizes.
        requestIdsBySupplier = new Map();
        for (let offset = 0; offset < requestInputs.length; offset += RPC_CHUNK_SIZE) {
          const chunk = requestInputs.slice(offset, offset + RPC_CHUNK_SIZE);
          const { data: results, error: rpcError } = await client.rpc('create_document_requests_v2', {
            p_inputs: chunk,
          });
          if (rpcError) throw rpcError;
          (results as Array<Record<string, unknown>> | null)?.forEach((result, index) => {
            const supplierId = chunk[index]?.supplier_id;
            const requestId = typeof result?.request_id === 'string' ? result.request_id : null;
            if (supplierId && requestId) {
              requestIdsBySupplier.set(supplierId, [...(requestIdsBySupplier.get(supplierId) || []), requestId]);
            }
          });
        }

        // Mirror NewRequestModal: batch email per supplier, fire-and-forget so
        // email issues never fail the activation itself.
        const authHeader = req.headers.get('Authorization') ?? '';
        for (const [supplierId, requestIds] of requestIdsBySupplier) {
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-batch-request-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader },
            body: JSON.stringify({ requestIds, supplierId }),
          }).catch((error) => {
            logEvent('warn', 'framework_activation_email_failed', context, {
              supplier_id: supplierId, error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      }
    }

    const requestsCreated = [...requestIdsBySupplier.values()].reduce((sum, ids) => sum + ids.length, 0);
    logEvent('info', 'framework_activated', context, {
      actor_id: user.id, buyer_id: input.buyer_id, framework_code: framework.code,
      supplier_count: activations.length, skipped_count: skipped.length,
      requests_created: requestsCreated, latency_ms: Math.round(performance.now() - startedAt),
    });

    return jsonResponse(context, {
      framework_id: framework.id,
      framework_code: framework.code,
      activations,
      skipped,
      requirement_count: supplierRequirementVersions.length,
      requests_created: requestsCreated,
      request_ids_by_supplier: Object.fromEntries(requestIdsBySupplier),
      correlation_id: context.correlationId,
    });
  } catch (error) {
    logEvent('error', 'framework_activation_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: error instanceof Error ? error.message : 'Framework activation failed', correlation_id: context.correlationId }, canonicalEvidenceErrorStatus(error));
  }
});
