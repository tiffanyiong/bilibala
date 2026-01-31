import React from 'react';
import { ExploreVideo } from '../../../shared/types/database';

interface ThumbnailNavProps {
  currentIndex: number;
  onChange: (index: number) => void;
  isAnimating: boolean;
  exploreVideos: ExploreVideo[];
}

const ThumbnailNav: React.FC<ThumbnailNavProps> = ({
  currentIndex,
  onChange,
  isAnimating,
  exploreVideos,
}) => {
  // Total items: 1 (landing form) + explore videos
  const totalItems = 1 + exploreVideos.length;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4">
      {Array.from({ length: totalItems }).map((_, index) => {
        const isActive = index === currentIndex;
        const isLandingCard = index === 0;
        const video = !isLandingCard ? exploreVideos[index - 1] : null;

        return (
          <button
            key={index}
            onClick={() => !isAnimating && onChange(index)}
            disabled={isAnimating}
            aria-label={isLandingCard ? 'Go to start' : `Go to video ${index}`}
            className={`
              relative overflow-hidden transition-all duration-300 ease-out
              ${isAnimating ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${isActive
                ? 'w-14 h-10 sm:w-16 sm:h-11 ring-2 ring-stone-700 ring-offset-1'
                : 'w-10 h-7 sm:w-12 sm:h-8 opacity-60 hover:opacity-100'
              }
              rounded-md sm:rounded-lg
            `}
          >
            {isLandingCard ? (
              // Landing card thumbnail - show Bilibala icon/text
              <div className={`
                w-full h-full bg-[#FAF9F6] border border-stone-200 flex items-center justify-center
                rounded-md sm:rounded-lg
              `}>
                <span className={`
                  font-serif text-stone-700
                  ${isActive ? 'text-[10px] sm:text-xs' : 'text-[8px] sm:text-[10px]'}
                `}>
                  B
                </span>
              </div>
            ) : video ? (
              // Video thumbnail
              <img
                src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/default.jpg`}
                alt={video.title}
                className="w-full h-full object-cover rounded-md sm:rounded-lg"
              />
            ) : null}

            {/* Active indicator overlay */}
            {isActive && (
              <div className="absolute inset-0 border-2 border-stone-700 rounded-md sm:rounded-lg pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ThumbnailNav;
