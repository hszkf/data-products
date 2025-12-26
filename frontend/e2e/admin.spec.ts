import { test, expect } from '@playwright/test';

// Helper to login before tests
async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('hasif');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and login
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await loginAsAdmin(page);
  });

  test('should access admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Should show admin dashboard - use more specific selector
    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({ timeout: 5000 });
  });

  test('should show admin navigation sidebar', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Should have navigation links - use exact match
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Query Logs', exact: true })).toBeVisible();
  });

  test('should show role permissions table', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Should show permissions table - look for table headers
    await expect(page.getByRole('columnheader', { name: 'Permission' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Editor' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Viewer' })).toBeVisible();
  });

  test('should navigate to users page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Click on Users link in sidebar (exact match)
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    
    // Should be on users page
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to logs page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Click on Query Logs link in sidebar
    await page.getByRole('link', { name: 'Query Logs', exact: true }).click();
    
    // Should be on logs page
    await expect(page).toHaveURL(/\/admin\/logs/);
  });
});

test.describe('Admin Access Control', () => {
  test('viewer cannot access admin users endpoint', async ({ page }) => {
    // Login as viewer
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.getByLabel('Username').fill('ernie');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    
    // Try to navigate to admin users page
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    
    // Should either show error or redirect - check for error message or no table
    const hasError = await page.getByText(/access denied|not authorized|permission|forbidden/i).isVisible().catch(() => false);
    const noUsersTable = await page.getByRole('table').isHidden().catch(() => true);
    
    expect(hasError || noUsersTable).toBeTruthy();
  });
});
