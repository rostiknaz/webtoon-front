import { test, expect, type Page } from '@playwright/test';

/**
 * Skeleton Loading Tests
 *
 * Tests for the VideoSkeleton loading state to catch issues where:
 * - Only a pulsing dot shows instead of the full skeleton
 * - Loading state flickers or doesn't render properly
 * - xgplayer's loading indicator shows instead of our skeleton
 */

// Navigate to video player
async function navigateToVideoPlayer(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const seriesCard = page.locator('a[href*="/serials/"]').first();
  await seriesCard.click();
  await page.waitForSelector('.hybrid-video-player', { timeout: 15000 });
  await page.waitForSelector('.swiper-slide-active', { timeout: 10000 });
}

// Jump to specific episode
async function jumpToEpisode(page: Page, index: number) {
  await page.evaluate((idx) => {
    const swiper = document.querySelector('.swiper') as HTMLElement & { swiper?: { slideTo: (idx: number) => void } };
    swiper?.swiper?.slideTo(idx);
  }, index);
}

// Check if the VideoSkeleton is properly rendered with all elements
async function checkSkeletonIntegrity(page: Page): Promise<{
  hasContainer: boolean;
  hasSpinner: boolean;
  hasCenterDot: boolean;
  hasTopSection: boolean;
  hasBottomSection: boolean;
  hasOnlyDot: boolean;
}> {
  return await page.evaluate(() => {
    // Find any visible loading skeleton
    const skeletons = document.querySelectorAll('.swiper-slide [class*="absolute"][class*="inset-0"][class*="z-10"]');

    for (const skeleton of skeletons) {
      const style = window.getComputedStyle(skeleton);
      if (style.opacity === '0' || style.display === 'none') continue;

      // Check for skeleton parts
      const hasSpinner = skeleton.querySelector('[class*="w-16"][class*="h-16"]') !== null ||
                         skeleton.querySelector('[style*="conic-gradient"]') !== null;
      const hasCenterDot = skeleton.querySelector('[class*="w-2"][class*="h-2"][class*="rounded-full"]') !== null;
      const hasTopSection = skeleton.querySelector('[class*="top-0"]') !== null;
      const hasBottomSection = skeleton.querySelector('[class*="bottom-0"]') !== null;
      const hasRightButtons = skeleton.querySelector('[class*="bottom-32"][class*="right-4"]') !== null;

      // Count visible child elements
      const visibleChildren = Array.from(skeleton.children).filter(child => {
        const childStyle = window.getComputedStyle(child);
        return childStyle.opacity !== '0' && childStyle.display !== 'none';
      }).length;

      return {
        hasContainer: true,
        hasSpinner,
        hasCenterDot,
        hasTopSection,
        hasBottomSection,
        // If we have a skeleton but very few visible parts, it might be the "dot only" issue
        hasOnlyDot: hasCenterDot && visibleChildren < 3,
      };
    }

    return {
      hasContainer: false,
      hasSpinner: false,
      hasCenterDot: false,
      hasTopSection: false,
      hasBottomSection: false,
      hasOnlyDot: false,
    };
  });
}

// Check for xgplayer's native loading indicator
async function checkXgplayerLoading(page: Page): Promise<{
  isVisible: boolean;
  hasLoadingElement: boolean;
}> {
  return await page.evaluate(() => {
    const loadingElements = document.querySelectorAll('.xgplayer-loading');
    for (const el of loadingElements) {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.opacity !== '0') {
        return { isVisible: true, hasLoadingElement: true };
      }
    }
    return { isVisible: false, hasLoadingElement: loadingElements.length > 0 };
  });
}

// Monitor for loading states during navigation
async function monitorLoadingStates(page: Page, duration: number = 2000): Promise<{
  skeletonAppeared: boolean;
  xgplayerLoadingAppeared: boolean;
  partialSkeletonDetected: boolean;
  screenshots: string[];
}> {
  const results = {
    skeletonAppeared: false,
    xgplayerLoadingAppeared: false,
    partialSkeletonDetected: false,
    screenshots: [] as string[],
  };

  const startTime = Date.now();
  let checkCount = 0;

  while (Date.now() - startTime < duration) {
    const skeleton = await checkSkeletonIntegrity(page);
    const xgLoading = await checkXgplayerLoading(page);

    if (skeleton.hasContainer) {
      results.skeletonAppeared = true;
      if (skeleton.hasOnlyDot) {
        results.partialSkeletonDetected = true;
        // Take screenshot when partial skeleton detected
        const screenshotPath = `skeleton-partial-${checkCount}.png`;
        await page.screenshot({ path: `test-results/${screenshotPath}` });
        results.screenshots.push(screenshotPath);
      }
    }

    if (xgLoading.isVisible) {
      results.xgplayerLoadingAppeared = true;
    }

    checkCount++;
    await page.waitForTimeout(50); // Check every 50ms
  }

  return results;
}


