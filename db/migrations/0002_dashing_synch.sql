CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_slug` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_sort` ON `categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `clip_categories` (
	`clip_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_clip_categories_unique` ON `clip_categories` (`clip_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`video_url` text,
	`thumbnail_url` text,
	`duration` integer,
	`resolution` text,
	`file_size` integer,
	`series_id` text,
	`episode_number` integer,
	`nsfw_rating` text DEFAULT 'safe' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`credit_cost` integer DEFAULT 1 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `creator_series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_clips_creator` ON `clips` (`creator_id`);--> statement-breakpoint
CREATE INDEX `idx_clips_feed` ON `clips` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_clips_nsfw_feed` ON `clips` (`status`,`nsfw_rating`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_clips_series` ON `clips` (`series_id`,`episode_number`);--> statement-breakpoint
CREATE TABLE `creator_series` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_url` text,
	`genre` text,
	`status` text DEFAULT 'ongoing' NOT NULL,
	`nsfw_rating` text DEFAULT 'safe' NOT NULL,
	`total_episodes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_series_slug_unique` ON `creator_series` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_creator_series_creator` ON `creator_series` (`creator_id`);--> statement-breakpoint
CREATE INDEX `idx_creator_series_slug` ON `creator_series` (`slug`);