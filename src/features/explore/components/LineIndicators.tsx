import React from 'react';

interface LineIndicatorsProps {
  total: number;
  currentIndex: number;
  onChange: (index: number) => void;
  isAnimating?: boolean;
}

const LineIndicators: React.FC<LineIndicatorsProps> = ({
  total,
  currentIndex,
  onChange,
  isAnimating = false,
}) => {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 py-4">
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === currentIndex;
        return (
          <button
            key={index}
            onClick={() => !isAnimating && onChange(index)}
            disabled={isAnimating}
            aria-label={`Go to card ${index + 1}`}
            aria-current={isActive ? 'true' : 'false'}
            className={`
              relative h-8 flex items-center justify-center
              transition-all duration-300 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2
              ${isAnimating ? 'cursor-not-allowed' : 'cursor-pointer group'}
            `}
          >
            {/* Line indicator */}
            <span
              className={`
                h-0.5 sm:h-[3px] rounded-full transition-all duration-300 ease-out
                ${isActive
                  ? 'w-8 sm:w-10 bg-stone-700'
                  : 'w-4 sm:w-5 bg-stone-300 group-hover:bg-stone-400 group-hover:w-6 sm:group-hover:w-7'
                }
              `}
            />
          </button>
        );
      })}
    </div>
  );
};

export default LineIndicators;
