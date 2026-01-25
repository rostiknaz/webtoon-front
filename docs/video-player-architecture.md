# Video Player Architecture

This document describes the hybrid video player implementation that combines Swiper for smooth animations with a React Context for LRU-based player caching.

## Overview

The video player system is designed to:

1. **Instant episode switching** - Preloaded players start during transition animation
2. **Prevent m3u8 reloads** - Cached players are reused when switching back to previously viewed episodes
3. **Manage memory** - LRU eviction keeps maximum 5 players in memory
4. **Provide smooth transitions** - Swiper handles GPU-accelerated vertical slide animations
5. **Save playback position** - Resume from where you left off when returning to an episode

## Hybrid Preloading Strategy

The key innovation is **preloading episodes during the swipe animation**, so players are ready to play instantly when the transition completes.

### The Problem (Without Preloading)

```
User swipes → Transition (350ms) → Transition ends → Init player → Load manifest → Buffer → Play
                                                     └─────────────── 300-500ms delay ───────────┘
```

### The Solution (With Preloading)

```
User swipes → Init player (background) → Transition (350ms) → Player ready → Play instantly!
              └─────────── Loading during animation ─────────┘              └─── ~50ms ───┘
```

### Preloading Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Episode Switching Flow                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PAGE LOAD                                                                       │
│  ─────────                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Initialize Episode 1 (play immediately)                               │   │
│  │ 2. Preload Episodes 2, 3 (no play, just init + load manifest)           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Cache: [Ep1(playing), Ep2(preloaded), Ep3(preloaded)]                          │
│                                                                                  │
│  ════════════════════════════════════════════════════════════════════════════   │
│                                                                                  │
│  USER SWIPES TO EPISODE 2                                                        │
│  ────────────────────────                                                        │
│                                                                                  │
│  onSlideChangeTransitionStart (t=0ms)                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Save Episode 1 position                                               │   │
│  │ 2. Pause all players                                                     │   │
│  │ 3. Preload Episode 2 (already cached → no-op)                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  [═══════════════ 350ms Slide Animation ═══════════════]                        │
│  │                                                     │                        │
│  │  Episode 2 player already loaded and ready!        │                        │
│  │                                                     │                        │
│                                                                                  │
│  onSlideChangeTransitionEnd (t=350ms)                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Set Episode 2 as active                                               │   │
│  │ 2. Play Episode 2 (INSTANT - already loaded!)                           │   │
│  │ 3. requestIdleCallback → Preload Episodes 1, 3                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Cache: [Ep1(paused), Ep2(playing), Ep3(preloaded)]                             │
│                                                                                  │
│  ════════════════════════════════════════════════════════════════════════════   │
│                                                                                  │
│  IDLE PRE-CACHE (After play starts)                                             │
│  ──────────────────────────────────                                             │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ requestIdleCallback or setTimeout(100ms) for Safari:                     │   │
│  │ • Preload previous episode (Ep1 - already cached)                        │   │
│  │ • Preload next episode (Ep3 - already cached)                            │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Performance Comparison

| Scenario | Without Preload | With Preload |
|----------|-----------------|--------------|
| First episode load | ~500ms | ~500ms |
| Sequential next (1→2) | 300-500ms | **~50ms** |
| Sequential prev (2→1) | 300-500ms | **~50ms** (cached) |
| Jump to uncached (1→10) | 300-500ms | 300-500ms |
| Return to cached (10→1) | **~50ms** (if in LRU) | **~50ms** |

### Code Implementation

```typescript
// Preload without playing
const preloadEpisode = (swiper: SwiperType, slideIndex: number) => {
  const episode = episodes[slideIndex];
  const host = slideEl.querySelector(".player-host");
  cache.preloadPlayer(episode._id, hlsUrl, host);  // Init only, no play
};

// On transition START - preload target
const handleSlideChangeTransitionStart = (swiper: SwiperType) => {
  cache.savePosition(prevEpisode._id);
  cache.pauseAll();
  preloadEpisode(swiper, swiper.activeIndex);  // KEY: Start loading NOW
};

// On transition END - play preloaded episode
const handleSlideChangeTransitionEnd = (swiper: SwiperType) => {
  initPlayer(activeSlide, newIndex);  // Already loaded → instant play
  preloadAdjacentEpisodes(swiper, newIndex);  // Prep for next swipe
};

// Idle pre-cache using requestIdleCallback
const preloadAdjacentEpisodes = (swiper: SwiperType, currentIndex: number) => {
  const preload = () => {
    preloadEpisode(swiper, currentIndex + 1);  // Next
    preloadEpisode(swiper, currentIndex - 1);  // Previous
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 2000 });
  } else {
    setTimeout(preload, 100);  // Safari fallback
  }
};
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SerialPage ($serialId.tsx)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VideoPlayerCacheProvider                  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │              HybridVideoPlayer                    │ │  │
│  │  │                                                   │ │  │
│  │  │  ┌─────────────────────────────────────────────┐ │ │  │
│  │  │  │              Swiper (vertical)              │ │ │  │
│  │  │  │                                             │ │ │  │
│  │  │  │  ┌─────────┐ ┌─────────┐     ┌─────────┐  │ │ │  │
│  │  │  │  │ Slide 1 │ │ Slide 2 │ ... │ Slide N │  │ │ │  │
│  │  │  │  │         │ │         │     │         │  │ │ │  │
│  │  │  │  │ player  │ │ player  │     │ (empty) │  │ │ │  │
│  │  │  │  │  host   │ │  host   │     │  host   │  │ │ │  │
│  │  │  │  └─────────┘ └─────────┘     └─────────┘  │ │ │  │
│  │  │  └─────────────────────────────────────────────┘ │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  Cache State:                                          │  │
│  │  ├─ Map<episodeId, CachedPlayer>                      │  │
│  │  ├─ LRU Order: [oldest, ..., newest]                  │  │
│  │  └─ Max Size: 5                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. VideoPlayerCacheProvider

**Location:** `src/contexts/VideoPlayerCacheContext.tsx`

The Context provider that manages player caching with LRU eviction.

#### State

```typescript
interface CachedPlayer {
  player: Player;           // xgplayer instance
  container: HTMLElement;   // DOM element containing player
  currentTime: number;      // Saved playback position
  episodeId: string;        // Unique identifier
  hlsUrl: string;           // Video stream URL
}

// Internal state
cacheRef: Map<string, CachedPlayer>  // Player cache
orderRef: string[]                    // LRU order tracking
activeEpisodeId: string | null        // Currently playing
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `initPlayerInHost(episodeId, hlsUrl, hostElement)` | Creates player in host element or returns cached |
| `preloadPlayer(episodeId, hlsUrl, hostElement)` | **NEW**: Initializes player without playing (for preloading) |
| `hasPlayer(episodeId)` | Checks if player exists in cache |
| `getCachedPlayer(episodeId)` | Returns cached player data |
| `savePosition(episodeId)` | Saves current playback time |
| `getSavedPosition(episodeId)` | Gets saved playback time |
| `restorePosition(episodeId)` | Sets player to saved position |
| `pauseAll()` | Pauses all cached players |
| `pauseOthers(activeId)` | Pauses all except specified |
| `playPlayer(episodeId)` | Plays specified player |
| `destroyAll()` | Cleanup - destroys all players |
| `getCacheStats()` | Returns `{size, maxSize, episodeIds}` |

#### LRU Eviction Logic

```typescript
const evictOldest = (protectedId?: string) => {
  while (cache.size >= MAX_CACHED_PLAYERS) {
    // Find oldest that isn't the currently active episode
    const oldestIdx = orderRef.findIndex(id => id !== protectedId);
    if (oldestIdx === -1) break;

    const oldestId = orderRef[oldestIdx];
    orderRef.splice(oldestIdx, 1);

    const cached = cache.get(oldestId);
    if (cached) {
      // Save position before destroying
      cached.currentTime = cached.player.currentTime || 0;
      cached.player.destroy();
      cache.delete(oldestId);
    }
  }
};
```

### 2. HybridVideoPlayer

**Location:** `src/components/HybridVideoPlayer.tsx`

The main video player component that integrates Swiper with the cache context.

#### Props

```typescript
interface HybridVideoPlayerProps {
  episodes: Episode[];           // All episodes for the series
  initialIndex: number;          // Starting episode index
  seriesTitle: string;           // Display title
  onEpisodeChange: (index: number) => void;  // Callback on navigation
  onLockedEpisode: () => void;   // Callback when locked episode accessed
}
```

#### Swiper Configuration

```typescript
<Swiper
  direction="vertical"      // TikTok-style vertical scroll
  slidesPerView={1}         // One episode at a time
  speed={350}               // Transition duration (ms)
  resistanceRatio={0}       // No bounce at edges
  watchSlidesProgress       // Track slide visibility
  initialSlide={initialIndex}
  onSwiper={handleSwiperInit}
  onSlideChangeTransitionStart={handleSlideChangeTransitionStart}
  onSlideChangeTransitionEnd={handleSlideChangeTransitionEnd}
/>
```

#### Player Initialization Flow

```
User navigates to slide
        │
        ▼
┌───────────────────┐
│ Is episode locked?│
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │Yes        │No
    ▼           ▼
┌────────┐  ┌──────────────────┐
│ Show   │  │ cache.hasPlayer? │
│ lock   │  └────────┬─────────┘
│ overlay│       ┌───┴───┐
└────────┘       │Yes    │No
                 ▼       ▼
          ┌──────────┐ ┌─────────────────┐
          │ Restore  │ │ Evict oldest if │
          │ position │ │ cache full (5)  │
          │ & play   │ └────────┬────────┘
          └──────────┘          │
                                ▼
                    ┌───────────────────┐
                    │ Create new player │
                    │ in host element   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Setup events:     │
                    │ - ended → next    │
                    │ - play/pause UI   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Add to cache &    │
                    │ play              │
                    └───────────────────┘
```

#### Event Handling

```typescript
// On slide transition START - save position, pause, and PRELOAD TARGET
const handleSlideChangeTransitionStart = (swiper) => {
  // Save position of previous episode
  const prevEpisode = episodes[swiper.previousIndex];
  if (prevEpisode && !prevEpisode.isLocked) {
    cache.savePosition(prevEpisode._id);
  }

  // Pause all players during transition
  cache.pauseAll();

  // IMPORTANT: Preload target episode NOW (during animation)
  // This gives the player time to initialize while animation plays
  preloadEpisode(swiper, swiper.activeIndex);
};

// On slide transition END - play preloaded episode + prep next
const handleSlideChangeTransitionEnd = (swiper) => {
  const episode = episodes[swiper.activeIndex];
  cache.setActiveEpisode(episode._id);

  // Player was preloaded during transition - now just play it
  initPlayer(activeSlide, swiper.activeIndex);

  // Pre-cache adjacent episodes during idle time
  preloadAdjacentEpisodes(swiper, swiper.activeIndex);
};
```

### 3. xgplayer Configuration