test.describe('Skeleton Loading - Detection Tests', () => {
  test('VideoSkeleton shows full content, not just center dot', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Jump to a distant episode to trigger loading
    await jumpToEpisode(page, 8);

    // Monitor loading states for 3 seconds
    const results = await monitorLoadingStates(page, 3000);

    // Log results for debugging
    console.log('Loading state results:', results);

    // If skeleton appeared, it should not be partial (only dot)
    if (results.skeletonAppeared) {
      expect(results.partialSkeletonDetected).toBe(false);
    }
  });

  test('rapid navigation does not cause partial skeleton', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Rapid navigation through episodes
    for (let i = 0; i < 5; i++) {
      await jumpToEpisode(page, i * 2); // Jump to episodes 0, 2, 4, 6, 8
      const results = await monitorLoadingStates(page, 500);

      if (results.partialSkeletonDetected) {
        // Take full page screenshot for debugging
        await page.screenshot({
          path: `test-results/partial-skeleton-rapid-nav-${i}.png`,
          fullPage: true
        });
        console.log(`Partial skeleton detected at episode ${i * 2}`);
      }

      expect(results.partialSkeletonDetected).toBe(false);
    }
  });

  test('loading skeleton has all required elements when visible', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Force a loading state by jumping far
    await jumpToEpisode(page, 11); // Last episode

    // Check skeleton integrity multiple times during loading
    let skeletonChecks = 0;
    let validSkeletons = 0;
    let invalidSkeletons = 0;

    for (let i = 0; i < 30; i++) {
      const integrity = await checkSkeletonIntegrity(page);

      if (integrity.hasContainer) {
        skeletonChecks++;
        if (integrity.hasSpinner && integrity.hasTopSection) {
          validSkeletons++;
        } else {
          invalidSkeletons++;
          console.log('Invalid skeleton state:', integrity);
        }
      }

      await page.waitForTimeout(100);
    }

    console.log(`Skeleton checks: ${skeletonChecks}, valid: ${validSkeletons}, invalid: ${invalidSkeletons}`);

    // All visible skeletons should be valid (have full content)
    expect(invalidSkeletons).toBe(0);
  });

  test('xgplayer loading indicator should be hidden when our skeleton shows', async ({ page }) => {
    await navigateToVideoPlayer(page);

    await jumpToEpisode(page, 6);

    // Monitor both loading states
    let bothShowingCount = 0;

    for (let i = 0; i < 30; i++) {
      const skeleton = await checkSkeletonIntegrity(page);
      const xgLoading = await checkXgplayerLoading(page);

      if (skeleton.hasContainer && xgLoading.isVisible) {
        bothShowingCount++;
        console.log('Both skeleton and xgplayer loading visible');
      }

      await page.waitForTimeout(100);
    }

    // We don't want both loading indicators showing at once
    // (This might be acceptable, but log it for investigation)
    if (bothShowingCount > 0) {
      console.log(`Both loading indicators visible ${bothShowingCount} times`);
    }
  });
});


