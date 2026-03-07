/**
 * Shared E2E Test Utilities
 *
 * Common helpers for Playwright tests: age gate bypass, user signup, etc.
 * Centralizes setup logic to prevent duplication across test files.
 */

import { expect, type Page } from '@playwright/test';

export const BASE_URL = 'http://localhost:5173';
export const STORE_KEY = 'webtoon-preferences';

/** Build Zustand localStorage payload to bypass age gate */
export function zustandState(): string {
  return JSON.stringify({
    state: {
      ageGateConfirmed: true,
      nsfwEnabled: false,
      likedEpisodes: {},
      swipeCount: 0,
      gateShownCount: 0,
      registered: true,
    },
    version: 0,
  });
}

/** Inject localStorage to skip the age gate confirmation dialog */
export async function bypassAgeGate(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    [STORE_KEY, zustandState()] as const,
  );
}

interface UserCredentials {
  name: string;
  email: string;
  password: string;
}

/** Create a new user account via the sign-up form */
export async function signUpUser(page: Page, user: UserCredentials): Promise<void> {
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
  await expect(drawer).not.toBeVisible({ timeout: 30000 });
}
