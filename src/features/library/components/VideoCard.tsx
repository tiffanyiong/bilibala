import React, { useState } from 'react';
import { VideoHistoryItem } from '../../../shared/types/database';

interface VideoCardProps {
  video: VideoHistoryItem;
  onClick: () => void;
  onViewReports?: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
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

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, onViewReports, onToggleFavorite, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const thumbnailUrl = video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
    >
      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm font-medium text-center mb-4">
            Remove this video from your library?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelDelete}
              className="px-4 py-2 bg-white/20 text-white text-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail - 16:9 aspect ratio */}
      <div className="aspect-video bg-stone-100 overflow-hidden relative">
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Favorite button - top right */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              video.isFavorite
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-white/80 text-stone-400 hover:bg-white hover:text-red-500 shadow-sm'
            }`}
            aria-label={video.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <HeartIcon filled={video.isFavorite} />
          </button>
        )}
        {/* Delete button - bottom right */}
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all bg-white/80 text-stone-400 hover:bg-white hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100"
            aria-label="Remove from library"
          >
            <TrashIcon />
          </button>
        )}
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

        {/* Practice Reports Badge - uses actual report count from practice_sessions */}
        {video.reportCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewReports?.();
            }}
            className="mt-3 text-xs text-stone-600 hover:text-stone-800 flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-full transition-colors"
          >
            <MicIcon />
            {video.reportCount} Report{video.reportCount > 1 ? 's' : ''}
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

const HeartIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

export default VideoCard;
