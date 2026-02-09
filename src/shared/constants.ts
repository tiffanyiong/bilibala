export const GEMINI_MODEL_FLASH = 'gemini-3-flash-preview';
export const GEMINI_MODEL_LIVE = 'gemini-live-2.5-flash-preview';

export const LANGUAGES = [
  { code: 'English', name: 'English' },
  { code: 'Spanish', name: 'Spanish (Español)' },
  { code: 'French', name: 'French (Français)' },
  { code: 'German', name: 'German (Deutsch)' },
  { code: 'Portuguese', name: 'Portuguese (Português)' },
  { code: 'Japanese', name: 'Japanese (日本語)' },
  { code: 'Korean', name: 'Korean (한국어)' },
  { code: 'Chinese', name: 'Chinese (Mandarin - 中文)' },
  { code: 'Hindi', name: 'Hindi (हिन्दी)' },
  { code: 'Italian', name: 'Italian (Italiano)' },
  { code: 'Russian', name: 'Russian (Русский)' },
  { code: 'Arabic', name: 'Arabic (العربية)' },
  { code: 'Indonesian', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'Turkish', name: 'Turkish (Türkçe)' },
  { code: 'Vietnamese', name: 'Vietnamese (Tiếng Việt)' }
];

// Languages supported by DeepL Free tier (used for translator dropdown only)
const DEEPL_SUPPORTED_NAMES = new Set([
  'English',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Portuguese (Português)',
  'Japanese (日本語)',
  'Korean (한국어)',
  'Chinese (Mandarin - 中文)',
  'Italian (Italiano)',
  'Russian (Русский)',
]);

export const DEEPL_SUPPORTED_LANGUAGES = LANGUAGES.filter(l => DEEPL_SUPPORTED_NAMES.has(l.name));

export const LEVELS = [
  { id: 'Easy', label: 'Easy' },
  { id: 'Medium', label: 'Medium' },
  { id: 'Hard', label: 'Hard' }
];

// --- MVP: Enabled target languages (toggle to enable all) ---
export const ENABLED_TARGET_LANGUAGES = ['English', 'Chinese'];
export const ENABLED_LANGUAGES = LANGUAGES.filter(
  (l) => ENABLED_TARGET_LANGUAGES.some(code => l.code.startsWith(code))
);

// --- Language-specific scoring frameworks ---
export type ScoringFrameworkId = 'ielts' | 'hsk' | 'generic';

export interface SubScoreDef {
  key: string;
  label: string;
  labelZh?: string;
  /** Native language translations keyed by language name (e.g. 'Chinese (Mandarin - 中文)') */
  labelNative?: Record<string, string>;
  max: number;
  step: number;
}

export interface ScoringFramework {
  id: ScoringFrameworkId;
  name: string;
  overallLabel: string;
  /** Native language translations for the overall label (e.g. "Band Score" → "评分等级") */
  overallLabelNative?: Record<string, string>;
  overallMin: number;
  overallMax: number;
  overallStep: number;
  subScores: SubScoreDef[];
  bandDescriptors: Record<number, string>;
  toGenericScore: (overallScore: number) => number;
  fromGenericScore: (genericScore: number) => number;
}

