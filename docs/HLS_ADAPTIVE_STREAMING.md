# HLS Adaptive Bitrate Streaming Configuration

Complete guide for configuring adaptive bitrate streaming with HLS.js and xgplayer.

---

## Current Implementation (xgplayer)

Your VideoPlayer (`src/components/VideoPlayer.tsx`) currently uses:

```typescript
const player = new Player({
  url: hlsUrl,
  quality: 'auto',        // ✅ Adaptive bitrate enabled
  preload: 'metadata',    // ✅ Don't preload entire video
  autoplay: true,
});
```

---

## Enhanced xgplayer Configuration

### Option 1: Advanced xgplayer with HLS Plugin

```typescript
import Player from 'xgplayer';
import HlsJsPlugin from 'xgplayer-hls.js';

const player = new Player({
  el: containerRef.current,
  url: hlsUrl,

  // Use HLS.js plugin for better control
  plugins: [HlsJsPlugin],

  // Adaptive bitrate settings
  quality: 'auto',
  defaultQuality: 720,  // Start with 720p

  // Preload optimization
  preload: 'metadata',  // Options: 'none' | 'metadata' | 'auto'

  // HLS.js specific configuration
  hls: {
    // Debugging (disable in production)
    debug: false,

    // Loading optimization
    maxBufferLength: 30,        // Max buffer: 30 seconds
    maxMaxBufferLength: 600,    // Hard limit: 10 minutes

    // Adaptive bitrate behavior
    maxBufferSize: 60 * 1000 * 1000,  // 60 MB buffer
    maxBufferHole: 0.5,         // Allow 0.5s gaps

    // Quality switching
    enableWorker: true,         // Use web worker for better performance
    lowLatencyMode: false,      // Disable for better buffering

    // Bandwidth estimation
    abrBandWidthFactor: 0.95,   // Use 95% of estimated bandwidth
    abrBandWidthUpFactor: 0.7,  // Be conservative when switching up

    // Start level (quality)
    startLevel: -1,             // -1 = auto-detect based on bandwidth
    capLevelToPlayerSize: true, // Don't load higher quality than player size

    // Fragment loading
    maxLoadingDelay: 4,         // Max 4s to load a fragment
    maxFragLookUpTolerance: 0.25,

    // Error handling
    fragLoadingTimeOut: 20000,  // 20s timeout for fragment load
    manifestLoadingTimeOut: 10000, // 10s timeout for manifest

    // Streaming optimization
    liveSyncDurationCount: 3,   // For live streams
    liveMaxLatencyDurationCount: 10,
  },

  // Mobile optimizations
  mobile: {
    gestureX: true,
    gestureY: true,
  },

  // Performance
  videoInit: true,
  autoplay: true,
  playsinline: true,
});
```

---

## Option 2: Direct HLS.js Implementation

For maximum control, you can use HLS.js directly:

### Installation

```bash
npm install hls.js
```

### Full Configuration

```typescript
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

export function VideoPlayerHLS({ episode }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const hlsUrl = getHlsUrl();

    if (Hls.isSupported()) {
      // Create HLS instance with advanced config
      const hls = new Hls({
        // ===== ADAPTIVE BITRATE SETTINGS =====

        // Debug (disable in production)
        debug: false,
        enableWorker: true,  // Use web worker for parsing

        // ===== QUALITY LEVELS =====

        // Start level selection
        startLevel: -1,  // -1 = auto-detect based on bandwidth
        // Options:
        // -1: Auto (recommended)
        // 0: Lowest quality (480p or lower)
        // 1: Medium quality (720p)
        // 2: High quality (1080p)
        // 3+: Higher qualities if available

        // Limit quality based on player size
        capLevelToPlayerSize: true,  // Don't load 1080p for small player

        // ===== BANDWIDTH ESTIMATION =====

        abrEwmaDefaultEstimate: 500000,  // Initial estimate: 500 Kbps
        abrEwmaSlowVoD: 3,              // Slow moving average for VOD
        abrEwmaFastVoD: 3,              // Fast moving average for VOD
        abrEwmaSlowLive: 9,             // For live streams
        abrEwmaFastLive: 3,
        abrBandWidthFactor: 0.95,       // Use 95% of estimated bandwidth
        abrBandWidthUpFactor: 0.7,      // Conservative when upgrading quality

        // ===== BUFFERING =====

        // Buffer length settings
        maxBufferLength: 30,             // Target buffer: 30 seconds
        maxMaxBufferLength: 600,         // Max buffer: 10 minutes
        maxBufferSize: 60 * 1000 * 1000, // Max buffer size: 60 MB
        maxBufferHole: 0.5,              // Allow 0.5s gaps in buffer

        // Buffer stall detection
        highBufferWatchdogPeriod: 2,     // Check every 2 seconds
        nudgeOffset: 0.1,                // Nudge playhead by 0.1s if stalled
        nudgeMaxRetry: 3,                // Max nudge attempts

        // ===== PRELOADING =====

        // Don't preload entire video
        maxFragLookUpTolerance: 0.25,    // Look ahead 0.25s for next fragment
        liveSyncDuration: undefined,     // Don't sync to live edge (VOD)

        // ===== LOADING TIMEOUTS =====

        manifestLoadingTimeOut: 10000,   // 10s to load manifest
        manifestLoadingMaxRetry: 1,      // Retry once
        manifestLoadingRetryDelay: 1000, // Wait 1s before retry

        fragLoadingTimeOut: 20000,       // 20s to load fragment
        fragLoadingMaxRetry: 6,          // Retry 6 times
        fragLoadingRetryDelay: 1000,     // Wait 1s between retries

        levelLoadingTimeOut: 10000,      // 10s to load level playlist
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,

        // ===== PROGRESSIVE LOADING =====

        progressive: true,               // Enable progressive loading
        lowLatencyMode: false,           // Disable for better buffering

        // ===== FRAGMENT LOADING =====

        maxLoadingDelay: 4,              // Max 4s delay for loading
        minAutoBitrate: 0,               // No minimum bitrate

        // ===== ERROR RECOVERY =====

        maxFragLoadFailRetry: 6,         // Retry failed fragments 6 times
        maxLevelLoadFailRetry: 4,        // Retry failed level loads 4 times
        fragLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: 8000,  // 8s to first byte
            maxLoadTimeMs: 20000,        // 20s max load time
            timeoutRetry: {
              maxNumRetry: 2,
              retryDelayMs: 0,
              maxRetryDelayMs: 0,
            },
            errorRetry: {
              maxNumRetry: 6,            // 6 retries on error
              retryDelayMs: 1000,        // 1s between retries
              maxRetryDelayMs: 8000,     // Max 8s delay
            },
          },
        },
      });

      // Load source
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      // ===== EVENT LISTENERS =====

      // Quality level switching
      hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
        console.log(`Switching to quality level ${data.level}`);
      });

      // Manifest loaded - show available qualities
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('Available qualities:', data.levels.map(l =>
          `${l.height}p (${Math.round(l.bitrate / 1000)} Kbps)`
        ));

        // Auto-start video
        video.play().catch(err => {
          console.error('Autoplay failed:', err);
        });
      });

      // Adaptive bitrate switching
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        console.log(`Switched to ${level.height}p (${Math.round(level.bitrate / 1000)} Kbps)`);
      });

      // Error handling
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error - attempting recovery');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error - attempting recovery');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error - destroying HLS instance');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
    }

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [episode._id]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      preload="metadata"  // ✅ Don't preload entire video
      className="w-full h-full"
    />
  );
}
```

---

## Quality Level Configuration

### Define Custom Quality Levels

```typescript
// After manifest is loaded
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  const levels = hls.levels;

  // Log available qualities
  levels.forEach((level, index) => {
    console.log(`Level ${index}: ${level.height}p @ ${level.bitrate}bps`);
  });

  // Force specific quality (disable auto)
  // hls.currentLevel = 1;  // Switch to 720p

  // Or keep auto mode
  hls.currentLevel = -1;  // Auto mode
});
```

### Manual Quality Selector UI

