import React from 'react';

interface ReportsFilterChipsProps {
  languages: string[];
  levels: string[];
  topics: string[];
  activeLanguage: string | null;
  activeLevel: string | null;
  activeTopic: string | null;
  onLanguageChange: (lang: string | null) => void;
  onLevelChange: (level: string | null) => void;
  onTopicChange: (topic: string | null) => void;
  showFavoritesOnly: boolean;
  onFavoritesChange: (show: boolean) => void;
  favoritesCount: number;
}

const ReportsFilterChips: React.FC<ReportsFilterChipsProps> = ({
  languages,
  levels,
  topics,
  activeLanguage,
  activeLevel,
  activeTopic,
  onLanguageChange,
  onLevelChange,
  onTopicChange,
  showFavoritesOnly,
  onFavoritesChange,
  favoritesCount,
}) => {
  const chipBase = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap';
  const chipActive = 'bg-stone-800 text-white border-stone-800';
  const chipInactive = 'bg-white/50 text-stone-600 border-stone-200 hover:bg-white/80 hover:border-stone-300';
  const isAllActive = !activeLanguage && !activeLevel && !activeTopic && !showFavoritesOnly;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* All chip */}
      <button
        onClick={() => { onLanguageChange(null); onLevelChange(null); onTopicChange(null); onFavoritesChange(false); }}
        className={`${chipBase} ${isAllActive ? chipActive : chipInactive}`}
      >
        All
      </button>

      {/* Favorites chip */}
      {favoritesCount > 0 && (
        <>
          <button
            onClick={() => onFavoritesChange(!showFavoritesOnly)}
            className={`${chipBase} flex items-center gap-1.5 ${showFavoritesOnly ? 'bg-rose-500 text-white border-rose-500' : chipInactive}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            Favorites
            <span className={`text-[10px] ${showFavoritesOnly ? 'text-white/70' : 'text-stone-400'}`}>{favoritesCount}</span>
          </button>
          <div className="w-px bg-stone-200 my-1 flex-shrink-0" />
        </>
      )}

      {/* Language chips */}
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => onLanguageChange(activeLanguage === lang ? null : lang)}
          className={`${chipBase} ${activeLanguage === lang ? chipActive : chipInactive}`}
        >
          {lang}
        </button>
      ))}

      {/* Separator between languages and levels */}
      {languages.length > 0 && levels.length > 0 && (
        <div className="w-px bg-stone-200 my-1 flex-shrink-0" />
      )}

      {/* Level chips */}
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onLevelChange(activeLevel === level ? null : level)}
          className={`${chipBase} ${activeLevel === level ? chipActive : chipInactive}`}
        >
          {level}
        </button>
      ))}

      {/* Separator between levels and topics */}
      {topics.length > 0 && (languages.length > 0 || levels.length > 0) && (
        <div className="w-px bg-stone-200 my-1 flex-shrink-0" />
      )}

      {/* Topic chips */}
      {topics.map((topic) => (
        <button
          key={topic}
          onClick={() => onTopicChange(activeTopic === topic ? null : topic)}
          className={`${chipBase} ${activeTopic === topic ? chipActive : chipInactive}`}
        >
          {topic}
        </button>
      ))}
    </div>
  );
};

export default ReportsFilterChips;
