import React, { useMemo } from 'react';
import { DashboardPracticeSession } from '../../../shared/types/database';
import { getScoringFramework } from '../../../shared/constants';
import ReportsScoreChart from './ReportsScoreChart';

interface ReportsOverviewProps {
  sessions: DashboardPracticeSession[];
  activeLanguage?: string | null;
}

interface LanguageSwitcherProps {
  languages: string[];
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  disabled?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ languages, selectedLanguage, onLanguageChange, disabled = false }) => {
  if (languages.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
      <span className="text-xs font-medium text-stone-500 flex-shrink-0">Language:</span>
      <div className="flex gap-1.5">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => !disabled && onLanguageChange(lang)}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
              selectedLanguage === lang
                ? 'bg-stone-800 text-white shadow-sm'
                : 'bg-white/70 text-stone-600 hover:bg-white hover:text-stone-800 border border-stone-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
};

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const ReportsOverview: React.FC<ReportsOverviewProps> = ({ sessions, activeLanguage }) => {
  // When "All" is active and user has multiple languages, allow them to switch
  const [overviewLanguage, setOverviewLanguage] = React.useState<string | null>(null);

  // Determine available languages
  const availableLanguages = useMemo(() => {
    const langSet = new Set<string>();
    for (const s of sessions) {
      if (s.target_lang) langSet.add(s.target_lang);
    }
    return Array.from(langSet).sort();
  }, [sessions]);

  // When activeLanguage is null (All filter), find most recently used language
  const mostRecentLanguage = useMemo(() => {
    if (!sessions.length) return null;
    // Sort by created_at descending, find first session with a target_lang
    const sorted = [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted.find((s) => s.target_lang)?.target_lang || null;
  }, [sessions]);

  // Reset overviewLanguage when activeLanguage changes
  React.useEffect(() => {
    if (activeLanguage) {
      setOverviewLanguage(null); // Reset when a specific language is selected
    }
  }, [activeLanguage]);

  // Determine which language to use for stats
  const statsLanguage = activeLanguage || overviewLanguage || mostRecentLanguage;

  // Filter sessions by stats language for overview calculations
  const filtered = useMemo(() => {
    if (!statsLanguage) return sessions;
    return sessions.filter((s) => s.target_lang === statsLanguage);
  }, [sessions, statsLanguage]);

  const framework = statsLanguage ? getScoringFramework(statsLanguage) : null;

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

    // Strongest topic — group by topic and accumulate GENERIC scores
    const topicScores = new Map<string, { total: number; count: number }>();
    for (const s of scoredSessions) {
      const topic = s.topic_text || 'General';
      const entry = topicScores.get(topic) || { total: 0, count: 0 };
      entry.total += (s.score || 0); // Keep generic score
      entry.count += 1;
      topicScores.set(topic, entry);
    }
    let strongestTopic = '-';
    let highestAvg = 0;
    for (const [topic, { total, count }] of topicScores) {
      // Calculate average in generic scale first, then convert to framework scale
      // This matches ReportsVideoGroup.tsx logic (lines 83-87)
      const genericAvg = total / count;
      const frameworkAvg = framework
        ? Math.round(framework.fromGenericScore(genericAvg) * 2) / 2
        : Math.round(genericAvg);
      if (frameworkAvg > highestAvg) {
        highestAvg = frameworkAvg;
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
      {/* Language switcher (only show when All filter is active and multiple languages exist) */}
      {!activeLanguage && availableLanguages.length > 1 && (
        <LanguageSwitcher
          languages={availableLanguages}
          selectedLanguage={statsLanguage || availableLanguages[0]}
          onLanguageChange={setOverviewLanguage}
        />
      )}

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
