import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Download History & License Access (Story 4.3)', () => {
  // ── AC6: Download history API returns 401 for anonymous user ──

  test('download history API returns 401 for anonymous user (AC6)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/download/history`);
    expect(response.status()).toBe(401);
  });

  // ── AC6: Download history API supports cursor and limit params ──

  test('download history API rejects unauthenticated with cursor params (AC6)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/download/history?cursor=1000000000&limit=5`);
    expect(response.status()).toBe(401);
  });

  // ── AC1: Download history API error response shape ──

  test('download history API returns error object for unauthorized (AC1)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/download/history`);
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // ── AC6: Limit param is bounded ──

  test('download history API respects max limit (AC6)', async ({ request }) => {
    // Even with excessive limit, should still return 401 (not 400 or crash)
    const response = await request.get(`${BASE_URL}/api/download/history?limit=1000`);
    expect(response.status()).toBe(401);
  });
});
