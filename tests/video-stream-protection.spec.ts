import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Video Stream Protection (Story 4.4)', () => {
  // ── AC2: Missing token returns 403 ──

  test('unsigned request to /api/video/* returns 403 (AC2)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/video/solgier/ep_01/manifest.m3u8`);
    expect(response.status()).toBe(403);
  });

  // ── AC2: Expired token returns 403 ──

  test('expired token returns 403 (AC2)', async ({ request }) => {
    // Use an expired timestamp (in the past)
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const response = await request.get(
      `${BASE_URL}/api/video/solgier/ep_01/manifest.m3u8?token=fakeinvalidtoken&expires=${expiredTimestamp}`,
    );
    expect(response.status()).toBe(403);
  });

  // ── AC2: Invalid token returns 403 ──

  test('invalid token returns 403 (AC2)', async ({ request }) => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const response = await request.get(
      `${BASE_URL}/api/video/solgier/ep_01/manifest.m3u8?token=0000000000&expires=${futureTimestamp}`,
    );
    expect(response.status()).toBe(403);
  });

  // ── AC1: Token endpoint returns valid token ──

  test('token endpoint returns signed token (AC1)', async ({ request }) => {
    const path = 'solgier/ep_01/manifest.m3u8';
    const response = await request.get(`${BASE_URL}/api/video/token?path=${encodeURIComponent(path)}`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.token).toBeTruthy();
    expect(data.expires).toBeGreaterThan(Date.now() / 1000);
    expect(data.path).toBe(path);
  });

  // ── AC1 + AC3: Valid token returns content with correct headers ──

  test('valid signed request returns video content (AC1, AC3)', async ({ request }) => {
    const path = 'solgier/ep_01/manifest.m3u8';

    // Get a valid token
    const tokenResponse = await request.get(`${BASE_URL}/api/video/token?path=${encodeURIComponent(path)}`);
    expect(tokenResponse.ok()).toBeTruthy();
    const { token, expires } = await tokenResponse.json();

    // Use the token to fetch the video content
    const videoResponse = await request.get(
      `${BASE_URL}/api/video/${path}?token=${token}&expires=${expires}`,
    );

    // If the file exists in R2, we get 200; if not, 404 (which is still valid token behavior)
    expect([200, 404]).toContain(videoResponse.status());

    // If the file exists, verify content type and manifest rewriting
    if (videoResponse.status() === 200) {
      const contentType = videoResponse.headers()['content-type'];
      expect(contentType).toContain('application/vnd.apple.mpegurl');

      // Verify manifest URLs are rewritten with signed tokens (AC3)
      const body = await videoResponse.text();
      const lines = body.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      for (const line of lines) {
        expect(line).toContain('/api/video/');
        expect(line).toContain('token=');
        expect(line).toContain('expires=');
      }
    }
  });
});
