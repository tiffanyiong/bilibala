import React, { useMemo, useState, useRef, useEffect } from 'react';
import { DashboardPracticeSession } from '../../../shared/types/database';
import ReportsFilterChips from './ReportsFilterChips';
import { NavigateToVideoFn } from './ReportsDashboardPage';
import ReportsVideoGroup from './ReportsVideoGroup';

type SortOption = 'recent' | 'oldest' | 'highest' | 'lowest';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest', label: 'Highest Score' },
  { value: 'lowest', label: 'Lowest Score' },
];

interface ReportsGroupedListProps {
  sessions: DashboardPracticeSession[];
  onViewReport: (session: DashboardPracticeSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onToggleFavorite?: (sessionId: string, isFavorited: boolean) => void;
  onNavigateToVideo?: NavigateToVideoFn;
  activeLanguage?: string | null;
  onLanguageChange?: (lang: string | null) => void;
}

const ReportsGroupedList: React.FC<ReportsGroupedListProps> = ({ sessions, onViewReport, onDeleteSession, onToggleFavorite, onNavigateToVideo, activeLanguage: externalLanguage, onLanguageChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalLanguage, setInternalLanguage] = useState<string | null>(null);
  const activeLanguage = externalLanguage !== undefined ? externalLanguage : internalLanguage;
  const setActiveLanguage = (lang: string | null) => {
    if (onLanguageChange) onLanguageChange(lang);
    else setInternalLanguage(lang);
  };
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    if (sortOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  // Extract unique languages, levels, and top topics for filter chips
  const { languages, levels, topics } = useMemo(() => {
    const langSet = new Set<string>();
    const levelSet = new Set<string>();
    const topicCounts = new Map<string, number>();

    for (const s of sessions) {
      if (s.target_lang) langSet.add(s.target_lang);
      if (s.level) levelSet.add(s.level);
      if (s.topic_text) {
        topicCounts.set(s.topic_text, (topicCounts.get(s.topic_text) || 0) + 1);
      }
    }

    // Sort topics by frequency, take top 8
    const sortedTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);

    return {
      languages: Array.from(langSet).sort(),
      levels: Array.from(levelSet).sort(),
      topics: sortedTopics,
    };
  }, [sessions]);

  // Count how many sessions are favorited (to show count on chip)
  const favoritesCount = useMemo(() => sessions.filter((s) => s.is_favorited).length, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return sessions.filter((s) => {
      if (showFavoritesOnly && !s.is_favorited) return false;
      if (activeLanguage && s.target_lang !== activeLanguage) return false;
      if (activeLevel && s.level !== activeLevel) return false;
      if (activeTopic && s.topic_text !== activeTopic) return false;
      if (query) {
        const searchable = `${s.videoTitle} ${s.topic_text} ${s.question_text}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [sessions, searchQuery, showFavoritesOnly, activeLanguage, activeLevel, activeTopic]);

  // Group by analysis_id (video) and sort
  const groups = useMemo(() => {
    const map = new Map<string, {
      video: { title: string; thumbnailUrl: string | null; youtubeId: string; targetLang: string; nativeLang: string; level: string; analysisId: string };
      sessions: DashboardPracticeSession[];
    }>();

    for (const s of filteredSessions) {
      const key = s.analysis_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          video: {
            title: s.videoTitle,
            thumbnailUrl: s.videoThumbnailUrl,
            youtubeId: s.youtubeId,
            targetLang: s.target_lang,
            nativeLang: s.native_lang,
            level: s.level,
            analysisId: s.analysis_id || '',
          },
          sessions: [],
        });
      }
      map.get(key)!.sessions.push(s);
    }

    const grouped = Array.from(map.values());

    // Helper: average score for a group
    const avgScore = (g: typeof grouped[0]) => {
      const scored = g.sessions.filter((s) => s.score !== null && s.score !== undefined);
      if (scored.length === 0) return 0;
      return scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length;
    };

    switch (sortBy) {
      case 'oldest':
        return grouped.sort(
          (a, b) => new Date(a.sessions[a.sessions.length - 1].created_at).getTime() - new Date(b.sessions[b.sessions.length - 1].created_at).getTime()
        );
      case 'highest':
        return grouped.sort((a, b) => avgScore(b) - avgScore(a));
      case 'lowest':
        return grouped.sort((a, b) => avgScore(a) - avgScore(b));
      case 'recent':
      default:
        return grouped.sort(
          (a, b) => new Date(b.sessions[0].created_at).getTime() - new Date(a.sessions[0].created_at).getTime()
        );
    }
  }, [filteredSessions, sortBy]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="space-y-4 mt-6">
      {/* Search bar */}
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search by video, topic, or question..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-300 shadow-sm ring-1 ring-black/[0.03] transition-all"
        />
      </div>

      {/* Filter chips + sort */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <ReportsFilterChips
            languages={languages}
            levels={levels}
            topics={topics}
            activeLanguage={activeLanguage}
            activeLevel={activeLevel}
            activeTopic={activeTopic}
            onLanguageChange={setActiveLanguage}
            onLevelChange={setActiveLevel}
            onTopicChange={setActiveTopic}
            showFavoritesOnly={showFavoritesOnly}
            onFavoritesChange={setShowFavoritesOnly}
            favoritesCount={favoritesCount}
          />
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative flex-shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 border border-stone-200 rounded-full text-xs font-medium text-stone-600 hover:bg-white/80 hover:border-stone-300 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
              <path d="M3 6h18M6 12h12M9 18h6" />
            </svg>
            {sortLabel}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-stone-400 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {sortOpen && (
            <div className="absolute z-50 right-0 mt-1.5 w-40 bg-white border border-stone-200 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04] overflow-hidden animate-[glassDropIn_0.2s_ease-out]">
              <div className="py-1 px-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      sortBy === opt.value
                        ? 'bg-stone-100 text-stone-800 font-medium'
                        : 'text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grouped video sections */}
      {groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-stone-500">
          No reports match your filters
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, i) => (
            <ReportsVideoGroup
              key={group.video.youtubeId + i}
              video={group.video}
              sessions={group.sessions}
              onViewReport={onViewReport}
              onDeleteSession={onDeleteSession}
              onToggleFavorite={onToggleFavorite}
              onNavigateToVideo={onNavigateToVideo}
              defaultExpanded={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsGroupedList;
