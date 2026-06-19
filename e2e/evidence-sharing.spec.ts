import { expect, test, type Page } from '@playwright/test';

const claimId = '00000000-0000-4000-8000-000000000030';
const buyerId = '00000000-0000-4000-8000-000000000001';
const grantId = '00000000-0000-4000-8000-000000000040';

async function mockEvidenceSharingBackend(page: Page, enabled = true) {
  const grants: Array<Record<string, unknown>> = [];
  const auditLog: Array<Record<string, unknown>> = [];

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let body: unknown = [];
    if (url.includes('/feature_flags')) body = { default_enabled: false };
    if (url.includes('/organization_feature_flags')) body = { enabled, expires_at: null };
    if (url.includes('/evidence_claims')) {
      body = [{
        id: claimId,
        document_type: 'business_license',
        status: 'verified',
        issuer: 'Intertek',
        certificate_number: 'INT-2026-00451',
        expiry_date: '2027-01-15',
      }];
    }
    if (url.includes('/buyer_supplier_connections')) {
      body = [{ buyer_id: buyerId, buyers: { id: buyerId, company_name: 'Golden Buyer' } }];
    }
    if (url.includes('/evidence_sharing_grants')) body = [...grants];
    if (url.includes('/evidence_sharing_audit_log')) body = [...auditLog];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/rest/v1/rpc/grant_evidence_access_v1', async (route) => {
    grants.push({
      id: grantId,
      granted_to_organization_id: buyerId,
      claim_id: claimId,
      document_type: null,
      purpose: 'compliance_decision',
      status: 'active',
      expires_at: null,
      granted_at: '2026-06-18T00:00:00Z',
    });
    auditLog.push({ id: 'audit-1', grant_id: grantId, event_type: 'granted', occurred_at: '2026-06-18T00:00:00Z', metadata: {} });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(grantId) });
  });

  await page.route('**/rest/v1/rpc/revoke_evidence_access_v1', async (route) => {
    const grant = grants.find((g) => g.id === grantId);
    if (grant) grant.status = 'revoked';
    auditLog.push({ id: 'audit-2', grant_id: grantId, event_type: 'revoked', occurred_at: '2026-06-18T00:05:00Z', metadata: {} });
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
}

test('feature flag hides the Evidence Sharing experience when disabled', async ({ page }) => {
  await mockEvidenceSharingBackend(page, false);
  await page.goto('/__test/evidence-sharing');
  await expect(page.getByText('Evidence sharing disabled')).toBeVisible();
});

test('shares a claim with a connected buyer and can revoke the grant', async ({ page }) => {
  await mockEvidenceSharingBackend(page);
  await page.goto('/__test/evidence-sharing');
  await expect(page.getByRole('heading', { name: 'Evidence Sharing' })).toBeVisible();
  await expect(page.getByText('Intertek')).toBeVisible();

  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByText('Select a connected buyer').click();
  await page.getByRole('option', { name: 'Golden Buyer' }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();

  await expect(page.getByText('Golden Buyer')).toBeVisible();
  await expect(page.getByText('Active')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('Revoked')).toBeVisible();
});
