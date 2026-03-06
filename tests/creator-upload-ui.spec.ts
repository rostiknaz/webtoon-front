import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = 'http://localhost:5173';
const RUN_ID = Date.now().toString(36);
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'Origin': BASE_URL };

const CREATOR_EMAIL = `upload-ui-creator-${RUN_ID}@test.example.com`;
const CONSUMER_EMAIL = `upload-ui-consumer-${RUN_ID}@test.example.com`;

const STORE_KEY = 'webtoon-preferences';

function zustandState() {
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

async function bypassAgeGate(page: Page) {
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    [STORE_KEY, zustandState()] as const,
  );
}

async function signUpUser(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: AUTH_HEADERS,
    data: { name: 'Upload UI Tester', email, password: 'TestPassword123!' },
  });
  if (!response.ok()) throw new Error(`Sign-up failed: ${response.status()}`);
}

async function signInUser(page: Page, email: string): Promise<void> {
  await bypassAgeGate(page);
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
      displayName: 'Upload UI Tester',
      payoutMethod: 'paypal',
      payoutEmail: 'payout@test.example.com',
      tosAccepted: true,
    },
  });
  if (!response.ok()) throw new Error(`Creator registration failed: ${response.status()}`);
}

test.describe('Creator Upload UI (Story 1.6)', () => {
  let seriesId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpUser(page, CREATOR_EMAIL);
    await signInUser(page, CREATOR_EMAIL);
    await registerAsCreator(page);
    await context.close();
  });

  test('creator sees "Upload Clip" button on /creator/uploads', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);
    await page.goto(`${BASE_URL}/creator/uploads`);

    const uploadBtn = page.getByRole('button', { name: 'Upload Clip' });
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking "Upload Clip" navigates to upload page with pipeline steps', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);
    await page.goto(`${BASE_URL}/creator/uploads`);

    await page.getByRole('button', { name: 'Upload Clip' }).first().click();

    // Should navigate to /creator/upload
    await page.waitForURL('**/creator/upload');

    // Page should show pipeline indicator and form
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Moderation')).toBeVisible();
    await expect(page.locator('#clip-title')).toBeVisible();
    await expect(page.locator('#ai-tool')).toBeVisible();
  });

  test('upload page has form fields and disabled submit without file', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);
    await page.goto(`${BASE_URL}/creator/upload`);

    // Submit button should be disabled when no file is selected
    const submitButton = page.getByRole('button', { name: 'Upload', exact: true });
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    // Form fields should be present and interactive
    await expect(page.locator('#clip-title')).toBeEnabled();
    await expect(page.locator('#ai-tool')).toBeEnabled();

    // Content Rating and Video File sections
    await expect(page.locator('text=Content Rating')).toBeVisible();
    await expect(page.locator('text=Video File')).toBeVisible();
    await expect(page.locator('text=Choose file')).toBeVisible();
  });

  test('back button on upload page returns to uploads list', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);
    await page.goto(`${BASE_URL}/creator/upload`);

    await expect(page.locator('#clip-title')).toBeVisible({ timeout: 5000 });

    // Click the back arrow (first button in the header)
    const header = page.locator('.border-b').first();
    await header.locator('button').first().click();

    // Should navigate back to uploads list
    await page.waitForURL('**/creator/uploads');
    await expect(page.getByRole('heading', { name: 'My Uploads' })).toBeVisible();
  });

  test('series detail page shows "Add Episode" button', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);

    // Create series via API
    const response = await page.request.post('/api/creator-series', {
      headers: AUTH_HEADERS,
      data: {
        title: `Upload UI Test Series ${RUN_ID}`,
        description: 'Test series for upload UI E2E',
        genre: 'Action',
        nsfwRating: 'safe',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    seriesId = body._id;

    await page.goto(`${BASE_URL}/creator/series/${seriesId}`);
    const addEpisodeBtn = page.getByRole('button', { name: 'Add Episode' });
    await expect(addEpisodeBtn).toBeVisible({ timeout: 10000 });
  });

  test('upload page shows series context when accessed with search params', async ({ page }) => {
    await signInUser(page, CREATOR_EMAIL);

    // Navigate directly with series params (same as what the Add Episode link does)
    await page.goto(`${BASE_URL}/creator/upload?seriesId=${seriesId}&episodeNumber=1`);

    // Upload page should show series context
    await expect(page.getByRole('heading', { name: /Add Episode/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Adding as Episode 1 to series')).toBeVisible();
    await expect(page.locator('#clip-title')).toBeVisible();
  });

  test('non-creator (consumer) is redirected from /creator/uploads', async ({ page }) => {
    await signUpUser(page, CONSUMER_EMAIL);
    await signInUser(page, CONSUMER_EMAIL);

    await page.goto(`${BASE_URL}/creator/uploads`);
    await page.waitForURL('**/');
    expect(page.url()).not.toContain('/creator/uploads');
  });

  test('unauthenticated user is redirected from /creator/uploads', async ({ page }) => {
    await bypassAgeGate(page);
    await page.goto(`${BASE_URL}/creator/uploads`);
    await page.waitForURL('**/');
    expect(page.url()).not.toContain('/creator/uploads');
  });
});
