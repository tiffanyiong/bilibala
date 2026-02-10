import React, { useState, useMemo, CSSProperties } from 'react';
import { DashboardPracticeSession } from '../../../shared/types/database';
import DashboardReportCard from './DashboardReportCard';
import { NavigateToVideoFn } from './ReportsDashboardPage';
import { getScoringFramework } from '../../../shared/constants';

// Low-saturated pastel accent colors (same as ExploreVideoCard)
const cardAccents = [
  { hover: 'rgba(180, 210, 240, 0.45)', shadow: 'rgba(180, 210, 240, 0.3)' },  // soft blue
  { hover: 'rgba(230, 215, 170, 0.45)', shadow: 'rgba(230, 215, 170, 0.3)' },  // soft yellow
  { hover: 'rgba(200, 220, 195, 0.45)', shadow: 'rgba(200, 220, 195, 0.3)' },  // soft green
  { hover: 'rgba(220, 200, 230, 0.45)', shadow: 'rgba(220, 200, 230, 0.3)' },  // soft lavender
  { hover: 'rgba(235, 205, 200, 0.45)', shadow: 'rgba(235, 205, 200, 0.3)' },  // soft pink
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Hash-based topic color (matches PracticeReportCard pattern)
const TOPIC_COLORS = [
  { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400' },
  { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  { bg: 'bg-lime-50', text: 'text-lime-600', dot: 'bg-lime-400' },
  { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  { bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-400' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-400' },
  { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' },
  { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400' },
  { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400' },
  { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', dot: 'bg-fuchsia-400' },
  { bg: 'bg-pink-50', text: 'text-pink-600', dot: 'bg-pink-400' },
];

function getTopicColor(topic: string) {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TOPIC_COLORS[Math.abs(hash) % TOPIC_COLORS.length];
}

interface ReportsVideoGroupProps {
  video: {
    title: string;
    thumbnailUrl: string | null;
    youtubeId: string;
    targetLang: string;
    nativeLang: string;
    level: string;
    analysisId: string;
  };
  sessions: DashboardPracticeSession[];
  onViewReport: (session: DashboardPracticeSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onToggleFavorite?: (sessionId: string, isFavorited: boolean) => void;
  onNavigateToVideo?: NavigateToVideoFn;
  defaultExpanded?: boolean;
}

const ReportsVideoGroup: React.FC<ReportsVideoGroupProps> = ({ video, sessions, onViewReport, onDeleteSession, onToggleFavorite, onNavigateToVideo, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Deterministic accent color for this video group
  const accent = useMemo(() => {
    const idx = hashString(video.youtubeId) % cardAccents.length;
    return cardAccents[idx];
  }, [video.youtubeId]);

  const framework = useMemo(() => getScoringFramework(video.targetLang), [video.targetLang]);

  const avgScore = useMemo(() => {
    const scored = sessions.filter((s) => s.score !== null && s.score !== undefined);
    if (scored.length === 0) return null;
    const genericAvg = scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length;
    if (framework) {
      // Convert to framework-native scale (e.g. IELTS 0-9, HSK 1-6) and round to nearest 0.5
      const native = framework.fromGenericScore(genericAvg);
      return Math.round(native * 2) / 2;
    }
    return Math.round(genericAvg);
  }, [sessions, framework]);

  // Group sessions by topic
  const topicGroups = useMemo(() => {
    const map = new Map<string, DashboardPracticeSession[]>();
    for (const s of sessions) {
      const topic = s.topic_text || 'General';
      if (!map.has(topic)) map.set(topic, []);
      map.get(topic)!.push(s);
    }
    return Array.from(map.entries());
  }, [sessions]);

  return (
    <div
      className={`report-video-group bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] overflow-hidden ${isExpanded ? 'expanded' : ''}`}
      style={{ '--card-hover-bg': accent.hover, '--card-hover-shadow': accent.shadow } as CSSProperties}
    >
      {/* Group header — thumbnail + title navigate to video, rest expands */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 p-4 hover:bg-white/30 transition-colors cursor-pointer"
      >
        {/* Video thumbnail — navigates to video */}
        <img
          src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
          alt=""
          className={`w-20 h-12 rounded-lg object-cover flex-shrink-0 ${onNavigateToVideo ? 'cursor-pointer hover:ring-2 hover:ring-stone-300 transition-all' : ''}`}
          onClick={(e) => {
            if (onNavigateToVideo) {
              e.stopPropagation();
              onNavigateToVideo(video);
            }
          }}
        />

        {/* Video info */}
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold text-stone-800 truncate ${onNavigateToVideo ? 'cursor-pointer hover:text-stone-600 hover:underline underline-offset-2' : ''}`}
            onClick={(e) => {
              if (onNavigateToVideo) {
                e.stopPropagation();
                onNavigateToVideo(video);
              }
            }}
          >
            {video.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-stone-500">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
            {avgScore !== null && (() => {
              // Use generic scale for color thresholds
              const colorScore = framework ? framework.toGenericScore(avgScore) : avgScore;
              return (
                <>
                  <span className="text-stone-300">·</span>
                  <span className={`text-[11px] font-medium ${
                    colorScore >= 80 ? 'text-emerald-600' : colorScore >= 60 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    avg {framework ? (framework.id === 'hsk' ? Math.round(avgScore) : avgScore.toFixed(1)) : avgScore}
                  </span>
                </>
              );
            })()}
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-400">{video.targetLang}</span>
            <span className="text-stone-300">·</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
              video.level === 'Easy' ? 'bg-green-50 text-green-600' :
              video.level === 'Hard' ? 'bg-red-50 text-red-600' :
              'bg-amber-50 text-amber-600'
            }`}>
              {video.level}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-stone-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Collapsible sessions list, sub-grouped by topic */}
      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3 border-t border-stone-100 pt-2 space-y-3">
            {topicGroups.map(([topic, topicSessions]) => {
              const color = getTopicColor(topic);
              return (
                <div key={topic}>
                  {/* Topic sub-header */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
                    <span className={`text-xs font-medium ${color.text}`}>{topic}</span>
                    <span className="text-[10px] text-stone-400">{topicSessions.length} session{topicSessions.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Cards for this topic */}
                  <div className="space-y-1.5">
                    {topicSessions.map((session) => (
                      <DashboardReportCard
                        key={session.id}
                        session={session}
                        showThumbnail={false}
                        onViewFullReport={() => onViewReport(session)}
                        onDelete={onDeleteSession}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsVideoGroup;
