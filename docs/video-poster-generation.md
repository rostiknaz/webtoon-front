# Video Poster & Thumbnail Generation

This document covers how to generate poster images and thumbnails for HLS video episodes to prevent black screens during loading.

## Overview

When a video player initializes, there's a delay while:
1. HLS manifest (`.m3u8`) downloads
2. First segment downloads
3. Video decoder initializes

Without a poster image, users see a black screen during this delay. Poster images solve this by displaying immediately while HLS loads.

## File Structure

```
R2 Bucket Structure:
/{seriesSlug}/
  ep_01/
    manifest.m3u8      # HLS master playlist
    720p/
      playlist.m3u8    # 720p variant playlist
      segment_000.ts   # Video segments
      segment_001.ts
      ...
    480p/
      playlist.m3u8    # 480p variant playlist
      ...
    360p/
      playlist.m3u8    # 360p variant playlist
      ...
    poster.jpg         # <-- Poster image (1080x1920 for 9:16, ~100-200KB)
  ep_02/
    ...
```

## Generating Poster Images

### Option 1: First Frame (Fastest)

Extracts the very first frame of the video:

```bash
ffmpeg -i input.mp4 -frames:v 1 -q:v 2 poster.jpg
```

**Pros:** Fastest, deterministic
**Cons:** First frame might be black or uninteresting

### Option 2: Thumbnail Filter (Recommended)

Uses FFmpeg's thumbnail filter to select the most "interesting" frame from the first N frames:

```bash
# Analyze first 300 frames, pick the most representative
ffmpeg -i input.mp4 -vf "thumbnail=300" -frames:v 1 -q:v 2 poster.jpg
```

**Pros:** Picks a visually interesting frame automatically
**Cons:** Slightly slower (needs to analyze multiple frames)

### Option 3: Specific Timestamp

Extract a frame at a specific time (e.g., 2 seconds in):

```bash
ffmpeg -i input.mp4 -ss 00:00:02 -frames:v 1 -q:v 2 poster.jpg
```

**Pros:** Predictable, skips intro/black frames
**Cons:** Manual timing selection required

### Option 4: I-Frame Extraction

Extract the first keyframe (I-frame), which is typically the highest quality:

```bash
ffmpeg -i input.mp4 -vf "select='eq(pict_type,I)'" -frames:v 1 -q:v 2 poster.jpg
```

**Pros:** Highest quality frame (keyframes are self-contained)
**Cons:** May not be the most visually interesting

## Quality Settings

The `-q:v` flag controls JPEG quality:
- `2` = Highest quality (~150-300KB for 1080x1920)
- `5` = High quality (~80-150KB)
- `10` = Medium quality (~40-80KB)
- `31` = Lowest quality

**Recommendation:** Use `-q:v 2` or `-q:v 5` for posters. File size is minimal compared to video segments.

## Batch Processing Script

Create a script to generate posters for all episodes:

```bash
#!/bin/bash
# generate-posters.sh
# Usage: ./generate-posters.sh /path/to/source/videos /path/to/output

SOURCE_DIR="$1"
OUTPUT_DIR="$2"

for video in "$SOURCE_DIR"/*.mp4; do
  filename=$(basename "$video" .mp4)

  # Extract padded episode number (assumes format: ep_01.mp4, ep_02.mp4, etc.)
  ep_num=$(echo "$filename" | grep -oE '[0-9]+')
  padded_ep=$(printf "ep_%02d" "$ep_num")

  output_path="$OUTPUT_DIR/$padded_ep/poster.jpg"

  echo "Generating poster for $filename -> $output_path"

  # Use thumbnail filter for best frame selection
  ffmpeg -i "$video" \
    -vf "thumbnail=300" \
    -frames:v 1 \
    -q:v 2 \
    "$output_path"
done

echo "Done! Generated posters for all episodes."
```

## Complete Transcoding Script with Poster

Add poster generation to your HLS transcoding workflow:

