import React, { useEffect, useRef, useState } from 'react';
import { ExploreVideo } from '../../../shared/types/database';
import ExploreCard, { ExploreCardSkeleton } from './ExploreCard';

interface ExploreCarouselProps {
  targetLang: string;
  level: string;
  onVideoSelect: (analysisId: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EXPLORE_VIDEOS_LIMIT = 21;

const ExploreCarousel: React.FC<ExploreCarouselProps> = ({
  targetLang,
  level,
  onVideoSelect,
}) => {
  const [videos, setVideos] = useState<ExploreVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch videos when targetLang or level changes
  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          targetLang,
          level,
          limit: String(EXPLORE_VIDEOS_LIMIT),
        });

        const response = await fetch(`${API_BASE}/api/explore?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch explore videos');
        }

        const data = await response.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error('[ExploreCarousel] Error:', err);
        setError('Failed to load videos');
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the fetch to avoid rapid calls when user is selecting options
    const timeoutId = setTimeout(fetchVideos, 300);
    return () => clearTimeout(timeoutId);
  }, [targetLang, level]);

  // Update scroll button visibility
  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        scrollEl.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [videos]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 256; // ~1 card width + gap
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Don't render anything if no videos and not loading (empty state is hidden)
  if (!isLoading && videos.length === 0 && !error) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-700">Explore Videos</h3>
          <p className="text-xs text-stone-400 mt-0.5">See what others are learning</p>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 border border-stone-200 rounded-full shadow-md flex items-center justify-center text-stone-600 hover:bg-white hover:text-stone-800 transition-all opacity-0 group-hover/carousel:opacity-100 -translate-x-1/2"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon />
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {isLoading ? (
            // Skeleton loading state
            Array(4)
              .fill(0)
              .map((_, i) => <ExploreCardSkeleton key={i} />)
          ) : error ? (
            // Error state
            <div className="w-full py-8 text-center text-stone-400 text-sm">{error}</div>
          ) : (
            // Video cards
            videos.map((video) => (
              <ExploreCard
                key={video.analysisId}
                video={video}
                onClick={() => onVideoSelect(video.analysisId)}
              />
            ))
          )}
        </div>

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 border border-stone-200 rounded-full shadow-md flex items-center justify-center text-stone-600 hover:bg-white hover:text-stone-800 transition-all opacity-0 group-hover/carousel:opacity-100 translate-x-1/2"
            aria-label="Scroll right"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </div>
  );
};

const ChevronLeftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default ExploreCarousel;
