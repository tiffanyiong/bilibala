import React from 'react';
import { ScoringBreakdown } from '../../../shared/types';
import { getScoringFramework } from '../../../shared/constants';
import SubScoreBar from '../../../shared/components/SubScoreBar';

// ─── IELTS Band Descriptors (keyed by floor of band_score) ───
const IELTS_COLORS: Record<number, { color: string; dot: string; bg: string }> = {
  9: { color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50/60' },
  8: { color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  7: { color: 'text-indigo-600', dot: 'bg-indigo-500', bg: 'bg-indigo-50/60' },
  6: { color: 'text-sky-600', dot: 'bg-sky-500', bg: 'bg-sky-50/60' },
  5: { color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50/60' },
  4: { color: 'text-orange-600', dot: 'bg-orange-500', bg: 'bg-orange-50/60' },
  3: { color: 'text-stone-600', dot: 'bg-stone-500', bg: 'bg-stone-100/80' },
  2: { color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100/60' },
  1: { color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100/50' },
  0: { color: 'text-stone-400', dot: 'bg-stone-300', bg: 'bg-stone-100/40' },
};

// ─── HSK Level Colors ───
const HSK_COLORS: Record<number, { color: string; dot: string; bg: string }> = {
  6: { color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50/60' },
  5: { color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  4: { color: 'text-indigo-600', dot: 'bg-indigo-500', bg: 'bg-indigo-50/60' },
  3: { color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50/60' },
  2: { color: 'text-stone-600', dot: 'bg-stone-500', bg: 'bg-stone-100/80' },
  1: { color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100/50' },
};

// ─── Generic role config (legacy / non-framework languages) ───
const ROLES_CONFIG: Record<string, {
  min: number;
  color: string;
  dot: string;
  bg: string;
  labels: Record<string, string>;
}> = {
  master: {
    min: 95, color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50/60',
    labels: {
      'English': 'Language Master', 'Chinese (Mandarin - 中文)': '语言大师',
      'Japanese (日本語)': '言語マスター', 'Korean (한국어)': '언어 마스터',
      'Spanish (Español)': 'Maestro del Idioma', 'French (Français)': 'Maître de Langue',
    }
  },
  expert: {
    min: 85, color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50/60',
    labels: {
      'English': 'Fluency Expert', 'Chinese (Mandarin - 中文)': '流利专家',
      'Japanese (日本語)': '流暢エキスパート', 'Korean (한국어)': '유창함 전문가',
      'Spanish (Español)': 'Experto en Fluidez', 'French (Français)': 'Expert en Fluidité',
    }
  },
  pioneer: {
    min: 70, color: 'text-indigo-600', dot: 'bg-indigo-500', bg: 'bg-indigo-50/60',
    labels: {
      'English': 'Logic Pioneer', 'Chinese (Mandarin - 中文)': '逻辑先锋',
      'Japanese (日本語)': 'ロジックパイオニア', 'Korean (한국어)': '논리 개척자',
      'Spanish (Español)': 'Pionero Lógico', 'French (Français)': 'Pionnier Logique',
    }
  },
  speaker: {
    min: 55, color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50/60',
    labels: {
      'English': 'Active Speaker', 'Chinese (Mandarin - 中文)': '积极表达者',
      'Japanese (日本語)': 'アクティブスピーカー', 'Korean (한국어)': '적극적 화자',
      'Spanish (Español)': 'Hablante Activo', 'French (Français)': 'Orateur Actif',
    }
  },
  talent: {
    min: 40, color: 'text-stone-600', dot: 'bg-stone-500', bg: 'bg-stone-100/80',
    labels: {
      'English': 'Emerging Talent', 'Chinese (Mandarin - 中文)': '潜力新星',
      'Japanese (日本語)': '新進タレント', 'Korean (한국어)': '떠오르는 인재',
      'Spanish (Español)': 'Talento Emergente', 'French (Français)': 'Talent Émergent',
    }
  },
  explorer: {
    min: 0, color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100/50',
    labels: {
      'English': 'Explorer', 'Chinese (Mandarin - 中文)': '探索者',
      'Japanese (日本語)': '探検者', 'Korean (한국어)': '탐험가',
      'Spanish (Español)': 'Explorador', 'French (Français)': 'Explorateur',
    }
  },
};

const translations: Record<string, {
  than: string; peers: string; nextGoal: string; peak: string;
}> = {
  'English': { than: 'Performing better than', peers: 'of learners', nextGoal: 'NEXT MILESTONE:', peak: 'Peak' },
  'Chinese (Mandarin - 中文)': { than: '表现优于', peers: '的学习者', nextGoal: '下一目标:', peak: '巅峰' },
  'Japanese (日本語)': { than: '学習者の上位', peers: 'のパフォーマンス', nextGoal: '次の目標:', peak: '頂点' },
  'Korean (한국어)': { than: '학습자 중 상위', peers: '의 성과', nextGoal: '다음 목표:', peak: '정점' },
  'Spanish (Español)': { than: 'Mejor que', peers: 'de los estudiantes', nextGoal: 'PRÓXIMA META:', peak: 'Cima' },
  'French (Français)': { than: 'Meilleur que', peers: 'des apprenants', nextGoal: 'PROCHAIN OBJECTIF:', peak: 'Sommet' },
};

interface PerformanceCardProps {
  score: number;
  targetLang?: string;
  nativeLang?: string;
  level?: string;
  breakdown?: ScoringBreakdown | null;
  isDeliveryMode?: boolean;
}

/** Get a sub-score label in the appropriate language (native for Easy level, target otherwise) */
function getSubLabel(sub: { label: string; labelZh?: string; labelNative?: Record<string, string> }, displayLang: string): string {
  if (sub.labelNative?.[displayLang]) return sub.labelNative[displayLang];
  if (displayLang.includes('中文') && sub.labelZh) return sub.labelZh;
  return sub.label;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  score,
  targetLang = 'English',
  nativeLang = 'English',
  level = 'Medium',
  breakdown,
  isDeliveryMode = false,
}) => {
  const isEasy = level.toLowerCase() === 'easy';
  const displayLang = isEasy ? nativeLang : targetLang;
  const framework = getScoringFramework(targetLang);

  // ─── IELTS Layout ───
  if (breakdown?.framework === 'ielts' && framework) {
    const b = breakdown;
    const bandFloor = Math.floor(b.band_score);
    const colors = IELTS_COLORS[bandFloor] || IELTS_COLORS[0];
    const descriptor = b.band_descriptor || framework.bandDescriptors[bandFloor] || '';

    return (
      <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-5 border border-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] w-full mb-6">
        <div className="flex flex-col gap-3">
          {/* Header: descriptor + delivery label */}
          <div className="flex items-start justify-between gap-2">
            <div className={`flex items-start gap-2 ${colors.bg} px-3 py-2 rounded-xl`}>
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-1.5 flex-shrink-0`} />
              <span className={`text-xs leading-relaxed ${colors.color}`}>
                {descriptor}
              </span>
            </div>
            {isDeliveryMode && (
              <span className="text-[9px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 mt-1">
                Delivery Score
              </span>
            )}
          </div>

          {/* Band Score Display */}
          <div className="flex items-baseline gap-2 pb-1">
            <span className={`text-3xl font-bold ${colors.color} tabular-nums`}>
              {b.band_score.toFixed(1)}
            </span>
            <span className="text-xs text-stone-400 font-medium">{framework.overallLabelNative?.[displayLang] || framework.overallLabel}</span>
          </div>

          {/* Sub-Score Bars — hide 0-score entries (old sessions with missing data) */}
          <div className="space-y-2 pt-1">
            {framework.subScores
              .filter((sub) => ((b as unknown as Record<string, number>)[sub.key] ?? 0) > 0)
              .map((sub) => {
                const val = (b as unknown as Record<string, number>)[sub.key] ?? 0;
                return (
                  <SubScoreBar
                    key={sub.key}
                    label={getSubLabel(sub, displayLang)}
                    value={val}
                    max={sub.max}
                  />
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // ─── HSK Layout ───
  if (breakdown?.framework === 'hsk' && framework) {
    const b = breakdown;
    const levelFloor = Math.floor(b.hsk_level);
    const colors = HSK_COLORS[levelFloor] || HSK_COLORS[1];
    const descriptor = b.level_descriptor || framework.bandDescriptors[levelFloor] || '';

    return (
      <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-5 border border-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] w-full mb-6">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className={`flex items-start gap-2 ${colors.bg} px-3 py-2 rounded-xl`}>
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-1.5 flex-shrink-0`} />
              <span className={`text-xs leading-relaxed ${colors.color}`}>
                {descriptor}
              </span>
            </div>
            {isDeliveryMode && (
              <span className="text-[9px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 mt-1">
                Delivery Score
              </span>
            )}
          </div>

          {/* HSK Level Display */}
          <div className="flex items-baseline gap-2 pb-1">
            <span className={`text-3xl font-bold ${colors.color} tabular-nums`}>
              {Math.round(b.hsk_level)}
            </span>
            <span className="text-xs text-stone-400 font-medium">{framework.overallLabelNative?.[displayLang] || framework.overallLabel}</span>
          </div>

          {/* Sub-Score Bars — hide 0-score entries (old sessions with missing data) */}
          <div className="space-y-2 pt-1">
            {framework.subScores
              .filter((sub) => ((b as unknown as Record<string, number>)[sub.key] ?? 0) > 0)
              .map((sub) => {
                const val = (b as unknown as Record<string, number>)[sub.key] ?? 0;
                return (
                  <SubScoreBar
                    key={sub.key}
                    label={getSubLabel(sub, displayLang)}
                    value={val}
                    max={sub.max}
                  />
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Generic Layout (legacy / non-framework languages) ───
  const t = translations[displayLang] || translations['English'];

  const getRoleInfo = (s: number) => {
    const getLabel = (roleKey: string) => {
      return ROLES_CONFIG[roleKey].labels[displayLang] || ROLES_CONFIG[roleKey].labels['English'];
    };

    if (s >= 95) return { ...ROLES_CONFIG.master, title: getLabel('master'), next: t.peak, nextScore: 100 };
    if (s >= 85) return { ...ROLES_CONFIG.expert, title: getLabel('expert'), next: getLabel('master'), nextScore: 95 };
    if (s >= 70) return { ...ROLES_CONFIG.pioneer, title: getLabel('pioneer'), next: getLabel('expert'), nextScore: 85 };
    if (s >= 55) return { ...ROLES_CONFIG.speaker, title: getLabel('speaker'), next: getLabel('pioneer'), nextScore: 70 };
    if (s >= 40) return { ...ROLES_CONFIG.talent, title: getLabel('talent'), next: getLabel('speaker'), nextScore: 55 };
    return { ...ROLES_CONFIG.explorer, title: getLabel('explorer'), next: getLabel('talent'), nextScore: 40 };
  };

  const role = getRoleInfo(score);
  const fakePercentile = Math.floor(score + (100 - score) * 0.42);
  const progress = score >= 95 ? 100 : (score / role.nextScore) * 100;

  return (
    <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-5 border border-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03] w-full mb-6">
      <div className="flex flex-col gap-4">
        {/* Role Badge */}
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 ${role.bg} px-2.5 py-1 rounded-full`}>
            <div className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
            <span className={`text-[9px] font-black ${role.color} uppercase tracking-widest`}>
              {role.title}
            </span>
          </div>
          {isDeliveryMode && (
            <span className="text-[9px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Delivery Score
            </span>
          )}
        </div>

        {/* Percentile */}
        <div className="pb-1">
          <p className="text-stone-500 text-[15px] font-medium leading-tight">
            {t.than} <span className="text-indigo-600 font-bold">{fakePercentile}%</span> {t.peers}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2.5 pt-2">
          <div className="h-[2px] w-full bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-300 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-stone-300 uppercase tracking-tighter whitespace-nowrap">
              {t.nextGoal}
            </span>
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">
              {role.next}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceCard;
