import React, { useEffect, useRef, useState } from 'react';
import { LEVELS } from '../constants';

interface LevelSelectorProps {
  currentLevel: string;
  availableLevels: Set<string>; // Levels that have been analyzed
  onLevelChange: (level: string) => void;
  className?: string;
}

const LevelSelector: React.FC<LevelSelectorProps> = ({
  currentLevel,
  availableLevels,
  onLevelChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only show dropdown if there are other available levels
  const canSwitch = availableLevels.size > 1;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleToggle = () => {
    if (canSwitch) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 px-3 py-1 rounded-lg shadow-sm ring-1 ring-black/[0.04] text-xs font-medium uppercase tracking-wide transition-all ${
          canSwitch ? 'hover:bg-white/70 hover:shadow-md cursor-pointer' : 'cursor-default'
        }`}
        title={canSwitch ? 'Switch difficulty level' : 'Other levels are being analyzed'}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
        {currentLevel}
        {canSwitch && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && canSwitch && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl border border-stone-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] py-1 z-[300]">
          {LEVELS.map((level) => {
            const isAvailable = availableLevels.has(level.id);
            const isCurrent = currentLevel === level.id;

            return (
              <button
                key={level.id}
                onClick={() => {
                  if (isAvailable && !isCurrent) {
                    onLevelChange(level.id);
                    setIsOpen(false);
                  }
                }}
                disabled={!isAvailable || isCurrent}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  isCurrent
                    ? 'bg-stone-100 text-stone-900 font-medium cursor-default'
                    : isAvailable
                    ? 'text-stone-600 hover:bg-stone-50 cursor-pointer'
                    : 'text-stone-300 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{level.label}</span>
                  {!isAvailable && (
                    <span className="text-[10px] text-stone-400">Loading...</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LevelSelector;
