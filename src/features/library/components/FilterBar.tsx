import React from 'react';

interface FilterBarProps {
  languages: string[];
  levels: string[];
  activeLanguage: string | null;
  activeLevel: string | null;
  onLanguageChange: (lang: string | null) => void;
  onLevelChange: (level: string | null) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  languages,
  levels,
  activeLanguage,
  activeLevel,
  onLanguageChange,
  onLevelChange,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => {
          onLanguageChange(null);
          onLevelChange(null);
        }}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          !activeLanguage && !activeLevel
            ? 'bg-stone-800 text-white border-stone-800'
            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
        }`}
      >
        All
      </button>

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
    </div>
  );
};

export default FilterBar;
