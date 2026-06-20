import { expect, test } from '@playwright/test';

test('marketing landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TraceR2C/i);
  await expect(page.getByRole('heading', { name: /Make every supplier document/i })).toBeVisible();
});

test('authentication page renders without a session', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Session Error');
});
