import React from 'react';

// Role configurations with multi-language labels
const ROLES_CONFIG: Record<string, {
  min: number;
  color: string;
  dot: string;
  bg: string;
  labels: Record<string, string>;
}> = {
  master: {
    min: 95,
    color: 'text-blue-600',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50/60',
    labels: {
      'English': 'Language Master',
      'Chinese (Mandarin - 中文)': '语言大师',
      'Japanese (日本語)': '言語マスター',
      'Korean (한국어)': '언어 마스터',
      'Spanish (Español)': 'Maestro del Idioma',
      'French (Français)': 'Maître de Langue',
      'German (Deutsch)': 'Sprachmeister',
      'Portuguese (Português)': 'Mestre do Idioma',
      'Italian (Italiano)': 'Maestro della Lingua',
      'Russian (Русский)': 'Мастер Языка',
      'Arabic (العربية)': 'سيد اللغة',
      'Hindi (हिन्दी)': 'भाषा मास्टर',
      'Indonesian (Bahasa Indonesia)': 'Master Bahasa',
      'Turkish (Türkçe)': 'Dil Ustası',
      'Vietnamese (Tiếng Việt)': 'Bậc Thầy Ngôn Ngữ',
    }
  },
  expert: {
    min: 85,
    color: 'text-emerald-600',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/60',
    labels: {
      'English': 'Fluency Expert',
      'Chinese (Mandarin - 中文)': '流利专家',
      'Japanese (日本語)': '流暢エキスパート',
      'Korean (한국어)': '유창함 전문가',
      'Spanish (Español)': 'Experto en Fluidez',
      'French (Français)': 'Expert en Fluidité',
      'German (Deutsch)': 'Fließend-Experte',
      'Portuguese (Português)': 'Especialista em Fluência',
      'Italian (Italiano)': 'Esperto di Fluenza',
      'Russian (Русский)': 'Эксперт Беглости',
      'Arabic (العربية)': 'خبير الطلاقة',
      'Hindi (हिन्दी)': 'प्रवाह विशेषज्ञ',
      'Indonesian (Bahasa Indonesia)': 'Ahli Kefasihan',
      'Turkish (Türkçe)': 'Akıcılık Uzmanı',
      'Vietnamese (Tiếng Việt)': 'Chuyên Gia Lưu Loát',
    }
  },
  pioneer: {
    min: 70,
    color: 'text-indigo-600',
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50/60',
    labels: {
      'English': 'Logic Pioneer',
      'Chinese (Mandarin - 中文)': '逻辑先锋',
      'Japanese (日本語)': 'ロジックパイオニア',
      'Korean (한국어)': '논리 개척자',
      'Spanish (Español)': 'Pionero Lógico',
      'French (Français)': 'Pionnier Logique',
      'German (Deutsch)': 'Logik-Pionier',
      'Portuguese (Português)': 'Pioneiro da Lógica',
      'Italian (Italiano)': 'Pioniere della Logica',
      'Russian (Русский)': 'Пионер Логики',
      'Arabic (العربية)': 'رائد المنطق',
      'Hindi (हिन्दी)': 'तर्क अग्रणी',
      'Indonesian (Bahasa Indonesia)': 'Pelopor Logika',
      'Turkish (Türkçe)': 'Mantık Öncüsü',
      'Vietnamese (Tiếng Việt)': 'Tiên Phong Logic',
    }
  },
  speaker: {
    min: 55,
    color: 'text-amber-600',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/60',
    labels: {
      'English': 'Active Speaker',
      'Chinese (Mandarin - 中文)': '积极表达者',
      'Japanese (日本語)': 'アクティブスピーカー',
      'Korean (한국어)': '적극적 화자',
      'Spanish (Español)': 'Hablante Activo',
      'French (Français)': 'Orateur Actif',
      'German (Deutsch)': 'Aktiver Sprecher',
      'Portuguese (Português)': 'Falante Ativo',
      'Italian (Italiano)': 'Oratore Attivo',
      'Russian (Русский)': 'Активный Оратор',
      'Arabic (العربية)': 'متحدث نشط',
      'Hindi (हिन्दी)': 'सक्रिय वक्ता',
      'Indonesian (Bahasa Indonesia)': 'Pembicara Aktif',
      'Turkish (Türkçe)': 'Aktif Konuşmacı',
      'Vietnamese (Tiếng Việt)': 'Người Nói Tích Cực',
    }
  },
  talent: {
    min: 40,
    color: 'text-stone-600',
    dot: 'bg-stone-500',
    bg: 'bg-stone-100/80',
    labels: {
      'English': 'Emerging Talent',
      'Chinese (Mandarin - 中文)': '潜力新星',
      'Japanese (日本語)': '新進タレント',
      'Korean (한국어)': '떠오르는 인재',
      'Spanish (Español)': 'Talento Emergente',
      'French (Français)': 'Talent Émergent',
      'German (Deutsch)': 'Aufstrebendes Talent',
      'Portuguese (Português)': 'Talento Emergente',
      'Italian (Italiano)': 'Talento Emergente',
      'Russian (Русский)': 'Растущий Талант',
      'Arabic (العربية)': 'موهبة ناشئة',
      'Hindi (हिन्दी)': 'उभरती प्रतिभा',
      'Indonesian (Bahasa Indonesia)': 'Bakat Berkembang',
      'Turkish (Türkçe)': 'Yükselen Yetenek',
      'Vietnamese (Tiếng Việt)': 'Tài Năng Mới',
    }
  },
  explorer: {
    min: 0,
    color: 'text-stone-500',
    dot: 'bg-stone-400',
    bg: 'bg-stone-100/50',
    labels: {
      'English': 'Explorer',
      'Chinese (Mandarin - 中文)': '探索者',
      'Japanese (日本語)': '探検者',
      'Korean (한국어)': '탐험가',
      'Spanish (Español)': 'Explorador',
      'French (Français)': 'Explorateur',
      'German (Deutsch)': 'Entdecker',
      'Portuguese (Português)': 'Explorador',
      'Italian (Italiano)': 'Esploratore',
      'Russian (Русский)': 'Исследователь',
      'Arabic (العربية)': 'مستكشف',
      'Hindi (हिन्दी)': 'खोजकर्ता',
      'Indonesian (Bahasa Indonesia)': 'Penjelajah',
      'Turkish (Türkçe)': 'Kaşif',
      'Vietnamese (Tiếng Việt)': 'Người Khám Phá',
    }
  },
};

