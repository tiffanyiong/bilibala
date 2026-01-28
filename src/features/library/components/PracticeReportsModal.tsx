import React, { useEffect, useState, Component, ReactNode } from 'react';
import { DbPracticeSession } from '../../../shared/types/database';
import { SpeechAnalysisResult } from '../../../shared/types';
import { getPracticeSessionsForAnalysis } from '../../../shared/services/database';
import { useAuth } from '../../../shared/context/AuthContext';
import PracticeReportCard, { PracticeReportCardSkeleton } from './PracticeReportCard';
import PyramidFeedback from '../../practice/components/PyramidFeedback';
import { exportPracticeReportToPdf } from '../../../shared/utils/pdfExport';

// Stable default labels object to prevent infinite re-renders in PyramidFeedback
const DEFAULT_LABELS = {
  communicationLogic: 'Communication Logic',
  detected: 'Detected',
  myLogic: 'My Logic',
  aiImproved: 'AI Improved',
  legend: 'Legend',
  strong: 'Strong',
  weak: 'Weak',
  elaboration: 'Elaboration',
  critique: 'Critique',
  languagePolish: 'Language Polish & Alternatives',
  original: 'Original',
  betterAlternative: 'Better Alternative',
  coachFeedback: "Coach's Feedback",
  strengths: 'Strengths',
  areasForImprovement: 'Areas for Improvement',
  actionableTips: 'Actionable Tips',
  transcription: 'Transcription',
  yourRecording: 'Your Recording',
  recordAnswer: 'Record Answer',
  reviewAnswer: 'Review Answer',
  takeYourTime: 'Take your time',
  tapAnalyze: 'Tap analyze when ready',
  tryIncorporateFeedback: 'Try to incorporate the feedback',
  microphoneError: 'Microphone Error',
  retake: 'Retake',
  story: 'Story',
  fact: 'Fact',
  opinion: 'Opinion',
  scorePerfect: 'Perfect!',
  scoreExcellent: 'Excellent',
  scoreGreatJob: 'Great Job',
  scoreGoodStart: 'Good Start',
  scoreKeepGrowing: 'Keep Growing'
};