The video player uses [xgplayer](https://github.com/nicoxiang/xgplayer) with HLS support.

```typescript
const playerConfig = {
  el: hostElement,
  url: hlsUrl,
  autoplay: false,           // Controlled by component
  loop: false,
  playsinline: true,         // iOS inline playback
  fitVideoSize: 'fixWidth',  // Maintain aspect ratio

  // Mobile settings
  mobile: {
    gestureX: true,          // Horizontal gestures (seek)
    gestureY: false,         // Disabled - let Swiper handle vertical
  },

  // HLS settings
  hls: {
    maxBufferLength: 30,
    maxMaxBufferLength: 120,
    enableWorker: true,
  },
};
```

## Data Flow

### Episode Navigation (User swipes or clicks sidebar)

```
1. User Action
   └─► Swiper.slideTo(index) or swipe gesture

2. Transition Start Event
   ├─► Save current episode position
   └─► Pause all players

3. Transition End Event
   ├─► Update activeIndex state
   ├─► Notify parent (onEpisodeChange)
   └─► Initialize/resume player for new slide

4. Player Ready
   └─► Auto-play (with error handling for browser restrictions)
```

### Cache Lifecycle

```
Initial Load:
  └─► Cache: empty (0/5)

First Episode:
  └─► Cache: [ep1] (1/5)

Navigate to ep2:
  └─► Cache: [ep1, ep2] (2/5)

Navigate to ep3, ep4, ep5:
  └─► Cache: [ep1, ep2, ep3, ep4, ep5] (5/5)

Navigate to ep6 (TRIGGERS EVICTION):
  ├─► Evict ep1 (oldest)
  ├─► Save ep1 position before destroy
  └─► Cache: [ep2, ep3, ep4, ep5, ep6] (5/5)

Return to ep2 (CACHE HIT):
  ├─► Move ep2 to end of LRU order
  ├─► Restore saved position
  └─► Cache: [ep3, ep4, ep5, ep6, ep2] (5/5) - order updated
```

## Usage Example

```tsx
// In a route component
import { HybridVideoPlayer } from '@/components/HybridVideoPlayer';
import { VideoPlayerCacheProvider } from '@/contexts/VideoPlayerCacheContext';

function SerialPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <VideoPlayerCacheProvider>
      <HybridVideoPlayer
        episodes={episodes}
        initialIndex={activeIndex}
        seriesTitle="My Series"
        onEpisodeChange={setActiveIndex}
        onLockedEpisode={() => showSubscriptionDialog()}
      />
    </VideoPlayerCacheProvider>
  );
}
```

## Why Keep LRU Cache With Preloading?

Preloading and LRU cache serve **different purposes** and work together:

| Feature | Preloading | LRU Cache |
|---------|-----------|-----------|
| **Purpose** | Fast forward transitions | Memory management + backward navigation |
| **Handles** | Next episode ready instantly | Prevents unlimited memory growth |
| **Benefit** | Instant play on swipe | Going back is also instant |

### Memory Management

Without LRU limit, preloading could create unlimited players:

```
User swipes: 1→2→3→4→5→6→7→8→9→10
Without LRU: 10 players in memory (crash on mobile!)
With LRU(5): Only 5 players max, oldest evicted
```

### Backward Navigation

```
User watches: 1→2→3→4→5
User swipes back to 3

With LRU cache: Episode 3 still cached → instant playback
Without cache: Must reinitialize → 300-500ms delay
```

### Configuration Options

```typescript
// VideoPlayerCacheContext.tsx
const MAX_CACHED_PLAYERS = 5;  // Default

// Recommended values:
// 5 players - Good balance for most devices
// 3 players - Memory-constrained devices (current + prev + next)
// 7+ players - High-end devices with lots of RAM
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Max cached players | 5 | Configurable via `MAX_CACHED_PLAYERS` |
| Transition duration | 350ms | Swiper `speed` setting |
| Memory per player | ~50-100MB | Depends on video quality/buffer |
| Position save precision | Frame-accurate | Uses `player.currentTime` |
| Preloaded episodes | 2-3 | Adjacent to current |

---

## Priority Loading System

The priority loading system ensures the **current episode loads as fast as possible** by giving it bandwidth priority over preloaded episodes. This is especially important on slower networks where multiple concurrent HLS streams would compete for bandwidth.

### The Problem

Without priority loading, all players load with the same HLS.js configuration:

```
User jumps to Episode 9:
  ├─► Episode 9 starts loading (active)     → Requests segments
  ├─► Episode 8 preloading                  → Requests segments (competing!)
  └─► Episode 10 preloading                 → Requests segments (competing!)

Network bandwidth split 3 ways → Slower initial playback
```

### The Solution

Priority loading uses **different HLS.js configurations** for active vs preloaded players:

```
User jumps to Episode 9:
  ├─► Episode 9 (PRIORITY)    → Large buffers, auto quality selection
  ├─► Episode 8 (preload)     → Minimal buffers, lowest quality
  └─► Episode 10 (preload)    → Minimal buffers, lowest quality

Active episode gets most bandwidth → Faster initial playback
```

### HLS.js Configuration

```typescript
// Priority (active episode) - full buffers for smooth playback
const HLS_PLUGIN_CONFIG = {
  maxBufferLength: 30,       // 30 seconds buffer
  maxMaxBufferLength: 60,    // Up to 60 seconds
  startLevel: -1,            // Auto-select quality based on bandwidth
  enableWorker: true,
};

// Preload (adjacent episodes) - minimal buffers to reduce competition
const HLS_PLUGIN_CONFIG_PRELOAD = {
  maxBufferLength: 4,        // Only 4 seconds (2 segments)
  maxMaxBufferLength: 8,     // Cap at 8 seconds until activated
  startLevel: 0,             // Lowest quality initially
  enableWorker: true,
};
```

### Deferred Preloading

Preloading is **deferred until the current episode is ready** (CANPLAY event or 300ms timeout):

```
Episode 9 activated:
  │
  ├─► t=0ms:    Start loading Episode 9 (priority config)
  │
  ├─► t=150ms:  Episode 9 reaches CANPLAY
  │             └─► NOW start preloading Episodes 8 & 10
  │
  └─► t=300ms:  Fallback - start preloading even if CANPLAY hasn't fired
```

**Code implementation:**

```typescript
const preloadAdjacentEpisodes = (swiper, currentIndex) => {
  // Reset ready state
  currentEpisodeReadyRef.current = false;

  const doPreload = () => {
    preloadEpisode(swiper, currentIndex + 1);  // Next
    preloadEpisode(swiper, currentIndex - 1);  // Previous
  };

  const cached = cache.getCachedPlayer(episode._id);
  const video = cached?.player?.video;

  // If already ready, preload immediately
  if (video && video.readyState >= 3) {
    doPreload();
    return;
  }

  // Otherwise wait for CANPLAY or 300ms timeout
  pendingPreloadRef.current = setTimeout(doPreload, 300);

  if (cached?.player) {
    cached.player.on('canplay', () => {
      clearTimeout(pendingPreloadRef.current);
      doPreload();
    });
  }
};
```

### Long Jump Handling (e.g., Episode 1 → 9)

Long jumps require special handling because Virtual Slides hasn't rendered the target DOM yet:

```
Problem with long jumps:
  1. User clicks Episode 9 (from Episode 1)
  2. Virtual Slides only renders slides within ±2 of current
  3. Episode 9's DOM doesn't exist yet
  4. Player can't initialize → Black screen / stuck poster
```

**Solution: Force Virtual Slides update + MutationObserver**

```typescript
const handleSlideChangeTransitionStart = (swiper) => {
  const jumpDistance = Math.abs(targetIndex - prevIndex);

  // Force Virtual Slides to render target immediately for long jumps
  if (jumpDistance > 2 && swiper.virtual) {
    swiper.virtual.update(true);
  }
};

const handleSlideChange = (swiper) => {
  const isLongJump = Math.abs(newIndex - prevIndex) > 2;

  if (isLongJump) {
    // Use MutationObserver for reliable DOM detection
    const observer = new MutationObserver(() => {
      if (tryInitPlayer()) {
        observer.disconnect();
      }
    });

    observer.observe(swiper.el, { childList: true, subtree: true });

    // 1 second timeout fallback
    setTimeout(() => {
      observer.disconnect();
      tryInitPlayer();
    }, 1000);
  } else {
    // Short swipes use simple polling (faster)
    poll();
  }
};
```

### Performance Comparison

| Scenario | Without Priority | With Priority |
|----------|------------------|---------------|
| Sequential swipe (1→2) | ~200ms | ~150ms |
| Long jump (1→9) | Often fails/black screen | **Reliable ~300ms** |
| Slow network (3G) | ~2s (bandwidth split) | **~800ms** (priority) |
| Preload quality | Same as active | Lower (saves bandwidth) |

### Configuration

```typescript
// VideoPlayerCacheContext.tsx

// Priority player buffers (active episode)
maxBufferLength: 30,        // 30 seconds
maxMaxBufferLength: 60,     // Up to 60 seconds
startLevel: -1,             // Auto quality

// Preload player buffers (adjacent episodes)
maxBufferLength: 4,         // 4 seconds only
maxMaxBufferLength: 8,      // Cap at 8 seconds
startLevel: 0,              // Lowest quality

// HybridVideoPlayer.tsx
const PRELOAD_DEFER_TIMEOUT = 300;  // ms to wait for CANPLAY
const LONG_JUMP_THRESHOLD = 2;      // episodes
const LONG_JUMP_TIMEOUT = 1000;     // ms for MutationObserver
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Priority Loading Flow                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER JUMPS TO EPISODE 9 (from Episode 1)                                   │
│  ─────────────────────────────────────────                                  │
│                                                                              │
│  1. Transition Start                                                         │
│     ├─► Pause all players (free up bandwidth)                               │
│     ├─► Detect long jump (|9-1| > 2)                                        │
│     └─► Force swiper.virtual.update(true)                                   │
│                                                                              │
│  2. Slide Change                                                             │
│     ├─► Set Episode 9 as active                                             │
│     ├─► Start MutationObserver (wait for DOM)                               │
│     └─► DOM ready → initPlayer with PRIORITY config                         │
│                                                                              │
│  3. Episode 9 Loading (PRIORITY)                                             │
│     ├─► HLS.js: maxBufferLength=30, startLevel=-1 (auto)                    │
│     └─► Fetches manifest + first segments at full bandwidth                 │
│                                                                              │
│  4. CANPLAY Event (or 300ms timeout)                                         │
│     ├─► currentEpisodeReadyRef = true                                        │
│     └─► Start preloading Episodes 8 & 10                                    │
│                                                                              │
│  5. Preload Episodes 8 & 10 (LOW PRIORITY)                                   │
│     ├─► HLS.js: maxBufferLength=4, startLevel=0 (lowest)                    │
│     └─► Fetch only 2 segments, minimal bandwidth usage                      │
│                                                                              │
│  RESULT: Episode 9 plays quickly, adjacent episodes ready for swipe         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Changes |
|------|---------|
| `VideoPlayerCacheContext.tsx` | Added `HLS_PLUGIN_CONFIG_PRELOAD`, `isPriority` param |
| `HybridVideoPlayer.tsx` | Deferred preloading, MutationObserver for long jumps |

## Browser Considerations

### Autoplay Restrictions

Browsers block autoplay until user interacts with the page:

```typescript
const playPlayer = async (episodeId: string) => {
  try {
    await cached.player.play();
  } catch (err) {
    // Autoplay blocked - user needs to click play
    console.log('Play prevented:', err.message);
  }
};
```

### Mobile Gestures

- **Vertical swipe**: Handled by Swiper (episode navigation)
- **Horizontal swipe**: Handled by xgplayer (seek within video)
- **Tap**: Play/pause toggle

## Debugging

### Cache Stats Display

In development mode, cache stats are shown in the UI:

```
5 / 12 (cached: 3/5)
  │      │        │
  │      │        └─ Current cache size / max
  │      └─ Total episodes
  └─ Current episode number
```

### Console Logging

Common console messages:

```
Play prevented: The play() request was interrupted...
  └─ Normal during rapid navigation or autoplay block

Play prevented: play() failed because the user didn't interact...
  └─ Autoplay blocked - wait for user interaction
```

## Related Files

```
src/
├── components/
│   ├── HybridVideoPlayer.tsx      # Main player component
│   └── SwiperVideoPlayer.tsx      # Alternative (Swiper-only, no LRU)
├── contexts/
│   └── VideoPlayerCacheContext.tsx # Cache management
└── routes/serials/
    └── $serialId.tsx              # Page using the player
```

## Migration from Previous Approaches

### From VideoPlayer (always-mounted CSS approach)

The previous approach kept all players mounted and used CSS opacity for transitions. The hybrid approach improves on this by:

1. Adding LRU eviction (memory management)
2. Using Swiper for smoother animations
3. Proper cleanup of evicted players

### From SwiperVideoPlayer (Swiper-only approach)

The Swiper-only approach cached all visited players without limit. The hybrid approach adds:

1. Max 5 players (LRU eviction)
2. Context-based state (accessible from other components)
3. Position save/restore
