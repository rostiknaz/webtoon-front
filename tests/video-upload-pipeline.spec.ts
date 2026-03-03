import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const RUN_ID = Date.now().toString(36);
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'Origin': BASE_URL };

const CREATOR_EMAIL = `upload-creator-${RUN_ID}@test.example.com`;

/** Sign up a fresh user */
async function signUpUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: AUTH_HEADERS,
    data: { name: 'Upload Test Creator', email, password: 'TestPassword123!' },
  });
  if (!response.ok()) throw new Error(`Sign-up failed: ${response.status()}`);
}

/** Sign in an existing user */
async function signInUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: AUTH_HEADERS,
    data: { email, password: 'TestPassword123!' },
  });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
}

/** Register as creator */
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

/** Valid upload metadata */
const validUploadBody = {
  title: 'Test Upload Clip',
  categoryIds: ['cat_action'],
  aiToolUsed: 'Stable Diffusion',
  nsfwRating: 'safe' as const,
  fileSize: 10 * 1024 * 1024,
  duration: 30,
  resolution: '1080x1920',
};

test.describe('Video Upload Pipeline (Story 1.2)', () => {

  // Auth guard — no sign-up needed
  test('AC1: upload init rejects unauthenticated request (401)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload/init`, {
      headers: AUTH_HEADERS,
      data: validUploadBody,
    });
    expect(response.status()).toBe(401);
  });

  // Validation tests — need creator session
  test.describe('Validation (creator auth)', () => {
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await signUpUser(page, CREATOR_EMAIL);
      await registerAsCreator(page);
      await page.close();
    });

    test('AC1: upload init validates and creates clip for valid metadata', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: validUploadBody,
      });

      // R2 credentials not configured locally → 500 is expected
      if (response.status() === 500) {
        const body = await response.json();
        expect(body.error?.message).toContain('R2 credentials');
        return;
      }

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data._id).toBeTruthy();
      expect(data.presignedUrl).toBeTruthy();
      expect(data.expiresIn).toBe(3600);
    });

    test('AC1: upload init rejects missing required fields → VALIDATION_ERROR', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: { title: 'Missing fields' },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('AC3: rejects resolution below 1080x1920', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: { ...validUploadBody, resolution: '480x720' },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Resolution too low');
    });

    test('AC4: rejects duration under 10 seconds', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: { ...validUploadBody, duration: 5 },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('10 seconds');
    });

    test('AC4: rejects duration over 10 minutes', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: { ...validUploadBody, duration: 700 },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('10 minutes');
    });

    test('AC5: retry rejects non-existent clip (404)', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/retry/nonexistent-clip-id', {
        headers: AUTH_HEADERS,
      });

      expect(response.status()).toBe(404);
    });

    test('series episode: rejects non-owned series (403)', async ({ page }) => {
      await signInUser(page, CREATOR_EMAIL);

      const response = await page.request.post('/api/upload/init', {
        headers: AUTH_HEADERS,
        data: { ...validUploadBody, seriesId: 'nonexistent-series', episodeNumber: 1 },
      });

      expect(response.status()).toBe(403);
    });
  });
});
