-- Database Seed Script
-- Populates the database with initial subscription plans and sample content
--
-- Usage:
-- - Local:  npm run db:seed:local
-- - Remote: npm run db:seed:remote

-- ============================================
-- Subscription Plans
-- ============================================

INSERT OR IGNORE INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active)
VALUES
  ('plan_1week', '1 Week', 'Perfect for trying out premium content', 7.99, 'USD', 'weekly', 0,
   '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_1week', 1),

  ('plan_4weeks', '4 Weeks', 'Save 58% compared to weekly - just $3.37/week', 13.49, 'USD', 'monthly', 7,
   '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_4weeks', 1),

  ('plan_12weeks', '12 Weeks', 'Best value - save 74% compared to weekly at just $2.08/week', 24.99, 'USD', 'quarterly', 7,
   '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_12weeks', 1),

  ('plan_24weeks', '24 Weeks', 'Ultimate savings - save 78% compared to weekly at $1.75/week', 41.99, 'USD', 'biannual', 7,
   '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_24weeks', 1);

-- ============================================
-- Sample Series
-- ============================================

INSERT OR IGNORE INTO series (id, slug, title, description, thumbnail_url, genre, author, status, total_views, total_likes)
VALUES (
  'series_midnight_confessions',
  'midnight-confessions',
  'Midnight Confessions',
  'A gripping vertical short-form drama series that explores the complexities of modern relationships through late-night text messages. Follow Emma and Jake as their digital conversations reveal secrets, desires, and unexpected twists that will keep you on the edge of your seat.',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
  'Drama, Romance, Mystery, Thriller',
  'Michael Chen',
  'ongoing',
  0,
  0
);

-- ============================================
-- Sample Episodes
-- ============================================

INSERT OR IGNORE INTO episodes (id, serial_id, episode_number, title, description, thumbnail_url, duration, is_paid, views, likes, is_locked, published_at)
VALUES
  ('ep_mc_01', 'series_midnight_confessions', 1, 'The First Message',
   'It all starts with a simple text at midnight...',
   'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
   90, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_02', 'series_midnight_confessions', 2, 'Seen at 2:14 AM',
   'The moment she saw the message, everything changed.',
   'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&q=80',
   85, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_03', 'series_midnight_confessions', 3, 'Typing…',
   'Three dots that say everything and nothing at all.',
   'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=300&q=80',
   95, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_04', 'series_midnight_confessions', 4, 'Deleted Messages',
   'Some words are meant to disappear. But do they really?',
   'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=300&q=80',
   88, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_05', 'series_midnight_confessions', 5, 'Who Is Watching?',
   'When you realize someone else is reading your messages...',
   'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=300&q=80',
   92, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_06', 'series_midnight_confessions', 6, 'The Screenshot',
   'One screenshot can ruin everything.',
   'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300&q=80',
   87, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_07', 'series_midnight_confessions', 7, 'No Caller ID',
   'An unexpected call changes the game.',
   'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300&q=80',
   93, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_08', 'series_midnight_confessions', 8, 'Online Again',
   'After days of silence, they''re back online.',
   'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=300&q=80',
   90, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_09', 'series_midnight_confessions', 9, 'The Profile Picture',
   'A new profile picture reveals more than intended.',
   'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80',
   91, 0, 0, 0, 0, unixepoch()),

  ('ep_mc_10', 'series_midnight_confessions', 10, 'Voice Note',
   'Hearing their voice changes everything. [Premium]',
   'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=300&q=80',
   94, 1, 0, 0, 0, unixepoch()),

  ('ep_mc_11', 'series_midnight_confessions', 11, 'Read Receipts',
   'The truth about who''s been reading the messages. [Premium]',
   'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
   89, 1, 0, 0, 0, unixepoch()),

  ('ep_mc_12', 'series_midnight_confessions', 12, 'Last Seen',
   'The final message that reveals everything. [Premium]',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80',
   96, 1, 0, 0, 0, unixepoch());


-- ============================================
-- Categories (Epic 2: Content Discovery)
-- ============================================

