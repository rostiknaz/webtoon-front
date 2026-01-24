# R2 Self-Hosted HLS Video Streaming Architecture

This document describes the self-hosted HLS video streaming system using Cloudflare R2, which replaces Cloudflare Stream for significant cost savings (~99.99% reduction at scale).

## Overview

### Why R2 Over Cloudflare Stream?

| Metric | Cloudflare Stream | R2 Self-Hosted |
|--------|-------------------|----------------|
| Storage | $5/1000 min | $0.015/GB |
| Delivery | $1/1000 min | **FREE** |
| Monthly (4M DAU) | ~$1.44M | ~$100 |
| **Savings** | - | **99.99%** |

R2's **zero egress fees** make it ideal for video streaming where bandwidth costs typically dominate.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              HybridVideoPlayer.tsx                       │   │
│  │  - Generates HLS URL from series.slug + episodeNumber   │   │
│  │  - Path: {slug}/ep_{paddedNumber}/manifest.m3u8         │   │
│  │  - Aggressive preloading (next 2 + prev 1)              │   │
│  │  - 30s buffer for smooth playback                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           VideoPlayerCacheContext.tsx                    │   │
│  │  - LRU cache (5 players max)                            │   │
│  │  - xgplayer + HLS.js for playback                       │   │
│  │  - Position saving/restoration                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS (Free Egress)
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare R2 Bucket                         │
│                      (webtoon-hls)                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  {series_slug}/                                          │   │
│  │  └── ep_{padded_number}/                                 │   │
│  │      ├── manifest.m3u8      (ABR master playlist)       │   │
│  │      ├── 360p/                                          │   │
│  │      │   ├── playlist.m3u8  (quality playlist)          │   │
│  │      │   └── seg_*.ts       (video segments)            │   │
│  │      ├── 480p/                                          │   │
│  │      │   ├── playlist.m3u8                              │   │
│  │      │   └── seg_*.ts                                   │   │
│  │      └── 720p/                                          │   │
│  │          ├── playlist.m3u8                              │   │
│  │          └── seg_*.ts                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  GET /api/series/:id                                     │   │
│  │  - Returns series with slug field                        │   │
│  │  - slug: "solgier" (URL-safe identifier)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  D1 Database                                             │   │
│  │  - series.slug: URL-safe identifier for R2 paths       │   │
│  │  - episodes.episodeNumber: used for path generation     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **API Request**: Frontend fetches series data via `/api/series/:id`
2. **Series Data**: API returns series with `slug` field (e.g., `"solgier"`)
3. **URL Generation**: Frontend generates URL: `${R2_CDN_URL}/${slug}/ep_${paddedNumber}/manifest.m3u8`
4. **HLS Playback**: xgplayer + HLS.js fetches manifest, then quality playlists, then segments
5. **ABR**: Player automatically switches between 360p/480p/720p based on network conditions

---

## R2 Bucket Structure

### Bucket: `webtoon-hls`

```
webtoon-hls/
├── solgier/                    # Series folder
│   ├── ep_01/                  # Episode 1
│   │   ├── manifest.m3u8
│   │   ├── 360p/
│   │   │   ├── playlist.m3u8
│   │   │   └── seg_*.ts
│   │   ├── 480p/
│   │   │   └── ...
│   │   └── 720p/
│   │       └── ...
│   ├── ep_02/                  # Episode 2
│   │   └── ...
│   └── ep_99/                  # Episode 99
│       └── ...
├── midnight-chase/             # Another series
│   ├── ep_01/
│   └── ...
└── hero-academy/               # Another series
    └── ...
```

### URL Pattern

```
https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/{series_slug}/ep_{padded_number}/manifest.m3u8

Examples:
- https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/solgier/ep_01/manifest.m3u8
- https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/solgier/ep_99/manifest.m3u8
- https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/midnight-chase/ep_01/manifest.m3u8
```

### Quality Levels

| Quality | Resolution | Bitrate | Audio | Use Case |
|---------|------------|---------|-------|----------|
| 360p | 640x360 | ~800 kbps | 96 kbps AAC | Mobile/Low bandwidth |
| 480p | 854x480 | ~1.4 Mbps | 128 kbps AAC | Standard definition |
| 720p | 1280x720 | ~2.8 Mbps | 192 kbps AAC | HD playback |

---

## Database Schema

### Series Table

