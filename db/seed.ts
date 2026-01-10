/**
 * Database Seed Script
 *
 * Populates the database with initial data:
 * - Subscription plans
 * - Sample series and episodes (optional)
 *
 * Usage:
 * - Local: npm run db:seed:local
 * - Remote: npm run db:seed:remote
 */

import { createClient } from '@libsql/client';

const DATABASE_URL = process.env.DATABASE_URL || '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d92f4d3dda6d00f0624e5f92a013bc9e140a3dfd7f2719743e3a6571bf66d016.sqlite';

async function seed() {
  console.log('🌱 Seeding database...');

  const db = createClient({
    url: `file:${DATABASE_URL}`,
  });

  try {
    // Seed subscription plans
    console.log('📦 Creating subscription plans...');

    await db.execute({
      sql: `INSERT OR IGNORE INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'plan_free',
        'Free',
        'Access to free episodes only',
        0,
        'USD',
        'monthly',
        0,
        JSON.stringify({
          episodeAccess: 'limited',
          adFree: false,
          downloadable: false,
          earlyAccess: false,
        }),
        'plan_free',
        1,
      ],
    });

    await db.execute({
      sql: `INSERT OR IGNORE INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'plan_monthly',
        'Premium Monthly',
        'Unlimited access to all episodes, ad-free experience, and early access to new content',
        9.99,
        'USD',
        'monthly',
        7,
        JSON.stringify({
          episodeAccess: 'all',
          adFree: true,
          downloadable: true,
          earlyAccess: true,
        }),
        'solidgate_product_monthly', // Replace with actual Solidgate product ID
        1,
      ],
    });

    await db.execute({
      sql: `INSERT OR IGNORE INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'plan_yearly',
        'Premium Yearly',
        'All premium features + 2 months free. Best value!',
        99.99,
        'USD',
        'yearly',
        7,
        JSON.stringify({
          episodeAccess: 'all',
          adFree: true,
          downloadable: true,
          earlyAccess: true,
        }),
        'solidgate_product_yearly', // Replace with actual Solidgate product ID
        1,
      ],
    });

    console.log('✅ Subscription plans created');

    // Seed sample series (optional)
    console.log('📺 Creating sample series...');

    const seriesId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT OR IGNORE INTO series (id, title, description, thumbnail_url, genre, author, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        seriesId,
        'Sample Webtoon Series',
        'This is a sample webtoon series for testing. Replace with real content!',
        'https://placehold.co/300x400/e91e63/ffffff?text=Sample+Series',
        'Action',
        'Sample Author',
        'ongoing',
      ],
    });

    // Seed sample episodes
    console.log('🎬 Creating sample episodes...');

    for (let i = 1; i <= 5; i++) {
      const episodeId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT OR IGNORE INTO episodes (id, serial_id, episode_number, title, description, thumbnail_url, video_id, duration, is_paid, published_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
        args: [
          episodeId,
          seriesId,
          i,
          `Episode ${i}: Sample Title`,
          `This is episode ${i} of the sample series`,
          `https://placehold.co/300x169/9c27b0/ffffff?text=Episode+${i}`,
          `sample_video_id_${i}`, // Replace with actual Cloudflare Stream video ID
          600, // 10 minutes
          i > 2 ? 1 : 0, // First 2 episodes are free, rest are paid
        ],
      });
    }

    console.log('✅ Sample content created');

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('  - 3 subscription plans');
    console.log('  - 1 sample series');
    console.log('  - 5 sample episodes (2 free, 3 paid)');
    console.log('\n💡 Next steps:');
    console.log('  1. Update Solidgate product IDs in plans table');
    console.log('  2. Upload real video content to Cloudflare Stream');
    console.log('  3. Update video_id in episodes table');
    console.log('  4. Create real series content\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run seed
seed().catch(console.error);
