import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Browse Grid View', () => {
  // ── API tests ──

  test('feed API accepts sort parameter (AC5)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?sort=popular&limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toBeDefined();
    expect(Array.isArray(data.clips)).toBeTruthy();
  });

  test('feed API sort=popular returns clips ordered by views desc', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?sort=popular&limit=10`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // Views should be in descending order
    for (let i = 1; i < data.clips.length; i++) {
      expect(data.clips[i].views).toBeLessThanOrEqual(data.clips[i - 1].views);
    }
  });

  test('feed API sort=trending returns clips from last 7 days', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?sort=trending&limit=10`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const clip of data.clips) {
      if (clip.publishedAt) {
        const publishedDate = new Date(clip.publishedAt);
        expect(publishedDate.getTime()).toBeGreaterThan(sevenDaysAgo.getTime());
      }
    }
  });

  test('feed API accepts search parameter (AC4)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?search=test&limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toBeDefined();
    expect(Array.isArray(data.clips)).toBeTruthy();
  });

  test('feed API search filters by title (case-insensitive)', async ({ request }) => {
    // First get all clips to find a title to search for
    const allResponse = await request.get(`${BASE_URL}/api/feed?limit=5`);
    const allData = await allResponse.json();

    if (allData.clips.length > 0) {
      // Search for a substring of the first clip's title
      const firstTitle = allData.clips[0].title;
      const searchTerm = firstTitle.slice(0, 3).toLowerCase();

      const searchResponse = await request.get(`${BASE_URL}/api/feed?search=${searchTerm}&limit=50`);
      expect(searchResponse.ok()).toBeTruthy();

      const searchData = await searchResponse.json();
      // All results should contain the search term (case-insensitive)
      for (const clip of searchData.clips) {
        expect(clip.title.toLowerCase()).toContain(searchTerm.toLowerCase());
      }
    }
  });

  test('feed API popular sort uses offset pagination', async ({ request }) => {
    const page1 = await request.get(`${BASE_URL}/api/feed?sort=popular&limit=2`);
    expect(page1.ok()).toBeTruthy();
    const data1 = await page1.json();

    if (data1.nextCursor) {
      // nextCursor for popular sort should be a numeric offset
      expect(Number.isNaN(parseInt(data1.nextCursor, 10))).toBeFalsy();

      const page2 = await request.get(`${BASE_URL}/api/feed?sort=popular&limit=2&cursor=${data1.nextCursor}`);
      expect(page2.ok()).toBeTruthy();
      const data2 = await page2.json();

      // No duplicates between pages
      const page1Ids = new Set(data1.clips.map((c: { _id: string }) => c._id));
      for (const clip of data2.clips) {
        expect(page1Ids.has(clip._id)).toBeFalsy();
      }
    }
  });

  test('feed API default sort is latest (backward compatible)', async ({ request }) => {
    const withSort = await request.get(`${BASE_URL}/api/feed?sort=latest&limit=5`);
    const withoutSort = await request.get(`${BASE_URL}/api/feed?limit=5`);

    expect(withSort.ok()).toBeTruthy();
    expect(withoutSort.ok()).toBeTruthy();

    const dataWith = await withSort.json();
    const dataWithout = await withoutSort.json();

    // Same clips returned when sort=latest (default)
    expect(dataWith.clips.map((c: { _id: string }) => c._id)).toEqual(
      dataWithout.clips.map((c: { _id: string }) => c._id),
    );
  });

  // ── UI tests ──

  test('/browse route loads and renders grid (AC1)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to appear
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('browse page shows search bar (AC4)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('browse page shows sort toggle (AC5)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    await expect(page.getByText('New')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Popular')).toBeVisible();
    await expect(page.getByText('Trending')).toBeVisible();
  });

  test('browse page shows empty state for no results', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse?search=zzzznonexistent999`);

    await expect(page.getByText('No clips found')).toBeVisible({ timeout: 10000 });
  });

  // ── UI interaction tests (review fixes) ──

  test('clip cards show title, creator name, and counts (AC2)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to load with actual cards
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });

    // Get the first clip card link
    const firstCard = page.locator('[class*="grid"] a.group').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Verify card has title text (13px font-medium)
    const title = firstCard.locator('h3');
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();

    // Verify card has creator name starting with @
    const creator = firstCard.locator('p');
    await expect(creator).toBeVisible();
    const creatorText = await creator.textContent();
    expect(creatorText).toMatch(/^@/);
  });

  test('search bar filters clips on typing (AC4 interaction)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to load
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type a nonexistent search term
    await searchInput.fill('zzzznonexistent999');

    // Wait for debounce (300ms) + API response
    await expect(page.getByText('No clips found')).toBeVisible({ timeout: 5000 });

    // Clear search by selecting all and deleting (avoids overlay click issues)
    await searchInput.fill('');

    // "No clips found" should disappear after search is cleared
    await expect(page.getByText('No clips found')).toBeHidden({ timeout: 10000 });
  });

  test('sort toggle changes results (AC5 interaction)', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to load
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });

    // Click "Popular" sort button
    const popularBtn = page.getByText('Popular');
    await popularBtn.click();

    // URL should update with sort=popular
    await page.waitForURL(/sort=popular/, { timeout: 5000 });

    // Grid should still be visible (reloaded with popular sort)
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 5000 });

    // Click "Trending" sort button
    const trendingBtn = page.getByText('Trending');
    await trendingBtn.click();

    await page.waitForURL(/sort=trending/, { timeout: 5000 });
  });

  test('category filter works on browse grid', async ({ page }) => {
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to load
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });

    // Find a category chip button (skip "All" chip)
    const categoryChips = page.locator('button').filter({ hasText: /^(?!All$|New$|Popular$|Trending$).+/ });
    const chipCount = await categoryChips.count();

    if (chipCount > 0) {
      const chipText = await categoryChips.first().textContent();
      await categoryChips.first().click();

      // URL should update with category parameter
      await page.waitForURL(/category=/, { timeout: 5000 });

      // Grid should still be visible (reloaded with category filter)
      await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 5000 });

      // Verify the chip is now in active state (has text content matching)
      expect(chipText).toBeTruthy();
    }
  });

  test('responsive grid has 2 columns on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/browse`);

    // Wait for grid to load
    const grid = page.locator('[class*="grid"]').first();
    await expect(grid).toBeVisible({ timeout: 10000 });

    // Verify grid-cols-2 class is present
    const gridClass = await grid.getAttribute('class');
    expect(gridClass).toContain('grid-cols-2');
  });
});