```bash
#!/bin/bash
# transcode-episode.sh
# Generates HLS streams AND poster in one pass

INPUT="$1"
OUTPUT_DIR="$2"
SERIES_SLUG="$3"
EP_NUMBER="$4"

PADDED_EP=$(printf "ep_%02d" "$EP_NUMBER")
EPISODE_DIR="$OUTPUT_DIR/$SERIES_SLUG/$PADDED_EP"

mkdir -p "$EPISODE_DIR"/{720p,480p,360p}

# 1. Generate poster FIRST (shows while video loads)
echo "Generating poster..."
ffmpeg -i "$INPUT" \
  -vf "thumbnail=300" \
  -frames:v 1 \
  -q:v 2 \
  "$EPISODE_DIR/poster.jpg"

# 2. Generate HLS streams
echo "Transcoding to HLS..."
ffmpeg -i "$INPUT" \
  -filter_complex "[0:v]split=3[v720][v480][v360]; \
    [v720]scale=720:-2[v720out]; \
    [v480]scale=480:-2[v480out]; \
    [v360]scale=360:-2[v360out]" \
  -map "[v720out]" -map 0:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k \
    -hls_time 6 -hls_playlist_type vod -hls_segment_filename "$EPISODE_DIR/720p/segment_%03d.ts" \
    "$EPISODE_DIR/720p/playlist.m3u8" \
  -map "[v480out]" -map 0:a -c:v libx264 -preset fast -crf 25 -c:a aac -b:a 96k \
    -hls_time 6 -hls_playlist_type vod -hls_segment_filename "$EPISODE_DIR/480p/segment_%03d.ts" \
    "$EPISODE_DIR/480p/playlist.m3u8" \
  -map "[v360out]" -map 0:a -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 64k \
    -hls_time 6 -hls_playlist_type vod -hls_segment_filename "$EPISODE_DIR/360p/segment_%03d.ts" \
    "$EPISODE_DIR/360p/playlist.m3u8"

# 3. Create master playlist
cat > "$EPISODE_DIR/manifest.m3u8" << EOF
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=720x1280
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=480x854
480p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=360x640
360p/playlist.m3u8
EOF

echo "Done! Episode ready at: $EPISODE_DIR"
```

## I-Frame Playlists (Advanced)

I-Frame playlists enable instant seeking previews on iOS. FFmpeg can generate these automatically:

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset fast \
  -hls_time 6 -hls_playlist_type vod \
  -hls_flags single_file+iframe_index \
  -f hls manifest.m3u8
```

This generates:
- `manifest.m3u8` - Main playlist
- `iframe.m3u8` - I-frame only playlist (for scrubbing)

**Note:** iOS uses `iframe.m3u8` for thumbnail previews when seeking. Not required but improves UX.

## Uploading to R2

After generating posters, upload to your R2 bucket:

```bash
# Using wrangler
npx wrangler r2 object put webtoon-videos/series-slug/ep_01/poster.jpg \
  --file ./output/series-slug/ep_01/poster.jpg \
  --content-type image/jpeg

# Or using rclone for batch uploads
rclone copy ./output/ r2:webtoon-videos/ --include "*/poster.jpg"
```

## Implementation in Code

The poster URL is generated following the same convention as HLS URLs:

```typescript
// HybridVideoPlayer.tsx
const getPosterUrl = useCallback((ep: Episode) => {
  const paddedEp = ep.episodeNumber.toString().padStart(2, '0');
  return `${R2_CDN_URL}/${seriesSlug}/ep_${paddedEp}/poster.jpg`;
}, [seriesSlug]);
```

The poster is passed to xgplayer configuration:

```typescript
// VideoPlayerCacheContext.tsx
function createPlayerConfig(container, hlsUrl, posterUrl?) {
  return {
    ...STATIC_PLAYER_CONFIG,
    el: container,
    url: hlsUrl,
    poster: posterUrl,  // Shows immediately while HLS loads
    ...
  };
}
```

## Poster Specifications

| Property | Recommendation |
|----------|---------------|
| Format | JPEG (smaller than PNG for photos) |
| Resolution | Match video resolution (e.g., 1080x1920 for 9:16) |
| Quality | `-q:v 2` to `-q:v 5` |
| File size | 100-200KB typical |
| Filename | `poster.jpg` (consistent naming) |

## Troubleshooting

### Black screen still appears briefly

1. **Check poster URL is correct** - Open in browser to verify
2. **Check CSS** - Ensure `.xgplayer-poster` is not hidden
3. **Network timing** - Poster should load faster than HLS manifest

### Poster doesn't match video content

Use the thumbnail filter with more frames:
```bash
ffmpeg -i input.mp4 -vf "thumbnail=500" -frames:v 1 -q:v 2 poster.jpg
```

### Poster is too large

Reduce quality or resize:
```bash
ffmpeg -i input.mp4 -vf "thumbnail=300,scale=720:-1" -frames:v 1 -q:v 5 poster.jpg
```

## Related Documentation

- [R2 Video Streaming](./r2-video-streaming.md) - HLS architecture and R2 setup
- [Video Transcoding Workflow](./video-transcoding-workflow.md) - Full transcoding pipeline