```typescript
const QualitySelector = ({ hls }: { hls: Hls }) => {
  const [currentLevel, setCurrentLevel] = useState(-1);
  const qualities = hls.levels.map((level, index) => ({
    index,
    height: level.height,
    bitrate: level.bitrate,
  }));

  const handleQualityChange = (level: number) => {
    hls.currentLevel = level;
    setCurrentLevel(level);
  };

  return (
    <div className="quality-selector">
      <select
        value={currentLevel}
        onChange={(e) => handleQualityChange(Number(e.target.value))}
      >
        <option value={-1}>Auto</option>
        {qualities.map(q => (
          <option key={q.index} value={q.index}>
            {q.height}p ({Math.round(q.bitrate / 1000)} Kbps)
          </option>
        ))}
      </select>
    </div>
  );
};
```

---

## Preload Configuration Options

### Video Element Preload Attribute

```typescript
// Option 1: No preload (most efficient)
<video preload="none" />  // Only loads metadata on user interaction

// Option 2: Metadata only (recommended)
<video preload="metadata" />  // ✅ Loads duration, dimensions, first frame

// Option 3: Auto preload
<video preload="auto" />  // Loads entire video (not recommended)
```

### HLS.js Preload Control

```typescript
const hls = new Hls({
  // Control initial buffer
  maxBufferLength: 10,  // Only buffer 10 seconds initially

  // Delay loading until user interacts
  autoStartLoad: false,  // Don't start loading immediately
});

// Start loading when user clicks play
video.addEventListener('play', () => {
  hls.startLoad();
});
```

---

## Cloudflare Stream Specific Configuration

### Optimized for Cloudflare Stream

```typescript
const hlsConfig = {
  // Cloudflare Stream optimizations
  startLevel: -1,  // Let Cloudflare decide initial quality
  capLevelToPlayerSize: true,

  // Aggressive caching
  xhrSetup: (xhr: XMLHttpRequest, url: string) => {
    // Add Cloudflare-specific headers if needed
    xhr.setRequestHeader('CF-Cache-Status', 'HIT');
  },

  // Fast startup
  maxBufferLength: 15,  // Smaller buffer for faster start
  maxMaxBufferLength: 60,

  // Quality switching
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
};
```

### Cloudflare Stream URL Format

```typescript
// Your current implementation
const getHlsUrl = (videoId: string) => {
  const customerCode = 'your_customer_code';
  return `https://customer-${customerCode}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
};

// With quality parameter (optional)
const getHlsUrlWithQuality = (videoId: string, quality?: string) => {
  const customerCode = 'your_customer_code';
  const baseUrl = `https://customer-${customerCode}.cloudflarestream.com/${videoId}`;

  if (quality) {
    return `${baseUrl}/manifest/video.m3u8?quality=${quality}`;
  }
  return `${baseUrl}/manifest/video.m3u8`;
};
```

---

## Performance Monitoring

### Track Adaptive Bitrate Switching

```typescript
let qualitySwitchCount = 0;
let totalBufferingTime = 0;
let bufferStartTime = 0;

hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
  qualitySwitchCount++;
  const level = hls.levels[data.level];

  // Send analytics
  analytics.track('quality_switched', {
    resolution: `${level.height}p`,
    bitrate: level.bitrate,
    switchCount: qualitySwitchCount,
  });
});

hls.on(Hls.Events.BUFFER_APPENDING, () => {
  if (bufferStartTime > 0) {
    totalBufferingTime += Date.now() - bufferStartTime;
    bufferStartTime = 0;
  }
});

