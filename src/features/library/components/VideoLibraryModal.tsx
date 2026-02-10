import React, { useEffect, useState, useMemo } from 'react';
import { VideoHistoryItem } from '../../../shared/types/database';
import { getUserVideoLibrary } from '../../../shared/services/database';
import { useAuth } from '../../../shared/context/AuthContext';
import VideoCard, { VideoCardSkeleton } from './VideoCard';
import FilterBar from './FilterBar';
import PracticeReportsModal from './PracticeReportsModal';

interface VideoLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoHistoryItem) => void;
}

const VideoLibraryModal: React.FC<VideoLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
}) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  // Practice reports modal state
  const [selectedVideoForReports, setSelectedVideoForReports] = useState<VideoHistoryItem | null>(null);

  // Fetch videos when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      setError(null);
      getUserVideoLibrary(user.id)
        .then((data) => {
          setVideos(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch video library:', err);
          setError('Failed to load your videos. Please try again.');
          setLoading(false);
        });
    }
  }, [isOpen, user]);

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLanguageFilter(null);
      setLevelFilter(null);
      setSelectedVideoForReports(null);
    }
  }, [isOpen]);

  // Escape key handling (only if reports modal is not open)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedVideoForReports) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, selectedVideoForReports]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (languageFilter && v.targetLang !== languageFilter) return false;
      if (levelFilter && v.level !== levelFilter) return false;
      return true;
    });
  }, [videos, languageFilter, levelFilter]);

  // Extract unique languages/levels for FilterBar
  const uniqueLanguages = useMemo(
    () => [...new Set(videos.map((v) => v.targetLang))],
    [videos]
  );
  const uniqueLevels = useMemo(
    () => [...new Set(videos.map((v) => v.level))],
    [videos]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg w-full max-w-5xl max-h-[90vh] mx-4 relative flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <h2 className="text-xl font-semibold text-stone-800">My Video Library</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-6 pb-4 space-y-4 border-b border-stone-100">
          {/* Search placeholder */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search videos... (coming soon)"
              disabled
              className="w-full bg-stone-100 border border-stone-200 text-stone-400 text-sm rounded-lg py-2.5 px-4 pl-10 cursor-not-allowed"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>

          {/* Filters */}
          {!loading && videos.length > 0 && (
            <FilterBar
              languages={uniqueLanguages}
              levels={uniqueLevels}
              activeLanguage={languageFilter}
              activeLevel={levelFilter}
              onLanguageChange={setLanguageFilter}
              onLevelChange={setLevelFilter}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <ErrorIcon />
              </div>
              <p className="text-stone-600">{error}</p>
              <button
                onClick={() => {
                  if (user) {
                    setLoading(true);
                    setError(null);
                    getUserVideoLibrary(user.id)
                      .then(setVideos)
                      .catch(() => setError('Failed to load your videos.'))
                      .finally(() => setLoading(false));
                  }
                }}
                className="mt-4 text-sm text-stone-800 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredVideos.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center">
                <VideoIcon />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-2">
                {videos.length === 0 ? 'No videos yet' : 'No videos match filters'}
              </h3>
              <p className="text-stone-500 text-sm">
                {videos.length === 0
                  ? 'Start analyzing videos to build your library'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          )}

          {/* Video grid */}
          {!loading && !error && filteredVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.libraryId}
                  video={video}
                  onClick={() => onSelectVideo(video)}
                  onViewReports={() => setSelectedVideoForReports(video)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Practice Reports Modal */}
      {selectedVideoForReports && (
        <PracticeReportsModal
          isOpen={!!selectedVideoForReports}
          onClose={() => setSelectedVideoForReports(null)}
          analysisId={selectedVideoForReports.analysisId}
          videoTitle={selectedVideoForReports.title}
          targetLang={selectedVideoForReports.targetLang}
          level={selectedVideoForReports.level}
          youtubeId={selectedVideoForReports.youtubeId}
          thumbnailUrl={selectedVideoForReports.thumbnailUrl}
        />
      )}
    </div>
  );
};

// Icons
const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const VideoIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-stone-400"
  >
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

const ErrorIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-red-400"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default VideoLibraryModal;
