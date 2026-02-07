import React from 'react';
import { LANGUAGES, LEVELS } from '../../../shared/constants';
import GlassDropdown from '../../../shared/components/GlassDropdown';

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

const languageOptions = LANGUAGES.map((l) => ({ value: l.name, label: l.name }));

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
    <div className="w-full bg-white/50 backdrop-blur-2xl p-4 sm:p-5 border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03] rounded-2xl space-y-3 sm:space-y-3.5 text-left">
      {/* Header */}
      <div className="text-center space-y-0.5 pb-0.5">
        <h2 className="text-lg sm:text-xl md:text-2xl font-serif text-stone-800 tracking-tight">
          Bilibala
        </h2>
        <p className="text-[11px] sm:text-xs text-stone-500 leading-relaxed">
          Turn any YouTube video into a structured language lesson.
        </p>
      </div>

      {/* Language Selectors */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="space-y-0.5 sm:space-y-1">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            I Speak
          </label>
          <GlassDropdown
            value={nativeLang}
            onChange={setNativeLang}
            options={languageOptions}
          />
        </div>

        <div className="space-y-0.5 sm:space-y-1">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            I'm Learning
          </label>
          <GlassDropdown
            value={targetLang}
            onChange={setTargetLang}
            options={languageOptions}
          />
        </div>

        {/* Depth Level - full width on all screens */}
        <div className="col-span-2 space-y-0.5 sm:space-y-1">
          <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
            Depth Level
          </label>
          <div className="flex bg-white/40 backdrop-blur-sm p-1 rounded-xl border border-white/60 ring-1 ring-black/[0.04] gap-1">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`flex-1 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${
                  level === l.id
                    ? 'bg-white/70 backdrop-blur-sm text-stone-800 shadow-sm ring-1 ring-black/[0.04]'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-white/40'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* URL Input with inline submit */}
      <div className="space-y-0.5 sm:space-y-1">
        <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">
          Source Material
        </label>
        <div className="relative">
          <input
            type="text"
            className="w-full bg-white/60 backdrop-blur-sm border border-white/60 pl-3 sm:pl-4 pr-12 py-2 sm:py-2.5 text-base sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-200 transition-all rounded-xl ring-1 ring-black/[0.04] shadow-sm"
            placeholder="Paste YouTube Link..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && videoUrl) onStart(); }}
          />
          <button
            onClick={onStart}
            disabled={!videoUrl}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-stone-800 text-white shadow-sm hover:bg-stone-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      <div className="min-h-[16px] -mt-1.5">
        {errorMsg && (
          <span className="text-red-500 text-[10px] sm:text-[11px] font-medium leading-tight px-1">
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
};

export default LandingFormCard;
