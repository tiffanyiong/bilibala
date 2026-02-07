import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBackendOrigin } from '../../../shared/services/backend';
import { ExploreVideo } from '../../../shared/types/database';
import ExploreVideoCard from './ExploreVideoCard';
import LandingFormCard from './LandingFormCard';
import LineIndicators from './LineIndicators';

interface CubeCarouselProps {
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
  onExploreVideoSelect: (analysisId: string) => void;
}

const SNAP_THRESHOLD = 0.15; // 15% of container width to trigger snap
const SPRING_DURATION = 350; // ms for snap animation

const CubeCarousel: React.FC<CubeCarouselProps> = ({
  videoUrl,
  setVideoUrl,
  nativeLang,
  setNativeLang,
  targetLang,
  setTargetLang,
  level,
  setLevel,
  onStart,
  errorMsg,
  onExploreVideoSelect,
}) => {
  const [exploreVideos, setExploreVideos] = useState<ExploreVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0); // px offset during drag
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const containerWidthRef = useRef(0);

  const totalCards = 1 + Math.min(exploreVideos.length, 5);

  // Fetch explore videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const params = new URLSearchParams({ targetLang, level, limit: '5' });
        const response = await fetch(`${getBackendOrigin()}/api/explore?${params}`);
        if (response.ok) {
          const data = await response.json();
          setExploreVideos(data.videos || []);
        }
      } catch (err) {
        console.error('[CubeCarousel] Error fetching videos:', err);
      }
    };
    const timeoutId = setTimeout(fetchVideos, 300);
    return () => clearTimeout(timeoutId);
  }, [targetLang, level]);

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        containerWidthRef.current = containerRef.current.offsetWidth;
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Snap to a card with animation
  const snapToCard = useCallback((index: number) => {
    setIsSnapping(true);
    setCurrentIndex(index);
    setDragOffset(0);

    setTimeout(() => {
      setIsSnapping(false);
    }, SPRING_DURATION);
  }, []);

  // Handle drag end - determine snap target
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const width = containerWidthRef.current || 400;
    const ratio = dragOffset / width;

    if (ratio < -SNAP_THRESHOLD && currentIndex < totalCards - 1) {
      // Dragged left enough → go next
      snapToCard(currentIndex + 1);
    } else if (ratio > SNAP_THRESHOLD && currentIndex > 0) {
      // Dragged right enough → go prev
      snapToCard(currentIndex - 1);
    } else {
      // Spring back
      snapToCard(currentIndex);
    }

    dragStartRef.current = null;
  }, [isDragging, dragOffset, currentIndex, totalCards, snapToCard]);

  // Navigate via dots/keyboard
  const goToCard = useCallback((index: number) => {
    if (index === currentIndex || isDragging || isSnapping) return;
    snapToCard(index);
  }, [currentIndex, isDragging, isSnapping, snapToCard]);

  const goToNext = useCallback(() => {
    if (currentIndex < totalCards - 1) goToCard(currentIndex + 1);
  }, [currentIndex, totalCards, goToCard]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) goToCard(currentIndex - 1);
  }, [currentIndex, goToCard]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  const DRAG_THRESHOLD = 5; // px before drag starts (allows clicks to pass through)

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSnapping) return;
    dragStartRef.current = e.touches[0].clientX;
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartRef.current === null) return;
    const diff = e.touches[0].clientX - dragStartRef.current;

    // Only start dragging after threshold
    if (!isDragging && Math.abs(diff) < DRAG_THRESHOLD) return;
    if (!isDragging) setIsDragging(true);

    const atStart = currentIndex === 0 && diff > 0;
    const atEnd = currentIndex === totalCards - 1 && diff < 0;
    const dampened = (atStart || atEnd) ? diff * 0.3 : diff;

    setDragOffset(dampened);
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      handleDragEnd();
    }
    dragStartRef.current = null;
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSnapping) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    ) return;

    dragStartRef.current = e.clientX;
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartRef.current === null) return;
    const diff = e.clientX - dragStartRef.current;

    // Only start dragging after threshold
    if (!isDragging && Math.abs(diff) < DRAG_THRESHOLD) return;
    if (!isDragging) setIsDragging(true);

    const atStart = currentIndex === 0 && diff > 0;
    const atEnd = currentIndex === totalCards - 1 && diff < 0;
    const dampened = (atStart || atEnd) ? diff * 0.3 : diff;

    setDragOffset(dampened);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      handleDragEnd();
    }
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    if (isDragging) handleDragEnd();
    dragStartRef.current = null;
  };

  // Calculate card transform for each card
  const getCardStyle = (cardIndex: number): React.CSSProperties => {
    const width = containerWidthRef.current || 400;
    const gap = 20; // gap between cards in px

    // Base position: each card is offset by its index relative to current
    const baseOffset = (cardIndex - currentIndex) * (width + gap);
    const totalOffset = baseOffset + dragOffset;

    // Scale: center card is 1, adjacent cards are smaller
    const distanceRatio = Math.abs(totalOffset) / width;
    const scale = Math.max(0.85, 1 - distanceRatio * 0.15);

    // Opacity: fade cards that are far away
    const opacity = Math.max(0, 1 - distanceRatio * 0.5);

    // Only render cards that are potentially visible (current ±1)
    const isVisible = Math.abs(cardIndex - currentIndex) <= 1 || isDragging;
    if (!isVisible && Math.abs(totalOffset) > width * 1.5) {
      return {
        opacity: 0,
        transform: `translateX(${totalOffset}px) scale(0.85)`,
        pointerEvents: 'none',
        transition: 'none',
      };
    }

    return {
      opacity,
      transform: `translateX(${totalOffset}px) scale(${scale})`,
      pointerEvents: cardIndex === currentIndex && !isDragging ? 'auto' : 'none',
      transition: isDragging ? 'none' : `all ${SPRING_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1)`,
      willChange: isDragging ? 'transform' : 'auto',
    };
  };

  return (
    <div className="w-full flex flex-col items-center px-4 sm:px-6">
      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-xl select-none h-[480px] sm:h-[520px] md:h-[540px] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Card 1: Landing Form */}
        <div
          className="absolute inset-0 w-full h-full"
          style={getCardStyle(0)}
        >
          <LandingFormCard
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            nativeLang={nativeLang}
            setNativeLang={setNativeLang}
            targetLang={targetLang}
            setTargetLang={setTargetLang}
            level={level}
            setLevel={setLevel}
            onStart={onStart}
            errorMsg={errorMsg}
          />
        </div>

        {/* Cards 2-6: Explore Videos */}
        {exploreVideos.slice(0, 5).map((video, i) => {
          const cardIndex = i + 1;
          return (
            <div
              key={video.analysisId}
              className="absolute inset-0 w-full h-full flex items-center justify-center"
              style={getCardStyle(cardIndex)}
            >
              <ExploreVideoCard
                video={video}
                onSelect={() => onExploreVideoSelect(video.analysisId)}
              />
            </div>
          );
        })}
      </div>

      {/* Line Indicators Navigation */}
      {totalCards > 1 && (
        <LineIndicators
          total={totalCards}
          currentIndex={currentIndex}
          onChange={goToCard}
          isAnimating={isSnapping}
        />
      )}

      {/* Navigation hint */}
      <p className="hidden sm:block text-xs text-stone-400 -mt-1">
        Swipe to explore
      </p>
    </div>
  );
};

export default CubeCarousel;
