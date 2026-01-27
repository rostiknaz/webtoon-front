#!/bin/bash
#
# MP4 Preparation Script for R2 Self-Hosted Video
#
# Creates an optimized MP4 with faststart for instant playback.
# Uses high-quality CRF encoding to minimize quality loss.
# No re-encoding if source is already well-optimized (optional).
#
# The faststart flag moves the moov atom to the beginning of the file,
# enabling instant playback without downloading the entire file first.
#
# Usage: ./prepare-mp4.sh <input_video> <series_slug> <episode_number>
# Example: ./prepare-mp4.sh input.mp4 solgier 1
#
# Output structure:
#   ./output/{series_slug}/ep_{padded_number}/
#   ├── video.mp4           <-- Optimized MP4 with faststart
#   └── poster.jpg          <-- Poster image for instant display
#
# Requirements:
# - FFmpeg with libx264 and AAC support
#
# After preparation, upload to R2:
#   ./scripts/upload-to-r2.sh solgier 1

set -e

INPUT=$1
SERIES_SLUG=$2
EPISODE_NUM=$3
# Optional: pass "copy" to copy streams without re-encoding (if source is already optimized)
MODE=${4:-"encode"}

if [ -z "$INPUT" ] || [ -z "$SERIES_SLUG" ] || [ -z "$EPISODE_NUM" ]; then
    echo "Usage: $0 <input_video> <series_slug> <episode_number> [copy|encode]"
    echo "Example: $0 input.mp4 solgier 1"
    echo "         $0 input.mp4 solgier 1 copy  # Skip re-encoding if source is already optimized"
    echo ""
    echo "This will create: ./output/{series_slug}/ep_{padded_number}/video.mp4"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "Error: Input file '$INPUT' not found"
    exit 1
fi

# Pad episode number to 2 digits (01, 02, ... 99)
PADDED_EP=$(printf "%02d" "$EPISODE_NUM")
OUTPUT_DIR="./output/${SERIES_SLUG}/ep_${PADDED_EP}"

# Detect source video dimensions
SRC_WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$INPUT")
SRC_HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$INPUT")

# Get source bitrate for comparison
SRC_BITRATE=$(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 "$INPUT" 2>/dev/null || echo "unknown")

# Determine orientation
if [ "$SRC_HEIGHT" -gt "$SRC_WIDTH" ]; then
    ORIENTATION="portrait"
else
    ORIENTATION="landscape"
fi

echo "Source video analysis:"
echo "  Resolution: ${SRC_WIDTH}x${SRC_HEIGHT}"
echo "  Orientation: $ORIENTATION"
echo "  Bitrate: ${SRC_BITRATE}"
echo "  Mode: $MODE"
echo ""

echo "Creating output directory..."
echo "  Series: $SERIES_SLUG"
echo "  Episode: $EPISODE_NUM (padded: $PADDED_EP)"
echo "  Output: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# Generate poster image FIRST (fast, shows while video loads)
echo "Generating poster image..."
ffmpeg -i "$INPUT" \
  -vf "thumbnail=300" \
  -frames:v 1 \
  -q:v 2 \
  -y \
  "$OUTPUT_DIR/poster.jpg" 2>/dev/null

if [ -f "$OUTPUT_DIR/poster.jpg" ]; then
    POSTER_SIZE=$(du -h "$OUTPUT_DIR/poster.jpg" | cut -f1)
    echo "  poster.jpg created ($POSTER_SIZE)"
else
    echo "  Warning: Failed to generate poster.jpg"
fi
echo ""

echo "Preparing MP4 with faststart..."

if [ "$MODE" = "copy" ]; then
    # Stream copy mode - no re-encoding, just add faststart
    # Use this if source is already H.264 with good quality
    echo "  Using stream copy (no re-encoding)..."
    ffmpeg -i "$INPUT" \
      -c copy \
      -movflags +faststart \
      -y \
      "$OUTPUT_DIR/video.mp4"
else
    # Encode mode - re-encode with high quality CRF
    # CRF 18 is visually lossless for most content
    # Using CRF 18 instead of HLS's CRF 20-23 for maximum quality
    echo "  Re-encoding with CRF 18 (high quality)..."
    ffmpeg -i "$INPUT" \
      -c:v libx264 \
      -crf 18 \
      -preset medium \
      -c:a aac \
      -b:a 192k \
      -movflags +faststart \
      -y \
      "$OUTPUT_DIR/video.mp4"
fi

echo ""
echo "Preparation complete!"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "R2 path will be: ${SERIES_SLUG}/ep_${PADDED_EP}/"
echo ""
echo "Files created:"
du -sh "$OUTPUT_DIR"/*
echo ""

# Show video info
VIDEO_SIZE=$(du -h "$OUTPUT_DIR/video.mp4" | cut -f1)
OUTPUT_BITRATE=$(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 "$OUTPUT_DIR/video.mp4" 2>/dev/null || echo "unknown")

echo "Video details:"
echo "  File size: $VIDEO_SIZE"
echo "  Bitrate: $OUTPUT_BITRATE"
echo ""
echo "Video URL will be:"
echo "  https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/${SERIES_SLUG}/ep_${PADDED_EP}/video.mp4"
echo ""
echo "Poster URL will be:"
echo "  https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/${SERIES_SLUG}/ep_${PADDED_EP}/poster.jpg"
echo ""
echo "To upload to R2, run:"
echo "  ./scripts/upload-to-r2.sh $SERIES_SLUG $EPISODE_NUM"
