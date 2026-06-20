import { expect, test, type Page } from '@playwright/test';

const requestId = '00000000-0000-4000-8000-000000000030';
const versionId = '00000000-0000-4000-8000-000000000031';
const linkId = '00000000-0000-4000-8000-000000000032';

async function mockEvidenceBackend(page: Page, enabled = true) {
  let reviewed = false;

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/request_evidence_links')) {
      body = reviewed ? [] : [{
        id: linkId,
        request_id: requestId,
        evidence_version_id: versionId,
        relation: 'submitted',
        qualification: 'qualifies',
        document_requests: {
          id: requestId,
          title: 'ISO 9001 evidence request',
          document_type: 'iso_9001_certificate',
          status: 'submitted',
          fulfillment_status: 'submitted',
          buyer_id: '00000000-0000-4000-8000-000000000001',
          supplier_id: '00000000-0000-4000-8000-000000000020',
          due_date: '2026-07-01',
          request_reason_code: null,
          request_reason_notes: null,
        },
      }];
    }
    if (url.includes('/evidence_versions')) {
      body = {
        id: versionId,
        document_asset_id: '00000000-0000-4000-8000-000000000033',
        lifecycle_status: 'current',
        record: { display_name: 'ISO 9001 Certificate', canonical_document_type: 'iso_9001_certificate' },
        asset: { storage_bucket: 'compliance-documents', storage_path: null },
      };
    }
    if (url.includes('/evidence_review_policies')) body = null;
    if (url.includes('/evidence_field_observations')) {
      body = [{
        id: '00000000-0000-4000-8000-000000000034',
        field_name: 'certificate_number',
        normalized_value: 'INT-2026-00451',
        raw_value: 'INT-2026-00451',
        source_page: 2,
        source_quote: 'This certifies compliance with ISO 9001.',
        confidence: 0.92,
        created_at: '2026-06-18T00:00:00Z',
      }];
    }
    if (url.includes('/evidence_validation_runs')) {
      body = [{ id: 'run-1', status: 'passed', completeness: 1, evidence_validation_results: [] }];
    }
    if (url.includes('/evidence_attestations')) body = [];
    if (url.includes('/requirement_evidence_links')) body = [];
    if (url.includes('/compliance_tasks')) body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/functions/v1/review-evidence-v2', async (route) => {
    const input = route.request().postDataJSON();
    expect(input).toMatchObject({ request_id: requestId, evidence_version_id: versionId, approve: true });
    reviewed = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ four_eyes_required: false }) });
  });
}

test('feature flag hides the Evidence Verification experience when disabled', async ({ page }) => {
  await mockEvidenceBackend(page, false);
  await page.goto('/__test/evidence');
  await expect(page.getByText('Evidence verification disabled')).toBeVisible();
});

test('reviews canonical fields and approves the submitted evidence', async ({ page }) => {
  await mockEvidenceBackend(page);
  await page.goto('/__test/evidence');

  await expect(page.getByRole('heading', { name: 'Evidence Review' })).toBeVisible();
  await expect(page.getByText('ISO 9001 Certificate').first()).toBeVisible();
  await expect(page.getByDisplayValue('INT-2026-00451')).toBeVisible();
  await expect(page.getByText(/This certifies compliance with ISO 9001/)).toBeVisible();

  await page.getByRole('button', { name: 'Verify evidence and approve submission' }).click();
  await expect(page.getByText('No evidence is waiting for review.')).toBeVisible();
});
