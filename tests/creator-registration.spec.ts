import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Creator Registration Flow (Story 1.1)
 *
 * Tests the creator registration API endpoints:
 * 1. POST /api/creators/register - Register as creator
 * 2. GET /api/creators/me - Get own creator profile
 * 3. GET /api/creators/:id - Get public creator profile
 * 4. Auth guard behavior (401/403 responses)
 * 5. Validation (missing fields, invalid data)
 *
 * Tests run sequentially. Sign-ups are minimized (3 total) to avoid rate limits.
 * Rate limit is 5 sign-ups per 60 seconds.
 */

test.describe.configure({ mode: 'serial' });

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const BASE_URL = 'http://localhost:5173';
const AUTH_HEADERS = { Origin: BASE_URL };

const VALID_REGISTRATION = {
  displayName: 'Test Creator',
  bio: 'I make great content',
  payoutMethod: 'paypal' as const,
  payoutEmail: 'payout@test.example.com',
  tosAccepted: true,
};

// Emails for test users (only 3 sign-ups needed)
const EMAILS = {
  validation: `val-${RUN_ID}@test.example.com`,
  creator: `creator-${RUN_ID}@test.example.com`,
  consumer: `consumer-${RUN_ID}@test.example.com`,
};

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

// ============================================================
// AUTH GUARD TESTS (no sign-up needed)
// ============================================================

test.describe('Creator Registration', () => {
  test.describe('Authentication Guard', () => {
    test('should return 401 for unauthenticated POST /api/creators/register', async ({
      request,
    }) => {
      const response = await request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 401 for unauthenticated GET /api/creators/me', async ({
      request,
    }) => {
      const response = await request.get('/api/creators/me');
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should allow unauthenticated GET /api/creators/:id (public)', async ({
      request,
    }) => {
      const response = await request.get('/api/creators/nonexistent-id');
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ============================================================
  // VALIDATION TESTS (1 sign-up, reuse session via sign-in)
  // ============================================================

  test.describe('Validation', () => {
    test('should reject registration without ToS acceptance', async ({ page }) => {
      // First test: sign up the validation user
      await signUpUser(page, EMAILS.validation);

      const response = await page.request.post('/api/creators/register', {
        data: {
          displayName: 'Test Creator',
          payoutMethod: 'paypal',
          payoutEmail: 'payout@test.example.com',
          tosAccepted: false,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject registration with missing display name', async ({ page }) => {
      await signInUser(page, EMAILS.validation);

      const response = await page.request.post('/api/creators/register', {
        data: {
          payoutMethod: 'paypal',
          payoutEmail: 'payout@test.example.com',
          tosAccepted: true,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject registration with short display name', async ({ page }) => {
      await signInUser(page, EMAILS.validation);

      const response = await page.request.post('/api/creators/register', {
        data: {
          displayName: 'A',
          payoutMethod: 'paypal',
          payoutEmail: 'payout@test.example.com',
          tosAccepted: true,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject registration with invalid payout method', async ({ page }) => {
      await signInUser(page, EMAILS.validation);

      const response = await page.request.post('/api/creators/register', {
        data: {
          displayName: 'Test Creator',
          payoutMethod: 'bitcoin',
          payoutEmail: 'payout@test.example.com',
          tosAccepted: true,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject registration with invalid payout email', async ({ page }) => {
      await signInUser(page, EMAILS.validation);

      const response = await page.request.post('/api/creators/register', {
        data: {
          displayName: 'Test Creator',
          payoutMethod: 'paypal',
          payoutEmail: 'not-an-email',
          tosAccepted: true,
        },
      });
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================
  // REGISTRATION FLOW (1 sign-up for creator user)
  // ============================================================

  test.describe('Registration Flow', () => {
    let creatorUserId: string;

    test('should successfully register as creator', async ({ page }) => {
      await signUpUser(page, EMAILS.creator);

      const response = await page.request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(typeof body.isFoundingCreator).toBe('boolean');
    });

    test('should return creator profile via GET /api/creators/me', async ({ page }) => {
      await signInUser(page, EMAILS.creator);

      const response = await page.request.get('/api/creators/me');
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body._id).toBeDefined();
      expect(body.displayName).toBe(VALID_REGISTRATION.displayName);
      expect(body.bio).toBe(VALID_REGISTRATION.bio);
      expect(body.role).toBe('creator');
      expect(typeof body.isFoundingCreator).toBe('boolean');
      expect(body.payoutMethod).toBe(VALID_REGISTRATION.payoutMethod);
      expect(body.payoutEmail).toBe(VALID_REGISTRATION.payoutEmail);
      expect(body.createdAt).toBeDefined();

      creatorUserId = body._id;
    });

    test('should return public creator profile via GET /api/creators/:id', async ({
      request,
    }) => {
      const response = await request.get(`/api/creators/${creatorUserId}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body._id).toBe(creatorUserId);
      expect(body.displayName).toBe(VALID_REGISTRATION.displayName);
      expect(body.bio).toBe(VALID_REGISTRATION.bio);
      expect(typeof body.isFoundingCreator).toBe('boolean');

      // Public profile should NOT include sensitive payout info
      expect(body.payoutMethod).toBeUndefined();
      expect(body.payoutEmail).toBeUndefined();
    });

    test('should reject duplicate registration (409 Conflict)', async ({ page }) => {
      await signInUser(page, EMAILS.creator);

      const response = await page.request.post('/api/creators/register', {
        data: VALID_REGISTRATION,
      });
      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe('CONFLICT');
    });
  });

  // ============================================================
  // PROFILE NOT FOUND (1 sign-up for consumer user)
  // ============================================================

  test.describe('Profile Not Found', () => {
    test('should return 404 for consumer user accessing /api/creators/me', async ({
      page,
    }) => {
      await signUpUser(page, EMAILS.consumer);

      const response = await page.request.get('/api/creators/me');
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    test('should return 404 for non-existent public profile', async ({ request }) => {
      const response = await request.get(
        '/api/creators/00000000-0000-0000-0000-000000000000'
      );
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
