import { expect, test, type Page } from '@playwright/test';

const claimId = '00000000-0000-4000-8000-000000000030';

async function mockEvidenceBackend(page: Page, enabled = true) {
  let verified = false;

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/evidence_claims')) {
      body = [{
        id: claimId,
        document_upload_id: '00000000-0000-4000-8000-000000000031',
        supplier_id: '00000000-0000-4000-8000-000000000010',
        status: verified ? 'verified' : 'extracted',
        issuer: 'Intertek',
        certificate_number: 'INT-2026-00451',
        issue_date: '2026-01-15',
        expiry_date: '2027-01-15',
        standards: ['ISO 9001'],
        covered_products: ['Children\'s plush toy'],
        covered_facilities: [],
        source_page: 2,
        source_text: 'This certifies compliance with ISO 9001.',
        confidence: 0.92,
        extraction_model_version: 'evidence-extract-v1',
        is_duplicate_of: null,
        rejected_reason: null,
        created_at: '2026-06-18T00:00:00Z',
      }];
    }
    if (url.includes('/evidence_claim_corrections')) body = [];
    if (url.includes('/evidence_conflicts')) body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/rest/v1/rpc/verify_evidence_claim_v1', async (route) => {
    verified = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
}

test('feature flag hides the Evidence Verification experience when disabled', async ({ page }) => {
  await mockEvidenceBackend(page, false);
  await page.goto('/__test/evidence');
  await expect(page.getByText('Evidence verification disabled')).toBeVisible();
});

test('lists a claim, shows extracted fields, and verifies it', async ({ page }) => {
  await mockEvidenceBackend(page);
  await page.goto('/__test/evidence');
  await expect(page.getByRole('heading', { name: 'Evidence Verification' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Intertek' })).toBeVisible();
  await expect(page.getByText('INT-2026-00451').first()).toBeVisible();
  await expect(page.getByText('This certifies compliance with ISO 9001.')).toBeVisible();

  await page.getByRole('button', { name: 'Verify' }).click();
  // The claim is now verified, so it drops out of the default "Needs review" filter.
  await expect(page.getByText('No evidence claims in this category.')).toBeVisible();
});
