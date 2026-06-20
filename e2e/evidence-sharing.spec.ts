import { expect, test, type Page } from '@playwright/test';

const versionId = '00000000-0000-4000-8000-000000000030';
const supplierId = '00000000-0000-4000-8000-000000000020';
const buyerId = '00000000-0000-4000-8000-000000000001';
const grantId = '00000000-0000-4000-8000-000000000040';

async function mockEvidenceSharingBackend(page: Page, enabled = true) {
  const grants: Array<Record<string, unknown>> = [];

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/evidence_versions')) {
      body = [{
        id: versionId,
        expiry_date: '2027-01-15',
        lifecycle_status: 'current',
        document_asset_id: '00000000-0000-4000-8000-000000000031',
        record: {
          id: '00000000-0000-4000-8000-000000000032',
          display_name: 'Business License',
          canonical_document_type: 'business_license',
          supplier_id: supplierId,
        },
        asset: { storage_bucket: 'compliance-documents', storage_path: null },
        evidence_attestations: [{
          attestation_type: 'supplier_verification',
          outcome: 'accepted',
          organization_id: supplierId,
        }],
        evidence_validation_runs: [{ status: 'passed', completeness: 1, created_at: '2026-06-18T00:00:00Z', evidence_validation_results: [] }],
        evidence_field_observations: [],
      }];
    }
    if (url.includes('/buyer_supplier_connections')) {
      body = [{ buyer_id: buyerId, buyers: { id: buyerId, company_name: 'Golden Buyer' } }];
    }
    if (url.includes('/evidence_sharing_grants')) body = [...grants];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/rest/v1/rpc/grant_canonical_evidence_access_v1', async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({
      p_supplier_id: supplierId,
      p_buyer_id: buyerId,
      p_evidence_version_id: versionId,
      p_purpose: 'compliance_decision',
    });
    grants.push({
      id: grantId,
      granted_to_organization_id: buyerId,
      evidence_version_id: versionId,
      purpose: 'compliance_decision',
      status: 'active',
      expires_at: '2027-01-15T00:00:00Z',
      granted_at: '2026-06-18T00:00:00Z',
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(grantId) });
  });

  await page.route('**/rest/v1/rpc/revoke_evidence_access_v1', async (route) => {
    const grant = grants.find((item) => item.id === grantId);
    if (grant) grant.status = 'revoked';
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
}

test('feature flag hides the Evidence Sharing experience when disabled', async ({ page }) => {
  await mockEvidenceSharingBackend(page, false);
  await page.goto('/__test/evidence-sharing');
  await expect(page.getByText('Evidence sharing disabled')).toBeVisible();
});

test('shares a verified canonical version with a connected buyer and revokes it', async ({ page }) => {
  await mockEvidenceSharingBackend(page);
  await page.goto('/__test/evidence-sharing');

  await expect(page.getByRole('heading', { name: 'Evidence Sharing' })).toBeVisible();
  await expect(page.getByText('Business License')).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('heading', { name: 'Share verified evidence' })).toBeVisible();
  await page.getByText('Select buyer').click();
  await page.getByRole('option', { name: 'Golden Buyer' }).click();
  await page.getByRole('button', { name: 'Share evidence' }).click();

  await expect(page.getByText('Golden Buyer')).toBeVisible();
  await expect(page.getByText(/^active/)).toBeVisible();

  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText(/^revoked/)).toBeVisible();
});
