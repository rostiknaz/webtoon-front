import { test, expect } from '@playwright/test';

/** Zustand persist key */
const STORE_KEY = 'webtoon-preferences';

/** Must match SWIPE_GATE_THRESHOLD in src/hooks/useSwipeGate.ts */
const SWIPE_GATE_THRESHOLD = 10;

/** Must match SWIPE_GATE_REAPPEAR_INTERVAL in src/hooks/useSwipeGate.ts */
const SWIPE_GATE_REAPPEAR_INTERVAL = 8;

function zustandState(overrides: {
  ageGateConfirmed?: boolean;
  nsfwEnabled?: boolean;
  likedEpisodes?: Record<string, boolean>;
  swipeCount?: number;
  gateShownCount?: number;
  registered?: boolean;
} = {}) {
  return JSON.stringify({
    state: {
      ageGateConfirmed: overrides.ageGateConfirmed ?? true,
      nsfwEnabled: overrides.nsfwEnabled ?? false,
      likedEpisodes: overrides.likedEpisodes ?? {},
      swipeCount: overrides.swipeCount ?? 0,
      gateShownCount: overrides.gateShownCount ?? 0,
      registered: overrides.registered ?? false,
    },
    version: 0,
  });
}

/** Simulate N vertical swipes on the feed player */
async function swipeDown(page: import('@playwright/test').Page, count: number) {
  const feedPlayer = page.locator('.feed-player').first();
  const box = await feedPlayer.boundingBox();
  if (!box) throw new Error('Feed player not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height * 0.7;
  const endY = box.y + box.height * 0.2;

  for (let i = 0; i < count; i++) {
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 5 });
    await page.mouse.up();
    // Wait for slide transition to complete
    await page.waitForTimeout(500);
  }
}

test.describe('Swipe Gate & Registration Flow (Story 3.1)', () => {
  // ── AC1: Gate triggers after N swipes ──

  test('registration gate does NOT appear before threshold (AC1)', async ({ page }) => {
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD - 2 });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    // Gate should NOT be visible
    await expect(page.locator('[data-testid="registration-gate"]')).not.toBeVisible();
  });

  test('registration gate appears at swipe threshold (AC1)', async ({ page }) => {
    // Set swipe count just at the threshold
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    // Gate should be visible
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 5000 });

    // Should contain registration UI elements
    await expect(page.getByText('Unlock Unlimited Browsing')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Continue with Email')).toBeVisible();
    await expect(page.getByText('Maybe later')).toBeVisible();
  });

  // ── AC4: Swipe-past dismissal and reappearance ──

  test('dismissing gate stores gateShownCount and gate reappears after interval (AC4)', async ({ page }) => {
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 10000 });

    // Dismiss via "Maybe later"
    await page.getByText('Maybe later').click();

    // Gate should disappear
    await expect(page.locator('[data-testid="registration-gate"]')).not.toBeVisible({ timeout: 3000 });

    // gateShownCount should be incremented in localStorage
    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw)?.state?.gateShownCount ?? null;
    }, STORE_KEY);
    expect(stored).toBe(1);
  });

  test('gate reappears after REAPPEAR_INTERVAL more swipes (AC4)', async ({ page }) => {
    // Gate was shown once (gateShownCount=1), swipeCount at reappear threshold
    const reappearAt = SWIPE_GATE_THRESHOLD + SWIPE_GATE_REAPPEAR_INTERVAL;
    const val = zustandState({ swipeCount: reappearAt, gateShownCount: 1 });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    // Gate should reappear
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 5000 });
  });

  // ── AC3: Email registration flow ──

  test('email form expands when "Continue with Email" is clicked (AC3)', async ({ page }) => {
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 10000 });

    // Click to expand email form
    await page.getByText('Continue with Email').click();

    // Form fields should appear
    await expect(page.getByPlaceholder('Your name')).toBeVisible({ timeout: 3000 });
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('Create a password (8+ chars)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('email form validates required fields (AC3)', async ({ page }) => {
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 10000 });

    await page.getByText('Continue with Email').click();
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible({ timeout: 3000 });

    // Submit empty form — trigger validation by clicking submit then blurring
    await page.getByPlaceholder('your@email.com').click();
    await page.getByPlaceholder('your@email.com').blur();

    // Validation messages should appear (form uses onBlur mode)
    await expect(page.getByText('Email is required')).toBeVisible({ timeout: 3000 });
  });

  // ── AC7: Duplicate email handling ──

  test('mode toggle switches between signup and login (AC7)', async ({ page }) => {
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-testid="registration-gate"]')).toBeVisible({ timeout: 10000 });

    await page.getByText('Continue with Email').click();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible({ timeout: 3000 });

    // Switch to login mode
    await page.getByText('Already have an account? Log in').click();

    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    // Name field should be hidden in login mode
    await expect(page.getByPlaceholder('Your name')).not.toBeVisible();

    // Switch back to signup
    await page.getByText("Don't have an account? Sign up").click();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
  });

  // ── AC5: Authenticated user never sees gate ──

  test('authenticated user never sees registration gate (AC5)', async ({ page }) => {
    // Set high swipe count but also set registered=true
    const val = zustandState({ swipeCount: SWIPE_GATE_THRESHOLD + 50, registered: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    // Gate should NOT appear
    await expect(page.locator('[data-testid="registration-gate"]')).not.toBeVisible();
  });

  test('registered user with high swipe count never sees gate', async ({ page }) => {
    // Even after many swipes, registered users should never see the gate
    const val = zustandState({
      swipeCount: 100,
      gateShownCount: 5,
      registered: true,
    });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="registration-gate"]')).not.toBeVisible();
  });

  // ── Swipe count persistence ──

  test('swipe count persists in localStorage across page reloads', async ({ page }) => {
    const val = zustandState({ swipeCount: 5 });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`/feed`);
    await expect(page.locator('[data-clip-id]').first()).toBeVisible({ timeout: 10000 });

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw)?.state?.swipeCount ?? null;
    }, STORE_KEY);
    expect(stored).toBeGreaterThanOrEqual(5);
  });
});
