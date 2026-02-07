import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI_TRANSLATIONS } from '../../../shared/constants';
import { useTTS } from '../../../shared/hooks/useTTS';
import { TopicPoint, VocabularyItem } from '../../../shared/types';
import DinoGame from './DinoGame';

interface ContentTabsProps {
  summary: string;
  translatedSummary?: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  transcript?: { text: string; duration: number; offset: number }[];
  onTimestampClick?: (offset: number) => void;
  isLoading: boolean;
  targetLang: string;
  nativeLang?: string;
  level?: string;
  layoutMode?: 'fixed' | 'auto';
  currentTime?: number;
  transcriptLangMismatch?: boolean;
}

const BilingualText: React.FC<{ 
    main: string; 
    translated: string; 
    label?: string; 
    className?: string;
    isBlock?: boolean;
}> = ({ main, translated, label, className = "", isBlock = false }) => {
    const [showTranslation, setShowTranslation] = useState(false);
    const hasTranslation = translated && translated.trim() !== "" && translated.trim() !== main.trim();

    return (
        <div 
            onClick={(e) => {
                if (hasTranslation) {
                    e.stopPropagation();
                    setShowTranslation(!showTranslation);
                }
            }} 
            // cursor pointer only if has translation
            className={`${hasTranslation ? 'cursor-pointer hover:underline decoration-amber-200 underline-offset-4 active:scale-95' : ''} relative transition-all inline-block ${className}`}
        >
            <span className={isBlock ? "block" : "inline"}>
               {main}
            </span>
            {hasTranslation && (
                <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1 opacity-0 group-hover/trans:opacity-100 transition-opacity text-[10px] text-gray-400 border border-gray-200 px-1 rounded hover:bg-gray-50 whitespace-nowrap">
                    {label || "文"}
                </span>
            )}
            
            {showTranslation && hasTranslation && (
                <div className="mt-1.5 p-2 bg-gray-50 border border-gray-100 rounded text-gray-600 text-[12px] animate-in fade-in slide-in-from-top-1 duration-200">
                    {translated}
                </div>
            )}
        </div>
    );
};

// Helper to parse "MM:SS" to milliseconds
const parseTimestamp = (ts: string): number => {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
};

