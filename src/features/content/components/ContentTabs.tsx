import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UI_TRANSLATIONS } from '../../../shared/constants';
import { TopicPoint, VocabularyItem } from '../../../shared/types';

interface ContentTabsProps {
  summary: string;
  translatedSummary?: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  transcript?: { text: string; duration: number; offset: number }[];
  onTimestampClick?: (offset: number) => void;
  isLoading: boolean;
  targetLang: string;
  layoutMode?: 'fixed' | 'auto';
  currentTime?: number;
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
            className={`${hasTranslation ? 'cursor-pointer group/trans' : ''} relative transition-all inline-block ${className}`}
        >
            <span className={isBlock ? "block" : "inline"}>
               {main}
               {hasTranslation && (
                   <span className="ml-1.5 opacity-0 group-hover/trans:opacity-100 transition-opacity text-[10px] text-gray-400 border border-gray-200 px-1 rounded hover:bg-gray-50">
                       {label || "文"}
                   </span>
               )}
            </span>
            
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

const ContentTabs: React.FC<ContentTabsProps> = ({ summary, translatedSummary, topics, vocabulary, transcript, onTimestampClick, isLoading, targetLang, layoutMode = 'fixed', currentTime = 0 }) => {
  const [activeTab, setActiveTab] = useState<'outline' | 'vocab' | 'transcript'>('outline');
  const uiText = UI_TRANSLATIONS[targetLang] || UI_TRANSLATIONS['English'];

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTranscriptRef = useRef<HTMLDivElement>(null);
  const [showLocateBtn, setShowLocateBtn] = useState(false);
  // We use a ref to track if the user has manually scrolled away to avoid jittery auto-scrolling
  const isUserScrolling = useRef(false);

  // --- CUSTOM SVG ICONS ---
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

  // Auto-scroll logic
  useEffect(() => {
    if (activeTab === 'transcript' && activeTranscriptRef.current && !isUserScrolling.current) {
        activeTranscriptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeTranscriptIndex, activeTab]);

  const handleScroll = () => {
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
        // We don't automatically set isUserScrolling to false here, 
        // because we want to wait for user to explicitly click "Locate" 
        // to resume auto-scrolling if they were just scrolling around.
        // Or we can reset it if they scroll BACK to the element manually.
        if (!isOutside) {
             // If they manually scrolled back, re-enable auto-scroll? 
             // Let's keep it simple: once detached, stay detached until button click.
        }
    }
  };

  const scrollToCurrent = () => {
      if (activeTranscriptRef.current) {
          isUserScrolling.current = false;
          setShowLocateBtn(false);
          activeTranscriptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  const containerClasses = layoutMode === 'fixed' 
    ? "bg-[#FCFCFC] h-full flex flex-col overflow-hidden shadow-sm rounded-xl border border-gray-200"
    : "bg-[#FCFCFC] flex flex-col overflow-hidden shadow-sm rounded-xl border border-gray-200";

  const contentAreaClasses = layoutMode === 'fixed'
    ? "flex-1 overflow-y-auto p-2 scrollbar-hide relative"
    : "p-2 relative";

  return (
    <div className={containerClasses}>
      {/* Tab Header - Notion Style */}
      <div className="flex px-2 pt-2 gap-1 bg-transparent border-b border-gray-100 flex-nowrap overflow-x-auto shrink-0 mb-1">
        <button
          onClick={() => setActiveTab('outline')}
          className={`px-3 py-2 text-[14px] rounded-md transition-all whitespace-nowrap ${
            activeTab === 'outline' 
              ? 'text-gray-900 bg-gray-100 font-medium' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          Outline
        </button>
        <button
          onClick={() => setActiveTab('vocab')}
          className={`px-3 py-2 text-[14px] rounded-md transition-all whitespace-nowrap ${
            activeTab === 'vocab' 
              ? 'text-gray-900 bg-gray-100 font-medium' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          Vocabulary
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-3 py-2 text-[14px] rounded-md transition-all whitespace-nowrap ${
            activeTab === 'transcript' 
              ? 'text-gray-900 bg-gray-100 font-medium' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          Transcript
        </button>
      </div>

      {/* Content Area */}
      <div 
        className={contentAreaClasses}
        ref={scrollContainerRef}
        onScroll={activeTab === 'transcript' ? handleScroll : undefined}
      >
        
        {isLoading ? (
           // SKELETON LOADING
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
        ) : (
            <>
                {activeTab === 'outline' ? (
                  <div className="flex flex-col space-y-0.5 px-2 py-2">
                    {/* Summary Section */}
                    {summary && (
                        <div className="mb-4 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</h3>
                            <div className="text-[14px] text-gray-700 leading-relaxed">
                                <BilingualText main={summary} translated={translatedSummary} />
                            </div>
                        </div>
                    )}

                    {topics.length > 0 && topics.map((topic, index) => {
                        const ms = parseTimestamp(topic.timestamp);
                        return (
                            <div 
                                key={index} 
                                className="group flex gap-3 p-2 rounded-lg hover:bg-gray-100/80 transition-all cursor-pointer items-start"
                                onClick={() => onTimestampClick && onTimestampClick(ms)}
                            >
                                <div className="shrink-0 pt-0.5">
                                    <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 group-hover:border-gray-200 transition-colors">
                                        {topic.timestamp}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[15px] font-medium text-gray-800 leading-snug mb-1 group-hover:text-black">
                                        {topic.title}
                                    </h3>
                                    <div className="text-[13px] text-gray-500 leading-relaxed font-light">
                                        <BilingualText main={topic.description} translated={topic.translatedDescription} />
                                    </div>
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
                      <div key={index} className="group p-3 rounded-lg border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm transition-all">
                        <div className="flex justify-between items-baseline mb-1">
                          <BilingualText 
                              main={item.word} 
                              translated={item.translatedWord || ''}
                              className="font-medium text-gray-800 text-[15px]" 
                          />
                          <div className="text-gray-300 group-hover:text-gray-400 transition-colors shrink-0">
                            <StarfishIcon />
                          </div>
                        </div>
                        <div className="text-gray-600 text-[13px] mb-2 leading-relaxed">
                             <BilingualText main={item.definition} translated={item.translatedDefinition} />
                        </div>
                        <div className="text-[12px] text-gray-400 pl-2 border-l-2 border-gray-100 italic">
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
                                <span>Locate current</span>
                            </button>
                        )}

                        {transcript && transcript.length > 0 ? transcript.map((seg, i) => {
                            const isActive = i === activeTranscriptIndex;
                            return (
                                <div 
                                    key={i} 
                                    ref={isActive ? activeTranscriptRef : null}
                                    className={`
                                        group flex gap-3 p-3 rounded-lg transition-all cursor-pointer items-start
                                        ${isActive 
                                            ? 'bg-stone-100 border-l-4 border-stone-800 shadow-sm' 
                                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                                        }
                                    `}
                                    onClick={() => onTimestampClick && onTimestampClick(seg.offset)}
                                >
                                    <span className={`text-[11px] font-mono pt-0.5 shrink-0 w-10 ${isActive ? 'text-stone-600 font-bold' : 'text-gray-400'}`}>
                                        {new Date(seg.offset).toISOString().substr(14, 5)}
                                    </span>
                                    <p className={`text-[14px] leading-relaxed ${isActive ? 'text-stone-900 font-medium' : 'text-gray-700'}`}>
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
