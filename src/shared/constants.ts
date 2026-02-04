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
  { id: 'Easy', label: 'Beginner' },
  { id: 'Medium', label: 'Intermediate' },
  { id: 'Hard', label: 'Advanced' }
];

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
    outline: 'Story Outline', slang: 'Magic Words', ready: 'Ready to Chat?', start: 'Start Adventure',
    transcriptMismatch: 'Transcript not available in {lang}. Showing available captions instead.',
    outlineTab: 'Outline', vocabularyTab: 'Vocabulary', transcriptTab: 'Transcript', summary: 'Summary',
    practiceTopics: 'Practice Topics', selectTopicDesc: 'Select a topic to start speaking practice and get your personalized feedback.',
    selectTopic: 'Select a topic', favorite: 'Favorite', favorited: 'Favorited', saveToLibrary: 'Save to Library', startConversation: 'Start Conversation',
    generatingContent: 'Generating content with AI... This can take a moment for longer video', locateCurrent: 'Locate current',
    topic: 'Topic', question: 'Question', video: 'Video'
  },
  'Spanish (Español)': {
    outline: 'Historia', slang: 'Palabras Mágicas', ready: '¿Listo?', start: 'Comenzar',
    transcriptMismatch: 'Transcripción no disponible en {lang}. Mostrando subtítulos disponibles.',
    outlineTab: 'Esquema', vocabularyTab: 'Vocabulario', transcriptTab: 'Transcripción', summary: 'Resumen',
    practiceTopics: 'Temas de Práctica', selectTopicDesc: 'Selecciona un tema para comenzar la práctica de conversación y obtener comentarios personalizados.',
    selectTopic: 'Selecciona un tema', favorite: 'Favorito', favorited: 'Marcado', saveToLibrary: 'Guardar en Biblioteca', startConversation: 'Iniciar Conversación',
    generatingContent: 'Generando contenido con IA... Esto puede tardar un momento para videos más largos', locateCurrent: 'Ubicar actual',
    topic: 'Tema', question: 'Pregunta', video: 'Video'
  },
  'French (Français)': {
    outline: 'Histoire', slang: 'Mots Magiques', ready: 'Prêt?', start: 'Commencer',
    transcriptMismatch: 'Transcription non disponible en {lang}. Affichage des sous-titres disponibles.',
    outlineTab: 'Plan', vocabularyTab: 'Vocabulaire', transcriptTab: 'Transcription', summary: 'Résumé',
    practiceTopics: 'Sujets de Pratique', selectTopicDesc: 'Sélectionnez un sujet pour commencer la pratique orale et obtenir des commentaires personnalisés.',
    selectTopic: 'Sélectionner un sujet', favorite: 'Favori', favorited: 'Favori ajouté', saveToLibrary: 'Enregistrer dans la Bibliothèque', startConversation: 'Démarrer la Conversation',
    generatingContent: 'Génération de contenu avec l\'IA... Cela peut prendre un moment pour les vidéos plus longues', locateCurrent: 'Localiser actuel',
    topic: 'Sujet', question: 'Question', video: 'Vidéo'
  },
  'German (Deutsch)': {
    outline: 'Geschichte', slang: 'Zauberwörter', ready: 'Bereit?', start: 'Starten',
    transcriptMismatch: 'Transkript nicht verfügbar auf {lang}. Verfügbare Untertitel werden angezeigt.',
    outlineTab: 'Gliederung', vocabularyTab: 'Vokabular', transcriptTab: 'Transkript', summary: 'Zusammenfassung',
    practiceTopics: 'Übungsthemen', selectTopicDesc: 'Wählen Sie ein Thema aus, um mit der Sprechübung zu beginnen und personalisiertes Feedback zu erhalten.',
    selectTopic: 'Thema auswählen', favorite: 'Favorit', favorited: 'Favorisiert', saveToLibrary: 'In Bibliothek speichern', startConversation: 'Gespräch starten',
    generatingContent: 'Inhalte werden mit KI generiert... Dies kann bei längeren Videos einen Moment dauern', locateCurrent: 'Aktuell lokalisieren',
    topic: 'Thema', question: 'Frage', video: 'Video'
  },
  'Portuguese (Português)': {
    outline: 'História', slang: 'Palavras Mágicas', ready: 'Pronto?', start: 'Começar',
    transcriptMismatch: 'Transcrição não disponível em {lang}. Mostrando legendas disponíveis.',
    outlineTab: 'Esboço', vocabularyTab: 'Vocabulário', transcriptTab: 'Transcrição', summary: 'Resumo',
    practiceTopics: 'Tópicos de Prática', selectTopicDesc: 'Selecione um tópico para iniciar a prática de fala e obter feedback personalizado.',
    selectTopic: 'Selecionar um tópico', favorite: 'Favorito', favorited: 'Favoritado', saveToLibrary: 'Salvar na Biblioteca', startConversation: 'Iniciar Conversa',
    generatingContent: 'Gerando conteúdo com IA... Isso pode levar um momento para vídeos mais longos', locateCurrent: 'Localizar atual',
    topic: 'Tópico', question: 'Pergunta', video: 'Vídeo'
  },
  'Japanese (日本語)': {
    outline: 'ストーリー', slang: '魔法の言葉', ready: '準備OK？', start: 'スタート',
    transcriptMismatch: '{lang}の字幕がありません。利用可能な字幕を表示しています。',
    outlineTab: '概要', vocabularyTab: '単語', transcriptTab: '字幕', summary: '要約',
    practiceTopics: '練習トピック', selectTopicDesc: 'トピックを選択してスピーキング練習を開始し、パーソナライズされたフィードバックを受け取りましょう。',
    selectTopic: 'トピックを選択', favorite: 'お気に入り', favorited: 'お気に入り済み', saveToLibrary: 'ライブラリに保存', startConversation: '会話を始める',
    generatingContent: 'AIでコンテンツを生成中... 長い動画の場合は時間がかかることがあります', locateCurrent: '現在位置を表示',
    topic: 'トピック', question: '質問', video: '動画'
  },
  'Korean (한국어)': {
    outline: '스토리', slang: '마법의 단어', ready: '준비됐나요?', start: '시작하기',
    transcriptMismatch: '{lang} 자막을 사용할 수 없습니다. 사용 가능한 자막을 표시합니다.',
    outlineTab: '개요', vocabularyTab: '어휘', transcriptTab: '자막', summary: '요약',
    practiceTopics: '연습 주제', selectTopicDesc: '주제를 선택하여 말하기 연습을 시작하고 맞춤형 피드백을 받으세요.',
    selectTopic: '주제 선택', favorite: '즐겨찾기', favorited: '즐겨찾기됨', saveToLibrary: '라이브러리에 저장', startConversation: '대화 시작',
    generatingContent: 'AI로 콘텐츠 생성 중... 긴 동영상의 경우 시간이 걸릴 수 있습니다', locateCurrent: '현재 위치',
    topic: '주제', question: '질문', video: '동영상'
  },
  'Chinese (Mandarin - 中文)': {
    outline: '故事大纲', slang: '魔法词汇', ready: '准备好了吗？', start: '开始冒险',
    transcriptMismatch: '{lang}字幕不可用，正在显示可用的字幕。',
    outlineTab: '大纲', vocabularyTab: '词汇', transcriptTab: '字幕', summary: '摘要',
    practiceTopics: '练习主题', selectTopicDesc: '选择一个主题开始口语练习，获取个性化反馈。',
    selectTopic: '选择主题', favorite: '收藏', favorited: '已收藏', saveToLibrary: '保存到收藏库', startConversation: '开始对话',
    generatingContent: '正在用AI生成内容... 较长的视频可能需要一些时间', locateCurrent: '定位当前',
    topic: '主题', question: '问题', video: '视频'
  },
  'Hindi (हिन्दी)': {
    outline: 'कहानी', slang: 'जादुई शब्द', ready: 'तैयार?', start: 'शुरू करें',
    transcriptMismatch: '{lang} में ट्रांसक्रिप्ट उपलब्ध नहीं है। उपलब्ध कैप्शन दिखा रहे हैं।',
    outlineTab: 'रूपरेखा', vocabularyTab: 'शब्दावली', transcriptTab: 'प्रतिलेख', summary: 'सारांश',
    practiceTopics: 'अभ्यास विषय', selectTopicDesc: 'बोलने का अभ्यास शुरू करने और व्यक्तिगत प्रतिक्रिया प्राप्त करने के लिए एक विषय चुनें।',
    selectTopic: 'विषय चुनें', favorite: 'पसंदीदा', favorited: 'पसंदीदा में जोड़ा गया', saveToLibrary: 'लाइब्रेरी में सहेजें', startConversation: 'बातचीत शुरू करें',
    generatingContent: 'AI के साथ सामग्री बना रहा है... लंबे वीडियो के लिए कुछ समय लग सकता है', locateCurrent: 'वर्तमान खोजें',
    topic: 'विषय', question: 'प्रश्न', video: 'वीडियो'
  },
  'Italian (Italiano)': {
    outline: 'Storia', slang: 'Parole Magiche', ready: 'Pronto?', start: 'Inizia',
    transcriptMismatch: 'Trascrizione non disponibile in {lang}. Visualizzazione dei sottotitoli disponibili.',
    outlineTab: 'Schema', vocabularyTab: 'Vocabolario', transcriptTab: 'Trascrizione', summary: 'Riepilogo',
    practiceTopics: 'Argomenti di Pratica', selectTopicDesc: 'Seleziona un argomento per iniziare la pratica orale e ricevere feedback personalizzato.',
    selectTopic: 'Seleziona un argomento', favorite: 'Preferito', favorited: 'Aggiunto ai preferiti', saveToLibrary: 'Salva nella Libreria', startConversation: 'Inizia Conversazione',
    generatingContent: 'Generazione contenuti con AI... Potrebbe richiedere un momento per video più lunghi', locateCurrent: 'Trova attuale',
    topic: 'Argomento', question: 'Domanda', video: 'Video'
  },
  'Russian (Русский)': {
    outline: 'История', slang: 'Магические слова', ready: 'Готовы?', start: 'Начать',
    transcriptMismatch: 'Транскрипция недоступна на {lang}. Показаны доступные субтитры.',
    outlineTab: 'Содержание', vocabularyTab: 'Словарь', transcriptTab: 'Транскрипция', summary: 'Резюме',
    practiceTopics: 'Темы для Практики', selectTopicDesc: 'Выберите тему, чтобы начать практику речи и получить персонализированную обратную связь.',
    selectTopic: 'Выбрать тему', favorite: 'Избранное', favorited: 'В избранном', saveToLibrary: 'Сохранить в Библиотеку', startConversation: 'Начать Разговор',
    generatingContent: 'Генерация контента с помощью ИИ... Для длинных видео это может занять некоторое время', locateCurrent: 'Найти текущее',
    topic: 'Тема', question: 'Вопрос', video: 'Видео'
  },
  'Arabic (العربية)': {
    outline: 'القصة', slang: 'كلمات سحرية', ready: 'مستعد؟', start: 'ابدأ',
    transcriptMismatch: 'النص غير متوفر بـ{lang}. يتم عرض الترجمات المتاحة.',
    outlineTab: 'المخطط', vocabularyTab: 'المفردات', transcriptTab: 'النص', summary: 'الملخص',
    practiceTopics: 'مواضيع الممارسة', selectTopicDesc: 'اختر موضوعًا لبدء ممارسة التحدث والحصول على ملاحظات مخصصة.',
    selectTopic: 'اختر موضوعًا', favorite: 'المفضلة', favorited: 'تمت الإضافة للمفضلة', saveToLibrary: 'حفظ في المكتبة', startConversation: 'بدء المحادثة',
    generatingContent: 'جاري إنشاء المحتوى بالذكاء الاصطناعي... قد يستغرق هذا بعض الوقت للفيديوهات الطويلة', locateCurrent: 'تحديد الموقع الحالي',
    topic: 'الموضوع', question: 'السؤال', video: 'الفيديو'
  },
  'Indonesian (Bahasa Indonesia)': {
    outline: 'Cerita', slang: 'Kata Ajaib', ready: 'Siap?', start: 'Mulai',
    transcriptMismatch: 'Transkrip tidak tersedia dalam {lang}. Menampilkan teks yang tersedia.',
    outlineTab: 'Garis Besar', vocabularyTab: 'Kosakata', transcriptTab: 'Transkrip', summary: 'Ringkasan',
    practiceTopics: 'Topik Latihan', selectTopicDesc: 'Pilih topik untuk memulai latihan berbicara dan dapatkan umpan balik yang dipersonalisasi.',
    selectTopic: 'Pilih topik', favorite: 'Favorit', favorited: 'Difavoritkan', saveToLibrary: 'Simpan ke Perpustakaan', startConversation: 'Mulai Percakapan',
    generatingContent: 'Membuat konten dengan AI... Ini mungkin memakan waktu untuk video yang lebih panjang', locateCurrent: 'Temukan saat ini',
    topic: 'Topik', question: 'Pertanyaan', video: 'Video'
  },
  'Turkish (Türkçe)': {
    outline: 'Hikaye', slang: 'Sihirli Kelimeler', ready: 'Hazır mısın?', start: 'Başla',
    transcriptMismatch: '{lang} dilinde altyazı mevcut değil. Mevcut altyazılar gösteriliyor.',
    outlineTab: 'Taslak', vocabularyTab: 'Kelime Dağarcığı', transcriptTab: 'Transkript', summary: 'Özet',
    practiceTopics: 'Pratik Konuları', selectTopicDesc: 'Konuşma pratiğine başlamak ve kişiselleştirilmiş geri bildirim almak için bir konu seçin.',
    selectTopic: 'Konu seç', favorite: 'Favori', favorited: 'Favorilere eklendi', saveToLibrary: 'Kütüphaneye Kaydet', startConversation: 'Sohbet Başlat',
    generatingContent: 'AI ile içerik oluşturuluyor... Daha uzun videolar için biraz zaman alabilir', locateCurrent: 'Mevcut konumu bul',
    topic: 'Konu', question: 'Soru', video: 'Video'
  },
  'Vietnamese (Tiếng Việt)': {
    outline: 'Câu chuyện', slang: 'Từ ngữ phép thuật', ready: 'Sẵn sàng?', start: 'Bắt đầu',
    transcriptMismatch: 'Phụ đề không có sẵn bằng {lang}. Đang hiển thị phụ đề có sẵn.',
    outlineTab: 'Dàn ý', vocabularyTab: 'Từ vựng', transcriptTab: 'Phụ đề', summary: 'Tóm tắt',
    practiceTopics: 'Chủ đề Luyện tập', selectTopicDesc: 'Chọn một chủ đề để bắt đầu luyện nói và nhận phản hồi cá nhân hóa.',
    selectTopic: 'Chọn chủ đề', favorite: 'Yêu thích', favorited: 'Đã yêu thích', saveToLibrary: 'Lưu vào Thư viện', startConversation: 'Bắt đầu Cuộc trò chuyện',
    generatingContent: 'Đang tạo nội dung bằng AI... Có thể mất một lúc cho video dài hơn', locateCurrent: 'Xác định vị trí hiện tại',
    topic: 'Chủ đề', question: 'Câu hỏi', video: 'Video'
  }
};