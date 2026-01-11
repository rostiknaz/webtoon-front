/**
 * Database Seed Script with Drizzle ORM
 *
 * Populates the database with initial data:
 * - Subscription plans
 * - Sample series and episodes (optional)
 *
 * Usage:
 * - Local: npm run db:seed:local
 * - Remote: npm run db:seed:remote
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { plans, series, episodes } from './schema';
import { sql } from 'drizzle-orm';

// Determine database URL based on environment
const isRemote = process.env.DATABASE_URL === 'remote';
const DATABASE_URL = isRemote
  ? process.env.CLOUDFLARE_D1_URL || ''
  : process.env.DATABASE_URL ||
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d92f4d3dda6d00f0624e5f92a013bc9e140a3dfd7f2719743e3a6571bf66d016.sqlite';

async function seed() {
  console.log('🌱 Seeding database...');
  console.log(`📍 Target: ${isRemote ? 'Remote (Cloudflare D1)' : 'Local (SQLite)'}`);

  // Create database client
  const client = createClient({
    url: isRemote ? DATABASE_URL : `file:${DATABASE_URL}`,
  });

  const db = drizzle(client, { schema: { plans, series, episodes } });

  try {
    // Seed subscription plans
    console.log('\n📦 Creating subscription plans...');

    await db
      .insert(plans)
      .values([
        {
          id: 'plan_1week',
          name: '1 Week',
          description: 'Perfect for trying out premium content',
          price: 7.99,
          currency: 'USD',
          billingPeriod: 'weekly',
          trialDays: 0,
          features: JSON.stringify({
            episodeAccess: 'all',
            adFree: true,
            downloadable: true,
            earlyAccess: true,
          }),
          solidgateProductId: 'solidgate_product_1week',
          isActive: true,
        },
        {
          id: 'plan_4weeks',
          name: '4 Weeks',
          description: 'Save 58% compared to weekly - just $3.37/week',
          price: 13.49,
          currency: 'USD',
          billingPeriod: 'monthly',
          trialDays: 7,
          features: JSON.stringify({
            episodeAccess: 'all',
            adFree: true,
            downloadable: true,
            earlyAccess: true,
          }),
          solidgateProductId: 'solidgate_product_4weeks',
          isActive: true,
        },
        {
          id: 'plan_12weeks',
          name: '12 Weeks',
          description: 'Best value - save 74% compared to weekly at just $2.08/week',
          price: 24.99,
          currency: 'USD',
          billingPeriod: 'quarterly',
          trialDays: 7,
          features: JSON.stringify({
            episodeAccess: 'all',
            adFree: true,
            downloadable: true,
            earlyAccess: true,
          }),
          solidgateProductId: 'solidgate_product_12weeks',
          isActive: true,
        },
        {
          id: 'plan_24weeks',
          name: '24 Weeks',
          description: 'Ultimate savings - save 78% compared to weekly at $1.75/week',
          price: 41.99,
          currency: 'USD',
          billingPeriod: 'biannual',
          trialDays: 7,
          features: JSON.stringify({
            episodeAccess: 'all',
            adFree: true,
            downloadable: true,
            earlyAccess: true,
          }),
          solidgateProductId: 'solidgate_product_24weeks',
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    console.log('✅ Subscription plans created');

    // Seed sample series
    console.log('\n📺 Creating sample series...');

    const seriesId = crypto.randomUUID();
    await db
      .insert(series)
      .values({
        id: seriesId,
        title: 'Midnight Confessions',
        description:
          'A gripping vertical short-form drama series that explores the complexities of modern relationships through late-night text messages. Follow Emma and Jake as their digital conversations reveal secrets, desires, and unexpected twists that will keep you on the edge of your seat.',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
        genre: 'Drama, Romance, Mystery, Thriller',
        author: 'Michael Chen',
        status: 'ongoing',
        totalViews: 0,
        totalLikes: 0,
      })
      .onConflictDoNothing();

    console.log('✅ Sample series created');

    // Seed sample episodes
    console.log('\n🎬 Creating sample episodes...');

    const episodeData = [
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
        description: "After days of silence, they're back online.",
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
        description: "The truth about who's been reading the messages. [Premium]",
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

    // Insert episodes using Drizzle
    const episodeValues = episodeData.map((ep) => ({
      id: crypto.randomUUID(),
      serialId: seriesId,
      episodeNumber: ep.number,
      title: ep.title,
      description: ep.description,
      thumbnailUrl: ep.thumbnail,
      videoId: ep.videoId,
      duration: ep.duration,
      isPaid: ep.isPaid,
      views: 0,
      likes: 0,
      isLocked: false,
      publishedAt: sql`unixepoch()`,
    }));

    await db.insert(episodes).values(episodeValues).onConflictDoNothing();

    console.log('✅ Sample episodes created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('  - 4 subscription plans (1 week, 4 weeks, 12 weeks, 24 weeks)');
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
    client.close();
  }
}

// Run seed
seed().catch(console.error);
