import React from 'react';
import { ExploreVideo } from '../../../shared/types/database';

interface ExploreCardProps {
  video: ExploreVideo;
  onClick: () => void;
}

const levelColors: Record<string, string> = {
  Easy: 'bg-green-50 text-green-600',
  Medium: 'bg-amber-50 text-amber-600',
  Hard: 'bg-red-50 text-red-600',
};

export const ExploreCardSkeleton: React.FC = () => (
  <div className="w-60 flex-shrink-0 bg-white rounded-xl border border-stone-200 overflow-hidden animate-pulse">
    <div className="aspect-video bg-stone-200" />
    <div className="p-3 space-y-2">
      <div className="h-4 bg-stone-200 rounded w-full" />
      <div className="h-3 bg-stone-200 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-5 bg-stone-200 rounded-full w-16" />
        <div className="h-5 bg-stone-200 rounded-full w-12" />
      </div>
    </div>
  </div>
);

const ExploreCard: React.FC<ExploreCardProps> = ({ video, onClick }) => {
  const thumbnailUrl =
    video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

  return (
    <div
      onClick={onClick}
      className="w-60 flex-shrink-0 bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-stone-100 overflow-hidden relative">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* View count badge */}
        {video.viewCount > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
            {video.viewCount} {video.viewCount === 1 ? 'view' : 'views'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-medium text-stone-800 text-sm line-clamp-2 leading-tight min-h-[2.5rem]">
          {video.title}
        </h3>

        {video.channelName && (
          <p className="text-xs text-stone-400 mt-1 truncate">{video.channelName}</p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
            {video.targetLang}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              levelColors[video.level] || 'bg-stone-100 text-stone-600'
            }`}
          >
            {video.level}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExploreCard;
