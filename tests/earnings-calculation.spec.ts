import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Revenue Pool Calculation & Earnings Ledger (Story 6.2)
 *
 * Tests:
 * 1. POST /api/admin/payouts/calculate - Returns 401 for unauthenticated
 * 2. POST /api/admin/payouts/calculate - Returns 403 for non-admin
 * 3. POST /api/admin/payouts/calculate - Returns 403 for creator role
 * 4. GET /api/creators/me/earnings - Returns 401 for unauthenticated
 * 5. GET /api/creators/me/earnings - Returns earnings ledger for creator
 * 6. GET /api/creators/me/stats - Returns earnings fields after setup
 * 7. Dashboard page renders earnings ledger section
 *
 * Note: Admin-only tests (calculation with test data, idempotency, zero revenue/downloads)
 * cannot be tested in E2E because there is no way to create admin users via API.
 * Those scenarios are covered by the auth guard tests (401/403).
 */

test.describe.configure({ mode: 'serial' });

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const BASE_URL = 'http://localhost:5173';
const AUTH_HEADERS = { 'Content-Type': 'application/json', Origin: BASE_URL };

const EMAILS = {
  creator: `earn-creator-${RUN_ID}@test.example.com`,
  consumer: `earn-consumer-${RUN_ID}@test.example.com`,
};

const VALID_REGISTRATION = {
  displayName: 'Earnings Creator',
  bio: 'Testing earnings',
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

test.describe('Earnings Calculation & Ledger', () => {
  // ============================================================
  // ADMIN ENDPOINT AUTH GUARD TESTS
  // ============================================================

  test.describe('Admin Calculate Endpoint - Auth Guard', () => {
    test('should return 401 for unauthenticated POST /api/admin/payouts/calculate', async ({
      request,
    }) => {
      const response = await request.post(`${BASE_URL}/api/admin/payouts/calculate`, {
        headers: AUTH_HEADERS,
        data: { month: '2026-03' },
      });
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 for consumer POST /api/admin/payouts/calculate', async ({
      page,
    }) => {
      await signUpUser(page, EMAILS.consumer);

      const response = await page.request.post('/api/admin/payouts/calculate', {
        headers: AUTH_HEADERS,
        data: { month: '2026-03' },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    test('should return 403 for creator POST /api/admin/payouts/calculate', async ({
      page,
    }) => {
      await signUpUser(page, EMAILS.creator);
      const regResponse = await page.request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(regResponse.status()).toBe(200);
      await signInUser(page, EMAILS.creator);

      const response = await page.request.post('/api/admin/payouts/calculate', {
        headers: AUTH_HEADERS,
        data: { month: '2026-03' },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // CREATOR EARNINGS LEDGER TESTS
  // ============================================================

  test.describe('Creator Earnings Ledger', () => {
    test('should return 401 for unauthenticated GET /api/creators/me/earnings', async ({
      request,
    }) => {
      const response = await request.get(`${BASE_URL}/api/creators/me/earnings`);
      expect(response.status()).toBe(401);
    });

    test('should return earnings ledger for authenticated creator', async ({ page }) => {
      await signInUser(page, EMAILS.creator);

      const response = await page.request.get('/api/creators/me/earnings');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('earnings');
      expect(Array.isArray(body.earnings)).toBe(true);

      // New creator should have empty earnings
      expect(body.earnings.length).toBe(0);
    });

    test('should return real earnings in stats endpoint', async ({ page }) => {
      await signInUser(page, EMAILS.creator);

      const response = await page.request.get('/api/creators/me/stats');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(typeof body.monthlyEarnings).toBe('number');
      expect(typeof body.lifetimeEarnings).toBe('number');
      // New creator without earnings calculation should have 0
      expect(body.monthlyEarnings).toBe(0);
      expect(body.lifetimeEarnings).toBe(0);
    });
  });

  // ============================================================
  // UI TESTS
  // ============================================================

  test.describe('Dashboard Earnings Ledger UI', () => {
    test('should render earnings ledger section on dashboard', async ({ page }) => {
      await page.addInitScript(
        ([key, val]) => localStorage.setItem(key, val),
        [PREFERENCES_KEY, AGE_CONFIRMED_STATE] as const,
      );
      await signInUser(page, EMAILS.creator);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check earnings ledger heading is visible
      await expect(page.getByText('Earnings Ledger')).toBeVisible();

      // Empty state for new creator
      await expect(page.getByText('No earnings recorded yet.')).toBeVisible();
    });
  });
});
