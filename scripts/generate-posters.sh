#!/bin/bash
#
# Poster Generation Script for R2 Self-Hosted Video
#
# Generates poster images from source videos or existing transcoded output.
# Automatically applies SAR (Sample Aspect Ratio) correction to ensure
# poster dimensions match the video's display dimensions (important for
# vertical videos stored with non-square pixels).
#
# Useful for:
# - Adding posters to episodes that were transcoded before poster support
# - Batch regenerating posters with different settings
# - Generating posters from source videos without full transcoding
#
# Usage:
#   From source video:
#     ./generate-posters.sh --source <input_video> <series_slug> <episode_number>
#
#   From existing output (extracts from 720p HLS):
#     ./generate-posters.sh --output <series_slug> <episode_number>
#
#   Batch all episodes for a series (from output folder):
#     ./generate-posters.sh --batch <series_slug>
#
# Examples:
#   ./generate-posters.sh --source ~/videos/ep1.mp4 solgier 1
#   ./generate-posters.sh --output solgier 1
#   ./generate-posters.sh --batch solgier
#
# Options:
#   --method <first|thumbnail|timestamp>
#     first     - Use first frame (fastest)
#     thumbnail - Use FFmpeg thumbnail filter (default, picks interesting frame)
#     timestamp - Use frame at 2 seconds
#
#   --quality <1-31>
#     JPEG quality (2=best, 31=worst, default: 2)

set -e

# Default settings
METHOD="thumbnail"
QUALITY=2
OUTPUT_BASE="./output"

# Parse options
while [[ "$1" =~ ^-- ]]; do
    case "$1" in
        --method)
            METHOD="$2"
            shift 2
            ;;
        --quality)
            QUALITY="$2"
            shift 2
            ;;
        --source)
            MODE="source"
            shift
            ;;
        --output)
            MODE="output"
            shift
            ;;
        --batch)
            MODE="batch"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build FFmpeg filter based on method
get_filter() {
    case "$METHOD" in
        first)
            echo ""
            ;;
        thumbnail)
            echo "-vf thumbnail=300"
            ;;
        timestamp)
            echo "-ss 00:00:02"
            ;;
        *)
            echo "Unknown method: $METHOD" >&2
            exit 1
            ;;
    esac
}

# SAR correction filter - applies Sample Aspect Ratio to get correct display dimensions
# This handles videos where stored pixels differ from display dimensions (e.g., vertical videos stored horizontally)
SAR_FILTER="scale=iw*sar:ih,setsar=1"

# Generate poster from a video file
generate_poster() {
    local INPUT="$1"
    local OUTPUT_PATH="$2"

    echo "  Generating poster..."
    echo "    Input: $INPUT"
    echo "    Output: $OUTPUT_PATH"
    echo "    Method: $METHOD"

    # Build ffmpeg command with SAR correction
    # The SAR filter ensures poster dimensions match video display dimensions
    if [ "$METHOD" = "timestamp" ]; then
        ffmpeg -ss 00:00:02 -i "$INPUT" \
            -vf "$SAR_FILTER" \
            -frames:v 1 \
            -q:v "$QUALITY" \
            -y \
            "$OUTPUT_PATH" 2>/dev/null
    elif [ "$METHOD" = "thumbnail" ]; then
        ffmpeg -i "$INPUT" \
            -vf "thumbnail=300,$SAR_FILTER" \
            -frames:v 1 \
            -q:v "$QUALITY" \
            -y \
            "$OUTPUT_PATH" 2>/dev/null
    else
        # first frame with SAR correction
        ffmpeg -i "$INPUT" \
            -vf "$SAR_FILTER" \
            -frames:v 1 \
            -q:v "$QUALITY" \
            -y \
            "$OUTPUT_PATH" 2>/dev/null
    fi

    if [ -f "$OUTPUT_PATH" ]; then
        local SIZE=$(du -h "$OUTPUT_PATH" | cut -f1)
        # Get dimensions
        local DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUTPUT_PATH" 2>/dev/null)
        echo "    Created: poster.jpg ($SIZE) - ${DIMS//,/x}"
        return 0
    else
        echo "    ERROR: Failed to generate poster"
        return 1
    fi
}

# MODE: source - generate from source video file
if [ "$MODE" = "source" ]; then
    INPUT="$1"
    SERIES_SLUG="$2"
    EPISODE_NUM="$3"

    if [ -z "$INPUT" ] || [ -z "$SERIES_SLUG" ] || [ -z "$EPISODE_NUM" ]; then
        echo "Usage: $0 --source <input_video> <series_slug> <episode_number>"
        echo "Example: $0 --source ~/videos/ep1.mp4 solgier 1"
        exit 1
    fi

    if [ ! -f "$INPUT" ]; then
        echo "Error: Input file '$INPUT' not found"
        exit 1
    fi

    PADDED_EP=$(printf "%02d" "$EPISODE_NUM")
    OUTPUT_DIR="$OUTPUT_BASE/${SERIES_SLUG}/ep_${PADDED_EP}"

    mkdir -p "$OUTPUT_DIR"

    echo "Generating poster for $SERIES_SLUG ep_$PADDED_EP"
    generate_poster "$INPUT" "$OUTPUT_DIR/poster.jpg"

    echo ""
    echo "To upload poster to R2:"
    echo "  npx wrangler r2 object put webtoon-hls/${SERIES_SLUG}/ep_${PADDED_EP}/poster.jpg \\"
    echo "    --file=$OUTPUT_DIR/poster.jpg --content-type=image/jpeg --remote"

