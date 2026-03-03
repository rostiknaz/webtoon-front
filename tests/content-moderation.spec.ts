import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const RUN_ID = Date.now().toString(36);
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'Origin': BASE_URL };

const CREATOR_EMAIL = `mod-creator-${RUN_ID}@test.example.com`;
const ADMIN_EMAIL = `mod-admin-${RUN_ID}@test.example.com`;

async function signUpUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: AUTH_HEADERS,
    data: { name: 'Mod Test User', email, password: 'TestPassword123!' },
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
      displayName: 'Moderation Tester',
      payoutMethod: 'paypal',
      payoutEmail: 'payout@test.example.com',
      tosAccepted: true,
    },
  });
  if (!response.ok()) throw new Error(`Creator registration failed: ${response.status()}`);
}

/** Valid upload metadata */
const validUploadBody = {
  title: 'Moderation Test Clip',
  categoryIds: ['cat_action'],
  aiToolUsed: 'Stable Diffusion',
  nsfwRating: 'safe' as const,
  fileSize: 10 * 1024 * 1024,
  duration: 30,
  resolution: '1080x1920',
};

test.describe('Content Moderation (Story 1.3)', () => {

  test.describe('Upload Complete + Moderation', () => {
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await signUpUser(page, CREATOR_EMAIL);
      await registerAsCreator(page);
      await page.close();
    });

    test('upload complete triggers moderation and returns status', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      // Create clip via upload init — may fail on presigned URL if R2 not configured
      const initResponse = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: validUploadBody,
      });

      // If R2 credentials not configured, init returns 500 — skip presigned URL part
      if (initResponse.status() === 500) {
        test.skip(true, 'R2 credentials not configured');
        return;
      }

      expect(initResponse.ok()).toBeTruthy();
      const initData = await initResponse.json();
      const clipId = initData._id;

      // Call upload complete — triggers moderation scan
      const completeResponse = await page.request.post(`/api/upload/complete/${clipId}`, {
        headers: AUTH_HEADERS,
      });

      expect(completeResponse.ok()).toBeTruthy();
      const completeData = await completeResponse.json();
      expect(completeData._id).toBe(clipId);
      expect(['published', 'rejected', 'review']).toContain(completeData.status);
      expect(completeData.reason).toBeTruthy();
    });

    test('upload complete rejects unauthenticated request (401)', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/upload/complete/some-clip-id`, {
        headers: AUTH_HEADERS,
      });
      expect(response.status()).toBe(401);
    });

    test('upload complete rejects non-existent clip (404)', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/complete/nonexistent-clip', {
        headers: AUTH_HEADERS,
      });
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Admin Moderation Endpoints', () => {

    test('non-admin cannot access moderation queue (401/403)', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/moderation`, {
        headers: AUTH_HEADERS,
      });
      expect([401, 403]).toContain(response.status());
    });

    test('non-admin creator cannot access moderation queue (403)', async ({ page }) => {
      // Sign up a regular creator (not admin)
      const email = `mod-nonadmin-${RUN_ID}@test.example.com`;
      await signUpUser(page, email);
      await registerAsCreator(page);
      await signInUser(page, email);

      const response = await page.request.get('/api/admin/moderation', {
        headers: AUTH_HEADERS,
      });
      expect(response.status()).toBe(403);
    });

    test('non-admin cannot approve/reject clips (403)', async ({ page }) => {
      const email = `mod-nonadmin2-${RUN_ID}@test.example.com`;
      await signUpUser(page, email);
      await signInUser(page, email);

      const response = await page.request.post('/api/admin/moderation/some-clip-id', {
        headers: AUTH_HEADERS,
        data: { action: 'approve' },
      });
      expect(response.status()).toBe(403);
    });
  });
});
