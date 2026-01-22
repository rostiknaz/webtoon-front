import { test, expect, type Page } from '@playwright/test';

/**
 * Black Screen Detection Tests
 *
 * Tests for detecting and diagnosing black player issues during rapid
 * episode navigation. A "black screen" occurs when:
 * - No video element is visible
 * - No skeleton loader is visible
 * - Player host is empty
 *
 * These tests help identify race conditions in:
 * - VideoPlayerCacheContext (LRU caching, player initialization)
 * - Virtual Slides (DOM rendering timing)
 * - Autoplay/loading state management
 */

// Shorter timeouts for rapid navigation tests
const NAVIGATION_WAIT = 600; // Longer wait to ensure transition completes
const STABILIZATION_WAIT = 1000;

interface BlackScreenResult {
  episode: number;
  hasVideo: boolean;
  hasSkeleton: boolean;
  hasPlayerHost: boolean;
  isBlackScreen: boolean;
  timestamp: number;
}

// Helper to navigate to video player
async function navigateToVideoPlayer(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const seriesCard = page.locator('a[href*="/serials/"]').first();
  await seriesCard.click();

  await page.waitForSelector('.hybrid-video-player', { timeout: 15000 });
  await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });
}

// Helper to get current episode number
async function getCurrentEpisode(page: Page): Promise<number> {
  const indicator = page.locator('.swiper-slide-active .absolute.top-4.right-4');
  const text = await indicator.textContent();
  const match = text?.match(/(\d+)\s*\/\s*\d+/);
  return match ? parseInt(match[1]) : 0;
}

// Helper to jump to specific episode
async function jumpToEpisode(page: Page, index: number) {
  await page.evaluate((idx) => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slideTo: (idx: number) => void };
    };
    swiper?.swiper?.slideTo(idx);
  }, index);
}

// Helper to swipe to next episode
async function swipeNext(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slideNext: () => void };
    };
    swiper?.swiper?.slideNext();
  });
}

// Helper to swipe to previous episode
async function swipePrev(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slidePrev: () => void };
    };
    swiper?.swiper?.slidePrev();
  });
}

// Check black screen state for current slide
async function checkBlackScreen(page: Page, episodeNum: number): Promise<BlackScreenResult> {
  const activeSlide = page.locator('.swiper-slide-active');

  // Check for video element
  const videoVisible = await activeSlide.locator('video').isVisible().catch(() => false);

  // Check for skeleton loader
  const skeletonVisible = await activeSlide
    .locator('[class*="animate-pulse"], [class*="animate-spin"]')
    .first()
    .isVisible()
    .catch(() => false);

  // Check for player host element
  const playerHostVisible = await activeSlide.locator('.player-host').isVisible().catch(() => false);

  // A black screen is when player host exists but no video AND no skeleton
  const isBlackScreen = playerHostVisible && !videoVisible && !skeletonVisible;

  return {
    episode: episodeNum,
    hasVideo: videoVisible,
    hasSkeleton: skeletonVisible,
    hasPlayerHost: playerHostVisible,
    isBlackScreen,
    timestamp: Date.now(),
  };
}

// Detailed black screen check with DOM inspection
async function detailedBlackScreenCheck(page: Page): Promise<{
  isBlack: boolean;
  details: string;
}> {
  const details = await page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active');
    if (!activeSlide) return { isBlack: true, details: 'No active slide found' };

    const playerHost = activeSlide.querySelector('.player-host');
    if (!playerHost) return { isBlack: true, details: 'No player host found' };

    const video = playerHost.querySelector('video');
    const skeleton = activeSlide.querySelector('[class*="animate"]');
    const childCount = playerHost.childElementCount;

    const videoSrc = video?.src || 'none';
    const videoReadyState = video?.readyState ?? -1;
    const videoPaused = video?.paused ?? true;

    const isBlack = !video && !skeleton && childCount === 0;

    return {
      isBlack,
      details: JSON.stringify({
        hasVideo: !!video,
        videoSrc: videoSrc.substring(0, 50),
        videoReadyState,
        videoPaused,
        hasSkeleton: !!skeleton,
        playerHostChildren: childCount,
        slideClasses: activeSlide.className,
      }),
    };
  });

  return details;
}


test.describe('Black Screen Detection - Rapid Navigation', () => {
  test('rapid swipe 1→9 then 9→1 detects black screens', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const blackScreens: BlackScreenResult[] = [];
    const consoleErrors: string[] = [];

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Wait for initial load
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Starting rapid navigation test: 1 → 9');

    // Navigate from 1 to 9 (swipe next 8 times)
    for (let i = 1; i <= 8; i++) {
      await swipeNext(page);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const result = await checkBlackScreen(page, i + 1);
      if (result.isBlackScreen) {
        blackScreens.push(result);
        console.log(`BLACK SCREEN detected at episode ${i + 1}`);
      }
    }

    // Verify we reached episode 9
    const episodeAt9 = await getCurrentEpisode(page);
    expect(episodeAt9).toBe(9);

    console.log('Starting rapid navigation test: 9 → 1');

    // Navigate from 9 to 1 (swipe prev 8 times)
    for (let i = 9; i >= 2; i--) {
      await swipePrev(page);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const result = await checkBlackScreen(page, i - 1);
      if (result.isBlackScreen) {
        blackScreens.push(result);
        console.log(`BLACK SCREEN detected at episode ${i - 1}`);
      }
    }

    // Verify we returned to episode 1
    const episodeAt1 = await getCurrentEpisode(page);
    expect(episodeAt1).toBe(1);

    // Report findings
    console.log('\n=== BLACK SCREEN TEST RESULTS ===');
    console.log(`Total black screens detected: ${blackScreens.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (blackScreens.length > 0) {
      console.log('\nBlack screen episodes:');
      blackScreens.forEach((bs) => {
        console.log(`  Episode ${bs.episode}: video=${bs.hasVideo}, skeleton=${bs.hasSkeleton}`);
      });
    }

    if (consoleErrors.length > 0) {
      console.log('\nConsole errors:');
      consoleErrors.slice(0, 10).forEach((err) => console.log(`  ${err}`));
    }

    // Test passes but reports findings
    // Uncomment below to fail on black screens:
    // expect(blackScreens.length).toBe(0);
  });

  test('rapid jump navigation 1→9→1 with detailed inspection', async ({ page }) => {
    const issues: Array<{ episode: number; details: string }> = [];
    const browserLogs: string[] = [];

    // Capture ALL browser console logs for debugging - MUST be before navigation
    page.on('console', (msg) => {
      const text = msg.text();
      // Capture debug logs from our code and anything with 'slide' or 'player'
      if (text.startsWith('[') || text.toLowerCase().includes('slide') || text.toLowerCase().includes('player')) {
        browserLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    await navigateToVideoPlayer(page);

    // Wait for initial load
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Testing rapid JUMP navigation (not sequential swipe)');

    // Jump directly from 1 to 9
    console.log('Jumping from episode 1 to 9...');
    await jumpToEpisode(page, 8); // 0-indexed
    await page.waitForTimeout(NAVIGATION_WAIT);

    let check = await detailedBlackScreenCheck(page);
    if (check.isBlack) {
      issues.push({ episode: 9, details: check.details });
      console.log(`Issue at episode 9: ${check.details}`);
    }

    // Wait a bit more and check again
    await page.waitForTimeout(500);
    check = await detailedBlackScreenCheck(page);
    console.log(`Episode 9 after 500ms: ${check.details}`);

    // Jump back to 1
    console.log('Jumping from episode 9 to 1...');
    await jumpToEpisode(page, 0);
    await page.waitForTimeout(NAVIGATION_WAIT);

    check = await detailedBlackScreenCheck(page);
    if (check.isBlack) {
      issues.push({ episode: 1, details: check.details });
      console.log(`Issue at episode 1: ${check.details}`);
    }

    // Wait and check again
    await page.waitForTimeout(500);
    check = await detailedBlackScreenCheck(page);
    console.log(`Episode 1 after 500ms: ${check.details}`);

    console.log(`\nTotal issues found: ${issues.length}`);

    // Print browser logs for debugging
    console.log(`\nBrowser logs (${browserLogs.length} total):`);
    browserLogs.slice(0, 20).forEach((log) => console.log(`  ${log}`));
  });

  test('stress test: rapid sequential swipes without waiting', async ({ page }) => {
    await navigateToVideoPlayer(page);

    console.log('Stress test: Rapid swipes with minimal wait');

    // Rapid fire 8 swipes forward
    for (let i = 0; i < 8; i++) {
      await swipeNext(page);
      await page.waitForTimeout(100); // Very short wait
    }

    // Wait for everything to stabilize
    await page.waitForTimeout(STABILIZATION_WAIT);

    const finalEpisode = await getCurrentEpisode(page);
    console.log(`Final episode after rapid forward: ${finalEpisode}`);

    // Check final state
    const check = await detailedBlackScreenCheck(page);
    console.log(`Final state: ${check.details}`);

    // Rapid fire 8 swipes backward
    for (let i = 0; i < 8; i++) {
      await swipePrev(page);
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(STABILIZATION_WAIT);

    const returnEpisode = await getCurrentEpisode(page);
    console.log(`Final episode after rapid backward: ${returnEpisode}`);

    const returnCheck = await detailedBlackScreenCheck(page);
    console.log(`Return state: ${returnCheck.details}`);

    // Should end up back at episode 1
    expect(returnEpisode).toBe(1);
  });

  test('jump stress test: alternating distant episodes', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const jumpSequence = [8, 0, 5, 2, 7, 1, 6, 3]; // Random jumps
    const issues: Array<{ from: number; to: number; details: string }> = [];

    console.log('Jump stress test: Alternating distant episodes');

    let currentEpisode = 1;

    for (const targetIndex of jumpSequence) {
      const targetEpisode = targetIndex + 1;
      console.log(`Jumping from ${currentEpisode} to ${targetEpisode}...`);

      await jumpToEpisode(page, targetIndex);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const check = await detailedBlackScreenCheck(page);
      if (check.isBlack) {
        issues.push({
          from: currentEpisode,
          to: targetEpisode,
          details: check.details,
        });
      }

      const actual = await getCurrentEpisode(page);
      console.log(`  Actual: ${actual}, Black: ${check.isBlack}`);

      currentEpisode = actual;
    }

    console.log(`\nTotal black screen issues: ${issues.length}`);
    if (issues.length > 0) {
      issues.forEach((i) => console.log(`  ${i.from}→${i.to}: ${i.details}`));
    }
  });
});


test.describe('Black Screen Detection - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile rapid swipe 1→9→1', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const blackScreens: number[] = [];

    await page.waitForTimeout(STABILIZATION_WAIT);

    // Forward
    for (let i = 1; i <= 8; i++) {
      await swipeNext(page);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const check = await checkBlackScreen(page, i + 1);
      if (check.isBlackScreen) {
        blackScreens.push(i + 1);
      }
    }

    // Backward
    for (let i = 9; i >= 2; i--) {
      await swipePrev(page);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const check = await checkBlackScreen(page, i - 1);
      if (check.isBlackScreen) {
        blackScreens.push(i - 1);
      }
    }

    console.log(`Mobile black screens: ${blackScreens.length}`);
    if (blackScreens.length > 0) {
      console.log(`Episodes: ${blackScreens.join(', ')}`);
    }
  });
});


test.describe('Black Screen Root Cause Analysis', () => {
  test('monitor player cache state during navigation', async ({ page }) => {
    await navigateToVideoPlayer(page);

    await page.waitForTimeout(STABILIZATION_WAIT);

    // Get cache state at each step
    const getCacheState = async () => {
      return page.evaluate(() => {
        const indicator = document.querySelector('.swiper-slide-active .absolute.top-4.right-4');
        const text = indicator?.textContent || '';
        const cacheMatch = text.match(/cached:\s*(\d+)\/(\d+)/);
        return {
          size: cacheMatch ? parseInt(cacheMatch[1]) : 0,
          max: cacheMatch ? parseInt(cacheMatch[2]) : 5,
        };
      });
    };

    console.log('Monitoring cache state during navigation:');

    for (let i = 1; i <= 8; i++) {
      await swipeNext(page);
      await page.waitForTimeout(NAVIGATION_WAIT);

      const episode = await getCurrentEpisode(page);
      const cache = await getCacheState();
      const check = await detailedBlackScreenCheck(page);

      console.log(
        `Episode ${episode}: cache=${cache.size}/${cache.max}, black=${check.isBlack}`
      );

      if (check.isBlack) {
        console.log(`  Details: ${check.details}`);
      }
    }
  });

  test('verify skeleton shows during loading', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Jump to a distant episode immediately
    console.log('Jumping to episode 9 and checking for skeleton...');

    await jumpToEpisode(page, 8);

    // Check immediately (before video loads)
    const immediateCheck = await page.evaluate(() => {
      const activeSlide = document.querySelector('.swiper-slide-active');
      const skeleton = activeSlide?.querySelector('[class*="animate-pulse"], [class*="animate-spin"]');
      const video = activeSlide?.querySelector('video');
      return {
        hasSkeleton: !!skeleton,
        hasVideo: !!video,
        skeletonClasses: skeleton?.className || 'none',
      };
    });

    console.log('Immediate state:', immediateCheck);

    // Wait a bit and check again
    await page.waitForTimeout(100);

    const afterCheck = await page.evaluate(() => {
      const activeSlide = document.querySelector('.swiper-slide-active');
      const skeleton = activeSlide?.querySelector('[class*="animate-pulse"], [class*="animate-spin"]');
      const video = activeSlide?.querySelector('video');
      return {
        hasSkeleton: !!skeleton,
        hasVideo: !!video,
      };
    });

    console.log('After 100ms:', afterCheck);

    // Either skeleton should be showing OR video should be ready
    expect(immediateCheck.hasSkeleton || immediateCheck.hasVideo || afterCheck.hasVideo).toBe(true);
  });
});
