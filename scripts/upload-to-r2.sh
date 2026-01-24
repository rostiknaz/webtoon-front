#!/bin/bash
#
# R2 Upload Script for HLS Video Content
#
# Uploads transcoded HLS content to Cloudflare R2 bucket
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
# - Video must be transcoded first with transcode.sh

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
    echo "Run transcode.sh first: ./scripts/transcode.sh <input.mp4> $SERIES_SLUG $EPISODE_NUM"
    exit 1
fi

echo "Uploading HLS content to R2..."
echo "  Series: $SERIES_SLUG"
echo "  Episode: $EPISODE_NUM (padded: $PADDED_EP)"
echo "  Source: $LOCAL_PATH"
echo "  Destination: $BUCKET_NAME/$R2_PATH/"
echo ""

# Upload master manifest
echo "Uploading master manifest..."
npx wrangler r2 object put "$BUCKET_NAME/$R2_PATH/manifest.m3u8" \
    --file="$LOCAL_PATH/manifest.m3u8" \
    --content-type="application/vnd.apple.mpegurl" \
    --remote

# Upload each quality level
for QUALITY in 360p 480p 720p; do
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
echo "Upload complete!"
echo ""
echo "R2 path: $R2_PATH"
echo "Full URL: https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/$R2_PATH/manifest.m3u8"
echo ""
echo "Frontend will generate this URL from:"
echo "  Series slug: $SERIES_SLUG"
echo "  Episode number: $EPISODE_NUM"
