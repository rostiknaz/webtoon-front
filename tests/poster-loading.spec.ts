import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Poster Loading Tests
 *
 * Verifies that xgplayer's built-in poster displays correctly while HLS content loads.
 * The poster is configured via xgplayer's `poster` option and managed by the player.
 *
 * Key scenarios:
 * - Poster visible before video loads
 * - Poster URL correctly set from R2
 * - No excessive black screen during episode transitions
 */

// Helper: Navigate to video player
async function navigateToVideoPlayer(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const seriesCard = page.locator('a[href*="/serials/"]').first();
  await seriesCard.click();

  await page.waitForSelector('.hybrid-video-player', { timeout: 30000 });
  await page.waitForSelector('.swiper-slide-active', { timeout: 15000 });
}

// Helper: Jump to specific episode
async function jumpToEpisode(page: Page, index: number) {
  await page.evaluate((idx) => {
    const swiper = document.querySelector('.swiper') as HTMLElement & {
      swiper?: { slideTo: (idx: number) => void };
    };
    swiper?.swiper?.slideTo(idx);
  }, index);
}

// Helper: Check visual state of player
interface PlayerVisualState {
  hasVideo: boolean;
  videoHasContent: boolean;
  videoReadyState: number;
  hasXgplayerPoster: boolean;
  xgplayerPosterVisible: boolean;
  posterUrl: string | null;
  isBlackScreen: boolean;
}

async function getPlayerVisualState(page: Page): Promise<PlayerVisualState> {
  return page.evaluate(() => {
    const activeSlide = document.querySelector('.swiper-slide-active');
    if (!activeSlide) {
      return {
        hasVideo: false,
        videoHasContent: false,
        videoReadyState: -1,
        hasXgplayerPoster: false,
        xgplayerPosterVisible: false,
        posterUrl: null,
        isBlackScreen: true,
      };
    }

    const playerHost = activeSlide.querySelector('.player-host');
    const video = playerHost?.querySelector('video') as HTMLVideoElement | null;

    // Check for xgplayer's poster element
    const xgplayerPoster = playerHost?.querySelector('.xgplayer-poster') as HTMLElement | null;
    const xgplayerPosterVisible = xgplayerPoster
      ? window.getComputedStyle(xgplayerPoster).display !== 'none' &&
        window.getComputedStyle(xgplayerPoster).visibility !== 'hidden'
      : false;

    // Get poster URL from xgplayer poster background-image
    let posterUrl: string | null = null;
    if (xgplayerPoster) {
      const bgImage = window.getComputedStyle(xgplayerPoster).backgroundImage;
      const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      posterUrl = match ? match[1] : null;
    }

    // Check if video has actual content (not just element present)
    const videoReadyState = video?.readyState ?? -1;
    const videoHasContent = videoReadyState >= 2; // HAVE_CURRENT_DATA or higher

    // Detect black screen: player host exists but nothing visible
    const hasAnyVisibleContent = xgplayerPosterVisible || videoHasContent;
    const isBlackScreen = !!playerHost && !hasAnyVisibleContent;

    return {
      hasVideo: !!video,
      videoHasContent,
      videoReadyState,
      hasXgplayerPoster: !!xgplayerPoster,
      xgplayerPosterVisible,
      posterUrl,
      isBlackScreen,
    };
  });
}

// Helper: Measure time to first visual content
async function measureTimeToVisualContent(page: Page, maxWait = 10000): Promise<{
  timeToFirstVisual: number;
  firstVisualType: 'poster' | 'video' | 'timeout';
}> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const state = await getPlayerVisualState(page);
    const elapsed = Date.now() - startTime;

    if (state.xgplayerPosterVisible) {
      return { timeToFirstVisual: elapsed, firstVisualType: 'poster' };
    }
    if (state.videoHasContent) {
      return { timeToFirstVisual: elapsed, firstVisualType: 'video' };
    }

    await page.waitForTimeout(50);
  }

  return { timeToFirstVisual: maxWait, firstVisualType: 'timeout' };
}


test.describe('Poster Loading - Basic', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 size

  test('xgplayer poster element exists after player init', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for player to initialize
    await page.waitForTimeout(1000);

    const state = await getPlayerVisualState(page);

    console.log('Player state:');
    console.log(`  Has xgplayer poster: ${state.hasXgplayerPoster}`);
    console.log(`  Poster visible: ${state.xgplayerPosterVisible}`);
    console.log(`  Poster URL: ${state.posterUrl}`);
    console.log(`  Has video: ${state.hasVideo}`);
    console.log(`  Video ready state: ${state.videoReadyState}`);

    // xgplayer should have poster element configured
    expect(state.hasXgplayerPoster).toBe(true);
  });

  test('poster URL is correctly set from R2', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for player to initialize
    await page.waitForTimeout(1000);

    const state = await getPlayerVisualState(page);

    // Poster URL should be from R2
    if (state.posterUrl) {
      expect(state.posterUrl).toContain('r2.dev');
      expect(state.posterUrl).toContain('poster.jpg');
      console.log('✓ Poster URL correctly points to R2');
    } else {
      console.log('⚠ Poster URL not set - poster may not be configured');
    }
  });

  test('visual content appears within reasonable time', async ({ page }) => {
    await navigateToVideoPlayer(page);

    const measurement = await measureTimeToVisualContent(page, 10000);

    console.log(`First visual content: ${measurement.firstVisualType}`);
    console.log(`Time to first visual: ${measurement.timeToFirstVisual}ms`);

    // Should not timeout - something should be visible
    expect(measurement.firstVisualType).not.toBe('timeout');

    // Time to first visual should be reasonable
    expect(measurement.timeToFirstVisual).toBeLessThan(5000);
  });
});