hls.on(Hls.Events.BUFFER_EMPTY, () => {
  bufferStartTime = Date.now();
});
```

---

## Recommended Configuration by Use Case

### Use Case 1: Fast Startup (Mobile-First)

```typescript
const fastStartupConfig = {
  startLevel: 0,           // Start with lowest quality
  maxBufferLength: 10,     // Small buffer for fast start
  abrBandWidthFactor: 0.8, // Conservative bandwidth usage
  capLevelToPlayerSize: true,
};
```

### Use Case 2: Smooth Playback (Desktop)

```typescript
const smoothPlaybackConfig = {
  startLevel: -1,          // Auto-detect
  maxBufferLength: 30,     // Larger buffer
  abrBandWidthFactor: 0.95,
  maxMaxBufferLength: 120,
};
```

### Use Case 3: Data Saving (Mobile Data)

```typescript
const dataSavingConfig = {
  startLevel: 0,           // Force 480p
  maxBufferLength: 15,     // Moderate buffer
  abrBandWidthFactor: 0.7, // Very conservative
  capLevelToPlayerSize: true,
  maxBufferSize: 20 * 1000 * 1000,  // 20 MB max
};
```

---

## Implementation Steps

### Step 1: Install HLS.js Plugin for xgplayer

```bash
npm install xgplayer-hls.js
```

### Step 2: Update VideoPlayer.tsx

```typescript
import HlsJsPlugin from 'xgplayer-hls.js';

const player = new Player({
  el: containerRef.current,
  url: hlsUrl,
  plugins: [HlsJsPlugin],

  quality: 'auto',
  defaultQuality: 720,
  preload: 'metadata',

  hls: {
    debug: false,
    maxBufferLength: 30,
    maxMaxBufferLength: 600,
    abrBandWidthFactor: 0.95,
    startLevel: -1,
    capLevelToPlayerSize: true,
    enableWorker: true,
  },
});
```

### Step 3: Test Quality Switching

```bash
# Open DevTools Console
# Watch for quality switches during playback
# Throttle network to test adaptive behavior
```

---

## Testing Adaptive Bitrate

### Chrome DevTools Network Throttling

1. Open DevTools (F12)
2. Network tab → Throttling dropdown
3. Select "Fast 3G" or "Slow 3G"
4. Play video and watch quality adapt

### Manual Testing Script

```javascript
// In browser console
const video = document.querySelector('video');
const hls = video.hlsInstance;  // If exposed

// Check current quality
console.log('Current level:', hls.currentLevel);
console.log('Auto level:', hls.autoLevelEnabled);

// Get available qualities
hls.levels.forEach((level, i) => {
  console.log(`${i}: ${level.height}p @ ${level.bitrate}bps`);
});

// Force quality change
hls.currentLevel = 0;  // Switch to 480p
hls.currentLevel = 1;  // Switch to 720p
hls.currentLevel = -1; // Back to auto
```

---

## Cost Savings with Adaptive Streaming

### Estimated Bandwidth Reduction

| Configuration | Avg Quality | Data Usage | Savings |
|---------------|-------------|------------|---------|
| **Fixed 1080p** | 1080p | 100% | 0% |
| **Fixed 720p** | 720p | 50% | 50% |
| **Adaptive (default)** | 720p avg | 60% | 40% |
| **Adaptive + capLevelToPlayerSize** | 480p avg | 40% | 60% |

### Monthly Cost Impact (500k daily viewers)

```
Without adaptive: 9M minutes × $1/1000 = $9,000/month
With adaptive: 9M minutes × 0.6 × $1/1000 = $5,400/month

Savings: $3,600/month (40% reduction)
```

---

## Summary

### Quick Start (Recommended)

**Your current setup is already configured!** You have:
- ✅ `quality: 'auto'` - Adaptive bitrate enabled
- ✅ `preload: 'metadata'` - Efficient loading

### Enhancement Options

1. **Add HLS.js plugin** for more control
2. **Configure buffer length** to optimize startup time
3. **Enable capLevelToPlayerSize** for mobile data savings
4. **Add quality selector UI** for user control

### Best Configuration for Your App

```typescript
const player = new Player({
  url: hlsUrl,
  quality: 'auto',
  defaultQuality: 720,      // Start with 720p
  preload: 'metadata',      // ✅ Don't preload entire video

  hls: {
    startLevel: -1,         // Auto-detect initial quality
    capLevelToPlayerSize: true,  // Match player size
    maxBufferLength: 30,    // 30s buffer
    abrBandWidthFactor: 0.95,
  },
});
```

This will provide:
- ✅ Adaptive quality (1080p → 720p → 480p)
- ✅ Fast startup (metadata only)
- ✅ Smooth playback (30s buffer)
- ✅ Cost optimization (40% bandwidth savings)