```typescript
// db/schema.ts
export const series = sqliteTable('series', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // URL-safe: "solgier", "midnight-chase"
  title: text('title').notNull(),
  // ...
});
```

### Episodes Table

```typescript
// No hlsPath needed - path is generated from series.slug + episodeNumber
export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  serialId: text('serial_id').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  // ...
});
```

---

## Frontend URL Generation

### HybridVideoPlayer.tsx

```typescript
const R2_CDN_URL = 'https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev';

const getHlsUrl = useCallback((ep: Episode) => {
  const paddedEp = ep.episodeNumber.toString().padStart(2, '0');
  return `${R2_CDN_URL}/${seriesSlug}/ep_${paddedEp}/manifest.m3u8`;
}, [seriesSlug]);
```

### Usage in Route

```tsx
// src/routes/serials/$serialId.tsx
<HybridVideoPlayer
  episodes={episodes}
  seriesSlug={data.slug}  // From API response
  seriesTitle={data.title}
  // ...
/>
```

---

## Slug Guidelines

### Format Rules

- **Lowercase**: `solgier` not `Solgier`
- **Kebab-case**: `midnight-chase` not `midnight_chase`
- **URL-safe**: No spaces, special characters
- **Unique**: Each series has unique slug
- **Concise**: Short but descriptive

### Examples

| Title | Slug |
|-------|------|
| Solgier | `solgier` |
| Midnight Chase | `midnight-chase` |
| Hero Academy S2 | `hero-academy-s2` |
| The Last Stand | `the-last-stand` |

---

## Player Optimization

### Buffer Configuration

With R2's free egress, we use generous buffer sizes:

```typescript
const HLS_PLUGIN_CONFIG = {
  hlsJsPlugin: {
    maxBufferLength: 30,      // 30 seconds ahead
    maxMaxBufferLength: 60,   // Up to 60 seconds
  },
};
```

### Preloading Strategy

```typescript
const preloadAdjacentEpisodes = (swiper, currentIndex) => {
  // Next episode: immediate
  preloadEpisode(swiper, currentIndex + 1);

  // Next+1: during idle time
  requestIdleCallback(() => preloadEpisode(swiper, currentIndex + 2));

  // Previous: immediate
  preloadEpisode(swiper, currentIndex - 1);
};
```

### LRU Cache

```typescript
const MAX_CACHED_PLAYERS = 5; // 5 players for rapid swiping
```

---

## Workflow

### Adding a New Episode

```bash
# 1. Transcode video
./scripts/transcode.sh ~/videos/episode5.mp4 solgier 5

# 2. Upload to R2
./scripts/upload-to-r2.sh solgier 5

# 3. Done! Frontend generates URL automatically from:
#    - series.slug: "solgier"
#    - episode.episodeNumber: 5
#    - Result: solgier/ep_05/manifest.m3u8
```

### Adding a New Series

```sql
-- 1. Add series with slug
INSERT INTO series (id, slug, title, ...)
VALUES ('uuid', 'new-series', 'New Series Title', ...);

-- 2. Add episodes (episodeNumber is all you need)
INSERT INTO episodes (id, serial_id, episode_number, ...)
VALUES ('uuid', 'series-uuid', 1, ...);
```

---

## Cost Estimate

For your scale (100-200 series, 100 episodes each, 3-5 min videos):

```
Storage:
- Episodes: 200 × 100 = 20,000 episodes
- Size per episode: ~15MB (all qualities)
- Total: ~300GB

Monthly Costs:
- Storage: 300GB × $0.015 = $4.50/month
- Class A ops (writes): minimal
- Class B ops (reads): ~$1-5/month
- Egress: $0 (FREE!)

Total: ~$5-10/month
```

---

## Troubleshooting

### Video Not Playing

1. Verify slug matches R2 folder name exactly
2. Check episode number padding (01, 02, not 1, 2)
3. Verify R2 public access is enabled
4. Test manifest URL directly in browser

### Wrong Episode Playing

1. Check episodeNumber in database matches R2 folder
2. Verify slug is correct in API response
3. Check frontend is using correct series slug

---

## Files Reference

| File | Purpose |
|------|---------|
| `db/schema.ts` | Series table with slug column |
| `scripts/transcode.sh` | FFmpeg transcoding with slug/episode args |
| `scripts/upload-to-r2.sh` | R2 upload with slug/episode args |
| `src/components/HybridVideoPlayer.tsx` | Dynamic URL generation |
| `worker/routes/series.ts` | API returns slug with series data |
