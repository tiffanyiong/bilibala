import React, { useState } from 'react';
import { UI_TRANSLATIONS } from '../../../shared/constants';
import { TopicPoint, VocabularyItem } from '../../../shared/types';

interface ContentTabsProps {
  summary: string;
  translatedSummary?: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  isLoading: boolean;
  targetLang: string;
  layoutMode?: 'fixed' | 'auto';
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
            onClick={() => hasTranslation && setShowTranslation(!showTranslation)} 
            className={`${hasTranslation ? 'cursor-pointer group' : ''} relative transition-all ${className}`}
        >
            <div className={isBlock ? "block" : "inline"}>
               {main}
               {hasTranslation && label && <span className="ml-2 text-[10px] text-pink-600 font-bold bg-pink-100 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Translate</span>}
            </div>
            
            {showTranslation && hasTranslation && (
                <div className={`mt-2 text-zinc-600 bg-zinc-50 p-3 rounded-lg text-sm animate-fadeIn border border-zinc-200`}>
                    {translated}
                </div>
            )}
        </div>
    );
};

const ContentTabs: React.FC<ContentTabsProps> = ({ summary, translatedSummary, topics, vocabulary, isLoading, targetLang, layoutMode = 'fixed' }) => {
  const [activeTab, setActiveTab] = useState<'content' | 'vocab'>('content');
  const uiText = UI_TRANSLATIONS[targetLang] || UI_TRANSLATIONS['English'];

  // --- CUSTOM SVG ICONS (NO EMOJIS) ---
  const ShellIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 21V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 21C9 18 8 15 8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 21C15 18 16 15 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const StarfishIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const BubbleIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 8C15 6 13 6 13 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  if (isLoading) {
    return (
      <div className={`bg-white/40 backdrop-blur-xl rounded-[2rem] p-6 flex flex-col shadow-xl border border-white/50 ${layoutMode === 'fixed' ? 'h-full' : 'min-h-[400px]'}`}>
        <div className="flex gap-4 mb-6">
           <div className="h-12 w-32 bg-white/50 rounded-full animate-pulse"></div>
           <div className="h-12 w-32 bg-white/50 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-4 flex-1">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white/40 rounded-3xl animate-pulse"></div>
            ))}
        </div>
      </div>
    );
  }

    const containerClasses = layoutMode === 'fixed' 
    ? "bg-white h-full flex flex-col overflow-hidden shadow-sm rounded-2xl border border-zinc-200"
    : "bg-white flex flex-col overflow-hidden shadow-sm rounded-2xl border border-zinc-200";

  const contentAreaClasses = layoutMode === 'fixed'
    ? "flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide relative"
    : "p-5 space-y-5 relative";

  return (
    <div className={containerClasses}>
      {/* Tab Header - Minimal */}
      <div className="flex p-2 gap-2 bg-zinc-50 border-b border-zinc-100 flex-nowrap overflow-x-auto">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap min-w-[120px] ${
            activeTab === 'content' 
              ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' 
              : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <ShellIcon /> {uiText.outline}
        </button>
        <button
          onClick={() => setActiveTab('vocab')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap min-w-[120px] ${
            activeTab === 'vocab' 
              ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' 
              : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <StarfishIcon /> {uiText.slang}
        </button>
      </div>

      {/* Content Area */}
      <div className={contentAreaClasses}>
        
        {activeTab === 'content' ? (
          <div className="space-y-6">
            {/* Summary Section */}
            <div className="p-6 bg-white rounded-xl border border-zinc-200 shadow-sm">
                <h4 className="font-serif text-zinc-800 text-lg mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                        <BubbleIcon />
                    </div>
                    Start Here
                </h4>
                <div className="text-zinc-600 font-sans text-[15px] leading-relaxed">
                    <BilingualText 
                        main={summary} 
                        translated={translatedSummary || ""} 
                        label="Translate"
                        isBlock
                        className="font-normal"
                    />
                </div>
            </div>

            {/* Topics Section */}
            <div>
                <h4 className="font-serif text-zinc-800 text-lg mb-3 px-1">
                    Journey Steps
                </h4>
                <div className="space-y-3">
                    {topics.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex gap-4 p-5 bg-white rounded-xl items-start border border-zinc-200 hover:border-zinc-300 transition-all group"
                      >
                        <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 shrink-0 border border-zinc-200">
                            <span className="font-serif text-base">{index + 1}</span>
                        </div>
                        <div className="flex-1 pt-0.5">
                            <h5 className="font-bold text-zinc-800 text-[15px] font-sans mb-1.5">
                                <BilingualText main={item.title} translated={item.translatedTitle} />
                            </h5>
                            <div className="text-zinc-500 text-sm leading-relaxed font-normal">
                                <BilingualText main={item.description} translated={item.translatedDescription} isBlock />
                            </div>
                        </div>
                      </div>
                    ))}
                </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {vocabulary.map((item, index) => (
              <div key={index} className="p-5 bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-serif text-zinc-900 text-xl">{item.word}</span>
                  <div className="bg-zinc-50 text-zinc-400 p-1.5 rounded-lg">
                    <StarfishIcon />
                  </div>
                </div>
                <div className="text-zinc-600 text-[15px] mb-3 bg-zinc-50/50 p-3 rounded-lg border border-zinc-100">
                     <BilingualText main={item.definition} translated={item.translatedDefinition} label="?" />
                </div>
                <div className="text-sm text-zinc-500 bg-zinc-50 px-4 py-3 rounded-lg border border-zinc-100 italic">
                  <BilingualText main={item.context} translated={item.translatedContext} />
                </div>
              </div>
            ))}
            {vocabulary.length === 0 && (
                <div className="text-center p-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    <p className="text-zinc-400 text-sm">No vocabulary words found.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentTabs;