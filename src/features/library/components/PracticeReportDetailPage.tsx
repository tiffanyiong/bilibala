import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import { getBackendOrigin } from '../../../shared/services/backend';
import { getPracticeSessionById } from '../../../shared/services/database';
import { SpeechAnalysisResult } from '../../../shared/types';
import { DbPracticeSession, VideoHistoryItem } from '../../../shared/types/database';
import { exportPracticeReportToPdf } from '../../../shared/utils/pdfExport';
import PyramidFeedback from '../../practice/components/PyramidFeedback';

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
  aiVoice: 'AI Voice',
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
  scoreKeepGrowing: 'Keep Growing',
  // Pronunciation Analysis labels
  pronunciationIntonation: 'Pronunciation & Intonation',
  overallPronunciation: 'Overall Pronunciation',
  intonation: 'Intonation',
  wordPronunciation: 'Word Pronunciation',
  pronunciationNativeLike: 'native-like',
  pronunciationClear: 'clear',
  pronunciationAccented: 'accented',
  pronunciationNeedsWork: 'needs work',
  intonationNatural: 'natural',
  intonationFlat: 'flat',
  intonationMonotone: 'monotone',
  intonationOverlyExpressive: 'overly-expressive',
  pronunciationGood: 'Good',
  pronunciationNeedsWorkLabel: 'Needs Work',
  pronunciationUnclear: 'Unclear',
  // Header labels
  topic: 'Topic',
  question: 'Question',
  video: 'Video',
  source: 'Source',
  // Button labels
  downloadPdf: 'Download PDF',
  exporting: 'Exporting...',
};