// UI text translations
const translations: Record<string, {
  than: string;
  peers: string;
  nextGoal: string;
  peak: string;
}> = {
  'English': {
    than: 'Performing better than',
    peers: 'of learners',
    nextGoal: 'NEXT MILESTONE:',
    peak: 'Peak',
  },
  'Chinese (Mandarin - 中文)': {
    than: '表现优于',
    peers: '的学习者',
    nextGoal: '下一目标:',
    peak: '巅峰',
  },
  'Japanese (日本語)': {
    than: '学習者の上位',
    peers: 'のパフォーマンス',
    nextGoal: '次の目標:',
    peak: '頂点',
  },
  'Korean (한국어)': {
    than: '학습자 중 상위',
    peers: '의 성과',
    nextGoal: '다음 목표:',
    peak: '정점',
  },
  'Spanish (Español)': {
    than: 'Mejor que',
    peers: 'de los estudiantes',
    nextGoal: 'PRÓXIMA META:',
    peak: 'Cima',
  },
  'French (Français)': {
    than: 'Meilleur que',
    peers: 'des apprenants',
    nextGoal: 'PROCHAIN OBJECTIF:',
    peak: 'Sommet',
  },
  'German (Deutsch)': {
    than: 'Besser als',
    peers: 'der Lernenden',
    nextGoal: 'NÄCHSTES ZIEL:',
    peak: 'Spitze',
  },
  'Portuguese (Português)': {
    than: 'Melhor que',
    peers: 'dos alunos',
    nextGoal: 'PRÓXIMA META:',
    peak: 'Pico',
  },
  'Italian (Italiano)': {
    than: 'Meglio di',
    peers: 'degli studenti',
    nextGoal: 'PROSSIMO TRAGUARDO:',
    peak: 'Apice',
  },
  'Russian (Русский)': {
    than: 'Лучше чем',
    peers: 'учащихся',
    nextGoal: 'СЛЕДУЮЩАЯ ЦЕЛЬ:',
    peak: 'Пик',
  },
  'Arabic (العربية)': {
    than: 'أفضل من',
    peers: 'من المتعلمين',
    nextGoal: 'الهدف التالي:',
    peak: 'القمة',
  },
  'Hindi (हिन्दी)': {
    than: 'से बेहतर',
    peers: 'शिक्षार्थियों में',
    nextGoal: 'अगला लक्ष्य:',
    peak: 'शिखर',
  },
  'Indonesian (Bahasa Indonesia)': {
    than: 'Lebih baik dari',
    peers: 'pelajar',
    nextGoal: 'TARGET BERIKUTNYA:',
    peak: 'Puncak',
  },
  'Turkish (Türkçe)': {
    than: 'Öğrencilerin',
    peers: 'inden daha iyi',
    nextGoal: 'SONRAKİ HEDEF:',
    peak: 'Zirve',
  },
  'Vietnamese (Tiếng Việt)': {
    than: 'Vượt trội hơn',
    peers: 'người học',
    nextGoal: 'MỤC TIÊU TIẾP:',
    peak: 'Đỉnh cao',
  },
};

interface PerformanceCardProps {
  score: number;
  targetLang?: string;
  nativeLang?: string;
  level?: string;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  score,
  targetLang = 'English',
  nativeLang = 'English',
  level = 'Medium'
}) => {
  // Determine which language to use based on level
  const isEasy = level.toLowerCase() === 'easy';
  const displayLang = isEasy ? nativeLang : targetLang;

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
