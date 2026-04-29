import { test, expect } from '@playwright/test';

test('Full Stack: Create and Save Workspace Flow', async ({ page }) => {
  // Navigate to the frontend
  await page.goto('/');

  // Wait for the app to fully load
  await expect(page).toHaveTitle(/Robo Learn AI/);

  // 1. Find the "Save State" button on the UI
  const saveButton = page.locator('button', { hasText: 'Save State' });
  await expect(saveButton).toBeVisible();

  // 2. Click the save button and wait for the frontend to successfully talk to the backend's SQLite database
  const responsePromise = page.waitForResponse(res => res.url().includes('/api/save-flow') && res.status() === 200);
  await saveButton.click();
  const response = await responsePromise;
  const data = await response.json();
  
  // 4. Assert that the backend successfully created a new entry in the SQLite database
  expect(data.created).toBe(true);
  expect(data.project_id).toBeGreaterThan(0);

  // 5. Verify the UI updates to show the newly saved Workspace
  const workspaceEntry = page.locator('text=Workspace').first();
  await expect(workspaceEntry).toBeVisible();
});