// Error boundary to catch PyramidFeedback crashes
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ReportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PyramidFeedback error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Simple text-based feedback view as fallback
const SimpleFeedbackView: React.FC<{
  analysis: SpeechAnalysisResult;
  audioUrl?: string | null;
}> = ({ analysis, audioUrl }) => {
  const { feedback, transcription, structure, improvements } = analysis;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {audioUrl && (
        <div className="bg-stone-50 p-4 rounded-lg">
          <p className="text-xs font-medium text-stone-500 mb-2">Your Recording</p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      {transcription && (
        <div className="bg-stone-50 p-4 rounded-lg">
          <h4 className="font-medium text-stone-800 mb-2">Your Response</h4>
          <p className="text-stone-600 leading-relaxed">{transcription}</p>
        </div>
      )}

      {structure?.conclusion && (
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h4 className="font-medium text-indigo-800 mb-2">Main Point Detected</h4>
          <p className="text-indigo-700">{structure.conclusion}</p>
        </div>
      )}

      {feedback?.strengths && feedback.strengths.length > 0 && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <h4 className="font-medium text-green-800 mb-2">Strengths</h4>
          <ul className="list-disc list-inside space-y-1 text-green-700">
            {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {feedback?.weaknesses && feedback.weaknesses.length > 0 && (
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2">Areas for Improvement</h4>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {feedback?.suggestions && feedback.suggestions.length > 0 && (
        <div className="bg-stone-100 p-4 rounded-lg">
          <h4 className="font-medium text-stone-800 mb-2">Actionable Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

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

interface PracticeReportDetailPageProps {
  sessionId: string;
  video: VideoHistoryItem;
  onBack: () => void;
  onBackToLibrary: () => void;
}

const PracticeReportDetailPage: React.FC<PracticeReportDetailPageProps> = ({
  sessionId,
  video,
  onBack,
  onBackToLibrary,
}) => {
  const { user } = useAuth();
  const { canExportPdf, recordAction } = useSubscription();
  const [session, setSession] = useState<DbPracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translatedLabels, setTranslatedLabels] = useState<typeof DEFAULT_LABELS>(DEFAULT_LABELS);

  // Fetch translated labels based on level
  useEffect(() => {
    if (!session) return;

    const isEasy = video.level.toLowerCase() === 'easy';
    const nativeLang = session.native_lang || 'English';
    const languageToUse = isEasy ? nativeLang : video.targetLang;

    // Skip translation if using English
    if (!languageToUse || languageToUse.toLowerCase().includes('english')) {
      setTranslatedLabels(DEFAULT_LABELS);
      return;
    }

    // Check cache first (v3 adds downloadPdf/exporting labels)
    const cacheKey = `ui-labels-v3-${languageToUse}-${isEasy}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedLabels({ ...DEFAULT_LABELS, ...JSON.parse(cached) });
        return;
      }
    } catch {}

    // Fetch translations from backend
    fetch(`${getBackendOrigin()}/api/translate-ui-labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: languageToUse, isEasyLevel: isEasy, sourceLabels: DEFAULT_LABELS })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.labels) {
          setTranslatedLabels({ ...DEFAULT_LABELS, ...data.labels });
          localStorage.setItem(cacheKey, JSON.stringify(data.labels));
        }
      })
      .catch(err => console.error('Translation error:', err));
  }, [session, video.level, video.targetLang]);

  // Fetch session on mount
  useEffect(() => {
    if (user && sessionId) {
      setLoading(true);
      setError(null);

      getPracticeSessionById(user.id, sessionId)
        .then((data) => {
          if (data) {
            setSession(data);
          } else {
            setError('Report not found');
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch practice session:', err);
          setError('Failed to load report.');
          setLoading(false);
        });
    }
  }, [user, sessionId]);

  // Reconstruct analysis data
  const analysisData: SpeechAnalysisResult | null = session?.feedback_data
    ? {
        transcription: session.transcription || '',
        ...(session.feedback_data as Omit<SpeechAnalysisResult, 'transcription'>),
      }
    : null;

  const canRenderPyramid = analysisData &&
    analysisData.structure &&
    analysisData.structure.conclusion &&
    analysisData.structure.arguments &&
    analysisData.feedback;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle PDF export
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    if (!analysisData || !session || isExporting) return;

    if (!canExportPdf) {
      // PDF export is Pro-only; don't proceed
      return;
    }

    setIsExporting(true);
    try {
      await exportPracticeReportToPdf(analysisData, {
        videoTitle: video.title,
        topicText: session.topic_text || 'Practice Session',
        questionText: session.question_text || undefined,
        date: formatDate(session.created_at),
        targetLang: video.targetLang,
        nativeLang: session.native_lang || 'English',
        level: video.level,
      });
      // Record PDF export usage
      recordAction('pdf_export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#FAF9F6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {/* Breadcrumb and Export button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={onBack}
                className="text-stone-500 hover:text-stone-700 transition-colors flex items-center gap-1"
              >
                <BackIcon />
                <span>Reports</span>
              </button>
              <span className="text-stone-300">/</span>
              <span className="text-stone-700 font-medium">Feedback</span>
            </div>
            {/* Export PDF button */}
            {analysisData && canRenderPyramid && (
              <button
                onClick={handleExportPdf}
                disabled={isExporting || !canExportPdf}
                className={`group flex items-center gap-1.5 rounded-full transition-all duration-300 ease-out ${
                  !canExportPdf
                    ? 'text-stone-300 cursor-not-allowed p-1.5 pr-1.5 hover:pr-3'
                    : isExporting
                      ? 'text-stone-700 p-1.5 pr-3 cursor-wait'
                      : 'text-stone-700 hover:text-stone-900 p-1.5 pr-1.5 hover:pr-3'
                }`}
                title={!canExportPdf ? 'PDF export requires Pro plan' : undefined}
              >
                <span className="flex-shrink-0 flex items-center justify-center">
                  {isExporting ? <SpinnerIcon /> : <DownloadIcon />}
                </span>
                <span
                  className={`grid transition-all duration-300 ease-out ${
                    isExporting
                      ? 'grid-cols-[1fr] opacity-100'
                      : 'grid-cols-[0fr] opacity-0 group-hover:grid-cols-[1fr] group-hover:opacity-100'
                  }`}
                >
                  <span className="overflow-hidden whitespace-nowrap text-sm font-medium">
                    {isExporting ? translatedLabels.exporting : translatedLabels.downloadPdf}
                  </span>
                </span>
                {!canExportPdf && (
                  <span className="grid grid-cols-[0fr] opacity-0 group-hover:grid-cols-[1fr] group-hover:opacity-100 transition-all duration-300 ease-out">
                    <span className="overflow-hidden whitespace-nowrap text-[10px] bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded-full">
                      PRO
                    </span>
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Topic */}
          <h1 className="text-xl font-semibold text-stone-800">
            {session?.topic_text || 'Practice Session'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="pb-8">
        {/* Loading state */}
        {loading && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-stone-200 rounded w-1/3 mx-auto" />
              <div className="h-64 bg-stone-200 rounded" />
              <div className="h-32 bg-stone-200 rounded" />
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <ErrorIcon />
            </div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">
              {error}
            </h3>
            <button
              onClick={onBack}
              className="mt-4 text-sm font-medium text-stone-800 underline hover:no-underline"
            >
              Back to reports
            </button>
          </div>
        )}

        {/* Report content */}
        {!loading && !error && session && (
          <>
            {/* Question Card - Frosted Glass Design */}
            {session.question_text && (
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="p-4 bg-white/50 backdrop-blur-xl rounded-xl border border-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/60 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/50 shadow-sm">
                      <QuestionIcon />
                    </div>
                    <p className="text-xs font-medium text-stone-800 uppercase tracking-wide">{translatedLabels.question}</p>
                  </div>
                  <p className="text-stone-700 leading-relaxed">{session.question_text}</p>
                  {/* Metadata */}
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="text-stone-400 italic">{translatedLabels.source}: {video.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-stone-400">
                        {formatDate(session.created_at)}
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/50 text-stone-500 font-medium">
                        {video.targetLang}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/50 text-stone-500 font-medium">
                        {video.level}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {canRenderPyramid ? (
              <ReportErrorBoundary
                fallback={
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SimpleFeedbackView
                      analysis={analysisData!}
                      audioUrl={session.audio_url}
                    />
                  </div>
                }
              >
                <PyramidFeedback
                  analysis={analysisData!}
                  onRetry={() => {}}
                  audioUrl={session.audio_url}
                  startRetake={() => {}}
                  level={video.level}
                  nativeLang={session.native_lang || 'English'}
                  targetLang={video.targetLang}
                  preFetchedLabels={translatedLabels}
                  showRetry={false}
                />
              </ReportErrorBoundary>
            ) : (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
                  <WarningIcon />
                </div>
                <h3 className="text-lg font-medium text-stone-800 mb-2">
                  Feedback not available
                </h3>
                <p className="text-stone-500 text-sm">
                  {session.feedback_data
                    ? 'The feedback data format is incomplete or corrupted'
                    : 'This practice session doesn\'t have saved feedback data'}
                </p>
              </div>
            )}
          </>
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

const QuestionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const ErrorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const WarningIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block animate-spin">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
  </svg>
);

export default PracticeReportDetailPage;
