import { expect, test, type Page } from '@playwright/test';

const supplierId = '00000000-0000-4000-8000-000000000010';
const facilityId = '00000000-0000-4000-8000-000000000011';
const productId = '00000000-0000-4000-8000-000000000012';

async function mockRequirementBackend(page: Page, enabled = true) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/buyer_supplier_connections')) {
      body = [{ supplier_id: supplierId, suppliers: { id: supplierId, company_name: 'Golden Supplier' } }];
    }
    if (url.includes('/company_branches')) body = [{ id: facilityId, branch_name: 'Austin Facility', company_id: supplierId }];
    if (url.includes('/supplier_items')) body = [{ id: productId, item_name: 'Children Toy', supplier_id: supplierId }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/functions/v1/evaluate-requirements-v1', async (route) => {
    const request = route.request();
    expect(request.headers()['x-idempotency-key']).toBeTruthy();
    expect(request.headers()['x-correlation-id']).toBeTruthy();
    const input = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        evaluation_id: '00000000-0000-4000-8000-000000000020',
        idempotent_replay: false,
        evaluator_version: '1.0.0',
        correlation_id: 'e2e-correlation',
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        effective_at: input.effective_at,
        results: [
          {
            requirement_version_id: '00000000-0000-4000-8000-000000000021',
            legacy_mapping_id: null,
            framework_code: 'US-CPSC',
            framework_version: 'CPSC-2026.1',
            requirement_key: 'CHILDRENS-PRODUCT-CERTIFICATE',
            title: "Children's Product Certificate (CPC)",
            outcome: 'applies',
            explanation: 'All authoritative conditions matched.',
            matched_facts: { destination_country: 'US' },
            missing_inputs: [],
            citation: '15 U.S.C. 2063',
            source_url: 'https://www.cpsc.gov/example',
            required_evidence: [{ type: 'document', document_type: 'cpc', name: "Children's Product Certificate" }],
            effective_from: '2026-07-08',
            effective_to: '2027-01-07',
          },
          {
            requirement_version_id: '00000000-0000-4000-8000-000000000022',
            legacy_mapping_id: null,
            framework_code: 'US-CPSC',
            framework_version: 'CPSC-2026.1',
            requirement_key: 'CERTIFICATE-EFILING',
            title: 'CPSC certificate eFiling',
            outcome: 'indeterminate',
            explanation: 'Import status is required.',
            matched_facts: {},
            missing_inputs: ['domestic_import_status'],
            citation: '16 CFR part 1110',
            source_url: 'https://www.cpsc.gov/example',
            required_evidence: [],
            effective_from: '2026-07-08',
            effective_to: null,
          },
          {
            requirement_version_id: '00000000-0000-4000-8000-000000000023',
            legacy_mapping_id: null,
            framework_code: 'US-CPSC',
            framework_version: 'CPSC-2026.1',
            requirement_key: 'GENERAL-CERTIFICATE-OF-CONFORMITY',
            title: 'General Certificate of Conformity',
            outcome: 'does_not_apply',
            explanation: 'Children product classification did not match.',
            matched_facts: { is_children_product: true },
            missing_inputs: [],
            citation: null,
            source_url: null,
            required_evidence: [],
            effective_from: '2026-07-08',
            effective_to: null,
          },
        ],
      }),
    });
  });
}

test('feature flag hides the Requirements experience when disabled', async ({ page }) => {
  await mockRequirementBackend(page, false);
  await page.goto('/__test/requirements');
  await expect(page.getByText('Requirement engine disabled')).toBeVisible();
});

test('shows a recoverable error instead of leaving the subject selector loading', async ({ page }) => {
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/feature_flags')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ default_enabled: false }) });
      return;
    }
    if (url.includes('/organization_feature_flags')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, expires_at: null }) });
      return;
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'query failed' }) });
  });

  await page.goto('/__test/requirements');
  await expect(page.getByText('Unable to load connected suppliers.')).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('evaluates supplier, facility, and product subjects with explainable results', async ({ page }) => {
  await mockRequirementBackend(page);
  await page.goto('/__test/requirements');
  await expect(page.getByRole('heading', { name: 'Requirement Engine' })).toBeVisible();

  const subjectType = page.getByText('Supplier', { exact: true }).first();
  await subjectType.click();
  await page.getByRole('option', { name: 'Product' }).click();
  await page.getByText('Select subject').click();
  await page.getByRole('option', { name: 'Children Toy' }).click();
  await page.getByRole('button', { name: 'Evaluate requirements' }).click();

  await expect(page.getByRole('heading', { name: 'Applies (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs information (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Does not apply (1)' })).toBeVisible();
  await expect(page.getByText('Missing inputs: domestic_import_status')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Official source' }).first()).toHaveAttribute('href', 'https://www.cpsc.gov/example');
  await expect(page.getByText('15 U.S.C. 2063')).toBeVisible();

  await page.getByText('Product', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Facility' }).click();
  await page.getByText('Select subject').click();
  await expect(page.getByRole('option', { name: 'Austin Facility' })).toBeVisible();
});
