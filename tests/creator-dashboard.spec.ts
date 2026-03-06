import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Creator Dashboard (Story 6.1)
 *
 * Tests:
 * 1. GET /api/creators/me/stats - Returns stats for authenticated creator
 * 2. GET /api/creators/me/stats - Returns 401 for unauthenticated user
 * 3. GET /api/creators/me/stats - Returns 403 for consumer role
 * 4. Dashboard page renders metric cards with AnimateNumber
 * 5. Consumer accessing /dashboard is redirected to profile
 *
 * Tests run sequentially. 2 sign-ups total.
 */

test.describe.configure({ mode: 'serial' });

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const BASE_URL = 'http://localhost:5173';
const AUTH_HEADERS = { Origin: BASE_URL };

const EMAILS = {
  creator: `dash-creator-${RUN_ID}@test.example.com`,
  consumer: `dash-consumer-${RUN_ID}@test.example.com`,
};

const VALID_REGISTRATION = {
  displayName: 'Dashboard Creator',
  bio: 'Testing dashboard',
  payoutMethod: 'paypal' as const,
  payoutEmail: 'payout@test.example.com',
  tosAccepted: true,
};

const PREFERENCES_KEY = 'webtoon-preferences';
const AGE_CONFIRMED_STATE = JSON.stringify({
  state: { ageGateConfirmed: true, nsfwEnabled: false, likedEpisodes: {} },
  version: 0,
});

async function signUpUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: AUTH_HEADERS,
    data: { name: 'Test User', email, password: 'TestPassword123!' },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Sign-up failed for ${email}: ${response.status()} - ${body}`);
  }
}

async function signInUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: AUTH_HEADERS,
    data: { email, password: 'TestPassword123!' },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Sign-in failed for ${email}: ${response.status()} - ${body}`);
  }
}

test.describe('Creator Dashboard', () => {
  // ============================================================
  // API AUTH GUARD TESTS
  // ============================================================

  test.describe('Stats API - Auth Guard', () => {
    test('should return 401 for unauthenticated GET /api/creators/me/stats', async ({
      request,
    }) => {
      const response = await request.get('/api/creators/me/stats');
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================
  // API TESTS WITH CREATOR USER
  // ============================================================

  test.describe('Stats API - Creator Access', () => {
    test('should return stats for authenticated creator', async ({ page }) => {
      // Sign up and register as creator
      await signUpUser(page, EMAILS.creator);
      const regResponse = await page.request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(regResponse.status()).toBe(200);

      // Sign in again to get fresh session with creator role
      await signInUser(page, EMAILS.creator);

      // Fetch stats
      const response = await page.request.get('/api/creators/me/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(typeof body.totalUploads).toBe('number');
      expect(typeof body.totalViews).toBe('number');
      expect(typeof body.totalDownloads).toBe('number');
      expect(typeof body.monthlyEarnings).toBe('number');
      expect(typeof body.lifetimeEarnings).toBe('number');
      expect(typeof body.revenueSharePercent).toBe('number');
      expect(typeof body.isFoundingCreator).toBe('boolean');

      // New creator should have 0 stats
      expect(body.totalUploads).toBe(0);
      expect(body.totalViews).toBe(0);
      expect(body.totalDownloads).toBe(0);
      expect(body.monthlyEarnings).toBe(0);
      expect(body.lifetimeEarnings).toBe(0);

      // Revenue share should be 50 or 70
      expect([50, 70]).toContain(body.revenueSharePercent);
    });

    test('should return 403 for consumer role', async ({ page }) => {
      await signUpUser(page, EMAILS.consumer);

      const response = await page.request.get('/api/creators/me/stats');
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // UI TESTS
  // ============================================================

  test.describe('Dashboard Page - UI', () => {
    test('should render metric cards for creator', async ({ page }) => {
      await page.addInitScript(
        ([key, val]) => localStorage.setItem(key, val),
        [PREFERENCES_KEY, AGE_CONFIRMED_STATE] as const,
      );
      await signInUser(page, EMAILS.creator);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check page title
      await expect(page.locator('h1')).toHaveText('Dashboard');

      // Check welcome message
      await expect(page.getByText(/Welcome,/)).toBeVisible();

      // Check all 5 metric labels are visible
      await expect(page.getByText('Total Uploads')).toBeVisible();
      await expect(page.getByText('Total Views')).toBeVisible();
      await expect(page.getByText('Total Downloads')).toBeVisible();
      await expect(page.getByText('Monthly Earnings')).toBeVisible();
      await expect(page.getByText('Lifetime Earnings')).toBeVisible();

      // Check revenue share badge
      await expect(page.getByText(/Revenue Share/)).toBeVisible();
    });

    test('should redirect consumer to profile', async ({ page }) => {
      await page.addInitScript(
        ([key, val]) => localStorage.setItem(key, val),
        [PREFERENCES_KEY, AGE_CONFIRMED_STATE] as const,
      );
      await signInUser(page, EMAILS.consumer);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /dashboard
      expect(page.url()).not.toContain('/dashboard');
      expect(page.url()).toContain('/profile');
    });

    test('should redirect unauthenticated user to profile', async ({ page }) => {
      await page.addInitScript(
        ([key, val]) => localStorage.setItem(key, val),
        [PREFERENCES_KEY, AGE_CONFIRMED_STATE] as const,
      );
      // Clear cookies to ensure unauthenticated
      await page.context().clearCookies();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /dashboard
      expect(page.url()).not.toContain('/dashboard');
    });
  });
});