// Error boundary to catch PyramidFeedback crashes
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ReportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('PyramidFeedback error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Simple text-based feedback view as fallback when PyramidFeedback fails
const SimpleFeedbackView: React.FC<{
  analysis: SpeechAnalysisResult;
  audioUrl?: string | null;
}> = ({ analysis, audioUrl }) => {
  const { feedback, transcription, structure, improvements } = analysis;

  return (
    <div className="space-y-6">
      {/* Audio player */}
      {audioUrl && (
        <div className="bg-stone-50 p-4 rounded-lg">
          <p className="text-xs font-medium text-stone-500 mb-2">Your Recording</p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      {/* Transcription */}
      {transcription && (
        <div className="bg-stone-50 p-4 rounded-lg">
          <h4 className="font-medium text-stone-800 mb-2">Your Response</h4>
          <p className="text-stone-600 leading-relaxed">{transcription}</p>
        </div>
      )}

      {/* Main point/conclusion */}
      {structure?.conclusion && (
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h4 className="font-medium text-indigo-800 mb-2">Main Point Detected</h4>
          <p className="text-indigo-700">{structure.conclusion}</p>
        </div>
      )}

      {/* Strengths */}
      {feedback?.strengths && feedback.strengths.length > 0 && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <h4 className="font-medium text-green-800 mb-2">Strengths</h4>
          <ul className="list-disc list-inside space-y-1 text-green-700">
            {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {feedback?.weaknesses && feedback.weaknesses.length > 0 && (
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2">Areas for Improvement</h4>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {feedback?.suggestions && feedback.suggestions.length > 0 && (
        <div className="bg-stone-100 p-4 rounded-lg">
          <h4 className="font-medium text-stone-800 mb-2">Actionable Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Language improvements */}
      {improvements && improvements.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-stone-800">Language Polish</h4>
          {improvements.map((imp, i) => (
            <div key={i} className="bg-white p-4 rounded-lg border border-stone-200">
              <p className="text-red-600 text-sm mb-1">
                <span className="font-medium">Original:</span> "{imp.original}"
              </p>
              <p className="text-green-600 text-sm mb-1">
                <span className="font-medium">Better:</span> "{imp.improved}"
              </p>
              <p className="text-stone-500 text-xs">{imp.explanation}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-400 text-center italic">
        (Simplified view - graph visualization unavailable)
      </p>
    </div>
  );
};

interface PracticeReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId: string;
  videoTitle: string;
  targetLang: string;
  level: string;
  onExpand?: (sessionId?: string) => void;
}

type ViewMode = 'list' | 'report';

const PracticeReportsModal: React.FC<PracticeReportsModalProps> = ({
  isOpen,
  onClose,
  analysisId,
  videoTitle,
  targetLang,
  level,
  onExpand,
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
    console.log('[PracticeReportsModal] handleViewReport called with session:', session);
    console.log('[PracticeReportsModal] feedback_data:', session.feedback_data);
    console.log('[PracticeReportsModal] transcription:', session.transcription);
    setSelectedSession(session);
    setViewMode('report');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedSession(null);
  };

  // Format date for PDF export
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle PDF export
  const handleExportPdf = () => {
    if (!selectedSession) return;

    const analysis: SpeechAnalysisResult | null = selectedSession.feedback_data
      ? {
          transcription: selectedSession.transcription || '',
          ...(selectedSession.feedback_data as Omit<SpeechAnalysisResult, 'transcription'>),
        }
      : null;

    if (!analysis) return;

    exportPracticeReportToPdf(analysis, {
      videoTitle: videoTitle,
      topicText: selectedSession.topic_text || 'Practice Session',
      date: formatDate(selectedSession.created_at),
      targetLang: targetLang,
      level: level,
    });
  };

  if (!isOpen) return null;

  // Reconstruct full analysis data from session (feedback_data + transcription)
  const analysisData: SpeechAnalysisResult | null = selectedSession?.feedback_data
    ? {
        transcription: selectedSession.transcription || '',
        ...(selectedSession.feedback_data as Omit<SpeechAnalysisResult, 'transcription'>),
      }
    : null;

  // Debug logging
  if (viewMode === 'report' && selectedSession) {
    console.log('[PracticeReportsModal] Report view rendering:');
    console.log('  - analysisData:', analysisData);
    console.log('  - has structure:', !!analysisData?.structure);
    console.log('  - has feedback:', !!analysisData?.feedback);
    console.log('  - will render PyramidFeedback:', !!(analysisData && analysisData.structure && analysisData.feedback));
  }

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
          <div className="flex items-center gap-2">
            {/* Export PDF button - only show when viewing a report */}
            {viewMode === 'report' && selectedSession && analysisData && (
              <button
                onClick={handleExportPdf}
                className="text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="Export as PDF"
                title="Export as PDF"
              >
                <DownloadIcon />
              </button>
            )}
            {onExpand && (
              <button
                onClick={() => onExpand(viewMode === 'report' ? selectedSession?.id : undefined)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="Expand to full page"
                title="Expand to full page"
              >
                <ExpandIcon />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
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
              {analysisData &&
               analysisData.structure &&
               analysisData.structure.conclusion &&
               analysisData.structure.arguments &&
               analysisData.feedback ? (
                <ReportErrorBoundary
                  fallback={
                    <SimpleFeedbackView
                      analysis={analysisData}
                      audioUrl={selectedSession.audio_url}
                    />
                  }
                >
                  <PyramidFeedback
                    analysis={analysisData}
                    onRetry={() => {}} // No-op for read-only view
                    audioUrl={selectedSession.audio_url}
                    startRetake={() => {}} // No-op for read-only view
                    level={level}
                    nativeLang={selectedSession.native_lang || 'English'}
                    targetLang={targetLang}
                    preFetchedLabels={DEFAULT_LABELS}
                  />
                </ReportErrorBoundary>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                    <WarningIcon />
                  </div>
                  <h3 className="text-lg font-medium text-stone-800 mb-2">
                    Feedback not available
                  </h3>
                  <p className="text-stone-500 text-sm">
                    {selectedSession.feedback_data
                      ? 'The feedback data format is incomplete or corrupted'
                      : 'This practice session doesn\'t have saved feedback data'}
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

const ExpandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"></polyline>
    <polyline points="9 21 3 21 3 15"></polyline>
    <line x1="21" y1="3" x2="14" y2="10"></line>
    <line x1="3" y1="21" x2="10" y2="14"></line>
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

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

export default PracticeReportsModal;
