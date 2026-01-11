import React from 'react';
import { TopicPoint } from '../types';

interface TopicCardProps {
  items: TopicPoint[];
  isLoading: boolean;
}

const TopicCard: React.FC<TopicCardProps> = ({ items, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white/50 border border-white p-6 h-full flex flex-col shadow-xl rounded-[2rem]">
        <div className="h-8 bg-white/50 rounded-full mb-6 w-2/3 animate-pulse"></div>
        <div className="space-y-4 flex-1">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-24 border border-white bg-white/30 rounded-2xl animate-pulse"></div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 border border-white p-6 h-full flex flex-col overflow-hidden shadow-xl rounded-[2rem] backdrop-blur-sm">
      <h3 className="text-xl font-bold text-cyan-800 mb-6 flex items-center gap-3 font-display border-b-2 border-white pb-4 w-full">
        Discussion Plan
      </h3>
      <div className="overflow-y-auto space-y-4 pr-2 scrollbar-hide flex-1">
        {items.map((item, index) => (
          <div 
            key={index} 
            className="flex gap-4 p-4 bg-pink-50/80 border border-pink-100 items-start shadow-sm hover:shadow-md transition-all rounded-2xl"
          >
            <div className="text-lg font-black bg-pink-400 text-white w-10 h-10 flex items-center justify-center shadow-inner rounded-full shrink-0 border-2 border-white">
                {index + 1}
            </div>
            <div>
                <h4 className="font-bold text-slate-800 text-lg font-display mb-1">{item.title}</h4>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopicCard;