import React from 'react';
import { VocabularyItem } from '../../../shared/types';

interface VocabularyCardProps {
  items: VocabularyItem[];
  isLoading: boolean;
}

const VocabularyCard: React.FC<VocabularyCardProps> = ({ items, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white/50 border border-white p-6 h-full flex flex-col shadow-xl rounded-[2rem]">
        <div className="h-8 bg-white/50 rounded-full mb-6 w-1/2 animate-pulse"></div>
        <div className="space-y-4 flex-1">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-20 border border-white bg-white/30 rounded-2xl animate-pulse"></div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 border border-white p-6 h-full flex flex-col overflow-hidden shadow-xl rounded-[2rem] backdrop-blur-sm">
      <h3 className="text-xl font-bold text-cyan-800 mb-6 flex items-center gap-3 font-display border-b-2 border-white pb-4 w-full">
        Vocab Splash
      </h3>
      <div className="overflow-y-auto space-y-4 pr-2 scrollbar-hide flex-1">
        {items.map((item, index) => (
          <div key={index} className="group p-4 bg-yellow-50/90 border border-yellow-100 shadow-sm hover:scale-[1.02] transition-all rounded-2xl">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-black text-slate-800 text-lg font-display tracking-wide">{item.word}</span>
            </div>
            <p className="text-slate-700 text-sm font-bold mb-3">"{item.definition}"</p>
            <div className="text-xs text-yellow-800 bg-yellow-100/50 p-2 rounded-lg font-bold">
              <span className="opacity-50 mr-2">EX:</span>
              {item.context}
            </div>
          </div>
        ))}
        {items.length === 0 && (
            <div className="text-center p-4 italic text-slate-500 font-medium bg-white/40 rounded-xl">
                Pool is empty...
            </div>
        )}
      </div>
    </div>
  );
};

export default VocabularyCard;