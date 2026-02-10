import React, { useState, useMemo } from 'react';
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

// Short date format for mobile (e.g., "Feb 4")
function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

          {/* Date */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-stone-500">
              {formatDateTime(session.created_at)}
            </span>
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

const SortIcon: React.FC<{ direction: 'asc' | 'desc' }> = ({ direction }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline-block ml-1"
  >
    {direction === 'desc' ? (
      <path d="M12 5v14M5 12l7 7 7-7" />
    ) : (
      <path d="M12 19V5M5 12l7-7 7 7" />
    )}
  </svg>
);

// Notion-style pill colors (desaturated backgrounds)
const TOPIC_COLORS = [
  { bg: 'bg-red-50', text: 'text-red-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-amber-50', text: 'text-amber-600' },
  { bg: 'bg-yellow-50', text: 'text-yellow-600' },
  { bg: 'bg-lime-50', text: 'text-lime-600' },
  { bg: 'bg-green-50', text: 'text-green-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  { bg: 'bg-sky-50', text: 'text-sky-600' },
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  { bg: 'bg-violet-50', text: 'text-violet-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
];

// Simple hash function to get consistent color for each topic
function getTopicColor(topic: string) {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TOPIC_COLORS.length;
  return TOPIC_COLORS[index];
}

// Topic pill component
const TopicPill: React.FC<{ topic: string }> = ({ topic }) => {
  const color = getTopicColor(topic);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color.bg} ${color.text}`}
    >
      {topic}
    </span>
  );
};

// Table view component
interface PracticeReportTableProps {
  sessions: DbPracticeSession[];
  onViewReport: (session: DbPracticeSession) => void;
}

export const PracticeReportTable: React.FC<PracticeReportTableProps> = ({
  sessions,
  onViewReport,
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sort sessions by date
  const sortedSessions = useMemo(() => {
    const result = [...sessions];
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [sessions, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-500 border-b border-stone-200">
            <th
              className="py-3 px-2 font-medium cursor-pointer hover:text-stone-700 transition-colors whitespace-nowrap"
              onClick={toggleSortOrder}
            >
              Date
              <SortIcon direction={sortOrder} />
            </th>
            <th className="py-3 px-2 font-medium">Topic</th>
            <th className="py-3 px-2 font-medium">Question</th>
            <th className="py-3 px-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {sortedSessions.map((session) => (
            <tr
              key={session.id}
              onClick={() => onViewReport(session)}
              className="group border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-2 text-stone-500 whitespace-nowrap">
                <span className="sm:hidden">{formatDateShort(session.created_at)}</span>
                <span className="hidden sm:inline">{formatDateTime(session.created_at)}</span>
              </td>
              <td className="py-3 px-2">
                <TopicPill topic={session.topic_text || 'Practice Session'} />
              </td>
              <td className="py-3 px-2 text-stone-600 max-w-[200px] truncate">
                {session.question_text || '-'}
              </td>
              <td className="py-3 px-2">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-stone-500 hover:text-stone-700">
                  Open
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Table skeleton for loading state
export const PracticeReportTableSkeleton: React.FC = () => (
  <div className="animate-pulse overflow-x-auto">
    {/* Table skeleton */}
    <div className="space-y-0">
      {/* Header */}
      <div className="flex border-b border-stone-200 py-3 px-2 gap-4">
        <div className="h-4 w-28 bg-stone-200 rounded" />
        <div className="h-4 w-20 bg-stone-200 rounded" />
        <div className="h-4 w-48 bg-stone-200 rounded flex-1" />
        <div className="h-4 w-10 bg-stone-200 rounded" />
      </div>
      {/* Rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex border-b border-stone-100 py-3 px-2 gap-4 items-center">
          <div className="h-4 w-28 bg-stone-100 rounded" />
          <div className="h-5 w-20 bg-stone-100 rounded-md" />
          <div className="h-4 w-48 bg-stone-100 rounded flex-1" />
          <div className="h-4 w-10" />
        </div>
      ))}
    </div>
  </div>
);

export default PracticeReportCard;
