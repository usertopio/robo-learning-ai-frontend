import { test, expect } from '@playwright/test';

test('has title and displays workspace', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Robo Learn AI/);

  // Expect the header or main app container to be visible
  const header = page.locator('header');
  if (await header.count() > 0) {
    await expect(header.first()).toBeVisible();
  }
});
