import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

/** Zustand persist key — must match app store */
const STORE_KEY = 'webtoon-preferences';

function zustandState(overrides: {
  ageGateConfirmed?: boolean;
  nsfwEnabled?: boolean;
} = {}) {
  return JSON.stringify({
    state: {
      ageGateConfirmed: overrides.ageGateConfirmed ?? true,
      nsfwEnabled: overrides.nsfwEnabled ?? false,
      likedEpisodes: {},
    },
    version: 0,
  });
}

test.describe('Bottom Navigation', () => {
  // Bypass age gate for all nav tests
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, value);
    }, { key: STORE_KEY, value: zustandState({ ageGateConfirmed: true }) });
  });

  test('bottom nav visible on mobile with 3 tabs (AC1)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto(`${BASE_URL}/feed`);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Should have Feed, Browse, Profile links
    await expect(nav.getByText('Feed')).toBeVisible();
    await expect(nav.getByText('Browse')).toBeVisible();
    await expect(nav.getByText('Profile')).toBeVisible();

    // Should NOT have Upload (consumer view)
    await expect(nav.getByText('Upload')).not.toBeVisible();
  });

  test('active tab shows dot indicator (AC1)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto(`${BASE_URL}/feed`);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Feed tab should have aria-current="page" (only Feed, not Profile placeholder)
    const feedLink = nav.locator('a[aria-current="page"]');
    await expect(feedLink).toHaveCount(1);
    await expect(feedLink).toContainText('Feed');

    // Active dot indicator should be rendered
    await expect(nav.locator('.bg-primary')).toBeVisible();
  });

  test('tapping Browse navigates to /browse (AC3)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto(`${BASE_URL}/feed`);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    await nav.getByText('Browse').click();
    await page.waitForURL('**/browse**');

    // Browse should now be the active tab
    const activeLink = nav.locator('a[aria-current="page"]');
    await expect(activeLink).toContainText('Browse');
  });

  test('desktop: bottom nav hidden (AC4)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop-only test');

    await page.goto(`${BASE_URL}/feed`);

    // Bottom nav should not be visible on desktop
    // Desktop uses side nav instead (rendered in feed.tsx desktop layout)
    const bottomNav = page.locator('nav[aria-label="Main navigation"]');
    // On desktop, BottomNav is conditionally not rendered (feed.tsx only renders it in !isDesktop block)
    await expect(bottomNav).not.toBeVisible();
  });

  test('design tokens present in CSS (AC5)', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);

    const tokens = await page.evaluate(() => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      return {
        gold: cs.getPropertyValue('--gold').trim(),
        nsfw: cs.getPropertyValue('--nsfw').trim(),
        success: cs.getPropertyValue('--success').trim(),
        info: cs.getPropertyValue('--info').trim(),
        glowGold: cs.getPropertyValue('--glow-gold').trim(),
      };
    });

    expect(tokens.gold).toBeTruthy();
    expect(tokens.nsfw).toBeTruthy();
    expect(tokens.success).toBeTruthy();
    expect(tokens.info).toBeTruthy();
    expect(tokens.glowGold).toBeTruthy();
  });

  test('nav uses proper ARIA attributes (AC1)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto(`${BASE_URL}/feed`);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute('role', 'navigation');

    // Exactly one active tab should have aria-current
    const activeLinks = nav.locator('a[aria-current="page"]');
    await expect(activeLinks).toHaveCount(1);
  });

  test('bottom nav on browse page too (AC1)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await page.goto(`${BASE_URL}/browse`);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Browse should be active
    const activeLink = nav.locator('a[aria-current="page"]');
    await expect(activeLink).toContainText('Browse');
  });
});
