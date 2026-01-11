-- Seed Remote Database
-- Subscription Plans
INSERT OR IGNORE INTO plans (id, name, description, price, currency, billing_period, trial_days, features, solidgate_product_id, is_active)
VALUES
  ('plan_1week', '1 Week', 'Perfect for trying out premium content', 7.99, 'USD', 'weekly', 0, '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_1week', 1),
  ('plan_4weeks', '4 Weeks', 'Save 58% compared to weekly - just $3.37/week', 13.49, 'USD', 'monthly', 7, '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_4weeks', 1),
  ('plan_12weeks', '12 Weeks', 'Best value - save 74% compared to weekly at just $2.08/week', 24.99, 'USD', 'quarterly', 7, '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_12weeks', 1),
  ('plan_24weeks', '24 Weeks', 'Ultimate savings - save 78% compared to weekly at $1.75/week', 41.99, 'USD', 'biannual', 7, '{"episodeAccess":"all","adFree":true,"downloadable":true,"earlyAccess":true}', 'solidgate_product_24weeks', 1);

-- Midnight Confessions Series
INSERT INTO series (id, title, description, thumbnail_url, genre, author, status, created_at, updated_at)
VALUES (
  'a49ab52f-71ab-477f-b886-bc762fb72e64',
  'Midnight Confessions',
  'A gripping vertical short-form drama series that explores the complexities of modern relationships through late-night text messages. Follow Emma and Jake as their digital conversations reveal secrets, desires, and unexpected twists that will keep you on the edge of your seat.',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
  'Drama, Romance, Mystery, Thriller',
  'Michael Chen',
  'ongoing',
  unixepoch(),
  unixepoch()
);

-- Episodes
INSERT INTO episodes (id, serial_id, episode_number, title, description, thumbnail_url, video_id, duration, is_paid, published_at, created_at)
VALUES
  ('ep-1-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 1, 'The First Message', 'It all starts with a simple text at midnight...', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 90, 0, unixepoch(), unixepoch()),
  ('ep-2-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 2, 'Seen at 2:14 AM', 'The moment she saw the message, everything changed.', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 85, 0, unixepoch(), unixepoch()),
  ('ep-3-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 3, 'Typing…', 'Three dots that say everything and nothing at all.', 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 95, 0, unixepoch(), unixepoch()),
  ('ep-4-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 4, 'Deleted Messages', 'Some words are meant to disappear. But do they really?', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 88, 0, unixepoch(), unixepoch()),
  ('ep-5-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 5, 'Who Is Watching?', 'When you realize someone else is reading your messages...', 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 92, 0, unixepoch(), unixepoch()),
  ('ep-6-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 6, 'The Screenshot', 'One screenshot can ruin everything.', 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 87, 0, unixepoch(), unixepoch()),
  ('ep-7-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 7, 'No Caller ID', 'An unexpected call changes the game.', 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 93, 0, unixepoch(), unixepoch()),
  ('ep-8-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 8, 'Online Again', 'After days of silence, they''re back online.', 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 90, 0, unixepoch(), unixepoch()),
  ('ep-9-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 9, 'The Profile Picture', 'A new profile picture reveals more than intended.', 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 91, 0, unixepoch(), unixepoch()),
  ('ep-10-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 10, 'Voice Note', 'Hearing their voice changes everything. [Premium]', 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 94, 1, unixepoch(), unixepoch()),
  ('ep-11-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 11, 'Read Receipts', 'The truth about who''s been reading the messages. [Premium]', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 89, 1, unixepoch(), unixepoch()),
  ('ep-12-' || hex(randomblob(16)), 'a49ab52f-71ab-477f-b886-bc762fb72e64', 12, 'Last Seen', 'The final message that reveals everything. [Premium]', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80', 'b9b6b4f8b735d37919dcfebeda242dba', 96, 1, unixepoch(), unixepoch());
