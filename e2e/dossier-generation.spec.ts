import { expect, test, type Page } from '@playwright/test';

const supplierId = '00000000-0000-4000-8000-000000000010';
const dossierId = '00000000-0000-4000-8000-000000000060';
const versionId = '00000000-0000-4000-8000-000000000061';

async function mockDossierBackend(page: Page, enabled = true) {
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
    if (url.includes('/regulatory_packs')) body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/functions/v1/generate-dossier-v1', async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dossier_id: dossierId,
        version_id: versionId,
        version_number: 1,
        idempotent_replay: false,
        content_hash: 'a'.repeat(64),
        signature: 'c'.repeat(88),
        signing_key_id: '00000000-0000-4000-8000-000000000062',
        correlation_id: 'e2e-correlation',
        content_snapshot: {
          subject_type: input.subject_type,
          subject_display_name: 'Golden Supplier',
          effective_at: input.effective_at,
          generated_at: '2026-06-19T00:00:00Z',
          statements: [
            {
              decision_result_id: '00000000-0000-4000-8000-000000000063',
              framework_code: 'TR2C-LEGACY',
              framework_version: 'legacy-live',
              requirement_key: 'LEGACY-BUSINESS-LICENSE',
              title: 'Business License',
              outcome: 'compliant',
              explanation: 'Verified evidence covers this requirement and is currently valid.',
              citation: null,
              evidence: [{ document_type: 'Business License', issuer: 'City Hall', certificate_number: 'BL-1', expiry_date: '2027-01-01', status: 'verified' }],
            },
          ],
        },
      }),
    });
  });

  await page.route('**/functions/v1/verify-dossier-signature-v1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dossier_id: dossierId,
        version_id: versionId,
        content_matches: true,
        signature_valid: true,
        audit_chain: { valid: true, broken_at_row_id: null, reason: null },
        correlation_id: 'e2e-correlation',
      }),
    });
  });
}

test('feature flag hides the Dossiers experience when disabled', async ({ page }) => {
  await mockDossierBackend(page, false);
  await page.goto('/__test/dossiers');
  await expect(page.getByText('Dossiers disabled')).toBeVisible();
});

test('generates a dossier and verifies its signature', async ({ page }) => {
  await mockDossierBackend(page);
  await page.goto('/__test/dossiers');
  await expect(page.getByRole('heading', { name: 'Compliance Dossiers' })).toBeVisible();

  await page.getByText('Select subject').click();
  await page.getByRole('option', { name: 'Golden Supplier' }).click();
  await page.getByRole('button', { name: 'Generate dossier' }).click();

  await expect(page.getByText('Version 1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business License' })).toBeVisible();

  await page.getByRole('button', { name: 'Verify signature' }).click();
  await expect(page.getByText('Verified')).toBeVisible();
});
