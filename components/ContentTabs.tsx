import React, { useState } from 'react';
import { TopicPoint, VocabularyItem } from '../types';
import { UI_TRANSLATIONS } from '../constants';

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
                <div className={`mt-2 text-cyan-700 font-bold bg-cyan-50/50 p-3 rounded-xl text-sm animate-fadeIn border border-cyan-100`}>
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
    ? "bg-white/40 backdrop-blur-xl h-full flex flex-col overflow-hidden shadow-2xl shadow-cyan-900/10 rounded-[2.5rem] border border-white/60"
    : "bg-white/40 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl shadow-cyan-900/10 rounded-[2.5rem] border border-white/60";

  const contentAreaClasses = layoutMode === 'fixed'
    ? "flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide relative"
    : "p-6 space-y-6 relative";

  return (
    <div className={containerClasses}>
      {/* Glossy Tabs Header - ensure no stacking of buttons */}
      <div className="flex p-3 gap-3 bg-white/20 flex-nowrap overflow-x-auto">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-4 px-4 md:px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-sm border whitespace-nowrap min-w-[140px] ${
            activeTab === 'content' 
              ? 'bg-gradient-to-br from-yellow-300 to-yellow-400 text-yellow-900 border-yellow-200 shadow-yellow-200/50 scale-100' 
              : 'bg-white/60 text-slate-500 border-transparent hover:bg-white/80 scale-95'
          }`}
        >
          <ShellIcon /> {uiText.outline}
        </button>
        <button
          onClick={() => setActiveTab('vocab')}
          className={`flex-1 py-4 px-4 md:px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-sm border whitespace-nowrap min-w-[140px] ${
            activeTab === 'vocab' 
              ? 'bg-gradient-to-br from-pink-300 to-pink-400 text-pink-900 border-pink-200 shadow-pink-200/50 scale-100' 
              : 'bg-white/60 text-slate-500 border-transparent hover:bg-white/80 scale-95'
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
            <div className="p-8 bg-white/70 rounded-[2rem] border border-white shadow-sm backdrop-blur-md">
                <h4 className="font-bold text-cyan-700 text-2xl font-display mb-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-500">
                        <BubbleIcon />
                    </div>
                    Start Here
                </h4>
                <div className="text-slate-600 font-bold text-lg leading-relaxed">
                    <BilingualText 
                        main={summary} 
                        translated={translatedSummary || ""} 
                        label="Translate"
                        isBlock
                    />
                </div>
            </div>

            {/* Topics Section */}
            <div>
                <h4 className="font-bold text-white text-xl font-display mb-4 px-2 drop-shadow-sm">
                    Journey Steps
                </h4>
                <div className="space-y-4">
                    {topics.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex gap-5 p-6 bg-white/80 rounded-[2rem] items-start shadow-sm border-2 border-transparent hover:border-cyan-200 hover:shadow-lg transition-all group"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-cyan-200">
                            <span className="font-black font-display text-xl">{index + 1}</span>
                        </div>
                        <div className="flex-1 pt-1">
                            <h5 className="font-bold text-slate-800 text-xl font-display mb-2">
                                <BilingualText main={item.title} translated={item.translatedTitle} />
                            </h5>
                            <div className="text-slate-600 font-medium leading-relaxed">
                                <BilingualText main={item.description} translated={item.translatedDescription} isBlock />
                            </div>
                        </div>
                      </div>
                    ))}
                </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {vocabulary.map((item, index) => (
              <div key={index} className="p-6 bg-white/80 rounded-[2rem] shadow-sm border border-white hover:scale-[1.01] transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-black text-slate-800 text-2xl font-display">{item.word}</span>
                  <div className="bg-pink-100 text-pink-500 p-2 rounded-xl">
                    <StarfishIcon />
                  </div>
                </div>
                <div className="text-slate-600 font-bold text-lg mb-4 bg-white/50 p-3 rounded-xl border border-white">
                     <BilingualText main={item.definition} translated={item.translatedDefinition} label="?" />
                </div>
                <div className="text-sm text-cyan-800 bg-cyan-50/80 px-4 py-3 rounded-2xl border border-cyan-100">
                  <span className="font-bold opacity-60 mr-2 uppercase tracking-wider text-xs">Example</span>
                  <BilingualText main={item.context} translated={item.translatedContext} />
                </div>
              </div>
            ))}
            {vocabulary.length === 0 && (
                <div className="text-center p-12 bg-white/40 rounded-[2rem] border-2 border-dashed border-white">
                    <p className="text-white font-bold text-lg">Floating in an empty pool...</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentTabs;