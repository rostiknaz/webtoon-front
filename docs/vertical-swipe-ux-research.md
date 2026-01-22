# Vertical Video Swipe UX Research Report

## Executive Summary

Based on research from top apps (TikTok, Instagram Reels, YouTube Shorts) and Swiper.js documentation, here are the key findings and recommendations for improving vertical video swipe animation.

---

## 1. What Makes TikTok's Swipe Feel "Native"

### The Doherty Threshold (< 400ms Response Time)
Users feel "in control" when response time is under 400ms. TikTok achieves this with:
- **Instant visual feedback** on touch
- **Predictive preloading** of next content
- **GPU-accelerated transitions**

Sources:
- [TikTok's UI Is Designed to Hijack Your Brain](https://medium.com/design-bootcamp/tiktoks-ui-is-designed-to-hijack-your-brain-here-s-how-ed38f65d088b)
- [CareerFoundry: TikTok UI Explained](https://careerfoundry.com/en/blog/ui-design/tiktok-ui/)

### Physics-Based Spring Animation
Native apps use spring physics with:
- **Mass, stiffness, and damping** parameters
- **Initial velocity from gesture** for natural momentum
- **Continuous motion** that maintains velocity through interruptions

Sources:
- [Android Spring Animation](https://developer.android.com/develop/ui/views/animations/spring-animation)
- [SwiftUI Spring Animations](https://github.com/GetStream/swiftui-spring-animations)

### Haptic Feedback & Micro-interactions
> "The tiny haptic buzz, the heart bounce, the satisfying swipe—these aren't 'just nice.' They're behavioral reinforcements."

Source: [The Future Canvas - Hooked](https://thefuturecanvas.com/blog/hooked-the-ux-psychology-behind-social-medias-addictive-design)

---

## 2. Swiper Configuration Options

### Option A: TikTok-Style (Snappy with Subtle Depth) - CURRENTLY IMPLEMENTED
```typescript
<Swiper
  direction="vertical"
  slidesPerView={1}
  speed={280}                    // Faster, snappier
  threshold={3}                  // More responsive to touch
  touchRatio={1.2}              // Slightly more sensitive
  resistanceRatio={0.65}        // Subtle bounce at edges
  followFinger={true}           // Real-time follow
  shortSwipes={true}            // Quick flicks work
  longSwipesRatio={0.3}         // Easier to complete swipe
  watchSlidesProgress
  modules={[EffectCreative, Virtual, Parallax]}
  effect="creative"
  parallax={true}
  creativeEffect={{
    perspective: 1200,          // Enable 3D perspective
    prev: {
      translate: [0, "-100%", -80],  // Slight Z depth
      scale: 0.96,                    // Scale down outgoing
      opacity: 0.5,
    },
    next: {
      translate: [0, "100%", 0],
      scale: 1,
      opacity: 0,
    },
  }}
/>
```

### Option B: Instagram Reels Style (Smooth with Parallax)
```typescript
<Swiper
  direction="vertical"
  slidesPerView={1}
  speed={300}
  threshold={5}
  touchRatio={1}
  resistanceRatio={0.85}        // More bouncy at edges
  followFinger={true}
  modules={[EffectCreative, Virtual, Parallax]}
  effect="creative"
  parallax={true}
  creativeEffect={{
    limitProgress: 2,           // Smoother multi-slide feel
    prev: {
      translate: [0, "-95%", -50],
      scale: 0.92,
      opacity: 0.4,
      shadow: true,             // Add shadow for depth
    },
    next: {
      translate: [0, "100%", 0],
    },
  }}
/>
```

### Option C: YouTube Shorts Style (Clean Slide)
```typescript
<Swiper
  direction="vertical"
  slidesPerView={1}
  speed={250}                   // Very fast
  threshold={3}
  touchRatio={1.3}
  resistanceRatio={0.5}
  longSwipesMs={150}           // Quick long swipes
  modules={[EffectCreative, Virtual]}
  effect="creative"
  creativeEffect={{
    prev: {
      translate: [0, "-100%", 0],
      opacity: 0.8,            // Subtle fade only
    },
    next: {
      translate: [0, "100%", 0],
      opacity: 0,
    },
  }}
/>
```

### Original Configuration (Before Optimization)
```typescript
<Swiper
  direction="vertical"
  slidesPerView={1}
  speed={350}
  resistanceRatio={0}
  effect="creative"
  creativeEffect={{
    prev: { translate: [0, "-100%", 0], opacity: 0 },
    next: { translate: [0, "100%", 0], opacity: 0 },
  }}
/>
```

---

## 3. Configuration Parameters Reference

| Parameter | Description | Default | Recommended |
|-----------|-------------|---------|-------------|
| `speed` | Transition duration (ms) | 300 | 250-300 |
| `threshold` | Min px to trigger swipe | 5 | 3-5 |
| `touchRatio` | Touch sensitivity multiplier | 1 | 1.0-1.3 |
| `resistanceRatio` | Edge bounce (0=none, 1=full) | 0.85 | 0.5-0.85 |
| `longSwipesRatio` | % of slide to trigger change | 0.5 | 0.3-0.4 |
| `longSwipesMs` | Min ms for long swipe | 300 | 150-300 |
| `shortSwipes` | Enable quick flicks | true | true |
| `followFinger` | Real-time finger tracking | true | true |

---

## 4. Parallax Configuration (Future Enhancement)

Add parallax to episode info for a layered feel:

```tsx
// In EpisodeSlide component
<div
  className="absolute top-0 left-0 right-0 ..."
  data-swiper-parallax="-30%"      // Moves slower than slide
  data-swiper-parallax-opacity="0.5" // Fades during transition
>
  <h3 data-swiper-parallax="-20%">{seriesTitle}</h3>
  <p data-swiper-parallax="-10%">Episode {episode.episodeNumber}</p>
</div>

// Action buttons with different parallax
<div
  className="absolute bottom-24 right-4 ..."
  data-swiper-parallax="-15%"
  data-swiper-parallax-scale="0.9"
>
  {/* Like, Share, Episodes buttons */}
</div>
```

---

## 5. Key UX Principles

### From Transition Best Practices:
| Principle | Implementation |
|-----------|----------------|
| **Timing consistency** | Stick to one transition style |
| **Match energy** | Fast transitions for engaging content |
| **Seamlessness** | Motion should feel continuous, not jarring |
| **Restraint** | Don't overuse effects - they should enhance, not distract |

Sources:
- [Zubtitle: Video Transitions](https://zubtitle.com/blog/5-video-transitions-for-instagram-reels-tiktoks-shorts/)
- [Delivered Social: Top Tips](https://deliveredsocial.com/top-tips-for-social-media-video-transitions-you-cant-ignore-in-2025/)

### From TikTok UX Psychology:
| Pattern | Why It Works |
|---------|--------------|
| **Fitts's Law** | All actions in thumb zone, minimal movement needed |
| **Hick's Law** | Minimal choices = faster decisions |
| **Variable reinforcement** | Uncertainty of next video keeps users engaged |
| **Full-screen immersion** | No distractions, pure content focus |

Sources:
- [LinkedIn: TikTok UI Analysis](https://www.linkedin.com/pulse/why-tiktoks-ui-amazing-uxui-analysis-series-part-1-mesai-memoria)
- [Medium: Why TikTok is Addictive](https://chougeena.medium.com/why-tiktok-is-addictive-a-product-design-and-ux-analysis-149f429d55c3)

---

## 6. Action Plan (Future Enhancements)

After testing Option A, consider these additional enhancements:

### Phase 1: Parallax Effects
- [ ] Add parallax to top info bar (title, episode info)
- [ ] Add parallax to action buttons (like, share, episodes)
- [ ] Test different parallax values for optimal feel

### Phase 2: Haptic Feedback
- [ ] Add vibration on slide change (for PWA/native)
- [ ] Add haptic on like button tap
- [ ] Test haptic intensity levels

### Phase 3: Preload Indicators
- [ ] Add subtle loading indicator for next video
- [ ] Show buffering state during transitions
- [ ] Implement skeleton loading for slide content

### Phase 4: A/B Testing
- [ ] Set up analytics for swipe completion rate
- [ ] Track time spent per video
- [ ] Compare Option A vs B vs C metrics

---

## 7. Testing Checklist

When testing swipe animations, evaluate:

- [ ] **Responsiveness**: Does it react instantly to touch?
- [ ] **Smoothness**: Is the animation fluid without jank?
- [ ] **Predictability**: Does it go where expected?
- [ ] **Satisfaction**: Does it feel "good" to swipe?
- [ ] **Edge behavior**: Does bounce at edges feel natural?
- [ ] **Speed**: Is transition too fast or too slow?
- [ ] **Depth effect**: Does 3D transform enhance or distract?

---

*Last updated: January 2026*
*Based on research from TikTok, Instagram Reels, YouTube Shorts, and Swiper.js documentation*
