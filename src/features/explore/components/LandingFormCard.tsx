import React from 'react';
import { LANGUAGES, LEVELS } from '../../../shared/constants';

interface LandingFormCardProps {
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
}

const ChevronDownIcon = () => (
  <svg
    className="w-4 h-4 text-zinc-500 pointer-events-none absolute right-3 sm:right-4 top-1/2 -translate-y-1/2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const LandingFormCard: React.FC<LandingFormCardProps> = ({
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
}) => {
  return (
    <div className="w-full h-full bg-[#FAF9F6] p-4 sm:p-6 md:p-8 border border-stone-200 shadow-sm rounded-xl sm:rounded-2xl space-y-4 sm:space-y-5 text-left overflow-y-auto">
      {/* Header */}
      <div className="text-center space-y-1 sm:space-y-2 pb-1 sm:pb-2">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-stone-800 tracking-tight">
          Bilibala
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
          Turn any YouTube video into a structured language lesson.
        </p>
      </div>

      {/* Language Selectors */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1 sm:space-y-1.5">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            I Speak
          </label>
          <div className="relative group">
            <select
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              className="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-xs sm:text-sm rounded-lg py-2 sm:py-2.5 px-2.5 sm:px-3 pr-7 sm:pr-8 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all cursor-pointer hover:bg-stone-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon />
          </div>
        </div>

        <div className="space-y-1 sm:space-y-1.5">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            I'm Learning
          </label>
          <div className="relative group">
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-xs sm:text-sm rounded-lg py-2 sm:py-2.5 px-2.5 sm:px-3 pr-7 sm:pr-8 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all cursor-pointer hover:bg-stone-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon />
          </div>
        </div>

        {/* Depth Level - full width on all screens */}
        <div className="col-span-2 space-y-1 sm:space-y-1.5">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            Depth Level
          </label>
          <div className="flex bg-white p-1 rounded-lg border border-stone-200 gap-1">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`flex-1 py-1.5 sm:py-2 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                  level === l.id
                    ? 'bg-[#FAF9F6] text-stone-800 shadow-sm border border-stone-200'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* URL Input */}
      <div className="space-y-1 sm:space-y-1.5 pt-1 sm:pt-2">
        <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
          Source Material
        </label>
        <input
          type="text"
          className="w-full bg-white border border-stone-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-200 transition-all rounded-lg shadow-sm"
          placeholder="Paste YouTube Link..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>

      {/* Error Message — inline under input, no extra vertical space */}
      {errorMsg && (
        <div className="-mt-2 sm:-mt-3 text-red-500 text-[10px] sm:text-[11px] font-medium leading-tight px-1">
          {errorMsg}
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={onStart}
        disabled={!videoUrl}
        className="w-full bg-stone-800 text-white font-medium py-2.5 sm:py-3 text-sm rounded-lg shadow-md hover:bg-stone-900 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-[0.98]"
      >
        Start
      </button>
    </div>
  );
};

export default LandingFormCard;
