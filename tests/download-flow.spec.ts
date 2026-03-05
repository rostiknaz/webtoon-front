import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * E2E Tests for Download Flow with Credit Deduction (Story 4.1)
 *
 * Tests download API, credit deduction, re-download, insufficient credits,
 * and UI integration.
 */

const BASE_URL = 'http://localhost:5173';
const STORE_KEY = 'webtoon-preferences';

function zustandState(overrides: {
  ageGateConfirmed?: boolean;
  registered?: boolean;
} = {}) {
  return JSON.stringify({
    state: {
      ageGateConfirmed: overrides.ageGateConfirmed ?? true,
      nsfwEnabled: false,
      likedEpisodes: {},
      swipeCount: 0,
      gateShownCount: 0,
      registered: overrides.registered ?? true,
    },
    version: 0,
  });
}

async function bypassAgeGate(page: Page) {
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    [STORE_KEY, zustandState({ ageGateConfirmed: true, registered: true })] as const,
  );
}

/** Sign up via Profile page AuthDrawer and return the page (cookies set on context) */
async function signUpUser(page: Page, user: { name: string; email: string; password: string }) {
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');

  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible({ timeout: 5000 });

  await drawer.getByText('Continue with Email').click();
  await drawer.getByText("Don't have an account? Sign up").click();

  await drawer.locator('input[name="name"]').fill(user.name);
  await drawer.locator('input[name="email"]').fill(user.email);
  await drawer.locator('input[name="password"]').fill(user.password);

  await drawer.getByRole('button', { name: 'Create Account' }).click();
  // Wait for drawer to close (auth completion)
  await expect(drawer).not.toBeVisible({ timeout: 30000 });
}

