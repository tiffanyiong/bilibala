import React from 'react';

const ROLES_CONFIG: Record<string, any> = {
  master: { min: 95, label: '語言大師', eng: 'Language Master', color: 'text-blue-600', dot: 'bg-blue-500', bg: 'bg-blue-50/60' },
  expert: { min: 85, label: '流利專家', eng: 'Fluency Expert', color: 'text-emerald-600', dot: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  pioneer: { min: 70, label: '邏輯先鋒', eng: 'Logic Pioneer', color: 'text-indigo-600', dot: 'bg-indigo-500', bg: 'bg-indigo-50/60' },
  speaker: { min: 55, label: '積極溝通者', eng: 'Active Speaker', color: 'text-amber-600', dot: 'bg-amber-500', bg: 'bg-amber-50/60' },
  talent: { min: 40, label: '潛力學員', eng: 'Emerging Talent', color: 'text-stone-600', dot: 'bg-stone-500', bg: 'bg-stone-100/80' },
  explorer: { min: 0, label: '探索者', eng: 'Explorer', color: 'text-stone-500', dot: 'bg-stone-400', bg: 'bg-stone-100/50' },
};

const translations: Record<string, any> = {
  'Chinese (Mandarin - 中文)': {
    than: '表現優於',
    peers: '的學習者',
    nextGoal: 'NEXT MILESTONE:',
  },
  'English': {
    than: 'Performing better than',
    peers: 'of learners',
    nextGoal: 'NEXT MILESTONE:',
  }
};

interface PerformanceCardProps {
  score: number;
  targetLang?: string;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({ score, targetLang = 'English' }) => {
  const t = translations[targetLang] || translations['English'];

  const getRoleInfo = (s: number) => {
    const isZH = targetLang.includes('Chinese');
    if (s >= 95) return { ...ROLES_CONFIG.master, title: isZH ? ROLES_CONFIG.master.label : ROLES_CONFIG.master.eng, next: 'Peak', nextScore: 100 };
    if (s >= 85) return { ...ROLES_CONFIG.expert, title: isZH ? ROLES_CONFIG.expert.label : ROLES_CONFIG.expert.eng, next: isZH ? ROLES_CONFIG.master.label : ROLES_CONFIG.master.eng, nextScore: 95 };
    if (s >= 70) return { ...ROLES_CONFIG.pioneer, title: isZH ? ROLES_CONFIG.pioneer.label : ROLES_CONFIG.pioneer.eng, next: isZH ? ROLES_CONFIG.expert.label : ROLES_CONFIG.expert.eng, nextScore: 85 };
    if (s >= 55) return { ...ROLES_CONFIG.speaker, title: isZH ? ROLES_CONFIG.speaker.label : ROLES_CONFIG.speaker.eng, next: isZH ? ROLES_CONFIG.pioneer.label : ROLES_CONFIG.pioneer.eng, nextScore: 70 };
    if (s >= 40) return { ...ROLES_CONFIG.talent, title: isZH ? ROLES_CONFIG.talent.label : ROLES_CONFIG.talent.eng, next: isZH ? ROLES_CONFIG.speaker.label : ROLES_CONFIG.speaker.eng, nextScore: 55 };
    return { ...ROLES_CONFIG.explorer, title: isZH ? ROLES_CONFIG.explorer.label : ROLES_CONFIG.explorer.eng, next: isZH ? ROLES_CONFIG.talent.label : ROLES_CONFIG.talent.eng, nextScore: 40 };
  };

  const role = getRoleInfo(score);
  const fakePercentile = Math.floor(score + (100 - score) * 0.42);
  const progress = score >= 95 ? 100 : (score / role.nextScore) * 100;

  return (
    <div className="bg-white rounded-[20px] p-5 border border-stone-200/60 w-full mb-6 shadow-sm">
      <div className="flex flex-col gap-4">
        
        {/* Role Badge - Matched to Screenshot Pill Style */}
        <div className="flex justify-start">
          <div className={`inline-flex items-center gap-1.5 ${role.bg} px-2.5 py-1 rounded-full`}>
            <div className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
            <span className={`text-[9px] font-black ${role.color} uppercase tracking-widest`}>
              {role.title}
            </span>
          </div>
        </div>

        {/* Narrative Title - Clean, matched weight */}
        <div className="pb-1">
          <p className="text-stone-500 text-[15px] font-medium leading-tight">
            {t.than} <span className="text-indigo-600 font-bold">{fakePercentile}%</span> {t.peers}
          </p>
        </div>

        {/* Progress System - Professional Line Style */}
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