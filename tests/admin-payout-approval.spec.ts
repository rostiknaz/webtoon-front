import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Admin Payout Approval Workflow (Story 6.3)
 *
 * Tests auth guard enforcement on all admin payout endpoints.
 * Admin-specific functionality (actual approval, CSV export content)
 * cannot be tested in E2E because admin users cannot be created via API.
 */

test.describe.configure({ mode: 'serial' });

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const BASE_URL = 'http://localhost:5173';
const AUTH_HEADERS = { 'Content-Type': 'application/json', Origin: BASE_URL };

const EMAILS = {
  consumer: `payout-consumer-${RUN_ID}@test.example.com`,
  creator: `payout-creator-${RUN_ID}@test.example.com`,
};

const VALID_REGISTRATION = {
  displayName: 'Payout Creator',
  bio: 'Testing payouts',
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

test.describe('Admin Payout Approval', () => {
  // ============================================================
  // GET /api/admin/payouts/months - Auth Guard
  // ============================================================

  test.describe('GET /api/admin/payouts/months - Auth Guard', () => {
    test('should return 401 for unauthenticated request', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/payouts/months`);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 for non-admin user', async ({ page }) => {
      await signUpUser(page, EMAILS.consumer);

      const response = await page.request.get('/api/admin/payouts/months');
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // GET /api/admin/payouts/:month - Auth Guard
  // ============================================================

  test.describe('GET /api/admin/payouts/:month - Auth Guard', () => {
    test('should return 403 for non-admin user', async ({ page }) => {
      await signInUser(page, EMAILS.consumer);

      const response = await page.request.get('/api/admin/payouts/2026-03');
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // POST /api/admin/payouts/approve - Auth Guard
  // ============================================================

  test.describe('POST /api/admin/payouts/approve - Auth Guard', () => {
    test('should return 403 for non-admin user', async ({ page }) => {
      await signInUser(page, EMAILS.consumer);

      const response = await page.request.post('/api/admin/payouts/approve', {
        headers: AUTH_HEADERS,
        data: { month: '2026-03' },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    test('should return 403 for creator role', async ({ page }) => {
      await signUpUser(page, EMAILS.creator);
      const regResponse = await page.request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(regResponse.status()).toBe(200);
      await signInUser(page, EMAILS.creator);

      const response = await page.request.post('/api/admin/payouts/approve', {
        headers: AUTH_HEADERS,
        data: { month: '2026-03' },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // GET /api/admin/payouts/:month/export - Auth Guard
  // ============================================================

  test.describe('GET /api/admin/payouts/:month/export - Auth Guard', () => {
    test('should return 403 for non-admin user', async ({ page }) => {
      await signInUser(page, EMAILS.consumer);

      const response = await page.request.get('/api/admin/payouts/2026-03/export');
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // Admin Payouts Page UI
  // ============================================================

  test.describe('Admin Payouts Page UI', () => {
    test('should redirect non-admin to home page', async ({ page }) => {
      await page.addInitScript(
        ([key, val]) => localStorage.setItem(key, val),
        [PREFERENCES_KEY, AGE_CONFIRMED_STATE] as const,
      );
      await signInUser(page, EMAILS.consumer);
      await page.goto('/admin/payouts');
      await page.waitForLoadState('networkidle');

      // Should be redirected away from admin page
      expect(page.url()).not.toContain('/admin/payouts');
    });
  });
});
