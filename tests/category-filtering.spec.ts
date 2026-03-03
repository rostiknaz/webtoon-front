import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Category Filtering', () => {
  test('GET /api/categories returns all categories ordered by sortOrder (AC1)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBeTruthy();
    expect(data.categories.length).toBe(8); // 8 seeded categories

    // Verify ordering by sortOrder
    for (let i = 1; i < data.categories.length; i++) {
      expect(data.categories[i].sortOrder).toBeGreaterThanOrEqual(
        data.categories[i - 1].sortOrder,
      );
    }

    // Verify fields
    const first = data.categories[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.slug).toBeDefined();
    expect(first).toHaveProperty('description');
    expect(typeof first.sortOrder).toBe('number');
  });

  test('GET /api/categories first category is Action (sortOrder 1)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    const data = await response.json();

    expect(data.categories[0].name).toBe('Action');
    expect(data.categories[0].slug).toBe('action');
    expect(data.categories[0].sortOrder).toBe(1);
  });

  test('feed category filter returns only clips in that category (AC2)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&category=cat_action`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips.length).toBeGreaterThan(0);

    for (const clip of data.clips) {
      expect(clip.categoryIds).toContain('cat_action');
    }
  });

  test('feed category filter for romance returns romance clips', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&category=cat_romance&nsfw=all`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips.length).toBeGreaterThan(0);

    for (const clip of data.clips) {
      expect(clip.categoryIds).toContain('cat_romance');
    }
  });

  test('nonexistent category returns empty array (AC3)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&category=nonexistent_cat`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toEqual([]);
    expect(data.nextCursor).toBeNull();
  });

  test('categories response includes Cache-Status header (AC4)', async ({ request }) => {
    // First request — cache MISS
    const response1 = await request.get(`${BASE_URL}/api/categories`);
    expect(response1.ok()).toBeTruthy();

    // Second request — should be cache HIT
    const response2 = await request.get(`${BASE_URL}/api/categories`);
    expect(response2.ok()).toBeTruthy();
    const cacheStatus = response2.headers()['cache-status'];
    expect(cacheStatus).toContain('HIT');
  });

  test('category filter works with cursor pagination (AC2 + pagination)', async ({ request }) => {
    // Get first page with action filter
    const page1 = await request.get(`${BASE_URL}/api/feed?limit=2&category=cat_action`);
    expect(page1.ok()).toBeTruthy();
    const data1 = await page1.json();

    // All clips in first page should be action
    for (const clip of data1.clips) {
      expect(clip.categoryIds).toContain('cat_action');
    }

    // If there's a next page, verify it also only has action clips
    if (data1.nextCursor) {
      const page2 = await request.get(
        `${BASE_URL}/api/feed?limit=2&category=cat_action&cursor=${data1.nextCursor}`,
      );
      expect(page2.ok()).toBeTruthy();
      const data2 = await page2.json();

      for (const clip of data2.clips) {
        expect(clip.categoryIds).toContain('cat_action');
      }

      // No duplicates between pages
      const page1Ids = new Set(data1.clips.map((c: any) => c._id));
      for (const clip of data2.clips) {
        expect(page1Ids.has(clip._id)).toBeFalsy();
      }
    }
  });

  test('categories endpoint is accessible without authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    expect(response.ok()).toBeTruthy();
  });
});