const ContentTabs: React.FC<ContentTabsProps> = ({ summary, translatedSummary, topics, vocabulary, transcript, onTimestampClick, isLoading, targetLang, nativeLang, level = 'Medium', layoutMode = 'fixed', currentTime = 0, transcriptLangMismatch = false }) => {
  const [activeTab, setActiveTab] = useState<'outline' | 'vocab' | 'transcript'>('outline');
  const { speak, currentText } = useTTS(targetLang);

  // Determine which language to use for UI based on level
  const isEasy = level.toLowerCase() === 'easy';
  const uiLang = isEasy ? (nativeLang || 'English') : targetLang;
  const uiText = UI_TRANSLATIONS[uiLang] || UI_TRANSLATIONS['English'];

  const [showDinoGame, setShowDinoGame] = useState(false);
  const [showLangMismatchInfo, setShowLangMismatchInfo] = useState(false);
  const langInfoBtnRef = useRef<HTMLButtonElement>(null);
  const nativeUiText = UI_TRANSLATIONS[nativeLang || 'English'] || UI_TRANSLATIONS['English'];
  const mismatchMsg = nativeUiText.transcriptMismatch.replace('{lang}', targetLang);

  useEffect(() => {
    if (!isLoading) {
      setShowDinoGame(false);
      return;
    }
    const timer = setTimeout(() => setShowDinoGame(true), 15000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTranscriptRef = useRef<HTMLDivElement>(null);
  const [showLocateBtn, setShowLocateBtn] = useState(false);
  // We use a ref to track if the user has manually scrolled away to avoid jittery auto-scrolling
  const isUserScrolling = useRef(false);

  // --- CUSTOM SVG ICONS ---
  const SpeakerIcon: React.FC<{ isPlaying?: boolean }> = ({ isPlaying }) => (
    <svg className={`w-4 h-4 ${isPlaying ? 'text-amber-500' : 'text-stone-400 group-hover:text-stone-600'}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {isPlaying ? (
        <>
          <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  );

  const StarfishIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const LocateIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3V5M12 19V21M21 12H19M5 12H3M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12ZM12 12H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const activeTranscriptIndex = useMemo(() => {
    if (!transcript || transcript.length === 0) return -1;
    const ms = currentTime * 1000;
    
    // Find segment that contains current time
    return transcript.findIndex((seg, i) => {
        const nextSeg = transcript[i + 1];
        const end = nextSeg ? nextSeg.offset : Infinity;
        return ms >= seg.offset && ms < end;
    });
  }, [transcript, currentTime]);

  // Scroll the active transcript element to the center of the container only
  const isProgrammaticScroll = useRef(false);

  const scrollToActive = useCallback(() => {
    const container = scrollContainerRef.current;
    const activeEl = activeTranscriptRef.current;
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    // Calculate offset to center the active element within the container
    const offset = activeRect.top - containerRect.top - (containerRect.height / 2) + (activeRect.height / 2);

    isProgrammaticScroll.current = true;
    container.scrollBy({ top: offset, behavior: 'smooth' });
    setTimeout(() => {
        isProgrammaticScroll.current = false;
    }, 500);
  }, []);

  // Auto-scroll when active transcript changes
  useEffect(() => {
    if (activeTab === 'transcript' && activeTranscriptRef.current && !isUserScrolling.current) {
        scrollToActive();
    }
  }, [activeTranscriptIndex, activeTab, scrollToActive]);

  const handleScroll = () => {
    // Ignore scroll events triggered by programmatic scrollIntoView
    if (isProgrammaticScroll.current) return;

    if (!scrollContainerRef.current || !activeTranscriptRef.current) return;

    const container = scrollContainerRef.current;
    const activeEl = activeTranscriptRef.current;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    // Check if active element is outside the visible area
    const isOutside = activeRect.bottom < containerRect.top || activeRect.top > containerRect.bottom;

    if (isOutside) {
        setShowLocateBtn(true);
        isUserScrolling.current = true;
    } else {
        setShowLocateBtn(false);
        // User scrolled back to the active element, re-enable auto-scroll
        isUserScrolling.current = false;
    }
  };

  const scrollToCurrent = () => {
      if (activeTranscriptRef.current) {
          isUserScrolling.current = false;
          setShowLocateBtn(false);
          scrollToActive();
      }
  };

  const containerClasses = layoutMode === 'fixed'
    ? "bg-white/50 backdrop-blur-2xl h-full flex flex-col overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl border border-white/60 ring-1 ring-black/[0.03]"
    : "bg-white/50 backdrop-blur-2xl flex flex-col overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl border border-white/60 ring-1 ring-black/[0.03]";

  const contentAreaClasses = layoutMode === 'fixed'
    ? "flex-1 overflow-y-auto p-2 scrollbar-hide relative"
    : "p-2 relative";

  return (
    <div className={containerClasses}>
      {/* Tab Header - Notion Style */}
      <div className="flex px-2 pt-2 gap-1 bg-white/30 border-b border-white/40 flex-nowrap overflow-x-auto shrink-0 mb-1">
        <button
          onClick={() => setActiveTab('outline')}
          className={`px-3 py-2 text-[14px] rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'outline'
              ? 'text-stone-800 bg-white/60 backdrop-blur-sm font-medium shadow-sm ring-1 ring-black/[0.04]'
              : 'text-stone-400 hover:bg-white/30 hover:text-stone-600'
          }`}
        >
          {uiText.outlineTab}
        </button>
        <button
          onClick={() => setActiveTab('vocab')}
          className={`px-3 py-2 text-[14px] rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'vocab'
              ? 'text-stone-800 bg-white/60 backdrop-blur-sm font-medium shadow-sm ring-1 ring-black/[0.04]'
              : 'text-stone-400 hover:bg-white/30 hover:text-stone-600'
          }`}
        >
          {uiText.vocabularyTab}
        </button>
        <div className="relative flex items-center">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-3 py-2 text-[14px] rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'transcript'
                ? 'text-stone-800 bg-white/60 backdrop-blur-sm font-medium shadow-sm ring-1 ring-black/[0.04]'
                : 'text-stone-400 hover:bg-white/30 hover:text-stone-600'
            }`}
          >
            {uiText.transcriptTab}
          </button>
          {transcriptLangMismatch && (
            <button
              ref={langInfoBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowLangMismatchInfo(!showLangMismatchInfo); }}
              className="ml-0.5 p-0.5 text-amber-500 hover:text-amber-600 transition-colors"
              title="Language info"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          {showLangMismatchInfo && langInfoBtnRef.current && (() => {
            const rect = langInfoBtnRef.current!.getBoundingClientRect();
            return (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowLangMismatchInfo(false)} />
                <div
                  className="fixed z-[9999] bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-700 text-[11px] leading-snug shadow-lg w-56"
                  style={{ top: rect.bottom + 4, left: rect.left }}
                >
                  {mismatchMsg}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Content Area */}
      <div 
        className={contentAreaClasses}
        ref={scrollContainerRef}
        onScroll={activeTab === 'transcript' ? handleScroll : undefined}
      >
        
        {isLoading ? (
           showDinoGame ? (
             // DINO GAME after 15s wait
             <div className="flex flex-col items-center px-2 py-4 h-full">
               <div className="flex-1 w-full">
                 <DinoGame />
               </div>
               <div className="flex items-center gap-2 mt-3 mb-1">
                 <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                 <p className="text-gray-400 text-xs">{uiText.generatingContent}</p>
               </div>
             </div>
           ) : (
             // SKELETON LOADING (first 15s)
             <div className="flex flex-col space-y-4 px-2 py-4">
                 {activeTab === 'outline' && (
                     <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm space-y-2">
                         <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                         <div className="h-4 w-full bg-gray-100 rounded animate-pulse"></div>
                         <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse"></div>
                     </div>
                 )}
                 {[1, 2, 3, 4].map(i => (
                     <div key={i} className="flex gap-3 p-2">
                         <div className="h-4 w-10 bg-gray-100 rounded animate-pulse shrink-0"></div>
                         <div className="flex-1 space-y-2">
                             <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse"></div>
                             <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse"></div>
                         </div>
                     </div>
                 ))}
             </div>
           )
        ) : (
            <>
                {activeTab === 'outline' ? (
                  <div className="flex flex-col space-y-0.5 px-2 py-2">
                    {/* Summary Section */}
                    {summary && (
                        <div className="mb-3 p-3.5 rounded-xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]">
                            <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">{uiText.summary}</h3>
                            <div className="text-[14px] text-stone-600 leading-relaxed">
                                <BilingualText main={summary} translated={translatedSummary} />
                            </div>
                        </div>
                    )}

                    {topics.length > 0 && (
                      <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-1 mt-1 mb-1">{uiText.chapters}</h3>
                    )}
                    {topics.length > 0 && topics.map((topic, index) => {
                        const ms = parseTimestamp(topic.timestamp);
                        return (
                            <div
                                key={index}
                                className="group flex gap-3 p-2.5 rounded-xl transition-all cursor-pointer items-start border border-transparent hover:border-white/60 hover:bg-white/40 hover:backdrop-blur-xl hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:ring-1 hover:ring-black/[0.03] active:scale-[0.99]"
                                onClick={() => onTimestampClick && onTimestampClick(ms)}
                            >
                                <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
                                    <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 transition-colors">
                                        {topic.timestamp}
                                    </span>
                                    <svg className="w-3 h-3 text-amber-300 group-hover:text-amber-600 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[14px] font-medium text-stone-700 leading-snug mb-0.5 group-hover:text-stone-900">
                                        {topic.title}
                                    </h3>
                                    <p className="text-[12px] text-stone-400 leading-relaxed line-clamp-2">
                                        {topic.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    
                    {topics.length === 0 && (
                        <div className="text-center py-16 px-4">
                            <div className="text-gray-300 mb-2">
                                <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm">Empty outline</p>
                        </div>
                    )}
                  </div>
                ) : activeTab === 'vocab' ? (
                  <div className="grid grid-cols-1 gap-2 px-2 py-2">
                    {vocabulary.map((item, index) => (
                      <div key={index} className="group p-3 rounded-xl border border-transparent hover:border-white/60 hover:bg-white/40 hover:backdrop-blur-xl hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:ring-1 hover:ring-black/[0.03] transition-all">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center">
                            <BilingualText
                                main={item.word}
                                translated={item.translatedWord || ''}
                                className="font-medium text-stone-800 text-[15px]"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(item.word);
                              }}
                              className="ml-2 p-1.5 rounded-full hover:bg-stone-100 transition-colors relative z-10"
                              title="Listen to pronunciation"
                            >
                              <SpeakerIcon isPlaying={currentText === item.word} />
                            </button>

                          </div>
                        </div>
                        <div className="text-stone-600 text-[13px] mb-2 leading-relaxed">
                             <BilingualText main={item.definition} translated={item.translatedDefinition} />
                        </div>
                        <div className="text-[12px] text-stone-400 pl-2 border-l-2 border-stone-200 italic">
                          <BilingualText main={item.context} translated={item.translatedContext} />
                        </div>
                      </div>
                    ))}
                    {vocabulary.length === 0 && (
                        <div className="text-center py-16 px-4">
                            <p className="text-gray-400 text-sm">No vocabulary words</p>
                        </div>
                    )}
                  </div>
                ) : (
                    // TRANSCRIPT TAB
                    <div className="relative flex flex-col space-y-1 px-2 py-2">
                        {/* Locate Button - Floating */}
                        {showLocateBtn && (
                            <button
                                onClick={scrollToCurrent}
                                className="sticky top-2 z-10 self-center bg-stone-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-stone-900 transition-all animate-in fade-in zoom-in duration-200 mb-2"
                            >
                                <LocateIcon />
                                <span>{uiText.locateCurrent}</span>
                            </button>
                        )}

                        {transcript && transcript.length > 0 ? transcript.map((seg, i) => {
                            const isActive = i === activeTranscriptIndex;
                            return (
                                <div 
                                    key={i} 
                                    ref={isActive ? activeTranscriptRef : null}
                                    className={`
                                        group flex gap-3 p-3 rounded-xl transition-all cursor-pointer items-start
                                        ${isActive
                                            ? 'bg-white/50 backdrop-blur-sm border-l-4 border-amber-700/50 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]'
                                            : 'hover:bg-white/30 border-l-4 border-transparent'
                                        }
                                    `}
                                    onClick={() => onTimestampClick && onTimestampClick(seg.offset)}
                                >
                                    <span className={`text-[11px] font-mono pt-0.5 shrink-0 w-10 ${isActive ? 'text-amber-700 font-bold' : 'text-stone-400'}`}>
                                        {new Date(seg.offset).toISOString().substr(14, 5)}
                                    </span>
                                    <p className={`text-[14px] leading-relaxed ${isActive ? 'text-stone-800 font-medium' : 'text-stone-600'}`}>
                                        {seg.text}
                                    </p>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-16 px-4">
                                <p className="text-gray-400 text-sm">No transcript available</p>
                            </div>
                        )}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default ContentTabs;
