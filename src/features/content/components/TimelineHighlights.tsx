import React from 'react';
import { TopicPoint } from '../../../shared/types';

interface TimelineHighlightsProps {
  topics: TopicPoint[];
}

const TimelineHighlights: React.FC<TimelineHighlightsProps> = ({ topics }) => {
  // Pastel colors for the dots
  const dotColors = [
    'bg-[#FFB5A7]', // pink
    'bg-[#FCD5CE]', // light pink
    'bg-[#D8E2DC]', // light grey/blue
    'bg-[#ECE4DB]', // beige
    'bg-[#FFE5D9]', // peach
  ];

  return (
    <div className="w-full bg-white rounded-2xl border border-[#D9D9D9] p-6 shadow-sm mt-6">
      <div className="space-y-6 relative">
        {/* Vertical Line */}
        <div className="absolute left-[9px] top-3 bottom-3 w-[2px] bg-[#F0F0F0] -z-10"></div>

        {topics.map((topic, index) => {
          const colorClass = dotColors[index % dotColors.length];
          
          return (
            <div key={index} className="flex gap-4 items-start group relative">
              {/* Dot */}
              <div className={`w-5 h-5 rounded-full ${colorClass} shrink-0 mt-1 border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-110`}></div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-[15px] font-medium text-[#1A1A1A] leading-tight">
                    {topic.title}
                  </h4>
                  <span className="text-xs font-mono text-[#6D6D6D] bg-[#F6F4EF] px-2 py-0.5 rounded ml-3 shrink-0">
                    {topic.timestamp || `0:${String(index * 45 + 15).padStart(2, '0')}`}
                  </span>
                </div>
                <p className="text-sm text-[#6D6D6D] leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                  {topic.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineHighlights;