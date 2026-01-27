#!/bin/bash
#
# R2 Upload Script for Video Content (HLS and MP4)
#
# Uploads video content to Cloudflare R2 bucket
# Automatically detects and uploads:
# - MP4: video.mp4 + poster.jpg (from prepare-mp4.sh)
# - HLS: manifest.m3u8 + quality folders + poster.jpg (from transcode.sh)
#
# Usage: ./upload-to-r2.sh <series_slug> <episode_number>
# Example: ./upload-to-r2.sh solgier 1
#
# The script uploads all files from ./output/{series_slug}/ep_{number}/ to:
#   webtoon-hls/{series_slug}/ep_{number}/
#
# Requirements:
# - Wrangler CLI configured with Cloudflare credentials
# - R2 bucket 'webtoon-hls' must exist
# - Video must be prepared first with transcode.sh (HLS) or prepare-mp4.sh (MP4)

set -e

SERIES_SLUG=$1
EPISODE_NUM=$2
BUCKET_NAME="webtoon-hls"

if [ -z "$SERIES_SLUG" ] || [ -z "$EPISODE_NUM" ]; then
    echo "Usage: $0 <series_slug> <episode_number>"
    echo "Example: $0 solgier 1"
    exit 1
fi

# Pad episode number to 2 digits
PADDED_EP=$(printf "%02d" "$EPISODE_NUM")
LOCAL_PATH="./output/${SERIES_SLUG}/ep_${PADDED_EP}"
R2_PATH="${SERIES_SLUG}/ep_${PADDED_EP}"

if [ ! -d "$LOCAL_PATH" ]; then
    echo "Error: Directory '$LOCAL_PATH' not found"
    echo "Run one of:"
    echo "  ./scripts/prepare-mp4.sh <input.mp4> $SERIES_SLUG $EPISODE_NUM  (for MP4)"
    echo "  ./scripts/transcode.sh <input.mp4> $SERIES_SLUG $EPISODE_NUM    (for HLS)"
    exit 1
fi

# Detect content type based on what files exist
HAS_MP4=false
HAS_HLS=false
[ -f "$LOCAL_PATH/video.mp4" ] && HAS_MP4=true
[ -f "$LOCAL_PATH/manifest.m3u8" ] && HAS_HLS=true

if [ "$HAS_MP4" = false ] && [ "$HAS_HLS" = false ]; then
    echo "Error: No video.mp4 or manifest.m3u8 found in $LOCAL_PATH"
    echo "Run one of:"
    echo "  ./scripts/prepare-mp4.sh <input.mp4> $SERIES_SLUG $EPISODE_NUM  (for MP4)"
    echo "  ./scripts/transcode.sh <input.mp4> $SERIES_SLUG $EPISODE_NUM    (for HLS)"
    exit 1
fi

echo "Uploading video content to R2..."
echo "  Series: $SERIES_SLUG"
echo "  Episode: $EPISODE_NUM (padded: $PADDED_EP)"
echo "  Source: $LOCAL_PATH"
echo "  Destination: $BUCKET_NAME/$R2_PATH/"
echo "  Format: $([ "$HAS_MP4" = true ] && echo "MP4")$([ "$HAS_HLS" = true ] && echo " HLS")"
echo ""

# Upload poster image (shows immediately while video loads)
if [ -f "$LOCAL_PATH/poster.jpg" ]; then
    echo "Uploading poster image..."
    npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/poster.jpg" \
        --file="$LOCAL_PATH/poster.jpg" \
        --content-type="image/jpeg" \
        --remote
    echo "  poster.jpg uploaded"
else
    echo "Warning: No poster.jpg found."
fi
echo ""

# Upload MP4 if present
if [ "$HAS_MP4" = true ]; then
    echo "Uploading MP4 video..."
    npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/video.mp4" \
        --file="$LOCAL_PATH/video.mp4" \
        --content-type="video/mp4" \
        --remote
    echo "  video.mp4 uploaded"
    echo ""
fi

# Upload HLS content if present
if [ "$HAS_HLS" = true ]; then
    # Upload master manifest
    echo "Uploading HLS master manifest..."
    npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/manifest.m3u8" \
        --file="$LOCAL_PATH/manifest.m3u8" \
        --content-type="application/vnd.apple.mpegurl" \
        --remote

    # Upload each quality level
    for QUALITY in 360p 480p 720p 1080p; do
        if [ -d "$LOCAL_PATH/$QUALITY" ]; then
            echo ""
            echo "Uploading $QUALITY quality..."

            # Upload playlist
            npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/$QUALITY/playlist.m3u8" \
                --file="$LOCAL_PATH/$QUALITY/playlist.m3u8" \
                --content-type="application/vnd.apple.mpegurl" \
                --remote

            # Upload segments
            for SEGMENT in "$LOCAL_PATH/$QUALITY"/seg_*.ts; do
                if [ -f "$SEGMENT" ]; then
                    SEGMENT_NAME=$(basename "$SEGMENT")
                    npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/$QUALITY/$SEGMENT_NAME" \
                        --file="$SEGMENT" \
                        --content-type="video/mp2t" \
                        --remote
                fi
            done

            echo "  $QUALITY upload complete"
        fi
    done
    echo ""
fi

echo ""
echo "Upload complete!"
echo ""
echo "R2 path: $R2_PATH"
echo ""
echo "URLs:"
echo "  Poster:   https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/$R2_PATH/poster.jpg"
[ "$HAS_MP4" = true ] && echo "  MP4:      https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/$R2_PATH/video.mp4"
[ "$HAS_HLS" = true ] && echo "  HLS:      https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/$R2_PATH/manifest.m3u8"
echo ""
echo "Frontend configuration:"
echo "  To use MP4: set VITE_VIDEO_FORMAT=mp4 (default)"
echo "  To use HLS: set VITE_VIDEO_FORMAT=hls"
echo ""
echo "Frontend will generate these URLs from:"
echo "  Series slug: $SERIES_SLUG"
echo "  Episode number: $EPISODE_NUM"
