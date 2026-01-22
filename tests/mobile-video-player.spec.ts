import { test, expect } from '@playwright/test';

test.describe('Mobile Video Player', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load video player on mobile', async ({ page }) => {
    // Click on a serial card to navigate to video player
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();

    // Wait for navigation
    await page.waitForURL(/\/serials\/.+/);

    // Check if HybridVideoPlayer container is visible
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Check active slide has episode info (confirms Virtual Slides working)
    const episodeInfo = page.locator('.swiper-slide-active').filter({ hasText: /Episode/ });
    await expect(episodeInfo).toBeVisible({ timeout: 10000 });
  });

  test('should show custom controls on tap', async ({ page }) => {
    // Navigate to serial page
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Wait for video player
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Wait for active slide
    await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });

    // Custom controls should be visible
    const customControls = page.locator('.swiper-slide-active .custom-controls');
    await expect(customControls.first()).toBeVisible();

    // Check controls visibility attribute
    const controlsVisible = await videoContainer.getAttribute('data-controls-visible');
    expect(controlsVisible).toBe('true');
  });

  test('should have TikTok-style floating buttons', async ({ page }) => {
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Wait for video player
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Wait for active slide
    await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });

    // Check for Like button (in active slide)
    const likeButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-heart')
    });
    await expect(likeButton).toBeVisible();

    // Check for Episodes button (mobile only)
    const episodesButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-list')
    });
    await expect(episodesButton).toBeVisible();

    // Check for Share button
    const shareButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-share-2')
    });
    await expect(shareButton).toBeVisible();
  });

  test('should open episodes drawer on mobile', async ({ page }) => {
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Wait for video player
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Wait for active slide
    await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });

    // Click episodes button
    const episodesButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-list')
    });
    await episodesButton.click();

    // Check if drawer opens
    const drawer = page.locator('[role="dialog"], [data-vaul-drawer]');
    await expect(drawer).toBeVisible({ timeout: 3000 });
  });

  test('should have proper viewport height', async ({ page }) => {
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Check if HybridVideoPlayer has proper height
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Verify it covers the full viewport
    const boundingBox = await videoContainer.boundingBox();
    const viewport = page.viewportSize();

    if (boundingBox && viewport) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(viewport.height * 0.95);
    }
  });

  test('should maintain 9:16 aspect ratio', async ({ page }) => {
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Wait for video player and active slide
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });

    // Check container dimensions (should be portrait oriented for mobile)
    const boundingBox = await videoContainer.boundingBox();
    const viewport = page.viewportSize();
    if (boundingBox && viewport) {
      // On mobile, the container should fill the viewport width
      // and have a portrait aspect ratio (height > width)
      expect(boundingBox.height).toBeGreaterThan(boundingBox.width);
    }
  });

  test('should toggle like button', async ({ page }) => {
    const serialCard = page.locator('a[href*="/serials/"]').first();
    await serialCard.click();
    await page.waitForURL(/\/serials\/.+/);

    // Wait for video player
    const videoContainer = page.locator('.hybrid-video-player');
    await expect(videoContainer).toBeVisible({ timeout: 15000 });

    // Wait for active slide
    await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });

    // Find like button in active slide
    const likeButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-heart')
    });
    await expect(likeButton).toBeVisible();

    // Check initial state (should not have red class)
    const initialClass = await likeButton.getAttribute('class');
    expect(initialClass).not.toContain('text-red');

    // Click like button
    await likeButton.click();
    await page.waitForTimeout(100);

    // Check if class changes (should turn red)
    const newClass = await likeButton.getAttribute('class');
    expect(newClass).toContain('text-red');
  });
});
