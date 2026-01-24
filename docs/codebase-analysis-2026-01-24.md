# Codebase Analysis Report

**Date:** 2026-01-24
**Analyzed by:** Claude Code using react-best-practices and web-design-guidelines skills
**Status:** Action Plan in Progress

---

## React Performance Issues (57 Rules Checked)

### CRITICAL Issues

| Issue | File | Line | Fix | Status |
|-------|------|------|-----|--------|
| **Skeleton disabled (debug code)** | `HybridVideoPlayer.tsx` | 91-93 | Remove `const isLoading = false` - restore actual loading state | [ ] |
| **setState in render body** | `SubscriptionDrawer.tsx` | 65-70 | Move auto-select plan to `useEffect` | [ ] |

### HIGH Priority

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| **31 lucide icon imports scattered** | Multiple files | Create `@/components/icons/index.ts` barrel export | [ ] |
| **Sequential session invalidation** | `Header.tsx:34-43` | Use `void invalidateSession()` for parallel execution | [ ] |
| **Swiper bundle CSS** | `HybridVideoPlayer.tsx:36` | Import only needed CSS: `swiper/css`, `swiper/css/effect-creative` | [ ] |

### MEDIUM Priority

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| Redundant plan lookup | `SubscriptionDrawer.tsx:98` | Use `useMemo` for `recommendedPlanId` | [ ] |
| 4 separate drawer states | `serials/$serialId.tsx:85-88` | Consider consolidating to single `openDrawer` state | [ ] |

---

## Web Interface Guidelines Issues (100+ Rules Checked)

### Accessibility (HIGH)

| Issue | File:Line | Fix | Status |
|-------|-----------|-----|--------|
| Icon buttons missing aria-label | `Header.tsx:106,118,188` | Add `aria-label="Search"`, `aria-label="Notifications"`, etc. | [ ] |
| Icon buttons missing aria-label | `HeroSlider.tsx:185-203` | Add `aria-label="Previous slide"`, `aria-label="Next slide"` | [ ] |
| Pagination dots missing aria-label | `HeroSlider.tsx:207-223` | Add `aria-label="Go to slide {n}"` | [ ] |
| Non-semantic clickable divs | `GenreGrid.tsx:29-50` | Use `<button>` or add `role="button"` + `onKeyDown` | [ ] |
| Non-semantic clickable divs | `SubscriptionDrawer.tsx:138-182` | Use `<button>` for plan selection | [ ] |
| Missing keyboard support | `SubscriptionDrawer.tsx:138` | Add `onKeyDown` handler for Enter/Space | [ ] |
| Search input missing label | `Header.tsx:97-103` | Add `aria-label="Search"` or associate `<label>` | [ ] |

### Performance (HIGH)

| Issue | File:Line | Fix | Status |
|-------|-----------|-----|--------|
| Images missing width/height | `HeroSlider.tsx:63-70` | Add `width` and `height` attributes | [ ] |
| Images missing width/height | `AnimeCard.tsx:27-31` | Add explicit dimensions | [ ] |
| Images missing width/height | `EpisodeSidebar.tsx:115-121` | Add dimensions to thumbnails | [ ] |
| Missing lazy loading | Multiple card components | Add `loading="lazy"` to below-fold images | [ ] |
| Missing preconnect | `index.html` | Add `<link rel="preconnect" href="...cloudflarestream.com">` | [ ] |

### Animation (HIGH)

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| prefers-reduced-motion not respected | `HeroSlider.tsx`, `motion-button.tsx`, `index.css` | Wrap animations in `@media (prefers-reduced-motion: no-preference)` | [ ] |
| Non-compositor animations | `GenreGrid.tsx:31` | Remove `shadow` from hover transitions | [ ] |

### Touch/Mobile (HIGH)

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| Missing touch-action | `HybridVideoPlayer.tsx` | Add `touch-action: pan-y` to Swiper container | [ ] |
| Missing overscroll-behavior | `drawer.tsx`, `AuthDrawer.tsx`, `SubscriptionDrawer.tsx` | Add `overscroll-behavior: contain` | [ ] |

### Focus States (MEDIUM)

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| No focus indicator on clickable divs | `GenreGrid.tsx`, `SubscriptionDrawer.tsx` | Add `focus-visible:ring-2` | [ ] |
| Thin focus ring on dark backgrounds | `HeroSlider.tsx` pagination | Increase ring opacity/width | [ ] |

### Forms (MEDIUM)

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| Mode-switch buttons not disabled during submit | `AuthDrawer.tsx:474,629` | Add `disabled={isSubmitting}` | [ ] |

---

## What's Already Good

- **Async parallelization** in API routes using `Promise.all()`
- **useSyncExternalStore** for efficient video player state
- **Memoized context values** preventing unnecessary re-renders
- **Proper ARIA live regions** for form status announcements
- **Good semantic HTML** structure overall
- **Alt text on images** - all properly described
- **Form autocomplete attributes** - correctly set

---

## Action Plan

### Phase 1: Critical Fixes
1. [ ] `HybridVideoPlayer.tsx:91-93` - Restore skeleton loading state
2. [ ] `SubscriptionDrawer.tsx:65-70` - Move auto-select to useEffect

### Phase 2: High Priority
3. [ ] Create icons barrel export - Consolidate 31 lucide imports
4. [ ] `Header.tsx` - Parallel session invalidation + aria-labels
5. [ ] `index.html` - Add preconnect for Cloudflare Stream CDN
6. [ ] All images - Add width/height attributes
7. [ ] Drawers - Add `overscroll-behavior: contain`
8. [ ] Global CSS - Add `prefers-reduced-motion` media query
9. [ ] `HeroSlider.tsx` - Add aria-labels to navigation buttons

### Phase 3: Medium Priority
10. [ ] Convert clickable divs to semantic buttons
11. [ ] Add keyboard handlers to interactive elements
12. [ ] Add lazy loading to below-fold images
13. [ ] Improve focus indicators on dark backgrounds
14. [ ] Disable form-switching buttons during submission

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-24 | Initial analysis completed |
