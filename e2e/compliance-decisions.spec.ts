import { expect, test, type Page } from '@playwright/test';

const supplierId = '00000000-0000-4000-8000-000000000010';

async function mockComplianceBackend(page: Page, enabled = true) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/buyer_supplier_connections')) {
      body = [{ supplier_id: supplierId, suppliers: { id: supplierId, company_name: 'Golden Supplier' } }];
    }
    if (url.includes('/company_branches')) body = [];
    if (url.includes('/supplier_items')) body = [];
    if (url.includes('/compliance_tasks')) body = [];
    if (url.includes('/compliance_findings')) body = [];
    if (url.includes('/compliance_approvals')) body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/functions/v1/evaluate-compliance-v1', async (route) => {
    const request = route.request();
    expect(request.headers()['x-idempotency-key']).toBeTruthy();
    expect(request.headers()['x-correlation-id']).toBeTruthy();
    const input = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        evaluation_id: '00000000-0000-4000-8000-000000000040',
        idempotent_replay: false,
        evaluator_version: 'compliance-decision-v1',
        correlation_id: 'e2e-correlation',
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        results: [
          {
            requirement_version_id: null,
            legacy_mapping_id: '00000000-0000-4000-8000-000000000041',
            framework_code: 'TR2C-LEGACY',
            framework_version: 'legacy-live',
            requirement_key: 'LEGACY-ISO-9001',
            title: 'ISO 9001 Certificate',
            applicability_outcome: 'applies',
            outcome: 'compliant',
            explanation: 'Verified evidence covers this requirement and is currently valid.',
            evidence_claim_ids: ['00000000-0000-4000-8000-000000000042'],
            decision_version: 'compliance-decision-v1',
            effective_from: null,
            effective_to: null,
          },
          {
            requirement_version_id: null,
            legacy_mapping_id: '00000000-0000-4000-8000-000000000043',
            framework_code: 'TR2C-LEGACY',
            framework_version: 'legacy-live',
            requirement_key: 'LEGACY-INSURANCE',
            title: 'Certificate of Insurance',
            applicability_outcome: 'applies',
            outcome: 'missing',
            explanation: 'This requirement applies but no evidence has been requested or submitted yet.',
            evidence_claim_ids: [],
            decision_version: 'compliance-decision-v1',
            effective_from: null,
            effective_to: null,
          },
        ],
      }),
    });
  });
}

test('feature flag hides the Compliance Decisions experience when disabled', async ({ page }) => {
  await mockComplianceBackend(page, false);
  await page.goto('/__test/compliance-decisions');
  await expect(page.getByText('Compliance decisions disabled')).toBeVisible();
});

test('evaluates a supplier and shows computed decision outcomes', async ({ page }) => {
  await mockComplianceBackend(page);
  await page.goto('/__test/compliance-decisions');
  await expect(page.getByRole('heading', { name: 'Compliance Decisions' })).toBeVisible();

  await page.getByText('Select subject').click();
  await page.getByRole('option', { name: 'Golden Supplier' }).click();
  await page.getByRole('button', { name: 'Evaluate compliance' }).click();

  await expect(page.getByRole('heading', { name: 'ISO 9001 Certificate' })).toBeVisible();
  await expect(page.getByText('Compliant').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Certificate of Insurance' })).toBeVisible();
  await expect(page.getByText('Missing').first()).toBeVisible();
});
