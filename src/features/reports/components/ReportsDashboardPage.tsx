import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { getAllPracticeSessionsWithVideoMetadata, deletePracticeSession, togglePracticeSessionFavorite } from '../../../shared/services/database';
import { DashboardPracticeSession } from '../../../shared/types/database';
import ReportsEmptyState from './ReportsEmptyState';
import ReportsGroupedList from './ReportsGroupedList';
import ReportsOverview from './ReportsOverview';

export type NavigateToVideoFn = (video: { analysisId: string; youtubeId: string; title: string; thumbnailUrl: string | null; targetLang: string; nativeLang: string; level: string }) => void;

interface ReportsDashboardPageProps {
  onViewReport: (session: DashboardPracticeSession) => void;
  onNavigateToVideo?: NavigateToVideoFn;
}

const ReportsDashboardPage: React.FC<ReportsDashboardPageProps> = ({ onViewReport, onNavigateToVideo }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DashboardPracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      setIsLoading(true);
      const data = await getAllPracticeSessionsWithVideoMetadata(user.id);
      setSessions(data);
      setIsLoading(false);
    };

    fetchSessions();
  }, [user]);

  // Determine the user's most common native language for the disclaimer
  const userNativeLang = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.native_lang) counts.set(s.native_lang, (counts.get(s.native_lang) || 0) + 1);
    }
    let top: string | null = null;
    let topCount = 0;
    for (const [lang, count] of counts) {
      if (count > topCount) { top = lang; topCount = count; }
    }
    return top || 'English';
  }, [sessions]);

  // Auto-select the most-used language on first load
  useEffect(() => {
    if (hasAutoSelected || sessions.length === 0) return;
    const langCounts = new Map<string, number>();
    for (const s of sessions) {
      if (s.target_lang) langCounts.set(s.target_lang, (langCounts.get(s.target_lang) || 0) + 1);
    }
    let topLang: string | null = null;
    let topCount = 0;
    for (const [lang, count] of langCounts) {
      if (count > topCount) { topLang = lang; topCount = count; }
    }
    if (topLang) setActiveLanguage(topLang);
    setHasAutoSelected(true);
  }, [sessions, hasAutoSelected]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    const success = await deletePracticeSession(user.id, sessionId);
    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  const handleToggleFavorite = async (sessionId: string, isFavorited: boolean) => {
    if (!user) return;
    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, is_favorited: isFavorited } : s))
    );
    const success = await togglePracticeSessionFavorite(user.id, sessionId, isFavorited);
    if (!success) {
      // Revert on failure
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_favorited: !isFavorited } : s))
      );
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-20 text-sm text-stone-500">
          Sign in to view your practice reports
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
      {/* Page header */}
      <div className="mb-6 animate-[glassDropIn_0.3s_ease-out]">
        <h1 className="text-2xl sm:text-3xl font-serif text-stone-800">Practice Reports</h1>
        <p className="text-sm text-stone-500 mt-1">Track your speaking progress across all videos</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : sessions.length === 0 ? (
        <ReportsEmptyState />
      ) : (
        <>
          <ReportsOverview sessions={sessions} activeLanguage={activeLanguage} />
          <ReportsGroupedList sessions={sessions} onViewReport={onViewReport} onDeleteSession={handleDeleteSession} onToggleFavorite={handleToggleFavorite} onNavigateToVideo={onNavigateToVideo} activeLanguage={activeLanguage} onLanguageChange={setActiveLanguage} />

          {/* Disclaimer */}
          <p className="text-xs text-stone-400 text-center mt-8 mb-4 max-w-xl mx-auto leading-relaxed">
            {DISCLAIMER_TRANSLATIONS[userNativeLang] || DISCLAIMER_TRANSLATIONS.English}
          </p>
        </>
      )}
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    {/* Stats cards skeleton */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 ring-1 ring-black/[0.03]">
          <div className="h-3 w-20 bg-stone-200 rounded mb-2" />
          <div className="h-7 w-16 bg-stone-200 rounded mb-1" />
          <div className="h-3 w-24 bg-stone-100 rounded" />
        </div>
      ))}
    </div>

    {/* Chart skeleton */}
    <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-5 ring-1 ring-black/[0.03]">
      <div className="h-3 w-24 bg-stone-200 rounded mb-4" />
      <div className="h-48 bg-stone-100 rounded-lg" />
    </div>

    {/* Groups skeleton */}
    {[1, 2].map((i) => (
      <div key={i} className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[20px] p-4 ring-1 ring-black/[0.03]">
        <div className="flex items-center gap-3">
          <div className="w-20 h-12 bg-stone-200 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 w-48 bg-stone-200 rounded mb-1" />
            <div className="h-3 w-32 bg-stone-100 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const DISCLAIMER_TRANSLATIONS: Record<string, string> = {
  'English': 'All scores and feedback are AI-generated estimates for learning purposes only. They are not official scores and may not reflect actual exam results.',
  'Spanish (Español)': 'Todas las puntuaciones y comentarios son estimaciones generadas por IA solo con fines de aprendizaje. No son puntuaciones oficiales y pueden no reflejar los resultados reales del examen.',
  'French (Français)': 'Tous les scores et commentaires sont des estimations générées par l\'IA à des fins d\'apprentissage uniquement. Ce ne sont pas des scores officiels et ils peuvent ne pas refléter les résultats réels d\'un examen.',
  'German (Deutsch)': 'Alle Bewertungen und Rückmeldungen sind KI-generierte Schätzungen und dienen ausschließlich zu Lernzwecken. Sie stellen keine offiziellen Ergebnisse dar und spiegeln möglicherweise nicht die tatsächlichen Prüfungsergebnisse wider.',
  'Portuguese (Português)': 'Todas as pontuações e feedbacks são estimativas geradas por IA apenas para fins de aprendizagem. Não são pontuações oficiais e podem não refletir os resultados reais do exame.',
  'Japanese (日本語)': 'すべてのスコアとフィードバックはAIによる推定であり、学習目的のみに使用されます。公式スコアではなく、実際の試験結果を反映するものではありません。',
  'Korean (한국어)': '모든 점수와 피드백은 학습 목적으로만 제공되는 AI 생성 추정치입니다. 공식 점수가 아니며 실제 시험 결과를 반영하지 않을 수 있습니다.',
  'Chinese (Mandarin - 中文)': '所有分数和反馈均为AI生成的估算值，仅供学习参考。这些并非官方分数，可能无法反映实际考试成绩。',
  'Hindi (हिन्दी)': 'सभी स्कोर और फीडबैक केवल सीखने के उद्देश्य से AI-जनित अनुमान हैं। ये आधिकारिक स्कोर नहीं हैं और वास्तविक परीक्षा परिणामों को प्रतिबिंबित नहीं कर सकते।',
  'Italian (Italiano)': 'Tutti i punteggi e i feedback sono stime generate dall\'IA solo a scopo didattico. Non sono punteggi ufficiali e potrebbero non riflettere i risultati effettivi dell\'esame.',
  'Russian (Русский)': 'Все оценки и отзывы являются приблизительными данными, сгенерированными ИИ, и предназначены исключительно для обучения. Они не являются официальными результатами и могут не отражать реальные результаты экзамена.',
  'Arabic (العربية)': 'جميع الدرجات والملاحظات هي تقديرات مُنشأة بواسطة الذكاء الاصطناعي لأغراض التعلم فقط. وهي ليست درجات رسمية وقد لا تعكس نتائج الامتحان الفعلية.',
  'Indonesian (Bahasa Indonesia)': 'Semua skor dan umpan balik adalah estimasi yang dihasilkan AI hanya untuk tujuan pembelajaran. Ini bukan skor resmi dan mungkin tidak mencerminkan hasil ujian yang sebenarnya.',
  'Turkish (Türkçe)': 'Tüm puanlar ve geri bildirimler yalnızca öğrenme amaçlı yapay zeka tarafından üretilen tahminlerdir. Resmi puanlar değildir ve gerçek sınav sonuçlarını yansıtmayabilir.',
  'Vietnamese (Tiếng Việt)': 'Tất cả điểm số và phản hồi đều là ước tính do AI tạo ra, chỉ nhằm mục đích học tập. Đây không phải điểm chính thức và có thể không phản ánh kết quả thi thực tế.',
};

export default ReportsDashboardPage;