export const SCORING_FRAMEWORKS: Record<string, ScoringFramework> = {
  English: {
    id: 'ielts',
    name: 'Speaking',
    overallLabel: 'Band Score',
    overallLabelNative: { 'Chinese (Mandarin - 中文)': '评分', 'Japanese (日本語)': 'スコア', 'Korean (한국어)': '점수', 'Spanish (Español)': 'Puntuación', 'French (Français)': 'Score' },
    overallMin: 0,
    overallMax: 9,
    overallStep: 0.5,
    subScores: [
      { key: 'fluency_coherence', label: 'Fluency & Coherence', labelNative: { 'Chinese (Mandarin - 中文)': '流利度与连贯性', 'Japanese (日本語)': '流暢さと一貫性', 'Korean (한국어)': '유창성과 일관성', 'Spanish (Español)': 'Fluidez y Coherencia', 'French (Français)': 'Aisance et Cohérence' }, max: 9, step: 0.5 },
      { key: 'lexical_resource', label: 'Lexical Resource', labelNative: { 'Chinese (Mandarin - 中文)': '词汇资源', 'Japanese (日本語)': '語彙力', 'Korean (한국어)': '어휘력', 'Spanish (Español)': 'Recurso Léxico', 'French (Français)': 'Ressource Lexicale' }, max: 9, step: 0.5 },
      { key: 'grammatical_range', label: 'Grammar Range & Accuracy', labelNative: { 'Chinese (Mandarin - 中文)': '语法范围与准确性', 'Japanese (日本語)': '文法の幅と正確さ', 'Korean (한국어)': '문법 범위와 정확성', 'Spanish (Español)': 'Gramática y Precisión', 'French (Français)': 'Grammaire et Précision' }, max: 9, step: 0.5 },
      { key: 'pronunciation', label: 'Pronunciation', labelNative: { 'Chinese (Mandarin - 中文)': '发音', 'Japanese (日本語)': '発音', 'Korean (한국어)': '발음', 'Spanish (Español)': 'Pronunciación', 'French (Français)': 'Prononciation' }, max: 9, step: 0.5 },
    ],
    bandDescriptors: {
      9: 'Expert User',
      8: 'Very Good User',
      7: 'Good User',
      6: 'Competent User',
      5: 'Modest User',
      4: 'Limited User',
      3: 'Extremely Limited',
      2: 'Intermittent User',
      1: 'Non-User',
      0: 'Did Not Attempt',
    },
    toGenericScore: (band: number) => Math.round((band / 9) * 100),
    fromGenericScore: (score: number) => Math.round((score / 100) * 9 * 2) / 2,
  },
  Chinese: {
    id: 'hsk',
    name: 'Speaking',
    overallLabel: 'Level',
    overallLabelNative: { 'Chinese (Mandarin - 中文)': '评分', 'Japanese (日本語)': 'レベル', 'Korean (한국어)': '레벨', 'Spanish (Español)': 'Nivel', 'French (Français)': 'Niveau' },
    overallMin: 1,
    overallMax: 6,
    overallStep: 0.5,
    subScores: [
      { key: 'pronunciation_tones', label: 'Pronunciation & Tones', labelZh: '发音与声调', max: 100, step: 1 },
      { key: 'vocabulary_grammar', label: 'Vocabulary & Grammar', labelZh: '词汇与语法', max: 100, step: 1 },
      { key: 'fluency_coherence', label: 'Fluency & Coherence', labelZh: '流利与连贯', max: 100, step: 1 },
      { key: 'content_expressiveness', label: 'Content & Expressiveness', labelZh: '内容与表现力', max: 100, step: 1 },
    ],
    bandDescriptors: {
      6: 'Advanced (高级)',
      5: 'Upper-Intermediate (中高级)',
      4: 'Intermediate (中级)',
      3: 'Elementary (初级)',
      2: 'Beginner (入门)',
      1: 'Starter (起步)',
    },
    toGenericScore: (level: number) => Math.round((level / 6) * 100),
    fromGenericScore: (score: number) => Math.max(1, Math.round((score / 100) * 6 * 2) / 2),
  },
};

