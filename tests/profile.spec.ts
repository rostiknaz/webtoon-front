import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Profile Page & Session Management (Story 3.2)
 *
 * Tests the profile page, login/logout flows, and session persistence.
 * Tests run serially to share auth state across sequential tests.
 */

test.describe.configure({ mode: 'serial' });

let TEST_USER: { name: string; email: string; password: string };

/** Zustand persist key — must match app store */
const STORE_KEY = 'webtoon-preferences';

function zustandState(overrides: {
  ageGateConfirmed?: boolean;
  nsfwEnabled?: boolean;
  swipeCount?: number;
  gateShownCount?: number;
  registered?: boolean;
} = {}) {
  return JSON.stringify({
    state: {
      ageGateConfirmed: overrides.ageGateConfirmed ?? true,
      nsfwEnabled: overrides.nsfwEnabled ?? false,
      likedEpisodes: {},
      swipeCount: overrides.swipeCount ?? 0,
      gateShownCount: overrides.gateShownCount ?? 0,
      registered: overrides.registered ?? true,
    },
    version: 0,
  });
}

/** Bypass age gate for all tests */
async function bypassAgeGate(page: Page) {
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    [STORE_KEY, zustandState({ ageGateConfirmed: true, registered: true })] as const,
  );
}

/**
 * Sign up a new user via the Profile page's AuthDrawer.
 * On mobile, /profile auto-opens AuthDrawer for anonymous users.
 */
async function signUpViaProfile(page: Page) {
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');

  // AuthDrawer should auto-open for anonymous users
  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible({ timeout: 5000 });

  // Click "Continue with Email"
  await drawer.getByText('Continue with Email').click();

  // Switch to signup mode
  await drawer.getByText("Don't have an account? Sign up").click();

  // Fill signup form
  await drawer.locator('input[name="name"]').fill(TEST_USER.name);
  await drawer.locator('input[name="email"]').fill(TEST_USER.email);
  await drawer.locator('input[name="password"]').fill(TEST_USER.password);

  // Submit
  await drawer.getByRole('button', { name: 'Create Account' }).click();

  // Wait for auth to complete (drawer closes, session loads)
  await expect(drawer).not.toBeVisible({ timeout: 10000 });
}

/**
 * Log in via the Profile page's AuthDrawer.
 */
async function loginViaProfile(page: Page) {
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');

  // AuthDrawer should auto-open for anonymous users
  const drawer = page.locator('[role="dialog"]');
  await expect(drawer).toBeVisible({ timeout: 5000 });

  // Click "Continue with Email"
  await drawer.getByText('Continue with Email').click();

  // Fill login form
  await drawer.locator('input[name="email"]').fill(TEST_USER.email);
  await drawer.locator('input[name="password"]').fill(TEST_USER.password);

  // Submit
  await drawer.getByRole('button', { name: 'Sign In' }).click();

  // Wait for auth to complete
  await expect(drawer).not.toBeVisible({ timeout: 10000 });
}

test.describe('Profile Page (Story 3.2)', () => {
  test.beforeAll(() => {
    TEST_USER = {
      name: 'Profile Test User',
      email: `profile-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };
  });

  test('anonymous user tapping Profile tab sees login prompt (AC7, 6.4)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only: Profile tab is in bottom nav');

    await bypassAgeGate(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Tap Profile tab in bottom nav
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await nav.getByText('Profile').click();

    // Should navigate to /profile
    await page.waitForURL('**/profile');

    // Should show "Join to unlock full access" prompt
    await expect(page.getByText('Join to unlock full access')).toBeVisible({ timeout: 5000 });

    // AuthDrawer should open automatically for anonymous users
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
  });

  test('sign up and verify profile shows user info (AC2, 6.1, 6.5)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only: tests bottom nav profile flow');

    await bypassAgeGate(page);

    // Sign up via Profile page's AuthDrawer
    await signUpViaProfile(page);

    // Verify user info is displayed (AC6, 6.5)
    await expect(page.getByText(TEST_USER.name)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // Verify subscription section shows "Free tier" text
    await expect(page.getByText('Free tier')).toBeVisible({ timeout: 5000 });

    // Verify "My Account" link is visible
    await expect(page.getByText('My Account')).toBeVisible({ timeout: 5000 });

    // Verify "Log out" button is visible
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 5000 });
  });

  test('logout from Profile tab clears session (AC3, 6.2)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only: tests bottom nav profile flow');

    await bypassAgeGate(page);

    // Login via Profile page
    await loginViaProfile(page);

    // Verify authenticated state
    await expect(page.getByText(TEST_USER.name)).toBeVisible({ timeout: 10000 });

    // Click "Log out"
    await page.getByRole('button', { name: 'Log out' }).click();

    // Should navigate to /feed
    await page.waitForURL('**/feed');

    // Navigate back to profile — should show anonymous state
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByText('Profile').click();
    await page.waitForURL('**/profile');

    // Should show anonymous prompt again
    await expect(page.getByText('Join to unlock full access')).toBeVisible({ timeout: 5000 });
  });

  test('page reload preserves logged-in state (AC4, 6.3)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only: tests bottom nav profile flow');

    await bypassAgeGate(page);

    // Login via Profile page
    await loginViaProfile(page);

    // Verify authenticated state
    await expect(page.getByText(TEST_USER.name)).toBeVisible({ timeout: 10000 });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Session should be restored — profile should show authenticated state
    await expect(page.getByText(TEST_USER.name)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
  });

  test('Profile tab in bottom nav highlights correctly (AC6)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');

    await bypassAgeGate(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Profile tab should have aria-current="page"
    const activeLink = nav.locator('a[aria-current="page"]');
    await expect(activeLink).toHaveCount(1);
    await expect(activeLink).toContainText('Profile');
  });
});
