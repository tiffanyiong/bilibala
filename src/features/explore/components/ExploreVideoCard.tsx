import React from 'react';
import { ExploreVideo } from '../../../shared/types/database';

interface ExploreVideoCardProps {
  video: ExploreVideo;
  onSelect: () => void;
}

const levelDot: Record<string, string> = {
  Easy: 'bg-emerald-400',
  Medium: 'bg-amber-400',
  Hard: 'bg-rose-400',
};

const ExploreVideoCard: React.FC<ExploreVideoCardProps> = ({ video, onSelect }) => {
  const thumbnailUrl =
    video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left group cursor-pointer focus:outline-none"
    >
      {/* Explore badge - top center */}
      <div className="flex justify-center mb-2">
        <span className="px-2.5 py-0.5 bg-stone-100 rounded-full text-[9px] font-medium text-stone-500 uppercase tracking-wider">
          Explore
        </span>
      </div>

      {/* Thumbnail with overlay */}
      <div className="relative aspect-video rounded-xl overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-300">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

        {/* Play icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-stone-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2 text-white/90 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${levelDot[video.level] || 'bg-stone-400'}`} />
            <span className="font-medium">{video.level}</span>
            <span className="text-white/60">·</span>
            <span>{video.targetLang}</span>
          </div>
        </div>
      </div>

      {/* Title & Channel */}
      <div className="mt-3">
        <h3 className="font-normal text-stone-700 text-[15px] sm:text-base leading-snug line-clamp-2 tracking-tight group-hover:text-stone-500 transition-colors">
          {video.title}
        </h3>
        {video.channelName && (
          <p className="text-[11px] text-stone-400 mt-1.5 truncate font-light">{video.channelName}</p>
        )}
      </div>
    </button>
  );
};

export default ExploreVideoCard;
