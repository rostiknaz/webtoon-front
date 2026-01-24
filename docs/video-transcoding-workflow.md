# Video Transcoding and Upload Workflow

This document describes the step-by-step process for preparing and uploading video content to the R2-based HLS streaming system.

## Prerequisites

### Required Tools

1. **FFmpeg** (with libx264 and AAC support)
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg

   # Verify installation
   ffmpeg -version
   ```

2. **Wrangler CLI** (Cloudflare's CLI tool)
   ```bash
   npm install -g wrangler

   # Authenticate with Cloudflare
   wrangler login
   ```

3. **R2 Bucket** (created and configured)
   ```bash
   npx wrangler r2 bucket create webtoon-hls
   ```

---

## Quick Start

```bash
# 1. Transcode video to HLS
./scripts/transcode.sh ~/videos/episode1.mp4 solgier 1

# 2. Upload to R2
./scripts/upload-to-r2.sh solgier 1

# Done! Video is now available at:
# https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/solgier/ep_01/manifest.m3u8
```

---

## Transcoding Process

### Overview

The transcoding process converts a source video file into HLS format with multiple quality levels for adaptive bitrate streaming.

```
Source Video (MP4)
       │
       ▼
   FFmpeg Transcode
       │
       ├──► 360p (640x360, ~800kbps)
       ├──► 480p (854x480, ~1.4Mbps)
       └──► 720p (1280x720, ~2.8Mbps)
       │
       ▼
   HLS Output: ./output/{series_slug}/ep_{number}/
   ├── manifest.m3u8 (master playlist)
   ├── 360p/
   │   ├── playlist.m3u8
   │   └── seg_*.ts
   ├── 480p/
   │   └── ...
   └── 720p/
       └── ...
```

### Using the Transcode Script

```bash
# Location: scripts/transcode.sh

# Usage
./scripts/transcode.sh <input_video> <series_slug> <episode_number>

# Examples
./scripts/transcode.sh ~/videos/ep1.mp4 solgier 1
./scripts/transcode.sh ~/videos/ep2.mp4 solgier 2
./scripts/transcode.sh ~/videos/pilot.mp4 midnight-chase 1
```

### Output Structure

```
./output/
├── solgier/
│   ├── ep_01/
│   │   ├── manifest.m3u8
│   │   ├── 360p/
│   │   │   ├── playlist.m3u8
│   │   │   └── seg_*.ts
│   │   ├── 480p/
│   │   │   └── ...
│   │   └── 720p/
│   │       └── ...
│   └── ep_02/
│       └── ...
└── midnight-chase/
    └── ep_01/
        └── ...
```

### Expected Output Sizes

For a 3-5 minute video:
| Quality | Video Bitrate | Audio | Size (3 min) | Size (5 min) |
|---------|---------------|-------|--------------|--------------|
| 360p | ~400 kbps | 96k | ~10 MB | ~17 MB |
| 480p | ~700 kbps | 128k | ~18 MB | ~30 MB |
| 720p | ~1.5 Mbps | 192k | ~37 MB | ~62 MB |
| **Total** | - | - | **~65 MB** | **~109 MB** |

---

## Upload Process

### Using the Upload Script

```bash
# Location: scripts/upload-to-r2.sh

# Usage
./scripts/upload-to-r2.sh <series_slug> <episode_number>

# Examples
./scripts/upload-to-r2.sh solgier 1
./scripts/upload-to-r2.sh solgier 2
./scripts/upload-to-r2.sh midnight-chase 1
```

### What the Script Does

1. **Reads from local output directory**
   ```
   ./output/{series_slug}/ep_{padded_number}/
   ```

2. **Uploads to R2 with correct structure**
   ```
   webtoon-hls/{series_slug}/ep_{padded_number}/
   ```

3. **Sets correct MIME types**
   - `.m3u8` → `application/vnd.apple.mpegurl`
   - `.ts` → `video/mp2t`

### Upload Progress

```
Uploading HLS content to R2...
  Series: solgier
  Episode: 1 (padded: 01)
  Source: ./output/solgier/ep_01
  Destination: webtoon-hls/solgier/ep_01/

Uploading master manifest...
Upload complete.

Uploading 360p quality...
  360p upload complete

Uploading 480p quality...
  480p upload complete

Uploading 720p quality...
  720p upload complete

Upload complete!

