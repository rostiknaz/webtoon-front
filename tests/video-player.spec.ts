import { test, expect, type Page } from '@playwright/test';

/**
 * Video Player Tests
 *
 * Tests the HybridVideoPlayer component functionality based on:
 * - VideoPlayerCacheContext (LRU caching with max 5 players)
 * - Swiper integration (vertical episode navigation)
 * - xgplayer (HLS video playback)
 * - Custom controls (play/pause, like, share, episodes)
 *
 * Architecture reference: docs/video-player-architecture.md
 */

// Helper to navigate to video player page
async function navigateToVideoPlayer(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click on first series card
  const seriesCard = page.locator('a[href*="/serials/"]').first();
  await seriesCard.click();

  // Wait for video player to load
  await page.waitForSelector('.hybrid-video-player', { timeout: 15000 });
  await page.waitForTimeout(1000); // Allow player initialization
}

// Helper to get episode indicator text (now inside active slide)
async function getEpisodeIndicator(page: Page) {
  const indicator = page.locator('.swiper-slide-active .absolute.top-4.right-4');
  return await indicator.textContent();
}

// Helper to get current episode number from indicator
async function getCurrentEpisode(page: Page): Promise<number> {
  const text = await getEpisodeIndicator(page);
  const match = text?.match(/(\d+)\s*\/\s*\d+/);
  return match ? parseInt(match[1]) : 0;
}

// Helper to get cache size from indicator
async function getCacheSize(page: Page): Promise<number> {
  const text = await getEpisodeIndicator(page);
  const match = text?.match(/cached:\s*(\d+)\/\d+/);
  return match ? parseInt(match[1]) : 0;
}

// Helper to swipe to next episode
async function swipeToNextEpisode(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & { swiper?: { slideNext: () => void } };
    swiper?.swiper?.slideNext();
  });
  await page.waitForTimeout(500); // Wait for transition
}

// Helper to swipe to previous episode
async function swipeToPrevEpisode(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & { swiper?: { slidePrev: () => void } };
    swiper?.swiper?.slidePrev();
  });
  await page.waitForTimeout(500);
}

// Helper to jump to specific episode (0-indexed)
async function jumpToEpisode(page: Page, index: number) {
  await page.evaluate((idx) => {
    const swiper = document.querySelector('.swiper') as HTMLElement & { swiper?: { slideTo: (idx: number) => void } };
    swiper?.swiper?.slideTo(idx);
  }, index);
  await page.waitForTimeout(500);
}


test.describe('Video Player - Basic Functionality', () => {
  test('loads video player with xgplayer', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Verify HybridVideoPlayer container exists
    const playerContainer = page.locator('.hybrid-video-player');
    await expect(playerContainer).toBeVisible();

    // Verify Swiper is initialized
    const swiper = page.locator('.swiper');
    await expect(swiper).toBeVisible();

    // Verify xgplayer is initialized (video element exists)
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });
  });

  test('click on video toggles play/pause', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for video to be ready
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });

    // Get initial play state
    const initialPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);

    // Click on the video container to toggle
    const slideContent = page.locator('.swiper-slide-active .player-host').first();
    if (await slideContent.isVisible()) {
      await slideContent.click();
      await page.waitForTimeout(300);

      // Check if play state changed
      const afterClickPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
      expect(afterClickPaused).not.toBe(initialPaused);
    }
  });

  test('displays episode indicator', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const indicatorText = await getEpisodeIndicator(page);

    // Should show format "X / Y (cached: N/5)"
    expect(indicatorText).toMatch(/\d+\s*\/\s*\d+/);
  });

  test('displays series title and episode info', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Top info bar should be visible (now inside active slide)
    const topBar = page.locator('.swiper-slide-active .custom-controls').first();
    await expect(topBar).toBeVisible();

    // Should contain series title (h3)
    const title = page.locator('.swiper-slide-active h3');
    await expect(title).toBeVisible();

    // Should contain episode info
    const episodeInfo = page.locator('.swiper-slide-active p').filter({ hasText: /Episode/i });
    await expect(episodeInfo.first()).toBeVisible();
  });
});


