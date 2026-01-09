import { test, expect } from '@playwright/test';

test.describe('Mobile Video Player', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a serial page - you may need to update this URL
    // For now, using a placeholder - check your backend for valid serial IDs
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load video player on mobile', async ({ page }) => {
    // Click on a serial card to navigate to video player
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();

      // Wait for navigation
      await page.waitForURL(/\/serials\/.+/);

      // Check if video player container is visible
      const videoContainer = page.locator('.video-player-container');
      await expect(videoContainer).toBeVisible();

      // Check if xgplayer is initialized
      const xgplayer = page.locator('.xgplayer');
      await expect(xgplayer).toBeVisible();
    }
  });

  test('should show custom controls on tap', async ({ page }) => {
    // Navigate to serial page
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Wait for video player
      const videoContainer = page.locator('.video-player-container');
      await expect(videoContainer).toBeVisible();

      // Custom controls should be hidden initially (on mobile)
      const customControls = page.locator('.custom-controls');

      // Tap on video to show controls
      await videoContainer.click();

      // Wait a bit for focus event to trigger
      await page.waitForTimeout(500);

      // Check if controls are visible (data attribute should be true)
      const controlsVisible = await videoContainer.getAttribute('data-mobile-controls-visible');
      expect(controlsVisible).toBe('true');
    }
  });

  test('should have TikTok-style floating buttons', async ({ page }) => {
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Wait for video player
      const videoContainer = page.locator('.video-player-container');
      await expect(videoContainer).toBeVisible();

      // Tap to show controls
      await videoContainer.click();
      await page.waitForTimeout(500);

      // Check for Like button
      const likeButton = page.locator('button').filter({ has: page.locator('svg.lucide-heart') });
      await expect(likeButton).toBeVisible();

      // Check for Episodes button (mobile only)
      const episodesButton = page.locator('button').filter({ has: page.locator('svg.lucide-list') });
      await expect(episodesButton).toBeVisible();

      // Check for Share button
      const shareButton = page.locator('button').filter({ has: page.locator('svg.lucide-share-2') });
      await expect(shareButton).toBeVisible();
    }
  });

  test('should open episodes drawer on mobile', async ({ page }) => {
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Wait for video player
      const videoContainer = page.locator('.video-player-container');
      await expect(videoContainer).toBeVisible();

      // Tap to show controls
      await videoContainer.click();
      await page.waitForTimeout(500);

      // Click episodes button
      const episodesButton = page.locator('button').filter({ has: page.locator('svg.lucide-list') });
      await episodesButton.click();

      // Check if drawer opens
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible({ timeout: 2000 });
    }
  });

  test('should have proper viewport height', async ({ page }) => {
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Check if serial page container has fixed positioning
      const serialPage = page.locator('.serial-page-container');
      await expect(serialPage).toBeVisible();

      // Verify it covers the full viewport
      const boundingBox = await serialPage.boundingBox();
      const viewport = page.viewportSize();

      if (boundingBox && viewport) {
        expect(boundingBox.height).toBeGreaterThanOrEqual(viewport.height * 0.95);
      }
    }
  });

  test('should maintain 9:16 aspect ratio', async ({ page }) => {
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Wait for video player
      const xgplayer = page.locator('.xgplayer');
      await expect(xgplayer).toBeVisible();

      // Check video dimensions
      const boundingBox = await xgplayer.boundingBox();
      if (boundingBox) {
        const aspectRatio = boundingBox.width / boundingBox.height;
        // 9:16 = 0.5625, allow some tolerance
        expect(aspectRatio).toBeGreaterThan(0.5);
        expect(aspectRatio).toBeLessThan(0.65);
      }
    }
  });

  test('should toggle like button', async ({ page }) => {
    const serialCard = page.locator('[class*="serial"]').first();
    if (await serialCard.isVisible()) {
      await serialCard.click();
      await page.waitForURL(/\/serials\/.+/);

      // Wait for video player
      const videoContainer = page.locator('.video-player-container');
      await expect(videoContainer).toBeVisible();

      // Tap to show controls
      await videoContainer.click();
      await page.waitForTimeout(500);

      // Find like button
      const likeButton = page.locator('button').filter({ has: page.locator('svg.lucide-heart') });

      // Check initial state (should be white/not liked)
      const initialClass = await likeButton.getAttribute('class');

      // Click like button
      await likeButton.click();

      // Check if class changes (should turn red)
      const newClass = await likeButton.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
      expect(newClass).toContain('red');
    }
  });
});
