import React from 'react';

export type SortOrder = 'newest' | 'oldest';
export type ReportsFilter = 'all' | 'with_reports' | 'without_reports';

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
  reportsFilter?: ReportsFilter;
  onReportsFilterChange?: (filter: ReportsFilter) => void;
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
  reportsFilter = 'all',
  onReportsFilterChange,
}) => {
  const hasActiveFilters = activeLanguage || activeLevel || showFavoritesOnly || reportsFilter !== 'all';

  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => {
          onLanguageChange(null);
          onLevelChange(null);
          onFavoritesChange?.(false);
          onReportsFilterChange?.('all');
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

      {/* Reports filter */}
      {onReportsFilterChange && (
        <>
          <button
            onClick={() => onReportsFilterChange(reportsFilter === 'with_reports' ? 'all' : 'with_reports')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
              reportsFilter === 'with_reports'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <ReportIcon />
            With Reports
          </button>
          <button
            onClick={() => onReportsFilterChange(reportsFilter === 'without_reports' ? 'all' : 'without_reports')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
              reportsFilter === 'without_reports'
                ? 'bg-stone-600 text-white border-stone-600'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <NoReportIcon />
            No Reports
          </button>
        </>
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

const ReportIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>
);

const NoReportIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
);

export default FilterBar;
