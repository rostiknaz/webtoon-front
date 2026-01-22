import { test, expect, type Page } from '@playwright/test';

/**
 * Quick Swipe Mobile Tests
 *
 * Tests for detecting black screens and delays during rapid swipe gestures
 * on mobile devices. Simulates real user behavior with quick up/down swipes.
 *
 * Key scenarios:
 * - Rapid consecutive swipes (faster than video load time)
 * - Direction changes mid-swipe
 * - Gesture interruption patterns
 */

// Mobile viewport configuration
test.use({
  viewport: { width: 375, height: 812 }, // iPhone X dimensions
  hasTouch: true,
});

// Timing constants
const VERY_FAST_SWIPE_DELAY = 150; // Faster than typical video load
const FAST_SWIPE_DELAY = 250;
const STABILIZATION_WAIT = 800;

interface SwipeTestResult {
  episode: number;
  hasVideo: boolean;
  hasSkeleton: boolean;
  hasPlayerHost: boolean;
  isBlackScreen: boolean;
  videoReadyState: number;
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

// Get current episode number
async function getCurrentEpisode(page: Page): Promise<number> {
  // Use page.evaluate to get the episode number directly from DOM
  // This avoids strict mode issues when skeleton placeholder is also present
  const episodeNum = await page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active');
    if (!activeSlide) return 0;

    // Find the indicator that contains episode number (has text like "1 / 9")
    const indicators = Array.from(activeSlide.querySelectorAll('.absolute.top-4.right-4'));
    for (let i = 0; i < indicators.length; i++) {
      const text = indicators[i].textContent || '';
      const match = text.match(/(\d+)\s*\/\s*\d+/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return 0;
  });

  return episodeNum;
}

// Perform a quick swipe gesture using touch events
async function performSwipe(page: Page, direction: 'up' | 'down') {
  const startY = direction === 'up' ? 600 : 200;
  const endY = direction === 'up' ? 200 : 600;

  await page.touchscreen.tap(187, startY);
  await page.mouse.move(187, startY);
  await page.mouse.down();
  await page.mouse.move(187, endY, { steps: 5 }); // Quick swipe with few steps
  await page.mouse.up();
}

// Swipe using Swiper API (more reliable for testing)
async function swipeNext(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slideNext: () => void };
    };
    swiper?.swiper?.slideNext();
  });
}

async function swipePrev(page: Page) {
  await page.evaluate(() => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slidePrev: () => void };
    };
    swiper?.swiper?.slidePrev();
  });
}

// Detailed state check
async function checkSlideState(page: Page, episodeNum: number): Promise<SwipeTestResult> {
  const result = await page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active');
    if (!activeSlide) {
      return {
        hasVideo: false,
        hasSkeleton: false,
        hasPlayerHost: false,
        isBlackScreen: true,
        videoReadyState: -1,
      };
    }

    const playerHost = activeSlide.querySelector('.player-host');
    const video = playerHost?.querySelector('video');

    // Check for skeleton - look for the framer-motion skeleton overlay (has z-10 and pointer-events-none)
    // or any animated loading elements
    const skeletonOverlay = activeSlide.querySelector('.pointer-events-none.z-10');
    const animatedElements = activeSlide.querySelectorAll('[class*="animate-pulse"], [class*="animate-spin"]');

    const hasVideo = !!video;
    const hasSkeleton = !!skeletonOverlay || animatedElements.length > 0;
    const hasPlayerHost = !!playerHost;
    const videoReadyState = video?.readyState ?? -1;

    // Black screen = player host exists but empty (no video, no skeleton)
    const isBlackScreen = hasPlayerHost && !hasVideo && !hasSkeleton && (playerHost?.childElementCount === 0);

    return {
      hasVideo,
      hasSkeleton,
      hasPlayerHost,
      isBlackScreen,
      videoReadyState,
    };
  });

  return {
    episode: episodeNum,
    ...result,
    timestamp: Date.now(),
  };
}


test.describe('Quick Swipe Mobile Tests', () => {
  test('very rapid swipes up (1→5) with minimal delay', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    const results: SwipeTestResult[] = [];
    const blackScreens: number[] = [];

    console.log('Testing very rapid swipes UP (150ms between swipes)');

    // Perform 4 very fast swipes
    for (let i = 1; i <= 4; i++) {
      await swipeNext(page);
      await page.waitForTimeout(VERY_FAST_SWIPE_DELAY);

      const result = await checkSlideState(page, i + 1);
      results.push(result);

      if (result.isBlackScreen) {
        blackScreens.push(i + 1);
        console.log(`BLACK SCREEN at episode ${i + 1}`);
      }
    }

    // Wait for final state to stabilize
    await page.waitForTimeout(STABILIZATION_WAIT);
    const finalState = await checkSlideState(page, 5);
    console.log('Final state at episode 5:', JSON.stringify(finalState));

    // Check we ended at episode 5
    const finalEpisode = await getCurrentEpisode(page);
    expect(finalEpisode).toBe(5);

    console.log(`Black screens detected: ${blackScreens.length}`);
    console.log('Results:', results.map(r => ({
      ep: r.episode,
      video: r.hasVideo,
      skeleton: r.hasSkeleton,
      black: r.isBlackScreen,
      ready: r.videoReadyState,
    })));
  });

  test('rapid direction changes (up-down-up-down pattern)', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    // First go to episode 3 to have room for both directions
    await swipeNext(page);
    await swipeNext(page);
    await page.waitForTimeout(FAST_SWIPE_DELAY);

    const blackScreens: Array<{ episode: number; direction: string }> = [];

    console.log('Testing rapid direction changes');

    // Rapid direction changes: up, down, up, down, up, down
    const directions = ['down', 'up', 'down', 'up', 'down', 'up'] as const;

    for (const direction of directions) {
      if (direction === 'up') {
        await swipeNext(page);
      } else {
        await swipePrev(page);
      }
      await page.waitForTimeout(FAST_SWIPE_DELAY);

      const episode = await getCurrentEpisode(page);
      const result = await checkSlideState(page, episode);

      if (result.isBlackScreen) {
        blackScreens.push({ episode, direction });
        console.log(`BLACK SCREEN at episode ${episode} after swipe ${direction}`);
      }
    }

    await page.waitForTimeout(STABILIZATION_WAIT);
    const finalState = await checkSlideState(page, await getCurrentEpisode(page));

    console.log(`Black screens during direction changes: ${blackScreens.length}`);
    console.log('Final state:', JSON.stringify(finalState));

    // Final state should not be a black screen
    expect(finalState.isBlackScreen).toBe(false);
  });

  test('burst swipes - 6 swipes in rapid succession', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Testing burst swipes - 6 swipes with only 100ms gaps');

    // Rapid fire swipes
    const startTime = Date.now();
    for (let i = 0; i < 6; i++) {
      await swipeNext(page);
      await page.waitForTimeout(100); // Very minimal delay
    }
    const swipeTime = Date.now() - startTime;
    console.log(`6 swipes completed in ${swipeTime}ms`);

    // Wait for everything to settle
    await page.waitForTimeout(STABILIZATION_WAIT);

    const finalEpisode = await getCurrentEpisode(page);
    const finalState = await checkSlideState(page, finalEpisode);

    console.log(`Landed on episode ${finalEpisode}`);
    console.log('Final state:', JSON.stringify(finalState));

    // Should land on episode 7 (started at 1, swiped 6 times)
    expect(finalEpisode).toBe(7);
    expect(finalState.isBlackScreen).toBe(false);
    expect(finalState.hasVideo || finalState.hasSkeleton).toBe(true);
  });

  test('interrupted swipe pattern - start new swipe before previous completes', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Testing interrupted swipe pattern');

    const issues: Array<{ at: string; state: SwipeTestResult }> = [];

    // Swipe and immediately swipe again (interrupt pattern)
    for (let round = 0; round < 3; round++) {
      // Quick double-swipe forward
      await swipeNext(page);
      await page.waitForTimeout(50); // Almost immediate
      await swipeNext(page);
      await page.waitForTimeout(FAST_SWIPE_DELAY);

      const ep = await getCurrentEpisode(page);
      const state = await checkSlideState(page, ep);

      if (state.isBlackScreen) {
        issues.push({ at: `round ${round + 1} forward`, state });
      }

      // Quick double-swipe backward
      await swipePrev(page);
      await page.waitForTimeout(50);
      await swipePrev(page);
      await page.waitForTimeout(FAST_SWIPE_DELAY);

      const ep2 = await getCurrentEpisode(page);
      const state2 = await checkSlideState(page, ep2);

      if (state2.isBlackScreen) {
        issues.push({ at: `round ${round + 1} backward`, state: state2 });
      }
    }

    console.log(`Issues found: ${issues.length}`);
    if (issues.length > 0) {
      issues.forEach(i => console.log(`  ${i.at}: ep ${i.state.episode}`));
    }

    // Final verification
    await page.waitForTimeout(STABILIZATION_WAIT);
    const finalState = await checkSlideState(page, await getCurrentEpisode(page));
    expect(finalState.isBlackScreen).toBe(false);
  });

  test('skeleton visibility during rapid navigation', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Testing skeleton visibility during rapid navigation');

    let skeletonSeen = 0;
    let videoSeen = 0;
    let blackScreenSeen = 0;

    // Rapid swipes, checking state immediately after each
    for (let i = 0; i < 5; i++) {
      await swipeNext(page);

      // Check immediately (within 50ms of swipe)
      await page.waitForTimeout(50);
      const immediateState = await checkSlideState(page, i + 2);

      if (immediateState.hasSkeleton) skeletonSeen++;
      if (immediateState.hasVideo) videoSeen++;
      if (immediateState.isBlackScreen) blackScreenSeen++;

      await page.waitForTimeout(150); // Brief wait before next swipe
    }

    console.log(`States observed immediately after swipe:`);
    console.log(`  Skeleton visible: ${skeletonSeen}/5`);
    console.log(`  Video visible: ${videoSeen}/5`);
    console.log(`  Black screens: ${blackScreenSeen}/5`);

    // We should never see a black screen - either skeleton or video should be visible
    expect(blackScreenSeen).toBe(0);
  });

  test('swipe during video loading', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Don't wait for stabilization - swipe while first video is still loading
    console.log('Testing swipes during initial video load');

    const states: SwipeTestResult[] = [];

    // Start swiping immediately
    for (let i = 0; i < 3; i++) {
      await swipeNext(page);
      await page.waitForTimeout(200);

      const state = await checkSlideState(page, i + 2);
      states.push(state);
    }

    // Wait and verify final state
    await page.waitForTimeout(STABILIZATION_WAIT);
    const finalState = await checkSlideState(page, await getCurrentEpisode(page));

    console.log('States during rapid start:', states.map(s => ({
      ep: s.episode,
      video: s.hasVideo,
      skeleton: s.hasSkeleton,
      black: s.isBlackScreen,
    })));
    console.log('Final state:', JSON.stringify(finalState));

    // Final state should have video or at least skeleton
    expect(finalState.isBlackScreen).toBe(false);
  });
});


test.describe('Quick Swipe Performance Metrics', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('measure time to video ready after swipe', async ({ page }) => {
    await navigateToVideoPlayer(page);
    await page.waitForTimeout(STABILIZATION_WAIT);

    console.log('Measuring time from swipe to video ready');

    const timings: Array<{ episode: number; timeToReady: number }> = [];

    for (let i = 1; i <= 4; i++) {
      const startTime = Date.now();
      await swipeNext(page);

      // Poll for video ready state
      let timeToReady = 0;
      for (let attempt = 0; attempt < 50; attempt++) {
        await page.waitForTimeout(50);

        const state = await checkSlideState(page, i + 1);
        if (state.hasVideo && state.videoReadyState >= 3) {
          timeToReady = Date.now() - startTime;
          break;
        }
      }

      timings.push({ episode: i + 1, timeToReady: timeToReady || -1 });
      console.log(`Episode ${i + 1}: ${timeToReady > 0 ? timeToReady + 'ms' : 'timeout'}`);

      // Small wait before next measurement
      await page.waitForTimeout(300);
    }

    // Log average time
    const validTimings = timings.filter(t => t.timeToReady > 0);
    if (validTimings.length > 0) {
      const avgTime = validTimings.reduce((sum, t) => sum + t.timeToReady, 0) / validTimings.length;
      console.log(`Average time to video ready: ${avgTime.toFixed(0)}ms`);
    }

    // All episodes should eventually have video ready
    expect(validTimings.length).toBe(timings.length);
  });
});
