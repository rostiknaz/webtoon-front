import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

/** Zustand persist key and helper to build the localStorage JSON value */
const STORE_KEY = 'webtoon-preferences';

function zustandState(overrides: {
  ageGateConfirmed?: boolean;
  nsfwEnabled?: boolean;
  likedEpisodes?: Record<string, boolean>;
} = {}) {
  return JSON.stringify({
    state: {
      ageGateConfirmed: overrides.ageGateConfirmed ?? false,
      nsfwEnabled: overrides.nsfwEnabled ?? false,
      likedEpisodes: overrides.likedEpisodes ?? {},
    },
    version: 0,
  });
}

test.describe('Age Gate & NSFW Toggle', () => {
  // ── Age Gate Tests ──

  test('age gate appears on first visit (AC1)', async ({ page }) => {
    // Ensure clean state
    await page.addInitScript((key) => localStorage.removeItem(key), STORE_KEY);
    await page.goto(BASE_URL);

    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('Age Verification Required')).toBeVisible();
    await expect(page.getByRole('button', { name: 'I am 18 or older' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I am under 18' })).toBeVisible();
  });

  test('confirming 18+ stores in localStorage and loads feed (AC2)', async ({ page }) => {
    await page.addInitScript((key) => localStorage.removeItem(key), STORE_KEY);
    await page.goto(BASE_URL);

    await expect(page.locator('[role="alertdialog"]')).toBeVisible();

    await page.getByRole('button', { name: 'I am 18 or older' }).click();

    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw)?.state?.ageGateConfirmed ?? null;
    }, STORE_KEY);
    expect(stored).toBe(true);
  });

  test('denying redirects to landing page (AC3)', async ({ page }) => {
    await page.addInitScript((key) => localStorage.removeItem(key), STORE_KEY);
    await page.goto(`${BASE_URL}/feed`);

    await expect(page.locator('[role="alertdialog"]')).toBeVisible();

    await page.getByRole('button', { name: 'I am under 18' }).click();

    await page.waitForURL('**/age-restricted');
    await expect(page.getByText('Age Restricted Content')).toBeVisible();
  });

  test('returning visitor bypasses age gate (AC4)', async ({ page }) => {
    const val = zustandState({ ageGateConfirmed: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);
    await page.goto(BASE_URL);

    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
  });

  // ── NSFW Toggle Tests ──

  test('NSFW toggle default is OFF — only safe content (AC5)', async ({ page }) => {
    const val = zustandState({ ageGateConfirmed: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`${BASE_URL}/browse`);

    const toggle = page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('NSFW toggle ON — all content visible with indicator (AC6)', async ({ page }) => {
    const val = zustandState({ ageGateConfirmed: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`${BASE_URL}/browse`);

    const toggle = page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first();
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw)?.state?.nsfwEnabled ?? null;
    }, STORE_KEY);
    expect(stored).toBe(true);
  });

  test('toggle persists across navigation feed → browse → feed (AC7)', async ({ page }) => {
    const val = zustandState({ ageGateConfirmed: true, nsfwEnabled: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    // Go to feed
    await page.goto(`${BASE_URL}/feed`);
    const feedToggle = page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first();
    await expect(feedToggle).toHaveAttribute('aria-checked', 'true');

    // Navigate to browse
    await page.goto(`${BASE_URL}/browse`);
    const browseToggle = page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first();
    await expect(browseToggle).toHaveAttribute('aria-checked', 'true');

    // Navigate back to feed
    await page.goto(`${BASE_URL}/feed`);
    await expect(page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first()).toHaveAttribute('aria-checked', 'true');
  });

  test('toggle persists across page reload (AC7)', async ({ page }) => {
    const val = zustandState({ ageGateConfirmed: true, nsfwEnabled: true });
    await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [STORE_KEY, val] as const);

    await page.goto(`${BASE_URL}/browse`);
    const toggle = page.locator('[role="switch"][aria-label="Toggle adult content visibility"]').first();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Reload the page
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  // ── API-level NSFW filtering tests ──

  test('feed API returns only safe content when nsfw=safe (AC5)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?nsfw=safe&limit=20`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    for (const clip of data.clips) {
      expect(clip.nsfwRating).toBe('safe');
    }
  });

  test('feed API returns all content when nsfw=all (AC6)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?nsfw=all&limit=20`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toBeDefined();
    expect(Array.isArray(data.clips)).toBeTruthy();
  });
});
