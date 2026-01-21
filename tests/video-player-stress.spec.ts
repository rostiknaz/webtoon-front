import { test, expect } from '@playwright/test';

test.describe('Video Player Stress Test', () => {
  test('handles rapid non-sequential episode switching', async ({ page }) => {
    // Listen for console messages
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Navigate to home and click on first series
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on first series card to navigate to series page
    const seriesCard = page.locator('a[href*="/serials/"]').first();
    await seriesCard.click();

    await page.waitForSelector('.hybrid-video-player', { timeout: 15000 });

    // Wait for initial player to load
    await page.waitForTimeout(2000);

    // Get episode count from indicator
    const indicator = page.locator('.hybrid-video-player .absolute.top-4.right-4');
    const indicatorText = await indicator.textContent();
    const totalEpisodes = parseInt(indicatorText?.split('/')[1]?.trim() || '12');
    console.log(`Total episodes: ${totalEpisodes}`);

    // Get episode sidebar items
    const episodeItems = page.locator('[class*="episode"]').filter({ hasText: /Episode/i });

    // Function to click episode by index (0-based)
    const clickEpisodeByIndex = async (index: number) => {
      // Find episode item in sidebar
      const sidebarItems = page.locator('.hidden.md\\:block').locator('button, [role="button"], div[class*="cursor-pointer"]');
      const count = await sidebarItems.count();

      if (index < count) {
        await sidebarItems.nth(index).click();
        console.log(`Clicked episode at index ${index}`);
      } else {
        // Try using swiper to navigate directly
        await page.evaluate((idx) => {
          const swiper = document.querySelector('.swiper')?.['swiper'];
          if (swiper) swiper.slideTo(idx);
        }, index);
        console.log(`Swiped to episode at index ${index}`);
      }
    };

    // Test 1: Sequential switching (using swiper slides)
    console.log('Test 1: Sequential rapid swiping...');
    for (let i = 1; i < Math.min(5, totalEpisodes); i++) {
      await page.evaluate((idx) => {
        const swiper = document.querySelector('.swiper')?.['swiper'];
        if (swiper) swiper.slideNext();
      }, i);
      await page.waitForTimeout(400);
    }

    // Wait for stabilization
    await page.waitForTimeout(1500);

    // Verify we moved forward
    const afterSequential = await indicator.textContent();
    console.log('After sequential:', afterSequential);

    // Test 2: Jump to a later episode (if available)
    const jumpTarget = Math.min(totalEpisodes - 1, 11); // Episode 12 (index 11) or last
    console.log(`Test 2: Jump to episode ${jumpTarget + 1}...`);
    await page.evaluate((idx) => {
      const swiper = document.querySelector('.swiper')?.['swiper'];
      if (swiper) swiper.slideTo(idx);
    }, jumpTarget);
    await page.waitForTimeout(1500);

    const afterJump = await indicator.textContent();
    console.log('After jump:', afterJump);
    expect(afterJump).toContain(`${jumpTarget + 1} /`);

    // Test 3: Jump back to first episode
    console.log('Test 3: Jump back to episode 1...');
    await page.evaluate(() => {
      const swiper = document.querySelector('.swiper')?.['swiper'];
      if (swiper) swiper.slideTo(0);
    });
    await page.waitForTimeout(1500);

    const afterJumpBack = await indicator.textContent();
    console.log('After jump back:', afterJumpBack);
    expect(afterJumpBack).toContain('1 /');

    // Test 4: Rapid non-sequential (using direct slideTo)
    console.log('Test 4: Rapid non-sequential switching...');
    const maxIndex = Math.min(totalEpisodes - 1, 11);
    const sequence = [
      Math.min(maxIndex, 11),  // Jump to 12 or max
      Math.min(maxIndex, 4),   // Jump to 5
      Math.min(maxIndex, 7),   // Jump to 8
      Math.min(maxIndex, 2),   // Jump to 3
    ].filter(idx => idx >= 0);

    for (const idx of sequence) {
      await page.evaluate((slideIdx) => {
        const swiper = document.querySelector('.swiper')?.['swiper'];
        if (swiper) swiper.slideTo(slideIdx);
      }, idx);
      await page.waitForTimeout(250); // Very quick
    }
    await page.waitForTimeout(1500);

    // Verify we're on the last episode of the sequence
    const finalIdx = sequence[sequence.length - 1];
    await expect(indicator).toContainText(`${finalIdx + 1} /`);

    // Test 5: Check cache stats
    const cacheStats = await indicator.textContent();
    console.log('Final cache stats:', cacheStats);

    // Cache should have at most 5 players
    const cacheMatch = cacheStats?.match(/cached: (\d+)\/5/);
    if (cacheMatch) {
      const cacheSize = parseInt(cacheMatch[1]);
      expect(cacheSize).toBeLessThanOrEqual(5);
      console.log(`Cache size: ${cacheSize}/5`);
    }

    // Test 6: Verify video is functional
    await page.waitForTimeout(1000);
    const video = page.locator('video').first();
    if (await video.count() > 0) {
      const isLoaded = await video.evaluate((v: HTMLVideoElement) => v.readyState >= 2);
      console.log('Video loaded:', isLoaded);
    }

    // Print relevant console logs
    console.log('\n--- Play Prevention Logs ---');
    const playLogs = consoleLogs.filter(log =>
      log.toLowerCase().includes('play') ||
      log.toLowerCase().includes('error')
    );
    playLogs.slice(-10).forEach(log => console.log(log));
  });

  test('episode thumbnails are available', async ({ page }) => {
    // Navigate to home and click on first series
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const seriesCard = page.locator('a[href*="/serials/"]').first();
    await seriesCard.click();

    await page.waitForSelector('.hybrid-video-player', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check slides for preview content
    const slides = page.locator('.swiper-slide');
    const slideCount = await slides.count();
    console.log(`Found ${slideCount} swiper slides`);

    // Check if videos have poster attribute
    const videos = page.locator('video');
    const videoCount = await videos.count();

    if (videoCount > 0) {
      const hasPoster = await videos.first().evaluate((v: HTMLVideoElement) => !!v.poster);
      console.log(`Video has poster attribute: ${hasPoster}`);

      if (hasPoster) {
        const posterUrl = await videos.first().getAttribute('poster');
        console.log(`Poster URL: ${posterUrl}`);
      }
    }

    // Check for any preview images in slides
    const previewImages = page.locator('.swiper-slide img');
    const imageCount = await previewImages.count();
    console.log(`Preview images found: ${imageCount}`);

    // Check for background images
    const slidesWithBg = await page.evaluate(() => {
      const slides = document.querySelectorAll('.swiper-slide');
      let count = 0;
      slides.forEach(slide => {
        const style = window.getComputedStyle(slide);
        if (style.backgroundImage !== 'none') count++;
      });
      return count;
    });
    console.log(`Slides with background images: ${slidesWithBg}`);
  });
});
