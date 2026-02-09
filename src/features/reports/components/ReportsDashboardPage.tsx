import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { getAllPracticeSessionsWithVideoMetadata, deletePracticeSession, togglePracticeSessionFavorite } from '../../../shared/services/database';
import { DashboardPracticeSession } from '../../../shared/types/database';
import ReportsEmptyState from './ReportsEmptyState';
import ReportsGroupedList from './ReportsGroupedList';
import ReportsOverview from './ReportsOverview';

export type NavigateToVideoFn = (video: { analysisId: string; youtubeId: string; title: string; thumbnailUrl: string | null; targetLang: string; nativeLang: string; level: string }) => void;

interface ReportsDashboardPageProps {
  onViewReport: (session: DashboardPracticeSession) => void;
  onNavigateToVideo?: NavigateToVideoFn;
}

const ReportsDashboardPage: React.FC<ReportsDashboardPageProps> = ({ onViewReport, onNavigateToVideo }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DashboardPracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      setIsLoading(true);
      const data = await getAllPracticeSessionsWithVideoMetadata(user.id);
      setSessions(data);
      setIsLoading(false);
    };

    fetchSessions();
  }, [user]);

  // Auto-select the most-used language on first load
  useEffect(() => {
    if (hasAutoSelected || sessions.length === 0) return;
    const langCounts = new Map<string, number>();
    for (const s of sessions) {
      if (s.target_lang) langCounts.set(s.target_lang, (langCounts.get(s.target_lang) || 0) + 1);
    }
    let topLang: string | null = null;
    let topCount = 0;
    for (const [lang, count] of langCounts) {
      if (count > topCount) { topLang = lang; topCount = count; }
    }
    if (topLang) setActiveLanguage(topLang);
    setHasAutoSelected(true);
  }, [sessions, hasAutoSelected]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    const success = await deletePracticeSession(user.id, sessionId);
    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  const handleToggleFavorite = async (sessionId: string, isFavorited: boolean) => {
    if (!user) return;
    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, is_favorited: isFavorited } : s))
    );
    const success = await togglePracticeSessionFavorite(user.id, sessionId, isFavorited);
    if (!success) {
      // Revert on failure
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_favorited: !isFavorited } : s))
      );
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-20 text-sm text-stone-500">
          Sign in to view your practice reports
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
      {/* Page header */}
      <div className="mb-6 animate-[glassDropIn_0.3s_ease-out]">
        <h1 className="text-2xl sm:text-3xl font-serif text-stone-800">Practice Reports</h1>
        <p className="text-sm text-stone-500 mt-1">Track your speaking progress across all videos</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : sessions.length === 0 ? (
        <ReportsEmptyState />
      ) : (
        <>
          <ReportsOverview sessions={sessions} activeLanguage={activeLanguage} />
          <ReportsGroupedList sessions={sessions} onViewReport={onViewReport} onDeleteSession={handleDeleteSession} onToggleFavorite={handleToggleFavorite} onNavigateToVideo={onNavigateToVideo} activeLanguage={activeLanguage} onLanguageChange={setActiveLanguage} />
        </>
      )}
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    {/* Stats cards skeleton */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 ring-1 ring-black/[0.03]">
          <div className="h-3 w-20 bg-stone-200 rounded mb-2" />
          <div className="h-7 w-16 bg-stone-200 rounded mb-1" />
          <div className="h-3 w-24 bg-stone-100 rounded" />
        </div>
      ))}
    </div>

    {/* Chart skeleton */}
    <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 ring-1 ring-black/[0.03]">
      <div className="h-3 w-24 bg-stone-200 rounded mb-4" />
      <div className="h-48 bg-stone-100 rounded-lg" />
    </div>

    {/* Groups skeleton */}
    {[1, 2].map((i) => (
      <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-4 ring-1 ring-black/[0.03]">
        <div className="flex items-center gap-3">
          <div className="w-20 h-12 bg-stone-200 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 w-48 bg-stone-200 rounded mb-1" />
            <div className="h-3 w-32 bg-stone-100 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default ReportsDashboardPage;