test.describe('Download API Tests (Story 4.1)', () => {
  let clipId: string;

  test.beforeAll(async ({ request }) => {
    // Get a published clip ID for tests
    const response = await request.get(`${BASE_URL}/api/feed?limit=1`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.clips.length).toBeGreaterThan(0);
    clipId = data.clips[0]._id;
  });

  // ── AC1: Download requires auth ──

  test('download API returns 401 for anonymous user (AC1)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/download/${clipId}`);
    expect(response.status()).toBe(401);
  });

  // ── AC1: Authenticated user can download ──

  test('authenticated user can download a clip with free credits (AC1, AC7, AC8)', async ({ page }) => {
    const id = Date.now().toString(36);
    const user = { name: `DL ${id}`, email: `dl-${id}@test.com`, password: 'TestPass123!' };

    await bypassAgeGate(page);
    await signUpUser(page, user);

    // Check initial credits
    const creditsResponse = await page.request.get(`${BASE_URL}/api/credits/balance`);
    expect(creditsResponse.ok()).toBeTruthy();
    const credits = await creditsResponse.json();
    expect(credits.freeDownloads).toBeGreaterThan(0);
    const initialFreeDownloads = credits.freeDownloads;

    // Download the clip
    const downloadResponse = await page.request.post(`${BASE_URL}/api/download/${clipId}`);
    expect(downloadResponse.ok()).toBeTruthy();

    const downloadData = await downloadResponse.json();
    expect(downloadData.downloadUrl).toBeTruthy();
    expect(downloadData.alreadyDownloaded).toBe(false);
    expect(downloadData.creditCost).toBe(1);
    expect(downloadData.freeDownloadsRemaining).toBe(initialFreeDownloads - 1);

    // Verify credit cookie was refreshed (Set-Cookie header)
    const setCookie = downloadResponse.headers()['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('webtoon.credits');
  });

  // ── AC4: Re-download without re-charge ──

  test('re-downloading same clip does not deduct credits (AC4)', async ({ page }) => {
    const id = Date.now().toString(36);
    const user = { name: `DL ${id}`, email: `dl-${id}@test.com`, password: 'TestPass123!' };

    await bypassAgeGate(page);
    await signUpUser(page, user);

    // First download
    const first = await page.request.post(`${BASE_URL}/api/download/${clipId}`);
    expect(first.ok()).toBeTruthy();
    const firstData = await first.json();
    expect(firstData.alreadyDownloaded).toBe(false);

    // Get credits after first download
    const creditsAfterFirst = await page.request.get(`${BASE_URL}/api/credits/balance`);
    const afterFirst = await creditsAfterFirst.json();

    // Re-download
    const second = await page.request.post(`${BASE_URL}/api/download/${clipId}`);
    expect(second.ok()).toBeTruthy();
    const secondData = await second.json();
    expect(secondData.alreadyDownloaded).toBe(true);
    expect(secondData.creditCost).toBe(0);

    // Credits should not have changed
    const creditsAfterSecond = await page.request.get(`${BASE_URL}/api/credits/balance`);
    const afterSecond = await creditsAfterSecond.json();
    expect(afterSecond.freeDownloads).toBe(afterFirst.freeDownloads);
    expect(afterSecond.balance).toBe(afterFirst.balance);
  });

  // ── AC6: Insufficient credits gate ──

  test('user with 0 credits gets 403 forbidden (AC6)', async ({ page, request }) => {
    test.slow(); // This test needs signup + 3 sequential downloads
    const id = Date.now().toString(36);
    const user = { name: `DL ${id}`, email: `dl-${id}@test.com`, password: 'TestPass123!' };

    await bypassAgeGate(page);
    await signUpUser(page, user);

    // Get multiple clips from feed
    const feedResponse = await request.get(`${BASE_URL}/api/feed?limit=10`);
    const feedData = await feedResponse.json();
    expect(feedData.clips.length).toBeGreaterThanOrEqual(4);

    // Exhaust all 3 free downloads on different clips
    for (let i = 0; i < 3; i++) {
      const resp = await page.request.post(`${BASE_URL}/api/download/${feedData.clips[i]._id}`);
      expect(resp.ok()).toBeTruthy();
    }

    // Verify credits are exhausted
    const credits = await page.request.get(`${BASE_URL}/api/credits/balance`);
    const creditData = await credits.json();
    expect(creditData.freeDownloads).toBe(0);
    expect(creditData.balance).toBe(0);

    // Try downloading a 4th clip — should fail
    const forbidden = await page.request.post(`${BASE_URL}/api/download/${feedData.clips[3]._id}`);
    expect(forbidden.status()).toBe(403);

    const errorData = await forbidden.json();
    expect(errorData.error.code).toBe('FORBIDDEN');
    expect(errorData.error.message).toContain('Insufficient credits');
  });
});

test.describe('Download UI Tests (Story 4.1)', () => {
  // ── AC2: Download button shows for authenticated user in browse ──

  test('download button visible in browse grid for authenticated user (AC2)', async ({ page }) => {
    const id = Date.now().toString(36);
    const user = { name: `DL ${id}`, email: `dl-${id}@test.com`, password: 'TestPass123!' };

    await bypassAgeGate(page);
    await signUpUser(page, user);

    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Download buttons should appear for authenticated users
    const downloadButtons = page.locator('button[aria-label="Download clip"]');
    await expect(downloadButtons.first()).toBeVisible({ timeout: 5000 });
  });

  // ── AC5: Anonymous user does not see download buttons in browse grid ──

  test('anonymous user does not see download buttons in browse grid (AC5)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(
      ([key, val]) => localStorage.setItem(key, val),
      [STORE_KEY, zustandState({ ageGateConfirmed: true, registered: true })] as const,
    );

    await page.goto('/browse');
    await page.waitForLoadState('networkidle');

    // Wait for grid content to load
    await page.waitForTimeout(1000);

    // Download buttons should NOT be visible
    const downloadButtons = page.locator('button[aria-label="Download clip"]');
    await expect(downloadButtons).toHaveCount(0);

    await context.close();
  });
});