INSERT OR IGNORE INTO categories (id, name, slug, description, sort_order)
VALUES
  ('cat_action', 'Action', 'action', 'High-energy action sequences and fight scenes', 1),
  ('cat_romance', 'Romance', 'romance', 'Love stories and romantic drama', 2),
  ('cat_cyberpunk', 'Cyberpunk', 'cyberpunk', 'Futuristic dystopian worlds and neon-lit cities', 3),
  ('cat_slice_of_life', 'Slice of Life', 'slice-of-life', 'Everyday moments and relatable stories', 4),
  ('cat_horror', 'Horror', 'horror', 'Scary, suspenseful, and supernatural content', 5),
  ('cat_comedy', 'Comedy', 'comedy', 'Funny and lighthearted entertainment', 6),
  ('cat_sci_fi', 'Sci-Fi', 'sci-fi', 'Science fiction and space exploration', 7),
  ('cat_fantasy', 'Fantasy', 'fantasy', 'Magical worlds and epic adventures', 8);

-- ============================================
-- Sample Creator User (for clips)
-- ============================================

INSERT OR IGNORE INTO users (id, email, email_verified, name, image, role, display_name, bio)
VALUES
  ('user_creator_demo', 'creator@demo.webtoon.dev', 1, 'Demo Creator', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80', 'creator', 'NeonStudio', 'Creating incredible short-form content');

-- ============================================
-- Sample Creator Series
-- ============================================

INSERT OR IGNORE INTO creator_series (id, creator_id, slug, title, description, cover_url, genre, status, nsfw_rating, total_episodes)
VALUES
  ('cseries_neon_nights', 'user_creator_demo', 'neon-nights', 'Neon Nights', 'A cyberpunk journey through the streets of Neo Tokyo', 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&q=80', 'cyberpunk,action', 'ongoing', 'safe', 8),
  ('cseries_love_bytes', 'user_creator_demo', 'love-bytes', 'Love Bytes', 'Digital romance in the age of AI', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', 'romance,sci-fi', 'ongoing', 'suggestive', 5);

-- ============================================
-- Sample Clips (Epic 2: Feed Content)
-- ============================================

INSERT OR IGNORE INTO clips (id, creator_id, title, description, video_url, thumbnail_url, duration, series_id, episode_number, nsfw_rating, status, download_count, views, likes, published_at)
VALUES
  ('clip_01', 'user_creator_demo', 'Neon Chase', 'A high-speed chase through neon-lit streets', NULL, 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&q=80', 45, 'cseries_neon_nights', 1, 'safe', 'published', 120, 5400, 340, unixepoch() - 86400 * 20),
  ('clip_02', 'user_creator_demo', 'Rooftop Standoff', 'The final confrontation atop Neo Tower', NULL, 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=80', 62, 'cseries_neon_nights', 2, 'safe', 'published', 89, 4200, 287, unixepoch() - 86400 * 19),
  ('clip_03', 'user_creator_demo', 'Digital Heartbreak', 'When AI learns about love', NULL, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', 38, 'cseries_love_bytes', 1, 'suggestive', 'published', 210, 8900, 670, unixepoch() - 86400 * 18),
  ('clip_04', 'user_creator_demo', 'Street Fighter', 'Underground martial arts in the slums', NULL, 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80', 55, NULL, NULL, 'safe', 'published', 150, 6700, 420, unixepoch() - 86400 * 17),
  ('clip_05', 'user_creator_demo', 'Midnight Rain', 'A quiet moment in the rain', NULL, 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80', 30, NULL, NULL, 'safe', 'published', 95, 3800, 250, unixepoch() - 86400 * 16),
  ('clip_06', 'user_creator_demo', 'Code Red', 'Hacking into the mainframe', NULL, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', 48, 'cseries_neon_nights', 3, 'safe', 'published', 175, 7200, 510, unixepoch() - 86400 * 15),
  ('clip_07', 'user_creator_demo', 'First Date', 'Two strangers meet in virtual reality', NULL, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80', 42, 'cseries_love_bytes', 2, 'safe', 'published', 180, 9500, 720, unixepoch() - 86400 * 14),
  ('clip_08', 'user_creator_demo', 'Shadow Dance', 'Mysterious figures in the dark', NULL, 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=400&q=80', 35, NULL, NULL, 'safe', 'published', 110, 4100, 310, unixepoch() - 86400 * 13),
  ('clip_09', 'user_creator_demo', 'Cyber Dreams', 'Dreams become reality in the metaverse', NULL, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', 50, 'cseries_neon_nights', 4, 'safe', 'published', 200, 8400, 590, unixepoch() - 86400 * 12),
  ('clip_10', 'user_creator_demo', 'Sunset Lovers', 'A bittersweet goodbye at sunset', NULL, 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&q=80', 40, 'cseries_love_bytes', 3, 'suggestive', 'published', 160, 7100, 480, unixepoch() - 86400 * 11),
  ('clip_11', 'user_creator_demo', 'Ghost Protocol', 'When the dead send messages', NULL, 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80', 58, NULL, NULL, 'safe', 'published', 130, 5600, 370, unixepoch() - 86400 * 10),
  ('clip_12', 'user_creator_demo', 'Neon Samurai', 'A warrior with a glowing blade', NULL, 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400&q=80', 65, 'cseries_neon_nights', 5, 'safe', 'published', 220, 10200, 780, unixepoch() - 86400 * 9),
  ('clip_13', 'user_creator_demo', 'Laughing Stock', 'A comedy gone wrong', NULL, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', 33, NULL, NULL, 'safe', 'published', 88, 3200, 210, unixepoch() - 86400 * 8),
  ('clip_14', 'user_creator_demo', 'Dark Matter', 'Exploring the void between stars', NULL, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', 47, NULL, NULL, 'safe', 'published', 140, 6000, 430, unixepoch() - 86400 * 7),
  ('clip_15', 'user_creator_demo', 'Forbidden Kiss', 'Love that defies all rules', NULL, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80', 36, 'cseries_love_bytes', 4, 'nsfw', 'published', 300, 12000, 950, unixepoch() - 86400 * 6),
  ('clip_16', 'user_creator_demo', 'Blade Runner', 'Chasing androids through the rain', NULL, 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=80', 52, 'cseries_neon_nights', 6, 'safe', 'published', 190, 8800, 630, unixepoch() - 86400 * 5),
  ('clip_17', 'user_creator_demo', 'Haunted Server', 'The server room has a ghost', NULL, 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80', 44, NULL, NULL, 'safe', 'published', 105, 4500, 290, unixepoch() - 86400 * 4),
  ('clip_18', 'user_creator_demo', 'Dragon Awakens', 'The ancient beast rises from slumber', NULL, 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=400&q=80', 60, NULL, NULL, 'safe', 'published', 250, 11000, 850, unixepoch() - 86400 * 3),
  ('clip_19', 'user_creator_demo', 'Final Goodbye', 'The last message before departure', NULL, 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&q=80', 28, 'cseries_love_bytes', 5, 'safe', 'published', 170, 7600, 520, unixepoch() - 86400 * 2),
  ('clip_20', 'user_creator_demo', 'Electric Dreams', 'Where reality and fantasy collide', NULL, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', 54, 'cseries_neon_nights', 7, 'safe', 'published', 145, 6300, 440, unixepoch() - 86400 * 1);

-- ============================================
-- Clip-Category Associations
-- ============================================

INSERT OR IGNORE INTO clip_categories (clip_id, category_id)
VALUES
  ('clip_01', 'cat_action'), ('clip_01', 'cat_cyberpunk'),
  ('clip_02', 'cat_action'), ('clip_02', 'cat_cyberpunk'),
  ('clip_03', 'cat_romance'), ('clip_03', 'cat_sci_fi'),
  ('clip_04', 'cat_action'),
  ('clip_05', 'cat_slice_of_life'),
  ('clip_06', 'cat_cyberpunk'), ('clip_06', 'cat_action'),
  ('clip_07', 'cat_romance'), ('clip_07', 'cat_sci_fi'),
  ('clip_08', 'cat_horror'),
  ('clip_09', 'cat_cyberpunk'), ('clip_09', 'cat_sci_fi'),
  ('clip_10', 'cat_romance'),
  ('clip_11', 'cat_horror'), ('clip_11', 'cat_sci_fi'),
  ('clip_12', 'cat_action'), ('clip_12', 'cat_cyberpunk'), ('clip_12', 'cat_fantasy'),
  ('clip_13', 'cat_comedy'),
  ('clip_14', 'cat_sci_fi'),
  ('clip_15', 'cat_romance'),
  ('clip_16', 'cat_cyberpunk'), ('clip_16', 'cat_action'),
  ('clip_17', 'cat_horror'), ('clip_17', 'cat_comedy'),
  ('clip_18', 'cat_fantasy'), ('clip_18', 'cat_action'),
  ('clip_19', 'cat_romance'), ('clip_19', 'cat_slice_of_life'),
  ('clip_20', 'cat_cyberpunk'), ('clip_20', 'cat_sci_fi');
