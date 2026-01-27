import React, { useEffect, useState } from 'react';
import { DbPracticeSession } from '../../../shared/types/database';
import { SpeechAnalysisResult } from '../../../shared/types';
import { getPracticeSessionsForAnalysis } from '../../../shared/services/database';
import { useAuth } from '../../../shared/context/AuthContext';
import PracticeReportCard, { PracticeReportCardSkeleton } from './PracticeReportCard';
import PyramidFeedback from '../../practice/components/PyramidFeedback';

interface PracticeReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId: string;
  videoTitle: string;
  targetLang: string;
  level: string;
}

type ViewMode = 'list' | 'report';

const PracticeReportsModal: React.FC<PracticeReportsModalProps> = ({
  isOpen,
  onClose,
  analysisId,
  videoTitle,
  targetLang,
  level,
}) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DbPracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSession, setSelectedSession] = useState<DbPracticeSession | null>(null);

  // Fetch sessions when modal opens
  useEffect(() => {
    if (isOpen && user && analysisId) {
      setLoading(true);
      setError(null);
      setViewMode('list');
      setSelectedSession(null);

      getPracticeSessionsForAnalysis(user.id, analysisId)
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
  }, [isOpen, user, analysisId]);

  // Escape key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode === 'report') {
          setViewMode('list');
          setSelectedSession(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, viewMode, onClose]);

  const handleViewReport = (session: DbPracticeSession) => {
    setSelectedSession(session);
    setViewMode('report');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedSession(null);
  };

  if (!isOpen) return null;

  // Get analysis data from selected session
  const analysisData = selectedSession?.feedback_data as SpeechAnalysisResult | null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={viewMode === 'list' ? onClose : undefined}
    >
      <div
        className="bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg w-full max-w-4xl max-h-[90vh] mx-4 relative flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div className="flex items-center gap-3">
            {viewMode === 'report' && (
              <button
                onClick={handleBackToList}
                className="text-stone-500 hover:text-stone-700 transition-colors"
              >
                <BackIcon />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-stone-800">
                {viewMode === 'list' ? 'Practice Reports' : 'Feedback Report'}
              </h2>
              <p className="text-sm text-stone-500 truncate max-w-md">
                {videoTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* List View */}
          {viewMode === 'list' && (
            <>
              {/* Loading state */}
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <PracticeReportCardSkeleton key={i} />
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
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && sessions.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center">
                    <MicIcon />
                  </div>
                  <h3 className="text-lg font-medium text-stone-800 mb-2">
                    No practice sessions yet
                  </h3>
                  <p className="text-stone-500 text-sm">
                    Complete a practice session to see your reports here
                  </p>
                </div>
              )}

              {/* Sessions list */}
              {!loading && !error && sessions.length > 0 && (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <PracticeReportCard
                      key={session.id}
                      session={session}
                      onClick={() => handleViewReport(session)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Report View */}
          {viewMode === 'report' && selectedSession && (
            <div className="min-h-[400px]">
              {analysisData ? (
                <PyramidFeedback
                  analysis={analysisData}
                  onRetry={() => {}} // No-op for read-only view
                  audioUrl={selectedSession.audio_url}
                  startRetake={() => {}} // No-op for read-only view
                  level={level}
                  nativeLang={selectedSession.native_lang || 'English'}
                  targetLang={targetLang}
                  preFetchedLabels={null} // Will use defaults
                />
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                    <WarningIcon />
                  </div>
                  <h3 className="text-lg font-medium text-stone-800 mb-2">
                    Feedback not available
                  </h3>
                  <p className="text-stone-500 text-sm">
                    This practice session doesn't have saved feedback data
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Icons
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const MicIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const ErrorIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const WarningIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export default PracticeReportsModal;
