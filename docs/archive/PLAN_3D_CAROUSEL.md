# 3D Cube Carousel - Implementation Plan

## Overview
Replace the current landing page layout with a 3D rotating cube carousel. Cards appear **flat/2D when idle**, and the **3D cube rotation effect only activates during transitions**.

---

## Visual Design

### Idle State (Flat 2D)
- Card appears completely flat, no 3D perspective
- Clean, simple presentation
- Shadow and border match current design

### Transition State (3D Rotation)
- Perspective activates (1000px depth)
- Cards rotate like cube faces
- Smooth 600ms ease-out animation
- After rotation completes, snaps back to flat 2D

---

## Card Structure (6 Cards)

### Card 1: Landing Form Card
- Same beige background (#FAF9F6)
- Contains: "I Speak" / "I'm Learning" dropdowns, Depth Level selector, YouTube URL input, Start button
- Exact same functionality as current form

### Cards 2-6: Explore Video Cards
- **Same beige card style** as landing form for consistency
- Layout:
  - Video thumbnail (embedded, rounded corners)
  - Video title
  - Channel name (if available)
  - Language + Level badges
  - "Start Learning" button (same style as "Start" button)

---

## Component Architecture

```
src/features/explore/components/
├── CubeCarousel.tsx          # Main carousel container
│   ├── Manages rotation state (currentIndex, isRotating)
│   ├── Handles drag/swipe gestures
│   ├── Handles keyboard navigation
│   └── Syncs with dot indicators
│
├── CarouselCard.tsx          # Card wrapper with 3D positioning
│   ├── Applies rotateY transform based on index
│   ├── Handles backface-visibility
│   └── Manages enter/exit animations
│
├── LandingFormCard.tsx       # Card 1 content (extracted from App.tsx)
│   ├── Language selectors
│   ├── Level selector
│   ├── URL input
│   └── Start button
│
├── ExploreVideoCard.tsx      # Cards 2-6 content
│   ├── Thumbnail image
│   ├── Title, channel
│   ├── Badges
│   └── "Start Learning" button
│
├── DotIndicators.tsx         # Bottom navigation dots
│   ├── Renders dots for each card
│   ├── Highlights active dot
│   └── onClick jumps to card
│
└── index.ts                  # Exports
```

---

## CSS/Styling Approach

### Container (Cube Scene)
```css
.carousel-scene {
  /* No perspective by default - flat 2D */
  perspective: none;
  transition: perspective 0.1s;
}

.carousel-scene.is-rotating {
  /* Perspective only during rotation */
  perspective: 1000px;
}
```

### Cube Container
```css
.carousel-cube {
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Card Faces
```css
.carousel-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;

  /* Each face rotated around Y axis */
  /* For 6 faces: 0°, 60°, 120°, 180°, 240°, 300° */
}

.carousel-face:nth-child(1) { transform: rotateY(0deg) translateZ(var(--cube-depth)); }
.carousel-face:nth-child(2) { transform: rotateY(60deg) translateZ(var(--cube-depth)); }
/* ... etc */
```

### Flat State (After Rotation)
When not rotating, we can either:
1. Remove `transform-style: preserve-3d` temporarily
2. Or keep only the active card visible with `opacity`

---

## State Management

```typescript
interface CarouselState {
  currentIndex: number;        // 0-5 (which card is active)
  isRotating: boolean;         // true during animation
  isDragging: boolean;         // true during drag gesture
  dragStartX: number;          // Initial drag position
  dragDelta: number;           // Current drag offset
}
```

---

## Interaction Handlers

### 1. Dot Click
```typescript
const handleDotClick = (index: number) => {
  if (index === currentIndex) return;
  setIsRotating(true);
  setCurrentIndex(index);
  // After 600ms, setIsRotating(false)
};
```

### 2. Swipe/Drag
```typescript
const handleDragStart = (e) => {
  setIsDragging(true);
  setDragStartX(e.clientX || e.touches[0].clientX);
};

const handleDragMove = (e) => {
  if (!isDragging) return;
  const currentX = e.clientX || e.touches[0].clientX;
  setDragDelta(currentX - dragStartX);
  // Apply partial rotation based on dragDelta
};

const handleDragEnd = () => {
  setIsDragging(false);
  // If dragDelta > threshold, go next/prev
  // Else snap back
};
```

### 3. Keyboard
```typescript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') goToPrev();
    if (e.key === 'ArrowRight') goToNext();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Data Flow

1. **CubeCarousel** fetches explore videos on mount (reuses existing API)
2. Creates array of 6 items: [landingForm, video1, video2, video3, video4, video5]
3. Passes each item to **CarouselCard** with its index
4. **CarouselCard** renders either **LandingFormCard** or **ExploreVideoCard**
5. **DotIndicators** receives currentIndex and onChange callback

---

## Props Interface

### CubeCarousel
```typescript
interface CubeCarouselProps {
  // Landing form props (passed to LandingFormCard)
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  nativeLang: string;
  setNativeLang: (lang: string) => void;
  targetLang: string;
  setTargetLang: (lang: string) => void;
  level: string;
  setLevel: (level: string) => void;
  onStart: () => void;
  errorMsg: string;

  // Explore video handler
  onExploreVideoSelect: (analysisId: string) => void;
}
```

---

## Implementation Steps

1. **Create DotIndicators.tsx** - Simple, independent component
2. **Create LandingFormCard.tsx** - Extract form from App.tsx
3. **Create ExploreVideoCard.tsx** - Beige card with video info
4. **Create CarouselCard.tsx** - 3D face wrapper
5. **Create CubeCarousel.tsx** - Main orchestrator
6. **Update App.tsx** - Replace landing section with CubeCarousel
7. **Add CSS** - 3D transforms and transitions
8. **Test** - All navigation methods work

---

## Mobile Considerations

- Touch events for swipe (touchstart, touchmove, touchend)
- Same visual behavior, just touch instead of mouse
- Card size responsive (slightly smaller on mobile)
- Dots slightly larger for touch targets

---

## Accessibility

- Arrow key navigation
- Dots are focusable buttons with aria-labels
- Cards have appropriate heading structure
- Reduced motion: skip 3D animation, instant switch