/** Get the scoring framework for a target language (null = generic 0-100) */
export function getScoringFramework(targetLang: string): ScoringFramework | null {
  const baseLang = targetLang.split(/[\s(]/)[0];
  return SCORING_FRAMEWORKS[baseLang] || null;
}

export const UI_TRANSLATIONS: Record<string, {
  outline: string;
  slang: string;
  ready: string;
  start: string;
  transcriptMismatch: string;
  // Video analysis page labels
  outlineTab: string;
  vocabularyTab: string;
  transcriptTab: string;
  summary: string;
  chapters: string;
  practiceTopics: string;
  selectTopicDesc: string;
  selectTopic: string;
  favorite: string;
  favorited: string;
  saveToLibrary: string;
  startConversation: string;
  generatingContent: string;
  locateCurrent: string;
  // Report detail page labels
  topic: string;
  question: string;
  video: string;
}> = {
  'English': {
    outline: 'Story Outline', slang: 'Magic Words', ready: 'Ready to Chat?', start: 'Start Practicing',
    transcriptMismatch: 'Transcript not available in {lang}. Showing available captions instead.',
    outlineTab: 'Outline', vocabularyTab: 'Vocabulary', transcriptTab: 'Transcript', summary: 'Summary', chapters: 'Chapters',
    practiceTopics: 'Practice Topics', selectTopicDesc: 'Select a topic to start speaking practice and get your personalized feedback.',
    selectTopic: 'Select a topic', favorite: 'Favorite', favorited: 'Favorited', saveToLibrary: 'Save to Library', startConversation: 'Start Conversation',
    generatingContent: 'Generating content with AI... This can take a moment for longer video', locateCurrent: 'Locate current',
    topic: 'Topic', question: 'Question', video: 'Video'
  },
  'Spanish (Español)': {
    outline: 'Historia', slang: 'Palabras Mágicas', ready: '¿Listo?', start: 'Empezar a Practicar',
    transcriptMismatch: 'Transcripción no disponible en {lang}. Mostrando subtítulos disponibles.',
    outlineTab: 'Esquema', vocabularyTab: 'Vocabulario', transcriptTab: 'Transcripción', summary: 'Resumen', chapters: 'Capítulos',
    practiceTopics: 'Temas de Práctica', selectTopicDesc: 'Selecciona un tema para comenzar la práctica de conversación y obtener comentarios personalizados.',
    selectTopic: 'Selecciona un tema', favorite: 'Favorito', favorited: 'Marcado', saveToLibrary: 'Guardar en Biblioteca', startConversation: 'Iniciar Conversación',
    generatingContent: 'Generando contenido con IA... Esto puede tardar un momento para videos más largos', locateCurrent: 'Ubicar actual',
    topic: 'Tema', question: 'Pregunta', video: 'Video'
  },
  'French (Français)': {
    outline: 'Histoire', slang: 'Mots Magiques', ready: 'Prêt?', start: 'Commencer à Pratiquer',
    transcriptMismatch: 'Transcription non disponible en {lang}. Affichage des sous-titres disponibles.',
    outlineTab: 'Plan', vocabularyTab: 'Vocabulaire', transcriptTab: 'Transcription', summary: 'Résumé', chapters: 'Chapitres',
    practiceTopics: 'Sujets de Pratique', selectTopicDesc: 'Sélectionnez un sujet pour commencer la pratique orale et obtenir des commentaires personnalisés.',
    selectTopic: 'Sélectionner un sujet', favorite: 'Favori', favorited: 'Favori ajouté', saveToLibrary: 'Enregistrer dans la Bibliothèque', startConversation: 'Démarrer la Conversation',
    generatingContent: 'Génération de contenu avec l\'IA... Cela peut prendre un moment pour les vidéos plus longues', locateCurrent: 'Localiser actuel',
    topic: 'Sujet', question: 'Question', video: 'Vidéo'
  },
  'German (Deutsch)': {
    outline: 'Geschichte', slang: 'Zauberwörter', ready: 'Bereit?', start: 'Üben Starten',
    transcriptMismatch: 'Transkript nicht verfügbar auf {lang}. Verfügbare Untertitel werden angezeigt.',
    outlineTab: 'Gliederung', vocabularyTab: 'Vokabular', transcriptTab: 'Transkript', summary: 'Zusammenfassung', chapters: 'Kapitel',
    practiceTopics: 'Übungsthemen', selectTopicDesc: 'Wählen Sie ein Thema aus, um mit der Sprechübung zu beginnen und personalisiertes Feedback zu erhalten.',
    selectTopic: 'Thema auswählen', favorite: 'Favorit', favorited: 'Favorisiert', saveToLibrary: 'In Bibliothek speichern', startConversation: 'Gespräch starten',
    generatingContent: 'Inhalte werden mit KI generiert... Dies kann bei längeren Videos einen Moment dauern', locateCurrent: 'Aktuell lokalisieren',
    topic: 'Thema', question: 'Frage', video: 'Video'
  },
  'Portuguese (Português)': {
    outline: 'História', slang: 'Palavras Mágicas', ready: 'Pronto?', start: 'Começar a Praticar',
    transcriptMismatch: 'Transcrição não disponível em {lang}. Mostrando legendas disponíveis.',
    outlineTab: 'Esboço', vocabularyTab: 'Vocabulário', transcriptTab: 'Transcrição', summary: 'Resumo', chapters: 'Capítulos',
    practiceTopics: 'Tópicos de Prática', selectTopicDesc: 'Selecione um tópico para iniciar a prática de fala e obter feedback personalizado.',
    selectTopic: 'Selecionar um tópico', favorite: 'Favorito', favorited: 'Favoritado', saveToLibrary: 'Salvar na Biblioteca', startConversation: 'Iniciar Conversa',
    generatingContent: 'Gerando conteúdo com IA... Isso pode levar um momento para vídeos mais longos', locateCurrent: 'Localizar atual',
    topic: 'Tópico', question: 'Pergunta', video: 'Vídeo'
  },
  'Japanese (日本語)': {
    outline: 'ストーリー', slang: '魔法の言葉', ready: '準備OK？', start: '練習を始める',
    transcriptMismatch: '{lang}の字幕がありません。利用可能な字幕を表示しています。',
    outlineTab: '概要', vocabularyTab: '単語', transcriptTab: '字幕', summary: '要約', chapters: 'チャプター',
    practiceTopics: '練習トピック', selectTopicDesc: 'トピックを選択してスピーキング練習を開始し、パーソナライズされたフィードバックを受け取りましょう。',
    selectTopic: 'トピックを選択', favorite: 'お気に入り', favorited: 'お気に入り済み', saveToLibrary: 'ライブラリに保存', startConversation: '会話を始める',
    generatingContent: 'AIでコンテンツを生成中... 長い動画の場合は時間がかかることがあります', locateCurrent: '現在位置を表示',
    topic: 'トピック', question: '質問', video: '動画'
  },
  'Korean (한국어)': {
    outline: '스토리', slang: '마법의 단어', ready: '준비됐나요?', start: '연습 시작',
    transcriptMismatch: '{lang} 자막을 사용할 수 없습니다. 사용 가능한 자막을 표시합니다.',
    outlineTab: '개요', vocabularyTab: '어휘', transcriptTab: '자막', summary: '요약', chapters: '챕터',
    practiceTopics: '연습 주제', selectTopicDesc: '주제를 선택하여 말하기 연습을 시작하고 맞춤형 피드백을 받으세요.',
    selectTopic: '주제 선택', favorite: '즐겨찾기', favorited: '즐겨찾기됨', saveToLibrary: '라이브러리에 저장', startConversation: '대화 시작',
    generatingContent: 'AI로 콘텐츠 생성 중... 긴 동영상의 경우 시간이 걸릴 수 있습니다', locateCurrent: '현재 위치',
    topic: '주제', question: '질문', video: '동영상'
  },
  'Chinese (Mandarin - 中文)': {
    outline: '故事大纲', slang: '魔法词汇', ready: '准备好了吗？', start: '开始练习',
    transcriptMismatch: '{lang}字幕不可用，正在显示可用的字幕。',
    outlineTab: '大纲', vocabularyTab: '词汇', transcriptTab: '字幕', summary: '摘要', chapters: '章节',
    practiceTopics: '练习主题', selectTopicDesc: '选择一个主题开始口语练习，获取个性化反馈。',
    selectTopic: '选择主题', favorite: '收藏', favorited: '已收藏', saveToLibrary: '保存到收藏库', startConversation: '开始对话',
    generatingContent: '正在用AI生成内容... 较长的视频可能需要一些时间', locateCurrent: '定位当前',
    topic: '主题', question: '问题', video: '视频'
  },
  'Hindi (हिन्दी)': {
    outline: 'कहानी', slang: 'जादुई शब्द', ready: 'तैयार?', start: 'अभ्यास शुरू करें',
    transcriptMismatch: '{lang} में ट्रांसक्रिप्ट उपलब्ध नहीं है। उपलब्ध कैप्शन दिखा रहे हैं।',
    outlineTab: 'रूपरेखा', vocabularyTab: 'शब्दावली', transcriptTab: 'प्रतिलेख', summary: 'सारांश', chapters: 'अध्याय',
    practiceTopics: 'अभ्यास विषय', selectTopicDesc: 'बोलने का अभ्यास शुरू करने और व्यक्तिगत प्रतिक्रिया प्राप्त करने के लिए एक विषय चुनें।',
    selectTopic: 'विषय चुनें', favorite: 'पसंदीदा', favorited: 'पसंदीदा में जोड़ा गया', saveToLibrary: 'लाइब्रेरी में सहेजें', startConversation: 'बातचीत शुरू करें',
    generatingContent: 'AI के साथ सामग्री बना रहा है... लंबे वीडियो के लिए कुछ समय लग सकता है', locateCurrent: 'वर्तमान खोजें',
    topic: 'विषय', question: 'प्रश्न', video: 'वीडियो'
  },
  'Italian (Italiano)': {
    outline: 'Storia', slang: 'Parole Magiche', ready: 'Pronto?', start: 'Inizia a Praticare',
    transcriptMismatch: 'Trascrizione non disponibile in {lang}. Visualizzazione dei sottotitoli disponibili.',
    outlineTab: 'Schema', vocabularyTab: 'Vocabolario', transcriptTab: 'Trascrizione', summary: 'Riepilogo', chapters: 'Capitoli',
    practiceTopics: 'Argomenti di Pratica', selectTopicDesc: 'Seleziona un argomento per iniziare la pratica orale e ricevere feedback personalizzato.',
    selectTopic: 'Seleziona un argomento', favorite: 'Preferito', favorited: 'Aggiunto ai preferiti', saveToLibrary: 'Salva nella Libreria', startConversation: 'Inizia Conversazione',
    generatingContent: 'Generazione contenuti con AI... Potrebbe richiedere un momento per video più lunghi', locateCurrent: 'Trova attuale',
    topic: 'Argomento', question: 'Domanda', video: 'Video'
  },
  'Russian (Русский)': {
    outline: 'История', slang: 'Магические слова', ready: 'Готовы?', start: 'Начать Практику',
    transcriptMismatch: 'Транскрипция недоступна на {lang}. Показаны доступные субтитры.',
    outlineTab: 'Содержание', vocabularyTab: 'Словарь', transcriptTab: 'Транскрипция', summary: 'Резюме', chapters: 'Главы',
    practiceTopics: 'Темы для Практики', selectTopicDesc: 'Выберите тему, чтобы начать практику речи и получить персонализированную обратную связь.',
    selectTopic: 'Выбрать тему', favorite: 'Избранное', favorited: 'В избранном', saveToLibrary: 'Сохранить в Библиотеку', startConversation: 'Начать Разговор',
    generatingContent: 'Генерация контента с помощью ИИ... Для длинных видео это может занять некоторое время', locateCurrent: 'Найти текущее',
    topic: 'Тема', question: 'Вопрос', video: 'Видео'
  },
  'Arabic (العربية)': {
    outline: 'القصة', slang: 'كلمات سحرية', ready: 'مستعد؟', start: 'ابدأ التدريب',
    transcriptMismatch: 'النص غير متوفر بـ{lang}. يتم عرض الترجمات المتاحة.',
    outlineTab: 'المخطط', vocabularyTab: 'المفردات', transcriptTab: 'النص', summary: 'الملخص', chapters: 'الفصول',
    practiceTopics: 'مواضيع الممارسة', selectTopicDesc: 'اختر موضوعًا لبدء ممارسة التحدث والحصول على ملاحظات مخصصة.',
    selectTopic: 'اختر موضوعًا', favorite: 'المفضلة', favorited: 'تمت الإضافة للمفضلة', saveToLibrary: 'حفظ في المكتبة', startConversation: 'بدء المحادثة',
    generatingContent: 'جاري إنشاء المحتوى بالذكاء الاصطناعي... قد يستغرق هذا بعض الوقت للفيديوهات الطويلة', locateCurrent: 'تحديد الموقع الحالي',
    topic: 'الموضوع', question: 'السؤال', video: 'الفيديو'
  },
  'Indonesian (Bahasa Indonesia)': {
    outline: 'Cerita', slang: 'Kata Ajaib', ready: 'Siap?', start: 'Mulai Berlatih',
    transcriptMismatch: 'Transkrip tidak tersedia dalam {lang}. Menampilkan teks yang tersedia.',
    outlineTab: 'Garis Besar', vocabularyTab: 'Kosakata', transcriptTab: 'Transkrip', summary: 'Ringkasan', chapters: 'Bab',
    practiceTopics: 'Topik Latihan', selectTopicDesc: 'Pilih topik untuk memulai latihan berbicara dan dapatkan umpan balik yang dipersonalisasi.',
    selectTopic: 'Pilih topik', favorite: 'Favorit', favorited: 'Difavoritkan', saveToLibrary: 'Simpan ke Perpustakaan', startConversation: 'Mulai Percakapan',
    generatingContent: 'Membuat konten dengan AI... Ini mungkin memakan waktu untuk video yang lebih panjang', locateCurrent: 'Temukan saat ini',
    topic: 'Topik', question: 'Pertanyaan', video: 'Video'
  },
  'Turkish (Türkçe)': {
    outline: 'Hikaye', slang: 'Sihirli Kelimeler', ready: 'Hazır mısın?', start: 'Pratiğe Başla',
    transcriptMismatch: '{lang} dilinde altyazı mevcut değil. Mevcut altyazılar gösteriliyor.',
    outlineTab: 'Taslak', vocabularyTab: 'Kelime Dağarcığı', transcriptTab: 'Transkript', summary: 'Özet', chapters: 'Bölümler',
    practiceTopics: 'Pratik Konuları', selectTopicDesc: 'Konuşma pratiğine başlamak ve kişiselleştirilmiş geri bildirim almak için bir konu seçin.',
    selectTopic: 'Konu seç', favorite: 'Favori', favorited: 'Favorilere eklendi', saveToLibrary: 'Kütüphaneye Kaydet', startConversation: 'Sohbet Başlat',
    generatingContent: 'AI ile içerik oluşturuluyor... Daha uzun videolar için biraz zaman alabilir', locateCurrent: 'Mevcut konumu bul',
    topic: 'Konu', question: 'Soru', video: 'Video'
  },
  'Vietnamese (Tiếng Việt)': {
    outline: 'Câu chuyện', slang: 'Từ ngữ phép thuật', ready: 'Sẵn sàng?', start: 'Bắt đầu Luyện tập',
    transcriptMismatch: 'Phụ đề không có sẵn bằng {lang}. Đang hiển thị phụ đề có sẵn.',
    outlineTab: 'Dàn ý', vocabularyTab: 'Từ vựng', transcriptTab: 'Phụ đề', summary: 'Tóm tắt', chapters: 'Chương',
    practiceTopics: 'Chủ đề Luyện tập', selectTopicDesc: 'Chọn một chủ đề để bắt đầu luyện nói và nhận phản hồi cá nhân hóa.',
    selectTopic: 'Chọn chủ đề', favorite: 'Yêu thích', favorited: 'Đã yêu thích', saveToLibrary: 'Lưu vào Thư viện', startConversation: 'Bắt đầu Cuộc trò chuyện',
    generatingContent: 'Đang tạo nội dung bằng AI... Có thể mất một lúc cho video dài hơn', locateCurrent: 'Xác định vị trí hiện tại',
    topic: 'Chủ đề', question: 'Câu hỏi', video: 'Video'
  }
};