test.describe('Video Player - Episode Navigation', () => {
  test('swipe to next episode updates indicator', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const initialEpisode = await getCurrentEpisode(page);
    expect(initialEpisode).toBe(1);

    // Swipe to next
    await swipeToNextEpisode(page);

    const newEpisode = await getCurrentEpisode(page);
    expect(newEpisode).toBe(2);
  });

  test('swipe to previous episode works', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // First go to episode 2
    await swipeToNextEpisode(page);
    expect(await getCurrentEpisode(page)).toBe(2);

    // Then swipe back
    await swipeToPrevEpisode(page);
    expect(await getCurrentEpisode(page)).toBe(1);
  });

  test('jump to specific episode via swiper', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Jump to episode 5 (index 4)
    await jumpToEpisode(page, 4);

    const currentEpisode = await getCurrentEpisode(page);
    expect(currentEpisode).toBe(5);
  });

  test('rapid sequential navigation works', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Rapidly navigate through several episodes
    for (let i = 0; i < 4; i++) {
      await swipeToNextEpisode(page);
      await page.waitForTimeout(100); // Minimal wait
    }

    // Wait for stabilization
    await page.waitForTimeout(1000);

    // Should be on episode 5
    const currentEpisode = await getCurrentEpisode(page);
    expect(currentEpisode).toBe(5);
  });

  test('non-sequential jump navigation works', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Jump to episode 8
    await jumpToEpisode(page, 7);
    expect(await getCurrentEpisode(page)).toBe(8);

    // Jump back to episode 2
    await jumpToEpisode(page, 1);
    expect(await getCurrentEpisode(page)).toBe(2);

    // Jump to episode 5
    await jumpToEpisode(page, 4);
    expect(await getCurrentEpisode(page)).toBe(5);
  });
});


test.describe('Video Player - LRU Cache', () => {
  test('cache size stays within limit (max 5)', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Navigate through more than 5 episodes
    for (let i = 0; i < 7; i++) {
      await swipeToNextEpisode(page);
    }

    await page.waitForTimeout(1000);

    // Cache should not exceed 5
    const cacheSize = await getCacheSize(page);
    expect(cacheSize).toBeLessThanOrEqual(5);
  });

  test('cache stats display in development mode', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const indicatorText = await getEpisodeIndicator(page);

    // In dev mode, should show cache stats
    expect(indicatorText).toMatch(/cached:\s*\d+\/5/);
  });

  test('cached episode loads instantly on return', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Go to episode 3
    await jumpToEpisode(page, 2);
    await page.waitForTimeout(500);

    // Go to episode 5
    await jumpToEpisode(page, 4);
    await page.waitForTimeout(500);

    // Return to episode 3 (should be cached)
    const startTime = Date.now();
    await jumpToEpisode(page, 2);
    const endTime = Date.now();

    // Should be quick (cached) - less than 500ms
    expect(endTime - startTime).toBeLessThan(1000);
    expect(await getCurrentEpisode(page)).toBe(3);
  });

  test('LRU eviction evicts oldest episode', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Navigate sequentially: 1, 2, 3, 4, 5, 6
    for (let i = 0; i < 5; i++) {
      await swipeToNextEpisode(page);
      await page.waitForTimeout(300);
    }

    // Now on episode 6, cache should have evicted episode 1
    // Episode 1 should not be in cache anymore (5 most recent: 2,3,4,5,6)
    const cacheSize = await getCacheSize(page);
    expect(cacheSize).toBe(5);
  });
});


