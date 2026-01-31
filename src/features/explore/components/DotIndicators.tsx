import React from 'react';

interface DotIndicatorsProps {
  total: number;
  currentIndex: number;
  onChange: (index: number) => void;
  isRotating?: boolean;
}

const DotIndicators: React.FC<DotIndicatorsProps> = ({
  total,
  currentIndex,
  onChange,
  isRotating = false,
}) => {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-5 py-3 sm:py-4">
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === currentIndex;
        return (
          <button
            key={index}
            onClick={() => !isRotating && onChange(index)}
            disabled={isRotating}
            aria-label={`Go to card ${index + 1}`}
            aria-current={isActive ? 'true' : 'false'}
            className={`
              relative flex items-center justify-center
              w-10 h-10 sm:w-11 sm:h-11
              transition-all duration-300 ease-out
              focus:outline-none
              ${isRotating ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Visible dot */}
            <span
              className={`
                rounded-full transition-all duration-300
                ${isActive
                  ? 'w-3 h-3 sm:w-3.5 sm:h-3.5 bg-stone-700 shadow-md'
                  : 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-stone-300 hover:bg-stone-400 active:bg-stone-500'
                }
              `}
            />
            {/* Active dot glow effect */}
            {isActive && (
              <span className="absolute w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-stone-500 animate-ping opacity-30" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DotIndicators;
