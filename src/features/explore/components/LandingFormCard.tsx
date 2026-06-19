import React, { useState, useRef, useEffect } from 'react';
import { LEVELS } from '../../../shared/constants';
import GlassDropdown from '../../../shared/components/GlassDropdown';
import { useAppConfig } from '../../../shared/hooks/useAppConfig';

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
  onRandomPractice: () => void;
  randomPracticeDisabled?: boolean;
  randomPracticeLoading?: boolean;
  errorMsg: string;
}

const RANDOM_PRACTICE_PROMPTS = [
  'No thoughts, just talk',
  'I just wanna speak',
  'Pick for me',
  'Spin a topic',
];

const ROLLING_PROMPT_STEP_MS = 180;
const ROLLING_PROMPT_STEPS = 3;

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
  onRandomPractice,
  randomPracticeDisabled = false,
  randomPracticeLoading = false,
  errorMsg,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [randomPromptIndex, setRandomPromptIndex] = useState(0);
  const [isPromptRolling, setIsPromptRolling] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const promptRollTimeoutRefs = useRef<number[]>([]);
  const { enabledNativeLanguages, enabledTargetLanguages } = useAppConfig();
  const randomPracticeLabel = RANDOM_PRACTICE_PROMPTS[randomPromptIndex];

  // Map to dropdown options
  // Filter out the selected target language from native language options
  const nativeLanguageOptions = enabledNativeLanguages
    .filter((l) => l.name !== targetLang)
    .map((l) => ({ value: l.name, label: l.name }));

  // Filter out the selected native language from target language options
  const targetLangOptions = enabledTargetLanguages
    .filter((l) => l.name !== nativeLang)
    .map((l) => ({ value: l.name, label: l.name }));

  // Close settings panel when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const clearPromptRollTimers = () => {
    promptRollTimeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    promptRollTimeoutRefs.current = [];
  };

  useEffect(() => clearPromptRollTimers, []);

  const rollRandomPracticePrompt = () => {
    if (randomPracticeDisabled || randomPracticeLoading || isPromptRolling) return;

    clearPromptRollTimers();
    setIsPromptRolling(true);

    for (let step = 1; step <= ROLLING_PROMPT_STEPS; step += 1) {
      const timeoutId = window.setTimeout(() => {
        setRandomPromptIndex((current) => (current + 1) % RANDOM_PRACTICE_PROMPTS.length);
        if (step === ROLLING_PROMPT_STEPS) {
          promptRollTimeoutRefs.current = [];
          setIsPromptRolling(false);
        }
      }, ROLLING_PROMPT_STEP_MS * step);
      promptRollTimeoutRefs.current.push(timeoutId);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-2 sm:space-y-8 text-center">
      {/* Header */}
      <div className="space-y-1 sm:space-y-1.5">
        <h2 className="hidden sm:block text-4xl font-serif text-stone-800 tracking-tight">
          Bilibala
        </h2>
        <p className="mt-2 sm:mt-0 text-sm sm:text-base text-stone-400 leading-relaxed">
          Turn any YouTube video into a language lesson
        </p>
      </div>

      {/* Search Bar */}
      <div ref={settingsRef} className="relative w-full max-w-lg">
        <div className="
          relative flex flex-col
          bg-white/60 backdrop-blur-2xl
          border border-white/70
          rounded-2xl
          px-3 py-2.5
          shadow-[0_2px_20px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]
          ring-1 ring-black/[0.03]
          transition-all duration-300
          focus-within:shadow-[0_4px_28px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.04)]
          focus-within:border-stone-200/80
        ">
          {/* Row 1: URL Input */}
          <input
            type="text"
            className="
              w-full
              bg-transparent
              text-base sm:text-sm text-stone-800
              placeholder:text-stone-400
              focus:outline-none
              py-1
            "
            placeholder="Paste a YouTube link..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && videoUrl) onStart(); }}
          />

          {/* Row 2: Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            {/* Settings Icon Button */}
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`
                shrink-0 w-8 h-8 flex items-center justify-center
                rounded-lg
                transition-all duration-200 cursor-pointer
                ${settingsOpen
                  ? 'bg-stone-100 text-stone-700 shadow-sm ring-1 ring-black/[0.04]'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                }
              `}
              title="Language & level settings"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Submit / Enter Button */}
            <button
              onClick={onStart}
              disabled={!videoUrl}
              className="
                shrink-0 w-8 h-8 flex items-center justify-center
                rounded-lg
                bg-stone-800 text-white
                shadow-sm
                hover:bg-stone-900
                transition-all duration-200
                disabled:opacity-25 disabled:cursor-not-allowed
                active:scale-90
                cursor-pointer
              "
              title="Start lesson"
            >
              <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a4 4 0 014 4v1M3 10l4-4M3 10l4 4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Settings Dropdown Panel */}
        {settingsOpen && (
          <div className="
            absolute z-50 left-0 right-0 mt-1.5
            bg-white/70 backdrop-blur-2xl
            border border-white/70
            rounded-2xl
            shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.04)]
            ring-1 ring-black/[0.03]
            p-3 sm:p-3.5
            space-y-2.5
            animate-[glassDropIn_0.2s_ease-out]
          ">
            {/* I Speak */}
            <div className="space-y-0.5">
              <label className="block text-left text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-0.5">
                I Speak
              </label>
              <GlassDropdown
                value={nativeLang}
                onChange={setNativeLang}
                options={nativeLanguageOptions}
              />
            </div>

            {/* I'm Learning */}
            <div className="space-y-0.5">
              <label className="block text-left text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-0.5">
                I'm Learning
              </label>
              <GlassDropdown
                value={targetLang}
                onChange={setTargetLang}
                options={targetLangOptions}
              />
            </div>

            {/* Depth Level */}
            <div className="space-y-0.5">
              <label className="block text-left text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-0.5">
                Level
              </label>
              <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-white/60 ring-1 ring-black/[0.04] gap-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={`flex-1 py-1.5 sm:py-1 rounded-lg text-sm sm:text-xs font-medium transition-all ${
                      level === l.id
                        ? 'bg-white/80 backdrop-blur-sm text-stone-800 shadow-sm ring-1 ring-black/[0.04]'
                        : 'text-stone-500 hover:text-stone-700 hover:bg-white/40'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        <div className={errorMsg ? 'mt-2 min-h-[20px]' : 'min-h-0'}>
          {errorMsg && (
            <span className="text-red-500 text-xs font-medium leading-tight">
              {errorMsg}
            </span>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onRandomPractice}
            onMouseEnter={rollRandomPracticePrompt}
            onFocus={rollRandomPracticePrompt}
            disabled={randomPracticeDisabled}
            className="
              group inline-flex h-8 max-w-full items-center justify-center gap-1.5
              rounded-full border border-stone-200/70 bg-stone-50/80 px-3
              text-xs font-semibold text-stone-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_8px_rgba(0,0,0,0.03)]
              transition-all duration-200
              hover:border-stone-300 hover:bg-white hover:text-stone-500 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]
              active:scale-[0.98]
              disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-stone-200/70 disabled:hover:bg-stone-50/80 disabled:hover:text-stone-400 disabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_8px_rgba(0,0,0,0.03)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2
            "
            aria-label="Start a random practice session"
            title="Start a random practice session"
          >
            {randomPracticeLoading ? (
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <svg className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
              </svg>
            )}
            <span
              key={randomPracticeLoading ? 'loading' : randomPracticeLabel}
              className={`truncate ${isPromptRolling ? 'animate-[luckyTextRoll_150ms_ease-out]' : 'animate-[luckyTextSettle_180ms_ease-out]'}`}
            >
              {randomPracticeLoading ? 'Finding...' : randomPracticeLabel}
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default LandingFormCard;
