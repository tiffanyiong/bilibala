import React, { useMemo } from 'react';
import { ExploreVideo } from '../../../shared/types/database';

interface ExploreVideoCardProps {
  video: ExploreVideo;
  onSelect: () => void;
}

const levelLabel: Record<string, { text: string; color: string }> = {
  Easy: { text: 'Easy', color: 'text-emerald-600 bg-emerald-50' },
  Medium: { text: 'Medium', color: 'text-amber-600 bg-amber-50' },
  Hard: { text: 'Hard', color: 'text-rose-600 bg-rose-50' },
};

// Low-saturated pastel accent colors
const cardAccents = [
  { hover: 'rgba(180, 210, 240, 0.45)', shadow: 'rgba(180, 210, 240, 0.3)' },  // soft blue
  { hover: 'rgba(230, 215, 170, 0.45)', shadow: 'rgba(230, 215, 170, 0.3)' },  // soft yellow
  { hover: 'rgba(200, 220, 195, 0.45)', shadow: 'rgba(200, 220, 195, 0.3)' },  // soft green
  { hover: 'rgba(220, 200, 230, 0.45)', shadow: 'rgba(220, 200, 230, 0.3)' },  // soft lavender
  { hover: 'rgba(235, 205, 200, 0.45)', shadow: 'rgba(235, 205, 200, 0.3)' },  // soft pink
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ExploreVideoCard: React.FC<ExploreVideoCardProps> = ({ video, onSelect }) => {
  const thumbnailUrl =
    video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;

  const level = levelLabel[video.level] || { text: video.level, color: 'text-stone-500 bg-stone-50' };

  const accent = useMemo(
    () => cardAccents[hashString(video.youtubeId) % cardAccents.length],
    [video.youtubeId]
  );

  return (
    <button
      onClick={onSelect}
      style={{
        '--card-hover-bg': accent.hover,
        '--card-hover-shadow': accent.shadow,
      } as React.CSSProperties}
      className="
        explore-video-card
        w-full text-left group cursor-pointer focus:outline-none
        rounded-xl overflow-hidden
        bg-white
        transition-all duration-300
      "
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Play icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/10">
          <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-stone-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="px-3 py-2.5 space-y-1.5">
        <h3 className="font-medium text-stone-800 text-sm leading-snug line-clamp-2 tracking-tight">
          {video.title}
        </h3>

        <div className="flex items-center gap-2">
          {video.channelName && (
            <span className="text-xs text-stone-400 truncate">{video.channelName}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${level.color}`}>
            {level.text}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-stone-500 bg-stone-100">
            {video.targetLang}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ExploreVideoCard;
