#!/bin/bash
#
# HLS Transcoding Script for R2 Self-Hosted Video
#
# Creates multi-bitrate HLS streams from source video with automatic
# orientation detection (portrait/landscape) and smart quality selection.
# Never upscales beyond source resolution.
#
# Optimized for fast initial playback with 2-second segments and aligned GOPs
# Also generates a poster image for instant display while HLS loads
# Output structure matches R2 bucket organization for direct upload
#
# Usage: ./transcode.sh <input_video> <series_slug> <episode_number>
# Example: ./transcode.sh input.mp4 solgier 1
#
# Output structure:
#   ./output/{series_slug}/ep_{padded_number}/
#   ├── manifest.m3u8
#   ├── poster.jpg          <-- Poster image for instant display
#   ├── 360p/playlist.m3u8, seg_*.ts
#   ├── 480p/playlist.m3u8, seg_*.ts
#   ├── 720p/playlist.m3u8, seg_*.ts  (if source >= 720p)
#   └── 1080p/playlist.m3u8, seg_*.ts (if source >= 1080p)
#
# Requirements:
# - FFmpeg with libx264 and AAC support
# - Sufficient disk space for output (~2-3x input size for all qualities)
#
# After transcoding, upload to R2:
#   ./scripts/upload-to-r2.sh solgier 1

set -e

INPUT=$1
SERIES_SLUG=$2
EPISODE_NUM=$3

if [ -z "$INPUT" ] || [ -z "$SERIES_SLUG" ] || [ -z "$EPISODE_NUM" ]; then
    echo "Usage: $0 <input_video> <series_slug> <episode_number>"
    echo "Example: $0 input.mp4 solgier 1"
    echo ""
    echo "This will create: ./output/{series_slug}/ep_{padded_number}/"
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

# Determine orientation: portrait if height > width
if [ "$SRC_HEIGHT" -gt "$SRC_WIDTH" ]; then
    ORIENTATION="portrait"
    # For portrait, the "short side" is width
    SHORT_SIDE=$SRC_WIDTH
else
    ORIENTATION="landscape"
    # For landscape, the "short side" is height
    SHORT_SIDE=$SRC_HEIGHT
fi

echo "Source video analysis:"
echo "  Resolution: ${SRC_WIDTH}x${SRC_HEIGHT}"
echo "  Orientation: $ORIENTATION"
echo "  Short side: ${SHORT_SIDE}p"
echo ""

echo "Creating output directories..."
echo "  Series: $SERIES_SLUG"
echo "  Episode: $EPISODE_NUM (padded: $PADDED_EP)"
echo "  Output: $OUTPUT_DIR"
echo ""

# Create directories for qualities we'll generate
mkdir -p "$OUTPUT_DIR/360p" "$OUTPUT_DIR/480p"
[ "$SHORT_SIDE" -ge 720 ] && mkdir -p "$OUTPUT_DIR/720p"
[ "$SHORT_SIDE" -ge 1080 ] && mkdir -p "$OUTPUT_DIR/1080p"

# Generate poster image FIRST (fast, shows while HLS loads)
# Uses thumbnail filter to pick the most visually interesting frame from first 300 frames
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

# Determine which qualities to generate (never upscale beyond source)
QUALITIES="360p 480p"
[ "$SHORT_SIDE" -ge 720 ] && QUALITIES="$QUALITIES 720p"
[ "$SHORT_SIDE" -ge 1080 ] && QUALITIES="$QUALITIES 1080p"

echo "Transcoding $INPUT to HLS ($QUALITIES)..."
echo "This may take a while depending on video length..."
echo ""

# Multi-bitrate HLS transcoding with optimizations for fast initial load:
# - 2 second segments (faster initial playback, better ABR switching)
# - GOP size matching segment duration (keyframe every 2 seconds)
# - Closed GOP for HLS compliance (each segment independently decodable)
# - Disabled scene detection to maintain consistent keyframe intervals
# - Constant Rate Factor (CRF) for quality-based encoding
# - AAC audio at appropriate bitrates per quality level
#
# Video encoding flags explained:
#   -g 60              = GOP size of 60 frames (2 seconds at 30fps)
#   -keyint_min 60     = Minimum keyframe interval (prevents early keyframes)
#   -sc_threshold 0    = Disable scene change detection keyframes
#   -flags +cgop       = Closed GOP (required for proper HLS segment seeking)
#   -hls_time 2        = Target segment duration (matches GOP)
#   -hls_playlist_type vod = VOD playlist (adds #EXT-X-ENDLIST)

# Common video encoding flags for HLS optimization
HLS_VIDEO_FLAGS="-g 60 -keyint_min 60 -sc_threshold 0 -flags +cgop"
HLS_SEGMENT_FLAGS="-hls_time 2 -hls_list_size 0 -hls_playlist_type vod"

# Define resolutions based on orientation
# Portrait: width is the short side (e.g., 720x1280)
# Landscape: height is the short side (e.g., 1280x720)
if [ "$ORIENTATION" = "portrait" ]; then
    # Portrait dimensions (width x height)
    RES_360="360x640"
    RES_480="480x854"
    RES_720="720x1280"
    RES_1080="1080x1920"
    SCALE_360="scale=360:640"
    SCALE_480="scale=480:854"
    SCALE_720="scale=720:1280"
    SCALE_1080="scale=1080:1920"
else
    # Landscape dimensions (width x height)
    RES_360="640x360"
    RES_480="854x480"
    RES_720="1280x720"
    RES_1080="1920x1080"
    SCALE_360="scale=640:360"
    SCALE_480="scale=854:480"
    SCALE_720="scale=1280:720"
    SCALE_1080="scale=1920:1080"
fi

# Build ffmpeg command dynamically based on available qualities
# This avoids upscaling and handles both portrait and landscape videos

if [ "$SHORT_SIDE" -ge 1080 ]; then
    # 4 qualities: 360p, 480p, 720p, 1080p
    ffmpeg -i "$INPUT" \
      -filter_complex "[0:v]split=4[v1][v2][v3][v4]; \
        [v1]${SCALE_360}[v360]; \
        [v2]${SCALE_480}[v480]; \
        [v3]${SCALE_720}[v720]; \
        [v4]${SCALE_1080}[v1080]" \
      -map "[v360]" -map 0:a -c:v libx264 -crf 23 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 96k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/360p/seg_%03d.ts" \
        "$OUTPUT_DIR/360p/playlist.m3u8" \
      -map "[v480]" -map 0:a -c:v libx264 -crf 22 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 128k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/480p/seg_%03d.ts" \
        "$OUTPUT_DIR/480p/playlist.m3u8" \
      -map "[v720]" -map 0:a -c:v libx264 -crf 21 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 192k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/720p/seg_%03d.ts" \
        "$OUTPUT_DIR/720p/playlist.m3u8" \
      -map "[v1080]" -map 0:a -c:v libx264 -crf 20 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 256k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/1080p/seg_%03d.ts" \
        "$OUTPUT_DIR/1080p/playlist.m3u8"
elif [ "$SHORT_SIDE" -ge 720 ]; then
    # 3 qualities: 360p, 480p, 720p (source is 720p, don't upscale to 1080p)
    ffmpeg -i "$INPUT" \
      -filter_complex "[0:v]split=3[v1][v2][v3]; \
        [v1]${SCALE_360}[v360]; \
        [v2]${SCALE_480}[v480]; \
        [v3]${SCALE_720}[v720]" \
      -map "[v360]" -map 0:a -c:v libx264 -crf 23 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 96k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/360p/seg_%03d.ts" \
        "$OUTPUT_DIR/360p/playlist.m3u8" \
      -map "[v480]" -map 0:a -c:v libx264 -crf 22 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 128k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/480p/seg_%03d.ts" \
        "$OUTPUT_DIR/480p/playlist.m3u8" \
      -map "[v720]" -map 0:a -c:v libx264 -crf 21 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 192k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/720p/seg_%03d.ts" \
        "$OUTPUT_DIR/720p/playlist.m3u8"
else
    # 2 qualities: 360p, 480p (source is less than 720p)
    ffmpeg -i "$INPUT" \
      -filter_complex "[0:v]split=2[v1][v2]; \
        [v1]${SCALE_360}[v360]; \
        [v2]${SCALE_480}[v480]" \
      -map "[v360]" -map 0:a -c:v libx264 -crf 23 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 96k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/360p/seg_%03d.ts" \
        "$OUTPUT_DIR/360p/playlist.m3u8" \
      -map "[v480]" -map 0:a -c:v libx264 -crf 22 -preset medium $HLS_VIDEO_FLAGS -c:a aac -b:a 128k \
        $HLS_SEGMENT_FLAGS -hls_segment_filename "$OUTPUT_DIR/480p/seg_%03d.ts" \
        "$OUTPUT_DIR/480p/playlist.m3u8"
fi

echo "Creating master manifest..."

# Build manifest dynamically based on orientation and available qualities
cat > "$OUTPUT_DIR/manifest.m3u8" << EOF
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=${RES_360}
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=${RES_480}
480p/playlist.m3u8
EOF

if [ "$SHORT_SIDE" -ge 720 ]; then
    cat >> "$OUTPUT_DIR/manifest.m3u8" << EOF
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=${RES_720}
720p/playlist.m3u8
EOF
fi

if [ "$SHORT_SIDE" -ge 1080 ]; then
    cat >> "$OUTPUT_DIR/manifest.m3u8" << EOF
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=${RES_1080}
1080p/playlist.m3u8
EOF
fi

echo ""
echo "Transcoding complete!"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "R2 path will be: ${SERIES_SLUG}/ep_${PADDED_EP}/"
echo ""
echo "Files created:"
du -sh "$OUTPUT_DIR"/*
echo ""
echo "Poster URL will be:"
echo "  https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev/${SERIES_SLUG}/ep_${PADDED_EP}/poster.jpg"
echo ""
echo "To upload to R2, run:"
echo "  ./scripts/upload-to-r2.sh $SERIES_SLUG $EPISODE_NUM"
