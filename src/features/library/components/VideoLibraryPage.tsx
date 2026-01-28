import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { VideoHistoryItem } from '../../../shared/types/database';
import { getUserVideoLibrary, toggleLibraryFavorite, removeFromLibrary } from '../../../shared/services/database';
import { searchVideos } from '../../../shared/services/geminiService';
import { useAuth } from '../../../shared/context/AuthContext';
import VideoCard, { VideoCardSkeleton } from './VideoCard';
import FilterBar, { SortOrder } from './FilterBar';
import PracticeReportsModal from './PracticeReportsModal';

interface VideoLibraryPageProps {
  onSelectVideo: (video: VideoHistoryItem) => void;
  onExpandReports?: (video: VideoHistoryItem, sessionId?: string) => void;
}

const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({
  onSelectVideo,
  onExpandReports,
}) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If empty query, clear search results immediately
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    // Debounce the search
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      // Prepare searchable video data
      const searchableVideos = videos.map(v => ({
        libraryId: v.libraryId,
        title: v.title,
        targetLang: v.targetLang,
        level: v.level,
      }));

      const matchedIds = await searchVideos(query, searchableVideos);
      setSearchResults(matchedIds);
      setIsSearching(false);
    }, 500);
  }, [videos]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(async (libraryId: string) => {
    if (!user) return;

    const newValue = await toggleLibraryFavorite(user.id, libraryId);
    if (newValue !== null) {
      // Update local state optimistically
      setVideos(prev => prev.map(v =>
        v.libraryId === libraryId ? { ...v, isFavorite: newValue } : v
      ));
    }
  }, [user]);

  // Handle delete from library
  const handleDelete = useCallback(async (libraryId: string) => {
    if (!user) return;

    const success = await removeFromLibrary(user.id, libraryId);
    if (success) {
      // Remove from local state
      setVideos(prev => prev.filter(v => v.libraryId !== libraryId));
    }
  }, [user]);

  // Filtered videos (apply filters + search + sort)
  const filteredVideos = useMemo(() => {
    let result = videos;

    // Apply favorites filter
    if (showFavoritesOnly) {
      result = result.filter(v => v.isFavorite);
    }

    // Apply language/level filters
    result = result.filter((v) => {
      if (languageFilter && v.targetLang !== languageFilter) return false;
      if (levelFilter && v.level !== levelFilter) return false;
      return true;
    });

    // Apply search results if there's an active search
    if (searchResults !== null) {
      // Maintain the order from search results (most relevant first)
      const resultMap = new Map(result.map(v => [v.libraryId, v]));
      result = searchResults
        .filter(id => resultMap.has(id))
        .map(id => resultMap.get(id)!);
    } else {
      // Apply sorting only when not searching (search has its own relevance order)
      result = [...result].sort((a, b) => {
        const dateA = new Date(a.addedAt).getTime();
        const dateB = new Date(b.addedAt).getTime();
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
    }

    return result;
  }, [videos, showFavoritesOnly, languageFilter, levelFilter, searchResults, sortOrder]);

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
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-stone-800 mb-2">My Video Library</h1>
          <p className="text-stone-500">
            {loading ? 'Loading...' : `${videos.length} video${videos.length !== 1 ? 's' : ''} in your library`}
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          {/* AI Search */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search videos with AI..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white border border-stone-200 text-stone-800 text-sm rounded-lg py-2.5 px-4 pl-10 pr-10 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <ClearIcon />
              </button>
            )}
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
              showFavoritesOnly={showFavoritesOnly}
              onFavoritesChange={setShowFavoritesOnly}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
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
                {showFavoritesOnly ? <HeartIcon /> : <VideoIcon />}
              </div>
              <h3 className="text-xl font-medium text-stone-800 mb-2">
                {videos.length === 0
                  ? 'No videos yet'
                  : showFavoritesOnly
                    ? 'No favorite videos'
                    : searchQuery
                      ? 'No videos match your search'
                      : 'No videos match filters'}
              </h3>
              <p className="text-stone-500 max-w-md mx-auto">
                {videos.length === 0
                  ? 'Start analyzing YouTube videos to build your personal library'
                  : showFavoritesOnly
                    ? 'Mark videos as favorites by clicking the heart icon'
                    : searchQuery
                      ? 'Try a different search term or clear the search'
                      : 'Try adjusting your filters to see more videos'}
              </p>
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
                  onToggleFavorite={() => handleToggleFavorite(video.libraryId)}
                  onDelete={() => handleDelete(video.libraryId)}
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
          onExpand={onExpandReports ? (sessionId) => {
            setSelectedVideoForReports(null); // Close modal
            onExpandReports(selectedVideoForReports, sessionId);
          } : undefined}
        />
      )}
    </div>
  );
};

// Icons
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const ClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const VideoIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

const HeartIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
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
