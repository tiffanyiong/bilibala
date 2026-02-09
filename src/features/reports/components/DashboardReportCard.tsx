import React, { useState, useMemo, CSSProperties } from 'react';
import { DashboardPracticeSession } from '../../../shared/types/database';
import { SpeechAnalysisResult } from '../../../shared/types';
import { getBreakdown } from '../../../shared/utils/scoringUtils';
import { getScoringFramework } from '../../../shared/constants';
import SubScoreBar from '../../../shared/components/SubScoreBar';
import type { SubScoreDef } from '../../../shared/constants';

/** Get a sub-score label in the appropriate language (native for Easy level, target otherwise) */
function getSubLabel(sub: SubScoreDef, displayLang: string): string {
  if (sub.labelNative?.[displayLang]) return sub.labelNative[displayLang];
  if (displayLang.includes('中文') && sub.labelZh) return sub.labelZh;
  return sub.label;
}

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

interface DashboardReportCardProps {
  session: DashboardPracticeSession;
  showThumbnail?: boolean;
  onViewFullReport: () => void;
  onDelete?: (sessionId: string) => void;
  onToggleFavorite?: (sessionId: string, isFavorited: boolean) => void;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

const DashboardReportCard: React.FC<DashboardReportCardProps> = ({ session, showThumbnail = true, onViewFullReport, onDelete, onToggleFavorite }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const feedback = session.feedback_data as SpeechAnalysisResult | null;
  const score = session.score;
  const breakdown = getBreakdown(feedback?.feedback ?? null, session.target_lang);
  const framework = getScoringFramework(session.target_lang);
  const isDelivery = feedback?.detected_framework === 'PRACTICE_DELIVERY';
  const isEasy = session.level?.toLowerCase() === 'easy';
  const displayLang = isEasy ? (session.native_lang || 'English') : session.target_lang;

  // Deterministic accent color for this report card
  const accent = useMemo(() => {
    const idx = hashString(session.id) % cardAccents.length;
    return cardAccents[idx];
  }, [session.id]);

  return (
    <div className="group">
      {/* Compact row */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`report-card-row flex items-center gap-3 p-3 bg-white/40 backdrop-blur-sm border rounded-xl cursor-pointer transition-all duration-200 ${
          isExpanded
            ? 'border-stone-300 bg-white/60 shadow-sm rounded-b-none'
            : 'border-white/50'
        }`}
        style={{ '--card-hover-bg': accent.hover, '--card-hover-shadow': accent.shadow } as CSSProperties}
      >
        {/* Thumbnail */}
        {showThumbnail && (
          <img
            src={session.videoThumbnailUrl || `https://img.youtube.com/vi/${session.youtubeId}/mqdefault.jpg`}
            alt=""
            className="w-16 h-10 rounded-lg object-cover flex-shrink-0"
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-stone-400">{formatDate(session.created_at)}</span>
            {isDelivery && (
              <span className="text-[8px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Delivery</span>
            )}
          </div>
          <p className="text-sm text-stone-600 truncate mt-0.5">{session.question_text || '-'}</p>
        </div>

        {/* Favorite + Score + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(session.id, !session.is_favorited);
              }}
              className="p-1 rounded-full transition-all hover:scale-110 active:scale-95"
              aria-label={session.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={session.is_favorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-colors ${session.is_favorited ? 'text-rose-400' : 'text-stone-300 hover:text-rose-300'}`}
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          )}
          {score !== null && score !== undefined && (
            <span className={`text-lg font-semibold ${getScoreColor(score)} flex items-baseline gap-1`}>
              {breakdown?.framework === 'ielts' ? (
                <>{breakdown.band_score.toFixed(1)}<span className="text-[10px] text-stone-400 font-normal">{framework?.overallLabelNative?.[displayLang] || framework?.overallLabel || 'band'}</span></>
              ) : breakdown?.framework === 'hsk' ? (
                <>{Math.round(breakdown.hsk_level)}<span className="text-[10px] text-stone-400 font-normal ml-0.5">{framework?.overallLabelNative?.[displayLang] || framework?.overallLabel || 'Level'}</span></>
              ) : (
                score
              )}
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Accordion detail */}
      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 py-4 bg-white/60 backdrop-blur-sm border border-t-0 border-stone-300 rounded-b-xl space-y-4">
            {/* Score circle + summary row */}
            <div className="flex items-start gap-4">
              {/* Score ring */}
              {score !== null && score !== undefined && (
                <div className="flex-shrink-0">
                  <div className={`w-14 h-14 rounded-full border-2 ${getScoreBgColor(score)} flex flex-col items-center justify-center`}>
                    {breakdown?.framework === 'ielts' ? (
                      <>
                        <span className={`text-lg font-bold leading-none ${getScoreColor(score)}`}>{breakdown.band_score.toFixed(1)}</span>
                        <span className="text-[7px] text-stone-400 leading-none mt-0.5">band</span>
                      </>
                    ) : breakdown?.framework === 'hsk' ? (
                      <>
                        <span className={`text-lg font-bold leading-none ${getScoreColor(score)}`}>{Math.round(breakdown.hsk_level)}</span>
                        <span className="text-[7px] text-stone-400 leading-none mt-0.5">{framework?.overallLabelNative?.[displayLang] || framework?.overallLabel || 'Level'}</span>
                      </>
                    ) : (
                      <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-3">
                {/* Strengths */}
                {feedback?.feedback?.strengths && feedback.feedback.strengths.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide mb-1">Strengths</h4>
                    <ul className="space-y-0.5">
                      {feedback.feedback.strengths.slice(0, 3).map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {feedback?.feedback?.weaknesses && feedback.feedback.weaknesses.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium text-amber-600 uppercase tracking-wide mb-1">Areas to Improve</h4>
                    <ul className="space-y-0.5">
                      {feedback.feedback.weaknesses.slice(0, 3).map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-stone-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pronunciation */}
                {feedback?.pronunciation && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-stone-500">Pronunciation:</span>
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      feedback.pronunciation.overall === 'native-like' || feedback.pronunciation.overall === 'clear'
                        ? 'bg-emerald-50 text-emerald-600'
                        : feedback.pronunciation.overall === 'accented'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {feedback.pronunciation.overall}
                    </span>
                  </div>
                )}

                {/* Sub-score breakdown bars — hide 0-score entries */}
                {breakdown && framework && (
                  <div className="space-y-1.5 pt-1">
                    <h4 className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1">
                      {framework.name} Breakdown
                    </h4>
                    {framework.subScores
                      .filter((sub) => ((breakdown as unknown as Record<string, number>)[sub.key] ?? 0) > 0)
                      .map((sub) => (
                        <SubScoreBar
                          key={sub.key}
                          label={getSubLabel(sub, displayLang)}
                          value={(breakdown as unknown as Record<string, number>)[sub.key] ?? 0}
                          max={sub.max}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation banner — replaces actions when active */}
            {showConfirm ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 -mx-4 -mb-4 mt-2 bg-red-50/80 border-t border-red-100">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-xs text-red-600">Delete this report? This can't be undone.</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirm(false);
                    }}
                    className="px-3 py-1 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleting(true);
                      onDelete?.(session.id);
                    }}
                    disabled={isDeleting}
                    className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              /* Normal actions row */
              <div className="flex items-center justify-between">
                {onDelete ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirm(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Delete
                  </button>
                ) : <div />}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewFullReport();
                  }}
                  className="flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors"
                >
                  View Full Report
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardReportCard;
