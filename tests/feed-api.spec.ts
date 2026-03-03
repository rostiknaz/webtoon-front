import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Feed API - Cursor Pagination', () => {
  test('returns clips ordered by publishedAt DESC with nextCursor', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toBeDefined();
    expect(Array.isArray(data.clips)).toBeTruthy();
    expect(data.clips.length).toBeLessThanOrEqual(5);

    // Should have a nextCursor since we have 20 seed clips and asked for 5
    expect(data.nextCursor).toBeTruthy();

    // Verify clips are ordered by publishedAt DESC
    for (let i = 1; i < data.clips.length; i++) {
      const prev = new Date(data.clips[i - 1].publishedAt).getTime();
      const curr = new Date(data.clips[i].publishedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test('returns correct fields for each clip (AC5)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=1`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips.length).toBeGreaterThan(0);

    const clip = data.clips[0];
    expect(clip._id).toBeDefined();
    expect(clip.title).toBeDefined();
    expect(clip.creatorId).toBeDefined();
    expect(clip.creatorName).toBeDefined();
    expect(clip).toHaveProperty('videoUrl');
    expect(clip).toHaveProperty('thumbnailUrl');
    expect(clip).toHaveProperty('duration');
    expect(clip).toHaveProperty('downloadCount');
    expect(clip).toHaveProperty('views');
    expect(clip).toHaveProperty('likes');
    expect(clip.nsfwRating).toBeDefined();
    expect(clip).toHaveProperty('seriesId');
    expect(clip).toHaveProperty('episodeNumber');
    expect(clip).toHaveProperty('seriesTotalEpisodes');
    expect(clip.publishedAt).toBeDefined();
    expect(Array.isArray(clip.categoryIds)).toBeTruthy();
  });

  test('cursor pagination returns next page without duplicates (AC2)', async ({ request }) => {
    // Get first page
    const page1 = await request.get(`${BASE_URL}/api/feed?limit=5`);
    expect(page1.ok()).toBeTruthy();
    const data1 = await page1.json();
    expect(data1.nextCursor).toBeTruthy();

    // Get second page using cursor
    const page2 = await request.get(`${BASE_URL}/api/feed?limit=5&cursor=${data1.nextCursor}`);
    expect(page2.ok()).toBeTruthy();
    const data2 = await page2.json();

    // No duplicates between pages
    const page1Ids = new Set(data1.clips.map((c: any) => c._id));
    for (const clip of data2.clips) {
      expect(page1Ids.has(clip._id)).toBeFalsy();
    }

    // Second page clips should be older than first page clips
    if (data1.clips.length > 0 && data2.clips.length > 0) {
      const lastPage1 = new Date(data1.clips[data1.clips.length - 1].publishedAt).getTime();
      const firstPage2 = new Date(data2.clips[0].publishedAt).getTime();
      expect(lastPage1).toBeGreaterThanOrEqual(firstPage2);
    }
  });

  test('returns empty array and no cursor at end of feed (AC3)', async ({ request }) => {
    // Fetch all pages until no more
    let cursor: string | null = null;
    let totalClips = 0;
    let pages = 0;

    do {
      const url = cursor
        ? `${BASE_URL}/api/feed?limit=10&cursor=${cursor}`
        : `${BASE_URL}/api/feed?limit=10`;
      const response = await request.get(url);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      totalClips += data.clips.length;
      cursor = data.nextCursor;
      pages++;

      // Safety: prevent infinite loop
      if (pages > 10) break;
    } while (cursor);

    // Last page should have no cursor
    expect(cursor).toBeNull();
    // We should have received all safe clips (most of 20 seed clips are safe)
    expect(totalClips).toBeGreaterThan(0);
  });

  test('default nsfw=safe filters out non-safe clips', async ({ request }) => {
    // Default feed (nsfw=safe)
    const response = await request.get(`${BASE_URL}/api/feed?limit=50`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    for (const clip of data.clips) {
      expect(clip.nsfwRating).toBe('safe');
    }
  });

  test('nsfw=all returns all clips including non-safe', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&nsfw=all`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // Should have more clips than safe-only
    const safeResponse = await request.get(`${BASE_URL}/api/feed?limit=50&nsfw=safe`);
    const safeData = await safeResponse.json();

    expect(data.clips.length).toBeGreaterThanOrEqual(safeData.clips.length);
  });

  test('category filter returns only clips in that category', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&category=cat_action`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips.length).toBeGreaterThan(0);

    // Each clip should have the requested category
    for (const clip of data.clips) {
      expect(clip.categoryIds).toContain('cat_action');
    }
  });

  test('clips include series metadata when part of a series', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=50&nsfw=all`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    const seriesClip = data.clips.find((c: any) => c.seriesId !== null);
    const standaloneClip = data.clips.find((c: any) => c.seriesId === null);

    // Should have both types in seed data
    expect(seriesClip).toBeDefined();
    expect(standaloneClip).toBeDefined();

    // Series clip should have episode metadata
    expect(seriesClip.episodeNumber).toBeDefined();
    expect(seriesClip.seriesTotalEpisodes).toBeDefined();
    expect(seriesClip.seriesTotalEpisodes).toBeGreaterThan(0);

    // Standalone clip should have null series fields
    expect(standaloneClip.seriesId).toBeNull();
    expect(standaloneClip.episodeNumber).toBeNull();
    expect(standaloneClip.seriesTotalEpisodes).toBeNull();
  });

  test('default limit is 20', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // With 20 seed clips (most safe), should get up to 20
    expect(data.clips.length).toBeLessThanOrEqual(20);
  });

  test('invalid limit returns validation error', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=100`);
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('feed is accessible without authentication', async ({ request }) => {
    // No cookies or auth headers
    const response = await request.get(`${BASE_URL}/api/feed?limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.clips).toBeDefined();
  });

  test('creatorName falls back to user name when displayName is null', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/feed?limit=5`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    for (const clip of data.clips) {
      expect(clip.creatorName).toBeTruthy();
      expect(clip.creatorName).not.toBe('Unknown');
    }
  });
});