R2 path: solgier/ep_01
Full URL: https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/solgier/ep_01/manifest.m3u8
```

---

## Complete Workflow Example

### Adding Episode 5 to "Solgier" Series

```bash
# Step 1: Transcode the video
./scripts/transcode.sh ~/videos/solgier-ep5.mp4 solgier 5

# Output:
# Creating output directories...
#   Series: solgier
#   Episode: 5 (padded: 05)
#   Output: ./output/solgier/ep_05
#
# Transcoding complete!
# R2 path will be: solgier/ep_05/

# Step 2: Verify output
ls -la ./output/solgier/ep_05/
du -sh ./output/solgier/ep_05/*

# Step 3: Upload to R2
./scripts/upload-to-r2.sh solgier 5

# Step 4: Verify playback
# Open in browser:
# https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/solgier/ep_05/manifest.m3u8
```

### Adding a New Series "Hero Academy"

```bash
# Step 1: Create series in database (with slug!)
# Via Drizzle Studio or SQL:
# INSERT INTO series (id, slug, title) VALUES ('uuid', 'hero-academy', 'Hero Academy');

# Step 2: Transcode episode 1
./scripts/transcode.sh ~/videos/hero-academy-ep1.mp4 hero-academy 1

# Step 3: Upload
./scripts/upload-to-r2.sh hero-academy 1

# Step 4: Add episode to database
# INSERT INTO episodes (id, serial_id, episode_number, title)
# VALUES ('uuid', 'series-uuid', 1, 'Pilot');

# Step 5: Verify in app
# Frontend generates: hero-academy/ep_01/manifest.m3u8
```

---

## Batch Processing

### Process Multiple Episodes

```bash
#!/bin/bash
# scripts/batch-process.sh

SERIES_SLUG="$1"
VIDEOS_DIR="$2"

if [ -z "$SERIES_SLUG" ] || [ -z "$VIDEOS_DIR" ]; then
    echo "Usage: $0 <series_slug> <videos_directory>"
    echo "Example: $0 solgier ~/videos/solgier/"
    exit 1
fi

EP_NUM=1
for video in "$VIDEOS_DIR"/*.mp4; do
    echo "Processing episode $EP_NUM: $video"

    # Transcode
    ./scripts/transcode.sh "$video" "$SERIES_SLUG" "$EP_NUM"

    # Upload
    ./scripts/upload-to-r2.sh "$SERIES_SLUG" "$EP_NUM"

    EP_NUM=$((EP_NUM + 1))
done

echo "Batch processing complete!"
```

Usage:
```bash
chmod +x scripts/batch-process.sh
./scripts/batch-process.sh solgier ~/videos/solgier/
```

---

## Slug Naming Convention

### Rules

| Rule | Example |
|------|---------|
| Lowercase | `solgier` not `Solgier` |
| Kebab-case | `midnight-chase` not `midnight_chase` |
| No spaces | `hero-academy` not `hero academy` |
| URL-safe | No special characters |
| Unique | Each series has unique slug |

### Examples

| Series Title | Slug |
|--------------|------|
| Solgier | `solgier` |
| Midnight Chase | `midnight-chase` |
| Hero Academy Season 2 | `hero-academy-s2` |
| The Last Stand | `the-last-stand` |

---

## Troubleshooting

### FFmpeg Errors

**"Unknown encoder 'libx264'"**
```bash
brew reinstall ffmpeg
```

**"Audio stream not found"**
```bash
# Add silent audio track
ffmpeg -i input.mp4 -f lavfi -i anullsrc -shortest output.mp4
```

### Upload Errors

**"Bucket not found"**
```bash
npx wrangler r2 bucket create webtoon-hls
```

**"Access denied"**
```bash
wrangler logout && wrangler login
```

### Playback Issues

**"Video not loading"**
1. Check R2 public access is enabled
2. Verify manifest URL in browser
3. Check CORS if using custom domain

**"Wrong quality"**
- All quality folders must exist (360p, 480p, 720p)
- Verify all segments uploaded

---

## Cleanup

```bash
# Remove local transcoded files after upload
rm -rf ./output/solgier/ep_01/

# Or remove entire series
rm -rf ./output/solgier/

# Clean all output
rm -rf ./output/
```

---

## Scripts Reference

| Script | Usage | Purpose |
|--------|-------|---------|
| `transcode.sh` | `./transcode.sh <video> <slug> <num>` | FFmpeg HLS encoding |
| `upload-to-r2.sh` | `./upload-to-r2.sh <slug> <num>` | Upload to R2 |
| `batch-process.sh` | `./batch-process.sh <slug> <dir>` | Bulk processing |