# MODE: output - generate from existing transcoded HLS
elif [ "$MODE" = "output" ]; then
    SERIES_SLUG="$1"
    EPISODE_NUM="$2"

    if [ -z "$SERIES_SLUG" ] || [ -z "$EPISODE_NUM" ]; then
        echo "Usage: $0 --output <series_slug> <episode_number>"
        echo "Example: $0 --output solgier 1"
        exit 1
    fi

    PADDED_EP=$(printf "%02d" "$EPISODE_NUM")
    OUTPUT_DIR="$OUTPUT_BASE/${SERIES_SLUG}/ep_${PADDED_EP}"

    # Find best quality HLS segment to extract from
    INPUT=""
    for quality in 720p 480p 360p; do
        FIRST_SEG="$OUTPUT_DIR/$quality/seg_000.ts"
        if [ -f "$FIRST_SEG" ]; then
            INPUT="$FIRST_SEG"
            echo "Using $quality segment for poster extraction"
            break
        fi
    done

    if [ -z "$INPUT" ]; then
        echo "Error: No HLS segments found in $OUTPUT_DIR"
        echo "Run transcode.sh first or use --source mode with original video"
        exit 1
    fi

    echo "Generating poster for $SERIES_SLUG ep_$PADDED_EP"
    # For HLS segments, use first frame (thumbnail filter needs more frames)
    METHOD="first"
    generate_poster "$INPUT" "$OUTPUT_DIR/poster.jpg"

    echo ""
    echo "To upload poster to R2:"
    echo "  npx wrangler r2 object put webtoon-hls/${SERIES_SLUG}/ep_${PADDED_EP}/poster.jpg \\"
    echo "    --file=$OUTPUT_DIR/poster.jpg --content-type=image/jpeg --remote"

# MODE: batch - generate posters for all episodes in a series
elif [ "$MODE" = "batch" ]; then
    SERIES_SLUG="$1"

    if [ -z "$SERIES_SLUG" ]; then
        echo "Usage: $0 --batch <series_slug>"
        echo "Example: $0 --batch solgier"
        exit 1
    fi

    SERIES_DIR="$OUTPUT_BASE/$SERIES_SLUG"

    if [ ! -d "$SERIES_DIR" ]; then
        echo "Error: Series directory '$SERIES_DIR' not found"
        exit 1
    fi

    echo "Batch generating posters for series: $SERIES_SLUG"
    echo "=============================================="
    echo ""

    SUCCESS=0
    FAILED=0
    SKIPPED=0

    for EP_DIR in "$SERIES_DIR"/ep_*; do
        if [ ! -d "$EP_DIR" ]; then
            continue
        fi

        EP_NAME=$(basename "$EP_DIR")

        # Check if poster already exists
        if [ -f "$EP_DIR/poster.jpg" ]; then
            echo "[$EP_NAME] Skipping (poster.jpg already exists)"
            SKIPPED=$((SKIPPED + 1))
            continue
        fi

        # Find best quality segment
        INPUT=""
        for quality in 720p 480p 360p; do
            FIRST_SEG="$EP_DIR/$quality/seg_000.ts"
            if [ -f "$FIRST_SEG" ]; then
                INPUT="$FIRST_SEG"
                break
            fi
        done

        if [ -z "$INPUT" ]; then
            echo "[$EP_NAME] ERROR: No HLS segments found"
            FAILED=$((FAILED + 1))
            continue
        fi

        echo "[$EP_NAME] Generating poster from $quality..."

        # Use first frame for HLS segments with SAR correction
        ffmpeg -i "$INPUT" \
            -vf "$SAR_FILTER" \
            -frames:v 1 \
            -q:v "$QUALITY" \
            -y \
            "$EP_DIR/poster.jpg" 2>/dev/null

        if [ -f "$EP_DIR/poster.jpg" ]; then
            SIZE=$(du -h "$EP_DIR/poster.jpg" | cut -f1)
            DIMS=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$EP_DIR/poster.jpg" 2>/dev/null)
            echo "[$EP_NAME] Created poster.jpg ($SIZE) - ${DIMS//,/x}"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "[$EP_NAME] ERROR: Failed to generate poster"
            FAILED=$((FAILED + 1))
        fi
    done

    echo ""
    echo "=============================================="
    echo "Batch complete!"
    echo "  Success: $SUCCESS"
    echo "  Skipped: $SKIPPED (already had poster)"
    echo "  Failed:  $FAILED"
    echo ""

    if [ $SUCCESS -gt 0 ]; then
        echo "To upload all posters to R2, run:"
        echo "  for ep in $SERIES_DIR/ep_*/poster.jpg; do"
        echo "    EP_PATH=\$(dirname \$ep | sed 's|$OUTPUT_BASE/||')"
        echo "    npx wrangler r2 object put webtoon-hls/\$EP_PATH/poster.jpg \\"
        echo "      --file=\$ep --content-type=image/jpeg --remote"
        echo "  done"
    fi

else
    echo "Poster Generation Script"
    echo ""
    echo "Usage:"
    echo "  From source video:"
    echo "    $0 --source <input_video> <series_slug> <episode_number>"
    echo ""
    echo "  From existing HLS output:"
    echo "    $0 --output <series_slug> <episode_number>"
    echo ""
    echo "  Batch all episodes for a series:"
    echo "    $0 --batch <series_slug>"
    echo ""
    echo "Options:"
    echo "  --method <first|thumbnail|timestamp>  Extraction method (default: thumbnail)"
    echo "  --quality <1-31>                      JPEG quality (default: 2 = best)"
    echo ""
    echo "Examples:"
    echo "  $0 --source ~/videos/ep1.mp4 solgier 1"
    echo "  $0 --method first --source ~/videos/ep1.mp4 solgier 1"
    echo "  $0 --output solgier 1"
    echo "  $0 --batch solgier"
    exit 1
fi