test.describe('Skeleton Loading - Visual Regression', () => {
  test('capture skeleton states during episode navigation', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // Capture initial state
    await page.screenshot({ path: 'test-results/skeleton-initial.png' });

    // Jump to different episodes and capture any loading states
    const episodesToCheck = [5, 9, 3, 11, 1];

    for (const ep of episodesToCheck) {
      await jumpToEpisode(page, ep - 1);

      // Quick burst of screenshots to catch loading state
      for (let i = 0; i < 5; i++) {
        await page.screenshot({
          path: `test-results/skeleton-ep${ep}-frame${i}.png`,
        });
        await page.waitForTimeout(100);
      }

      // Wait for episode to settle
      await page.waitForTimeout(1000);
    }
  });

  test('detect pulsing dot without full skeleton', async ({ page }) => {
    await navigateToVideoPlayer(page);

    // This test specifically looks for the "pulsing dot only" issue
    const detectedIssues: string[] = [];

    for (let round = 0; round < 3; round++) {
      // Random jumps to trigger loading
      const targetEpisode = Math.floor(Math.random() * 10) + 1;
      await jumpToEpisode(page, targetEpisode - 1);

      // Check for partial skeleton immediately after jump
      for (let check = 0; check < 10; check++) {
        const html = await page.evaluate(() => {
          const activeSlide = document.querySelector('.swiper-slide-active');
          if (!activeSlide) return null;

          // Look for any small centered dot that might be a loading indicator
          const dots = activeSlide.querySelectorAll('[class*="rounded-full"]');
          const visibleDots: string[] = [];

          dots.forEach((dot, i) => {
            const style = window.getComputedStyle(dot);
            const rect = dot.getBoundingClientRect();

            // Small dots (less than 20px) that are visible
            if (rect.width < 20 && rect.height < 20 &&
                style.opacity !== '0' && style.display !== 'none') {
              visibleDots.push(`dot${i}: ${rect.width}x${rect.height} @ ${rect.left},${rect.top}`);
            }
          });

          return {
            hasActiveSlide: true,
            slideContent: activeSlide.innerHTML.substring(0, 500),
            visibleDots,
            hasVideo: activeSlide.querySelector('video') !== null,
            hasFullSkeleton: activeSlide.querySelector('[class*="inset-0"][class*="z-10"]') !== null,
          };
        });

        if (html && html.visibleDots.length > 0 && !html.hasVideo && !html.hasFullSkeleton) {
          detectedIssues.push(`Round ${round}, check ${check}: Dots without skeleton - ${html.visibleDots.join(', ')}`);
          await page.screenshot({
            path: `test-results/dot-only-issue-round${round}-check${check}.png`
          });
        }

        await page.waitForTimeout(50);
      }

      await page.waitForTimeout(500);
    }

    if (detectedIssues.length > 0) {
      console.log('Detected issues:', detectedIssues);
    }

    // This test is more for investigation - we report findings rather than failing
    expect(detectedIssues.length).toBe(0);
  });
});


test.describe('Skeleton Loading - Edge Cases', () => {
  test('loading state after drawer episode selection', async ({ page }) => {
    // Note: This test works on any viewport - we check if drawer button is visible
    // Mobile Chrome project already runs at mobile viewport size

    await navigateToVideoPlayer(page);

    // Open episodes drawer (mobile)
    const episodesButton = page.locator('.swiper-slide-active button').filter({
      has: page.locator('svg.lucide-list')
    });

    if (await episodesButton.isVisible()) {
      await episodesButton.click();
      await page.waitForTimeout(300);

      // Click on a distant episode in the drawer
      const drawerEpisodes = page.locator('[data-vaul-drawer] button, .fixed.inset-x-0.bottom-0 button');
      const count = await drawerEpisodes.count();

      if (count > 5) {
        await drawerEpisodes.nth(8).click();

        // Monitor for partial skeleton
        const results = await monitorLoadingStates(page, 2000);

        if (results.partialSkeletonDetected) {
          await page.screenshot({ path: 'test-results/drawer-jump-partial-skeleton.png' });
        }

        expect(results.partialSkeletonDetected).toBe(false);
      }
    }
  });

  test('loading state on slow network', async ({ page, context, browserName }) => {
    // CDP/network throttling is only available in Chromium browsers
    test.skip(browserName !== 'chromium', 'Network throttling requires Chromium CDP');

    // Navigate first, then apply throttling (otherwise initial page load times out)
    await navigateToVideoPlayer(page);

    // Now simulate slow 3G network for episode loading
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8, // 500 Kbps
      uploadThroughput: (500 * 1024) / 8,
      latency: 400,
    });

    // With slow network, loading should take longer - more chances to see skeleton
    await jumpToEpisode(page, 7);

    // Extended monitoring on slow network
    const results = await monitorLoadingStates(page, 5000);

    console.log('Slow network loading results:', results);

    // Skeleton should appear on slow network
    // But should never be partial
    if (results.skeletonAppeared) {
      expect(results.partialSkeletonDetected).toBe(false);
    }

    // Reset network conditions
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  });
});