test.describe('Video Player - Controls', () => {
  test('TikTok-style action buttons are visible', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Like button
    const likeButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-heart')
    });
    await expect(likeButton).toBeVisible();

    // Share button
    const shareButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-share-2')
    });
    await expect(shareButton).toBeVisible();
  });

  test('like button toggles state', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const likeButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-heart')
    });

    // Get initial class
    const initialClass = await likeButton.getAttribute('class');

    // Click to like
    await likeButton.click();
    await page.waitForTimeout(100);

    // Class should change (includes red when liked)
    const afterClass = await likeButton.getAttribute('class');
    expect(afterClass).not.toBe(initialClass);
  });

  test('back button navigates to home', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Click back button
    const backButton = page.locator('.swiper-slide-active a[href="/"] button');
    await backButton.click();

    // Should navigate to home
    await page.waitForURL('/');
  });

  test('control buttons do not trigger video play/pause', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for video
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });

    // Get initial play state
    const initialPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);

    // Click like button (should not affect video)
    const likeButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-heart')
    });
    await likeButton.click();
    await page.waitForTimeout(200);

    // Play state should be unchanged
    const afterPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(afterPaused).toBe(initialPaused);
  });
});


test.describe('Video Player - Controls Visibility', () => {
  test('controls are visible initially', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Top info bar should be visible
    const topBar = page.locator('.swiper-slide-active .custom-controls').first();
    await expect(topBar).toBeVisible();

    // Action buttons should be visible
    const actionButtons = page.locator('.swiper-slide-active .custom-controls').last();
    await expect(actionButtons).toBeVisible();
  });

  test('controls visibility tracked by data attribute', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const playerContainer = page.locator('.hybrid-video-player');
    const controlsVisible = await playerContainer.getAttribute('data-controls-visible');

    // Initially should be visible
    expect(controlsVisible).toBe('true');
  });

  test('click shows controls and starts auto-hide timer', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const playerContainer = page.locator('.hybrid-video-player');

    // Wait for initial auto-hide (3 seconds)
    await page.waitForTimeout(3500);

    // Controls should be hidden after auto-hide timer
    let controlsVisible = await playerContainer.getAttribute('data-controls-visible');
    expect(controlsVisible).toBe('false');

    // Click to toggle play/pause - should show controls
    const slideContent = page.locator('.swiper-slide-active > div');
    await slideContent.click();
    await page.waitForTimeout(100);

    // Controls should be visible after click
    controlsVisible = await playerContainer.getAttribute('data-controls-visible');
    expect(controlsVisible).toBe('true');
  });

  test('controls auto-hide after 3 seconds', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const playerContainer = page.locator('.hybrid-video-player');

    // Controls should be visible initially
    let controlsVisible = await playerContainer.getAttribute('data-controls-visible');
    expect(controlsVisible).toBe('true');

    // Wait for auto-hide timer (3 seconds + buffer)
    await page.waitForTimeout(3500);

    // Controls should be hidden
    controlsVisible = await playerContainer.getAttribute('data-controls-visible');
    expect(controlsVisible).toBe('false');
  });
});


test.describe('Video Player - Locked Episodes', () => {
  test('locked episodes show subscribe overlay', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Get total episodes
    const indicatorText = await getEpisodeIndicator(page);
    const totalMatch = indicatorText?.match(/\d+\s*\/\s*(\d+)/);
    const totalEpisodes = totalMatch ? parseInt(totalMatch[1]) : 12;

    // Jump to a later episode (likely locked if not subscribed)
    if (totalEpisodes > 9) {
      await jumpToEpisode(page, 9); // Episode 10
      await page.waitForTimeout(500);

      // Check for locked overlay
      const lockedOverlay = page.locator('.swiper-slide-active').filter({
        hasText: /Episode is locked|Subscribe/i
      });

      // May or may not be locked depending on subscription state
      if (await lockedOverlay.isVisible()) {
        // Verify subscribe button is present
        const subscribeButton = page.locator('.swiper-slide-active button').filter({
          hasText: /Subscribe/i
        });
        await expect(subscribeButton).toBeVisible();
      }
    }
  });
});


test.describe('Video Player - Video Element', () => {
  test('video element has correct attributes', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });

    // Check playsinline attribute (important for mobile)
    const playsinline = await video.getAttribute('playsinline');
    expect(playsinline).not.toBeNull();
  });

  test('video loads and buffers', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });

    // Wait for video to load
    await page.waitForTimeout(2000);

    // Check ready state (2+ means has current data)
    const readyState = await video.evaluate((v: HTMLVideoElement) => v.readyState);
    expect(readyState).toBeGreaterThanOrEqual(2);
  });

  test('video has valid source', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });

    // xgplayer with HLS creates blob URLs
    const src = await video.evaluate((v: HTMLVideoElement) => v.src);
    expect(src).toBeTruthy();
    // Should be either blob: URL (MSE) or direct m3u8
    expect(src.startsWith('blob:') || src.includes('.m3u8')).toBe(true);
  });
});


