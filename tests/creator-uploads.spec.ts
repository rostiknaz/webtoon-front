import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const RUN_ID = Date.now().toString(36);
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'Origin': BASE_URL };

const CREATOR_EMAIL = `uploads-creator-${RUN_ID}@test.example.com`;
const CONSUMER_EMAIL = `uploads-consumer-${RUN_ID}@test.example.com`;

async function signUpUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: AUTH_HEADERS,
    data: { name: 'Upload Status Tester', email, password: 'TestPassword123!' },
  });
  if (!response.ok()) throw new Error(`Sign-up failed: ${response.status()}`);
}

async function signInUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: AUTH_HEADERS,
    data: { email, password: 'TestPassword123!' },
  });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
}

async function registerAsCreator(page: Page): Promise<void> {
  const response = await page.request.post('/api/creators/register', {
    headers: AUTH_HEADERS,
    data: {
      displayName: 'Upload Tester',
      payoutMethod: 'paypal',
      payoutEmail: 'payout@test.example.com',
      tosAccepted: true,
    },
  });
  if (!response.ok()) throw new Error(`Creator registration failed: ${response.status()}`);
}

test.describe('Creator Upload Status Tracking (Story 1.4)', () => {

  test.describe('API: GET /api/clips/mine', () => {
    test('returns 401 for unauthenticated user', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/clips/mine`, {
        headers: AUTH_HEADERS,
      });
      expect(response.status()).toBe(401);
    });

    test('returns 403 for non-creator (consumer)', async ({ page }) => {
      await signUpUser(page, CONSUMER_EMAIL);
      await signInUser(page, CONSUMER_EMAIL);

      const response = await page.request.get('/api/clips/mine', {
        headers: AUTH_HEADERS,
      });
      expect(response.status()).toBe(403);
    });

    test('returns clips for authenticated creator', async ({ page }) => {
      await signUpUser(page, CREATOR_EMAIL);
      await registerAsCreator(page);
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.get('/api/clips/mine', {
        headers: AUTH_HEADERS,
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.clips).toBeDefined();
      expect(Array.isArray(data.clips)).toBeTruthy();
      // New creator has 0 clips
      expect(data.clips.length).toBe(0);
    });
  });

  test.describe('UI: /creator/uploads page', () => {

    test('non-authenticated user is redirected away', async ({ page }) => {
      await page.goto(`${BASE_URL}/creator/uploads`);
      // Should redirect to home
      await page.waitForURL('**/');
      expect(page.url()).not.toContain('/creator/uploads');
    });

    test('creator sees empty state when no uploads', async ({ page }) => {
      const email = `uploads-empty-${RUN_ID}@test.example.com`;
      await signUpUser(page, email);
      await registerAsCreator(page);
      await signInUser(page, email);

      await page.goto(`${BASE_URL}/creator/uploads`);
      await expect(page.locator('text=No uploads yet')).toBeVisible({ timeout: 10000 });
    });
  });
});
