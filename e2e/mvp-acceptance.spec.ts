import { expect, test } from '@playwright/test';

/**
 * E2E smoke: UI + ingestion-visible outcomes.
 * Push notification dedup is covered in `backend/tests/api.test.ts` with `PIH_PUSH_ENABLED=true`.
 */
test.describe('MVP acceptance (Task 10.2)', () => {
  test('homepage UI shows at least one decision card after one-round seed', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-clear-state').click();
    await page.getByTestId('btn-seed-single').click();
    await expect(page.getByTestId('btn-seed-single')).toBeEnabled({ timeout: 90_000 });
    await page.getByTestId('tab-homepage').click();
    await expect(page.getByTestId('decision-card').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('decision-cards-heading')).toBeVisible();
  });

  test('personalize tab loads and saves rules', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-clear-state').click();
    await page.getByTestId('btn-seed-single').click();
    await expect(page.getByTestId('btn-seed-single')).toBeEnabled({ timeout: 90_000 });
    await page.getByTestId('tab-personalize').click();
    await expect(page.getByTestId('textarea-pers-allow')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('textarea-pers-allow').fill('Social');
    await page.getByTestId('btn-pers-save').click();
    await expect(page.getByText(/已保存|Saved/)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('tab-homepage').click();
    await expect(page.getByTestId('timeline-row').first()).toBeVisible({ timeout: 30_000 });
  });
});
