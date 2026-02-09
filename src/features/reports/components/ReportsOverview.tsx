import React, { useMemo } from 'react';
import { DashboardPracticeSession } from '../../../shared/types/database';
import { getScoringFramework } from '../../../shared/constants';
import ReportsScoreChart from './ReportsScoreChart';

interface ReportsOverviewProps {
  sessions: DashboardPracticeSession[];
  activeLanguage?: string | null;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const ReportsOverview: React.FC<ReportsOverviewProps> = ({ sessions, activeLanguage }) => {
  // Filter sessions by active language for stats
  const filtered = useMemo(() => {
    if (!activeLanguage) return sessions;
    return sessions.filter((s) => s.target_lang === activeLanguage);
  }, [sessions, activeLanguage]);

  const framework = activeLanguage ? getScoringFramework(activeLanguage) : null;

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;

    const totalSessions = filtered.length;

    const scoredSessions = filtered.filter((s) => s.score !== null && s.score !== undefined);

    // Calculate average in framework-native scale (e.g. IELTS band, HSK level)
    let avgFrameworkScore = 0;
    if (scoredSessions.length > 0) {
      if (framework) {
        // Convert each session's generic score to framework scale, then average
        const sum = scoredSessions.reduce((acc, s) => acc + framework.fromGenericScore(s.score || 0), 0);
        avgFrameworkScore = Math.round((sum / scoredSessions.length) * 2) / 2; // Round to nearest 0.5
      } else {
        avgFrameworkScore = Math.round(scoredSessions.reduce((acc, s) => acc + (s.score || 0), 0) / scoredSessions.length);
      }
    }

    const totalTime = filtered.reduce((sum, s) => {
      if (s.recording_duration_sec) return sum + s.recording_duration_sec;
      if (s.transcription) {
        const wordCount = s.transcription.trim().split(/\s+/).length;
        return sum + Math.round((wordCount / 120) * 60);
      }
      return sum;
    }, 0);

    // Strongest topic — also use framework-native scores
    const topicScores = new Map<string, { total: number; count: number }>();
    for (const s of scoredSessions) {
      const topic = s.topic_text || 'General';
      const entry = topicScores.get(topic) || { total: 0, count: 0 };
      const score = framework ? framework.fromGenericScore(s.score || 0) : (s.score || 0);
      entry.total += score;
      entry.count += 1;
      topicScores.set(topic, entry);
    }
    let strongestTopic = '-';
    let highestAvg = 0;
    for (const [topic, { total, count }] of topicScores) {
      const avg = total / count;
      if (avg > highestAvg) {
        highestAvg = avg;
        strongestTopic = topic;
      }
    }

    return { totalSessions, avgFrameworkScore, totalTime, strongestTopic, highestAvg };
  }, [filtered, framework]);

  const chartData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return filtered
      .filter((s) => s.score !== null && s.score !== undefined && new Date(s.created_at) >= thirtyDaysAgo)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((s) => ({
        date: s.created_at,
        score: s.score || 0,
        label: s.topic_text,
      }));
  }, [filtered]);

  if (!stats) return null;

  // Language-specific average display (score is already in framework scale)
  const avgDisplay = (() => {
    if (framework) {
      const genericEquiv = framework.toGenericScore(stats.avgFrameworkScore);
      return {
        label: `Avg ${framework.overallLabel}`,
        value: framework.id === 'hsk' ? String(Math.round(stats.avgFrameworkScore)) : stats.avgFrameworkScore.toFixed(1),
        subtitle: framework.bandDescriptors[Math.floor(stats.avgFrameworkScore)] || '',
        color: getScoreColor(genericEquiv),
      };
    }
    return {
      label: 'Average Score',
      value: stats.avgFrameworkScore.toString(),
      subtitle: '',
      color: getScoreColor(stats.avgFrameworkScore),
    };
  })();

  const cards = [
    { label: 'Total Sessions', value: stats.totalSessions.toString(), subtitle: 'practice sessions' },
    { label: avgDisplay.label, value: avgDisplay.value, subtitle: avgDisplay.subtitle, color: avgDisplay.color },
    { label: 'Practice Time', value: formatDuration(stats.totalTime), subtitle: 'est. speaking time' },
    { label: 'Strongest Topic', value: stats.strongestTopic, subtitle: framework ? `avg ${framework.id === 'hsk' ? Math.round(stats.highestAvg) : stats.highestAvg.toFixed(1)}` : `avg ${Math.round(stats.highestAvg)}`, isText: true },
  ];

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card, i) => (
          <div
            key={card.label}
            style={{ animationDelay: `${i * 60}ms` }}
            className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] p-4 sm:p-5 animate-[glassDropIn_0.3s_ease-out_both]"
          >
            <p className="text-[10px] sm:text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-xl sm:text-2xl font-serif ${card.color || 'text-stone-800'} ${card.isText ? 'text-sm sm:text-base leading-snug line-clamp-2' : ''}`}>
              {card.value}
            </p>
            <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Score trend chart */}
      {chartData.length >= 2 && (
        <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] p-4 sm:p-5 mt-4 animate-[glassDropIn_0.3s_ease-out_0.25s_both]">
          <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">Score Trend (Last 30 Days)</h3>
          <ReportsScoreChart dataPoints={chartData} targetLang={activeLanguage || undefined} />
        </div>
      )}
    </div>
  );
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

export default ReportsOverview;
