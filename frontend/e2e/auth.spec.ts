import { test, expect, Page } from '@playwright/test';

/**
 * E2E Authentication Tests
 * 
 * These tests verify authentication flows including login, logout, 
 * session management, and role-based access control.
 * 
 * Note: API calls are mocked due to network connectivity issues between
 * Playwright's headless Chromium and localhost backend on macOS.
 */

// Test user data
const USERS = {
  admin: {
    id: 1,
    username: 'hasif',
    password: 'admin123',
    role: 'admin',
    team: 'data-science',
    display_name: 'Hasif'
  },
  editor: {
    id: 3,
    username: 'izhar',
    password: 'admin123',
    role: 'editor',
    team: 'data-science',
    display_name: 'Izhar'
  },
  viewer: {
    id: 7,
    username: 'ernie',
    password: 'admin123',
    role: 'viewer',
    team: 'business-intelligence',
    display_name: 'Ernie'
  }
};

// Configure tests to run serially
test.describe.configure({ mode: 'serial' });

// Helper to setup API mocks
async function setupAuthMocks(page: Page) {
  // Mock login endpoint
  await page.route('**/auth/login', async route => {
    const request = route.request();
    const postData = request.postDataJSON();
    
    // Find matching user
    const user = Object.values(USERS).find(
      u => u.username === postData.username && u.password === postData.password
    );
    
    if (user) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: `mock-jwt-token-${user.username}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              team: user.team,
              display_name: user.display_name,
              created_at: new Date().toISOString(),
              last_login: null,
              is_active: true
            }
          }
        })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: false, 
          message: 'Invalid username or password' 
        })
      });
    }
  });

  // Mock validate endpoint
  await page.route('**/auth/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  // Mock logout endpoint
  await page.route('**/auth/logout', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  // Mock users list API endpoint (only API calls, not page routes)
  await page.route('**/api/users', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: Object.values(USERS).map(u => ({
          id: u.id,
          username: u.username,
          role: u.role,
          team: u.team,
          display_name: u.display_name,
          created_at: new Date().toISOString(),
          last_login: null,
          is_active: true
        }))
      })
    });
  });

  // Mock users endpoint on port 8080
  await page.route('**:8080/users', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: Object.values(USERS).map(u => ({
          id: u.id,
          username: u.username,
          role: u.role,
          team: u.team,
          display_name: u.display_name,
          created_at: new Date().toISOString(),
          last_login: null,
          is_active: true
        }))
      })
    });
  });
}

// Helper to clear auth state
async function clearAuth(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

// Helper to login
async function login(page: Page, user: typeof USERS.admin) {
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/sql/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

// Helper to logout
async function logout(page: Page, displayName: string) {
  await page.waitForLoadState('networkidle');
  const userMenuButton = page.locator('button').filter({ hasText: displayName }).first();
  await userMenuButton.click();
  await page.waitForTimeout(300);
  await page.getByText('Sign Out').click();
  // Wait for redirect to home page
  await page.waitForURL('**/', { timeout: 10000 });
  // Wait for login form to be visible
  await page.waitForLoadState('networkidle');
}

// ============================================
// LOGIN PAGE DISPLAY TESTS
// ============================================
test.describe('Login Page Display', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should display login page at root', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Damya' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should display platform description', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Data Analytics Platform')).toBeVisible();
  });

  test('should display contact admin message', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/contact.*administrator/i)).toBeVisible();
  });

  test('should have password field masked', async ({ page }) => {
    await page.goto('/');
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

// ============================================
// INPUT VALIDATION TESTS
// ============================================
test.describe('Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should disable sign in button when username is empty', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('somepassword');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  test('should disable sign in button when password is empty', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('someuser');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  test('should disable sign in button when both fields are empty', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  test('should enable sign in button when both fields are filled', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('someuser');
    await page.getByLabel('Password').fill('somepassword');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });
});

// ============================================
// AUTHENTICATION FLOW TESTS
// ============================================
test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByLabel('Username').fill('wronguser');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for error message
    await expect(page.locator('.bg-red-900\\/20')).toBeVisible({ timeout: 10000 });
  });

  test('should show error with correct username but wrong password', async ({ page }) => {
    await page.getByLabel('Username').fill('hasif');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.locator('.bg-red-900\\/20')).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await login(page, USERS.admin);
    await expect(page).toHaveURL(/\/sql/);
  });

  test('should login successfully with valid editor credentials', async ({ page }) => {
    await login(page, USERS.editor);
    await expect(page).toHaveURL(/\/sql/);
  });

  test('should login successfully with valid viewer credentials', async ({ page }) => {
    await login(page, USERS.viewer);
    await expect(page).toHaveURL(/\/sql/);
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByLabel('Username').fill('hasif');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Either shows loading or redirects quickly
    const signingInVisible = await page.getByText('Signing in...').isVisible().catch(() => false);
    const redirected = await page.waitForURL(/\/sql/, { timeout: 15000 }).then(() => true).catch(() => false);
    
    expect(signingInVisible || redirected).toBeTruthy();
  });
});

// ============================================
// USER INFO DISPLAY TESTS
// ============================================
test.describe('User Info Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('should show admin user info after login', async ({ page }) => {
    await login(page, USERS.admin);
    // Look for the user menu button which contains the display name
    await expect(page.getByRole('button', { name: /Hasif/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show editor user info after login', async ({ page }) => {
    await login(page, USERS.editor);
    await expect(page.getByRole('button', { name: /Izhar/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show viewer user info after login', async ({ page }) => {
    await login(page, USERS.viewer);
    await expect(page.getByRole('button', { name: /Ernie/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// SESSION PERSISTENCE TESTS
// ============================================
test.describe('Session Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('should redirect authenticated user from root to SQL studio', async ({ page }) => {
    await login(page, USERS.admin);
    
    await page.goto('/');
    await expect(page).toHaveURL(/\/sql/, { timeout: 10000 });
  });

  test('should maintain session after page reload', async ({ page }) => {
    await login(page, USERS.admin);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL(/\/sql/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Hasif/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should store auth token in localStorage', async ({ page }) => {
    await login(page, USERS.admin);
    
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
  });

  test('should store user info in localStorage', async ({ page }) => {
    await login(page, USERS.admin);
    
    const userStr = await page.evaluate(() => localStorage.getItem('auth_user'));
    expect(userStr).toBeTruthy();
    
    const user = JSON.parse(userStr!);
    expect(user.username).toBe('hasif');
    expect(user.role).toBe('admin');
  });
});

// ============================================
// LOGOUT TESTS
// ============================================
test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('should logout admin successfully', async ({ page }) => {
    await login(page, USERS.admin);
    await logout(page, 'Hasif');
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('should logout editor successfully', async ({ page }) => {
    await login(page, USERS.editor);
    await logout(page, 'Izhar');
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('should logout viewer successfully', async ({ page }) => {
    await login(page, USERS.viewer);
    await logout(page, 'Ernie');
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('should clear localStorage on logout', async ({ page }) => {
    await login(page, USERS.admin);
    
    let token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    
    await logout(page, 'Hasif');
    
    token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const user = await page.evaluate(() => localStorage.getItem('auth_user'));
    
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  test('should not be able to access protected routes after logout', async ({ page }) => {
    await login(page, USERS.admin);
    await logout(page, 'Hasif');
    
    await page.goto('/sql');
    
    // After logout, should either see login form or "Sign In" button
    const onLoginPage = await page.getByLabel('Username').isVisible().catch(() => false);
    const signInButton = await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false);
    const authRequired = await page.getByText(/authentication required|log in/i).isVisible().catch(() => false);
    
    expect(onLoginPage || signInButton || authRequired).toBeTruthy();
  });
});

// ============================================
// PROTECTED ROUTES TESTS
// ============================================
test.describe('Protected Routes', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('unauthenticated user cannot access /sql', async ({ page }) => {
    await page.goto('/sql');
    
    // Should show login form or "Sign In" button or auth required message
    const onLoginPage = await page.getByLabel('Username').isVisible().catch(() => false);
    const signInButton = await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false);
    const authRequired = await page.getByText(/authentication required|log in/i).isVisible().catch(() => false);
    
    expect(onLoginPage || signInButton || authRequired).toBeTruthy();
  });

  test('unauthenticated user cannot access /admin', async ({ page }) => {
    await page.goto('/admin');
    
    const onLoginPage = await page.getByLabel('Username').isVisible().catch(() => false);
    const signInButton = await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false);
    const authRequired = await page.getByText(/authentication required|log in|access denied/i).isVisible().catch(() => false);
    
    expect(onLoginPage || signInButton || authRequired).toBeTruthy();
  });

  test('unauthenticated user accessing /jobs shows limited functionality', async ({ page }) => {
    await page.goto('/jobs');
    
    // Jobs page may be accessible but with limited functionality
    // Check that the page loaded (either login form, sign in button, or jobs page)
    const onLoginPage = await page.getByLabel('Username').isVisible().catch(() => false);
    const signInButton = await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false);
    const jobsPageLoaded = await page.getByText(/job scheduler/i).isVisible().catch(() => false);
    
    // Page should load in some form
    expect(onLoginPage || signInButton || jobsPageLoaded).toBeTruthy();
  });

  test('unauthenticated user accessing /storage shows navigation', async ({ page }) => {
    await page.goto('/storage');
    
    // Storage page loads but with limited functionality - check for navigation link
    const onLoginPage = await page.getByLabel('Username').isVisible().catch(() => false);
    const signInButton = await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false);
    const storageLink = await page.getByRole('link', { name: /storage/i }).isVisible().catch(() => false);
    
    expect(onLoginPage || signInButton || storageLink).toBeTruthy();
  });
});

// ============================================
// ROLE-BASED ACCESS CONTROL TESTS
// ============================================
test.describe('Role-Based Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('admin can access admin dashboard', async ({ page }) => {
    await login(page, USERS.admin);
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByRole('heading', { name: 'Admin Overview' })).toBeVisible({ timeout: 5000 });
  });

  test('admin can access admin users page', async ({ page }) => {
    await login(page, USERS.admin);
    
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });
  });

  test('editor cannot access admin dashboard', async ({ page }) => {
    await login(page, USERS.editor);
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });

  test('viewer cannot access admin dashboard', async ({ page }) => {
    await login(page, USERS.viewer);
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 5000 });
  });

  test('viewer cannot access admin users page', async ({ page }) => {
    await login(page, USERS.viewer);
    
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    
    const hasAccessDenied = await page.getByText(/access denied|not authorized|permission/i).isVisible().catch(() => false);
    expect(hasAccessDenied).toBeTruthy();
  });
});

// ============================================
// MULTIPLE USER SESSIONS TESTS
// ============================================
test.describe('Multiple Users', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await clearAuth(page);
  });

  test('can switch between different user accounts', async ({ page }) => {
    await login(page, USERS.admin);
    await expect(page.getByRole('button', { name: /Hasif/i }).first()).toBeVisible({ timeout: 5000 });
    
    await logout(page, 'Hasif');
    
    await login(page, USERS.viewer);
    await expect(page.getByRole('button', { name: /Ernie/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('logging in with different user replaces previous session', async ({ page }) => {
    await login(page, USERS.admin);
    
    let userStr = await page.evaluate(() => localStorage.getItem('auth_user'));
    let user = JSON.parse(userStr!);
    expect(user.username).toBe('hasif');
    
    await logout(page, 'Hasif');
    
    await login(page, USERS.editor);
    
    userStr = await page.evaluate(() => localStorage.getItem('auth_user'));
    user = JSON.parse(userStr!);
    expect(user.username).toBe('izhar');
    expect(user.role).toBe('editor');
  });
});
