import React from 'react';
import { VideoHistoryItem } from '../../../shared/types/database';

interface VideoCardProps {
  video: VideoHistoryItem;
  onClick: () => void;
  onViewReports?: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export const VideoCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden animate-pulse">
    <div className="aspect-video bg-stone-200" />
    <div className="p-4 space-y-2">
      <div className="h-4 bg-stone-200 rounded w-3/4" />
      <div className="h-3 bg-stone-200 rounded w-1/2" />
      <div className="h-3 bg-stone-200 rounded w-1/3" />
    </div>
  </div>
);

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, onViewReports }) => {
  const thumbnailUrl = video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Thumbnail - 16:9 aspect ratio */}
      <div className="aspect-video bg-stone-100 overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-stone-800 truncate text-sm md:text-base">
          {video.title}
        </h3>
        <p className="text-xs md:text-sm text-stone-500 mt-1">
          {video.targetLang} &middot; {video.level}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">
          {formatDate(video.lastAccessedAt)}
        </p>

        {/* Practice Reports Badge */}
        {video.practiceCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewReports?.();
            }}
            className="mt-3 text-xs text-stone-600 hover:text-stone-800 flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-full transition-colors"
          >
            <MicIcon />
            {video.practiceCount} Report{video.practiceCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
};

const MicIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

export default VideoCard;
