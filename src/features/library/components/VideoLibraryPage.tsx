import React, { useEffect, useState, useMemo } from 'react';
import { VideoHistoryItem } from '../../../shared/types/database';
import { getUserVideoLibrary } from '../../../shared/services/database';
import { useAuth } from '../../../shared/context/AuthContext';
import VideoCard, { VideoCardSkeleton } from './VideoCard';
import FilterBar from './FilterBar';
import PracticeReportsModal from './PracticeReportsModal';

interface VideoLibraryPageProps {
  onSelectVideo: (video: VideoHistoryItem) => void;
  onBack: () => void;
}

const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({
  onSelectVideo,
  onBack,
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

  // Fetch videos on mount
  useEffect(() => {
    if (user) {
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
  }, [user]);

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

  return (
    <div className="min-h-full bg-[#FAF9F6]">
      {/* Page Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <BackIcon />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-serif text-stone-800 mb-2">My Video Library</h1>
          <p className="text-stone-500">
            {loading ? 'Loading...' : `${videos.length} video${videos.length !== 1 ? 's' : ''} in your library`}
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          {/* Search placeholder */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search videos... (coming soon)"
              disabled
              className="w-full bg-white border border-stone-200 text-stone-400 text-sm rounded-lg py-2.5 px-4 pl-10 cursor-not-allowed"
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
        <div>
          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <ErrorIcon />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-2">Something went wrong</h3>
              <p className="text-stone-500 mb-4">{error}</p>
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
                className="text-sm font-medium text-stone-800 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredVideos.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-stone-100 rounded-full flex items-center justify-center">
                <VideoIcon />
              </div>
              <h3 className="text-xl font-medium text-stone-800 mb-2">
                {videos.length === 0 ? 'No videos yet' : 'No videos match filters'}
              </h3>
              <p className="text-stone-500 max-w-md mx-auto">
                {videos.length === 0
                  ? 'Start analyzing YouTube videos to build your personal library'
                  : 'Try adjusting your filters to see more videos'}
              </p>
              {videos.length === 0 && (
                <button
                  onClick={onBack}
                  className="mt-6 bg-stone-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors"
                >
                  Analyze a Video
                </button>
              )}
            </div>
          )}

          {/* Video grid */}
          {!loading && !error && filteredVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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
        />
      )}
    </div>
  );
};

// Icons
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const VideoIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

const ErrorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default VideoLibraryPage;