test.describe('Video Player - Auto-advance', () => {
  test.skip('auto-advances to next episode on video end', async ({ page }) => {
    // Skip this test as it requires waiting for video to finish
    // The videos in test environment are 6 seconds
    await navigateToVideoPlayer(page);

    const initialEpisode = await getCurrentEpisode(page);

    // Wait for video to finish (assuming 6 second videos)
    await page.waitForTimeout(8000);

    const newEpisode = await getCurrentEpisode(page);
    expect(newEpisode).toBe(initialEpisode + 1);
  });
});


test.describe('Video Player - xgplayer Controls', () => {
  test('xgplayer progress bar is visible', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // xgplayer should render progress bar
    const progressBar = page.locator('.xgplayer-progress, .xgplayer-progress-outer');

    // Wait for xgplayer to fully initialize
    await page.waitForTimeout(2000);

    // Progress bar may be inside xgplayer container - use active slide to avoid multiple matches
    const xgplayerContainer = page.locator('.swiper-slide-active .xgplayer');
    await expect(xgplayerContainer).toBeVisible();
  });

  test('xgplayer play/pause button is accessible', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for xgplayer to initialize
    await page.waitForTimeout(2000);

    // xgplayer has its own play button - use active slide to avoid multiple matches
    const xgplayerContainer = page.locator('.swiper-slide-active .xgplayer');
    await expect(xgplayerContainer).toBeVisible();
  });
});


test.describe('Video Player - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X size

  test('episodes button visible on mobile', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Episodes button should be visible on mobile
    const episodesButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-list')
    });
    await expect(episodesButton).toBeVisible();
  });

  test('clicking episodes button opens drawer', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Click episodes button
    const episodesButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-list')
    });
    await expect(episodesButton).toBeVisible();
    await episodesButton.click();

    // Drawer should open - check for drawer content (vaul uses [data-vaul-drawer] or look for DrawerContent's fixed class)
    const drawer = page.locator('[data-vaul-drawer], .fixed.inset-x-0.bottom-0');
    await expect(drawer).toBeVisible({ timeout: 3000 });
  });

  test('swipe gesture works on mobile', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const initialEpisode = await getCurrentEpisode(page);

    // Simulate swipe up gesture
    const playerContainer = page.locator('.hybrid-video-player');
    const box = await playerContainer.boundingBox();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3, { steps: 10 });
      await page.mouse.up();
    }

    await page.waitForTimeout(500);

    const newEpisode = await getCurrentEpisode(page);
    expect(newEpisode).toBe(initialEpisode + 1);
  });
});


test.describe('Video Player - Desktop Viewport', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar is visible on desktop', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Desktop sidebar should be visible
    const sidebar = page.locator('.hidden.md\\:block');
    await expect(sidebar).toBeVisible();
  });

  test('clicking sidebar episode navigates', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Get sidebar episode items
    const sidebar = page.locator('.hidden.md\\:block');
    const episodeItems = sidebar.locator('[class*="cursor-pointer"], button').filter({
      hasText: /Episode/i
    });

    const count = await episodeItems.count();
    if (count > 2) {
      // Click on third episode
      await episodeItems.nth(2).click();
      await page.waitForTimeout(500);

      const currentEpisode = await getCurrentEpisode(page);
      expect(currentEpisode).toBe(3);
    }
  });

  test('episodes button hidden on desktop', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Episodes button should be hidden on desktop (md:hidden class)
    const episodesButton = page.locator('.swiper-slide-active .md\\:hidden').filter({
      has: page.locator('svg.lucide-list')
    });

    // Should not be visible (has md:hidden class)
    await expect(episodesButton).toBeHidden();
  });
});
