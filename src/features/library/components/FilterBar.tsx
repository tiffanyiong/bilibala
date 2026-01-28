import React from 'react';

export type SortOrder = 'newest' | 'oldest';

interface FilterBarProps {
  languages: string[];
  levels: string[];
  activeLanguage: string | null;
  activeLevel: string | null;
  onLanguageChange: (lang: string | null) => void;
  onLevelChange: (level: string | null) => void;
  showFavoritesOnly?: boolean;
  onFavoritesChange?: (show: boolean) => void;
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  languages,
  levels,
  activeLanguage,
  activeLevel,
  onLanguageChange,
  onLevelChange,
  showFavoritesOnly = false,
  onFavoritesChange,
  sortOrder = 'newest',
  onSortChange,
}) => {
  const hasActiveFilters = activeLanguage || activeLevel || showFavoritesOnly;

  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => {
          onLanguageChange(null);
          onLevelChange(null);
          onFavoritesChange?.(false);
        }}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          !hasActiveFilters
            ? 'bg-stone-800 text-white border-stone-800'
            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
        }`}
      >
        All
      </button>

      {/* Favorites filter */}
      {onFavoritesChange && (
        <button
          onClick={() => onFavoritesChange(!showFavoritesOnly)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
            showFavoritesOnly
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <HeartIcon filled={showFavoritesOnly} />
          Favorites
        </button>
      )}

      {/* Divider */}
      {(languages.length > 0 || levels.length > 0) && (
        <div className="w-px h-6 bg-stone-200 self-center mx-1" />
      )}

      {/* Language filters */}
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => onLanguageChange(activeLanguage === lang ? null : lang)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            activeLanguage === lang
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {lang}
        </button>
      ))}

      {/* Divider between languages and levels */}
      {languages.length > 0 && levels.length > 0 && (
        <div className="w-px h-6 bg-stone-200 self-center mx-1" />
      )}

      {/* Level filters */}
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onLevelChange(activeLevel === level ? null : level)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            activeLevel === level
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {level}
        </button>
      ))}

      {/* Sort button */}
      {onSortChange && (
        <>
          <div className="w-px h-6 bg-stone-200 self-center mx-1" />
          <button
            onClick={() => onSortChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 flex items-center gap-1.5"
          >
            <SortIcon />
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
        </>
      )}
    </div>
  );
};

const HeartIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const SortIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
);

export default FilterBar;
