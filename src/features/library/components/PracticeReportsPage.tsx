import React, { useEffect, useState } from 'react';
import { VideoHistoryItem, DbPracticeSession } from '../../../shared/types/database';
import { getPracticeSessionsForAnalysis } from '../../../shared/services/database';
import { useAuth } from '../../../shared/context/AuthContext';
import PracticeReportCard, { PracticeReportCardSkeleton } from './PracticeReportCard';

interface PracticeReportsPageProps {
  video: VideoHistoryItem;
  onBack: () => void;
  onViewReport: (session: DbPracticeSession) => void;
}

const PracticeReportsPage: React.FC<PracticeReportsPageProps> = ({
  video,
  onBack,
  onViewReport,
}) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DbPracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions on mount
  useEffect(() => {
    if (user && video.analysisId) {
      setLoading(true);
      setError(null);

      getPracticeSessionsForAnalysis(user.id, video.analysisId)
        .then((data) => {
          setSessions(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch practice sessions:', err);
          setError('Failed to load practice reports.');
          setLoading(false);
        });
    }
  }, [user, video.analysisId]);

  return (
    <div className="min-h-full bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#FAF9F6] border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-4">
            <button
              onClick={onBack}
              className="text-stone-500 hover:text-stone-700 transition-colors flex items-center gap-1"
            >
              <BackIcon />
              <span>Library</span>
            </button>
            <span className="text-stone-300">/</span>
            <span className="text-stone-700 font-medium">Practice Reports</span>
          </div>

          {/* Video Info */}
          <div className="flex items-start gap-4">
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="w-20 h-12 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium text-stone-800 line-clamp-2 leading-snug">
                {video.title}
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                  {video.targetLang}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                  {video.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <PracticeReportCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <ErrorIcon />
            </div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">
              Something went wrong
            </h3>
            <p className="text-stone-500 mb-4">{error}</p>
            <button
              onClick={() => {
                if (user && video.analysisId) {
                  setLoading(true);
                  setError(null);
                  getPracticeSessionsForAnalysis(user.id, video.analysisId)
                    .then(setSessions)
                    .catch(() => setError('Failed to load practice reports.'))
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
        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-stone-100 rounded-full flex items-center justify-center">
              <MicIcon />
            </div>
            <h3 className="text-xl font-medium text-stone-800 mb-2">
              No practice sessions yet
            </h3>
            <p className="text-stone-500 max-w-md mx-auto">
              Complete a practice session to see your reports here
            </p>
          </div>
        )}

        {/* Sessions list */}
        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-stone-500 mb-6">
              {sessions.length} practice session{sessions.length !== 1 ? 's' : ''}
            </p>
            {sessions.map((session) => (
              <PracticeReportCard
                key={session.id}
                session={session}
                onClick={() => onViewReport(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Icons
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const MicIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const ErrorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default PracticeReportsPage;
