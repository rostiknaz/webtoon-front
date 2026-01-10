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

// @ts-ignore - process is available in Node.js runtime via tsx
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
        'Midnight Confessions',
        'A gripping vertical short-form drama series that explores the complexities of modern relationships through late-night text messages. Follow Emma and Jake as their digital conversations reveal secrets, desires, and unexpected twists that will keep you on the edge of your seat.',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
        'Drama, Romance, Mystery, Thriller',
        'Michael Chen',
        'ongoing',
      ],
    });

    // Seed sample episodes
    console.log('🎬 Creating sample episodes...');

    const episodes = [
      {
        number: 1,
        title: 'The First Message',
        description: 'It all starts with a simple text at midnight...',
        thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 90,
        isPaid: false,
      },
      {
        number: 2,
        title: 'Seen at 2:14 AM',
        description: 'The moment she saw the message, everything changed.',
        thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 85,
        isPaid: false,
      },
      {
        number: 3,
        title: 'Typing…',
        description: 'Three dots that say everything and nothing at all.',
        thumbnail: 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 95,
        isPaid: false,
      },
      {
        number: 4,
        title: 'Deleted Messages',
        description: 'Some words are meant to disappear. But do they really?',
        thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 88,
        isPaid: false,
      },
      {
        number: 5,
        title: 'Who Is Watching?',
        description: 'When you realize someone else is reading your messages...',
        thumbnail: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 92,
        isPaid: false,
      },
      {
        number: 6,
        title: 'The Screenshot',
        description: 'One screenshot can ruin everything.',
        thumbnail: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 87,
        isPaid: false,
      },
      {
        number: 7,
        title: 'No Caller ID',
        description: 'An unexpected call changes the game.',
        thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 93,
        isPaid: false,
      },
      {
        number: 8,
        title: 'Online Again',
        description: 'After days of silence, they\'re back online.',
        thumbnail: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 90,
        isPaid: false,
      },
      {
        number: 9,
        title: 'The Profile Picture',
        description: 'A new profile picture reveals more than intended.',
        thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 91,
        isPaid: false,
      },
      {
        number: 10,
        title: 'Voice Note',
        description: 'Hearing their voice changes everything. [Premium]',
        thumbnail: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 94,
        isPaid: true,
      },
      {
        number: 11,
        title: 'Read Receipts',
        description: 'The truth about who\'s been reading the messages. [Premium]',
        thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 89,
        isPaid: true,
      },
      {
        number: 12,
        title: 'Last Seen',
        description: 'The final message that reveals everything. [Premium]',
        thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80',
        videoId: 'b9b6b4f8b735d37919dcfebeda242dba',
        duration: 96,
        isPaid: true,
      },
    ];

    for (const ep of episodes) {
      const episodeId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT OR IGNORE INTO episodes (id, serial_id, episode_number, title, description, thumbnail_url, video_id, duration, is_paid, published_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
        args: [
          episodeId,
          seriesId,
          ep.number,
          ep.title,
          ep.description,
          ep.thumbnail,
          ep.videoId,
          ep.duration,
          ep.isPaid ? 1 : 0,
        ],
      });
    }

    console.log('✅ Sample content created');

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('  - 3 subscription plans');
    console.log('  - 1 sample series: "Midnight Confessions"');
    console.log('  - 12 sample episodes (9 free, 3 premium)');
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
