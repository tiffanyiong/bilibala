import React from 'react';
import { DbPracticeSession } from '../../../shared/types/database';

interface PracticeReportCardProps {
  session: DbPracticeSession;
  onClick: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export const PracticeReportCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-stone-200 p-4 animate-pulse">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-stone-200 rounded w-2/3" />
        <div className="h-3 bg-stone-200 rounded w-1/3" />
        <div className="h-4 bg-stone-200 rounded w-full mt-3" />
      </div>
      <div className="h-8 w-24 bg-stone-200 rounded" />
    </div>
  </div>
);

const PracticeReportCard: React.FC<PracticeReportCardProps> = ({ session, onClick }) => {
  const hasScore = session.score !== null;
  const transcriptionSnippet = session.transcription
    ? truncateText(session.transcription, 80)
    : 'No transcription available';

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Topic */}
          <h4 className="font-medium text-stone-800 truncate">
            {session.topic_text || 'Practice Session'}
          </h4>

          {/* Date & Score */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-stone-500">
              {formatDateTime(session.created_at)}
            </span>
            {hasScore && (
              <>
                <span className="text-stone-300">&middot;</span>
                <span className={`text-xs font-medium ${
                  session.score! >= 80 ? 'text-green-600' :
                  session.score! >= 60 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  Score: {session.score}
                </span>
              </>
            )}
          </div>

          {/* Transcription snippet */}
          <p className="text-sm text-stone-600 mt-2 italic">
            "{transcriptionSnippet}"
          </p>
        </div>

        {/* View button */}
        <button
          onClick={onClick}
          className="flex-shrink-0 text-xs font-medium text-stone-600 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
        >
          View Report
          <ArrowRightIcon />
        </button>
      </div>

      {/* Audio indicator */}
      {session.audio_url && (
        <div className="flex items-center gap-1 mt-3 text-xs text-stone-400">
          <AudioIcon />
          <span>Recording available</span>
        </div>
      )}
    </div>
  );
};

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const AudioIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);

export default PracticeReportCard;