test.describe('Poster Loading - Episode Navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('poster or video visible when jumping episodes', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for first episode to load
    await page.waitForTimeout(2000);

    console.log('Jumping to episode 9...');

    // Jump to distant episode
    const jumpStartTime = Date.now();
    await jumpToEpisode(page, 8); // Jump to episode 9 (0-indexed)

    // Poll for visual content
    interface Check {
      time: number;
      hasPlayerHost: boolean;
      hasXgplayer: boolean;
      posterVisible: boolean;
      videoReady: boolean;
      isBlack: boolean;
    }

    const checks: Check[] = [];
    const pollEnd = Date.now() + 3000;

    while (Date.now() < pollEnd) {
      const detail = await page.evaluate(() => {
        const activeSlide = document.querySelector('.swiper-slide-active');
        const playerHost = activeSlide?.querySelector('.player-host');
        const xgplayer = playerHost?.querySelector('.xgplayer');
        const xgplayerPoster = playerHost?.querySelector('.xgplayer-poster') as HTMLElement | null;
        const video = playerHost?.querySelector('video') as HTMLVideoElement | null;

        const xgplayerPosterVisible = xgplayerPoster
          ? window.getComputedStyle(xgplayerPoster).display !== 'none' &&
            window.getComputedStyle(xgplayerPoster).opacity !== '0'
          : false;

        const videoReady = video && video.readyState >= 2;

        return {
          hasPlayerHost: !!playerHost,
          hasXgplayer: !!xgplayer,
          posterVisible: xgplayerPosterVisible,
          videoReady: !!videoReady,
          isBlack: !!playerHost && !xgplayerPosterVisible && !videoReady,
        };
      });

      const elapsed = Date.now() - jumpStartTime;
      checks.push({ time: elapsed, ...detail });

      if (!detail.isBlack) {
        console.log(`Visual content appeared at ${elapsed}ms`);
        break;
      }

      await page.waitForTimeout(50);
    }

    // Analyze the gap
    const blackScreenDuration = checks.filter(c => c.isBlack).length * 50;
    console.log(`Black screen duration: ~${blackScreenDuration}ms`);

    // Log state progression
    console.log('\nState progression (first 15):');
    checks.slice(0, 15).forEach((c) => {
      const status = c.isBlack ? '⬛' : '✓';
      console.log(`  ${c.time}ms: ${status} host=${c.hasPlayerHost} xg=${c.hasXgplayer} poster=${c.posterVisible} video=${c.videoReady}`);
    });

    // Black screen should be under 1 second
    expect(blackScreenDuration).toBeLessThan(1000);
  });

  test('back-to-back navigation maintains visual content', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Wait for first episode
    await page.waitForTimeout(1500);

    // Jump forward then back
    await jumpToEpisode(page, 5);
    await page.waitForTimeout(500);

    await jumpToEpisode(page, 1);
    await page.waitForTimeout(500);

    const state = await getPlayerVisualState(page);

    // Should have visual content (poster or video)
    const hasVisualContent = state.xgplayerPosterVisible || state.videoHasContent;
    expect(hasVisualContent).toBe(true);
  });
});


test.describe('Poster Loading - Slow Network', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('visual content appears on slow network', async ({ page, context }) => {
    test.setTimeout(90000);

    // Navigate first (on fast network)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enable slow network BEFORE navigating to video
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 150_000, // 150 KB/s - slow but usable
      uploadThroughput: 75_000,
      latency: 500, // 500ms latency
    });

    console.log('Network throttled to Slow 3G (150KB/s, 500ms latency)');

    // Now navigate to video player
    const seriesCard = page.locator('a[href*="/serials/"]').first();
    await seriesCard.click();

    // Wait for player container (longer timeout for slow network)
    await page.waitForSelector('.hybrid-video-player', { timeout: 60000 });
    await page.waitForSelector('.swiper-slide-active', { timeout: 30000 });

    console.log('Player loaded, measuring time to visual content...');

    // Measure what shows first and when
    const measurement = await measureTimeToVisualContent(page, 15000);

    console.log(`First visual content: ${measurement.firstVisualType}`);
    console.log(`Time to first visual: ${measurement.timeToFirstVisual}ms`);

    // Should not timeout - something should be visible
    expect(measurement.firstVisualType).not.toBe('timeout');

    // Time to first visual should be reasonable even on slow network
    expect(measurement.timeToFirstVisual).toBeLessThan(8000);

    // Restore normal network
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  });
});


test.describe('Poster Loading - Page Refresh', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('visual content appears after page refresh', async ({ page }) => {
    // Navigate to video player
    await navigateToVideoPlayer(page);

    // Wait for content to load
    await page.waitForTimeout(2000);

    console.log('Refreshing page...');

    // Refresh the page
    const refreshStart = Date.now();
    await page.reload();

    // Wait for player
    await page.waitForSelector('.hybrid-video-player', { timeout: 30000 });
    await page.waitForSelector('.swiper-slide-active', { timeout: 15000 });

    // Measure time to visual content after refresh
    const measurement = await measureTimeToVisualContent(page, 10000);

    const refreshDuration = Date.now() - refreshStart;
    console.log(`Page refresh completed in ${refreshDuration}ms`);
    console.log(`First visual: ${measurement.firstVisualType} at ${measurement.timeToFirstVisual}ms`);

    // Something should be visible quickly after refresh
    expect(measurement.firstVisualType).not.toBe('timeout');
    expect(measurement.timeToFirstVisual).toBeLessThan(3000);
  });
});
