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

export const UI_TRANSLATIONS: Record<string, { outline: string; slang: string; ready: string; start: string; transcriptMismatch: string }> = {
  'English': { outline: 'Story Outline', slang: 'Magic Words', ready: 'Ready to Chat?', start: 'Start Adventure', transcriptMismatch: 'Transcript not available in {lang}. Showing available captions instead.' },
  'Spanish (Español)': { outline: 'Historia', slang: 'Palabras Mágicas', ready: '¿Listo?', start: 'Comenzar', transcriptMismatch: 'Transcripción no disponible en {lang}. Mostrando subtítulos disponibles.' },
  'French (Français)': { outline: 'Histoire', slang: 'Mots Magiques', ready: 'Prêt?', start: 'Commencer', transcriptMismatch: 'Transcription non disponible en {lang}. Affichage des sous-titres disponibles.' },
  'German (Deutsch)': { outline: 'Geschichte', slang: 'Zauberwörter', ready: 'Bereit?', start: 'Starten', transcriptMismatch: 'Transkript nicht verfügbar auf {lang}. Verfügbare Untertitel werden angezeigt.' },
  'Portuguese (Português)': { outline: 'História', slang: 'Palavras Mágicas', ready: 'Pronto?', start: 'Começar', transcriptMismatch: 'Transcrição não disponível em {lang}. Mostrando legendas disponíveis.' },
  'Japanese (日本語)': { outline: 'ストーリー', slang: '魔法の言葉', ready: '準備OK？', start: 'スタート', transcriptMismatch: '{lang}の字幕がありません。利用可能な字幕を表示しています。' },
  'Korean (한국어)': { outline: '스토리', slang: '마법의 단어', ready: '준비됐나요?', start: '시작하기', transcriptMismatch: '{lang} 자막을 사용할 수 없습니다. 사용 가능한 자막을 표시합니다.' },
  'Chinese (Mandarin - 中文)': { outline: '故事大纲', slang: '魔法词汇', ready: '准备好了吗？', start: '开始冒险', transcriptMismatch: '{lang}字幕不可用，正在显示可用的字幕。' },
  'Hindi (हिन्दी)': { outline: 'कहानी', slang: 'जादुई शब्द', ready: 'तैयार?', start: 'शुरू करें', transcriptMismatch: '{lang} में ट्रांसक्रिप्ट उपलब्ध नहीं है। उपलब्ध कैप्शन दिखा रहे हैं।' },
  'Italian (Italiano)': { outline: 'Storia', slang: 'Parole Magiche', ready: 'Pronto?', start: 'Inizia', transcriptMismatch: 'Trascrizione non disponibile in {lang}. Visualizzazione dei sottotitoli disponibili.' },
  'Russian (Русский)': { outline: 'История', slang: 'Магические слова', ready: 'Готовы?', start: 'Начать', transcriptMismatch: 'Транскрипция недоступна на {lang}. Показаны доступные субтитры.' },
  'Arabic (العربية)': { outline: 'القصة', slang: 'كلمات سحرية', ready: 'مستعد؟', start: 'ابدأ', transcriptMismatch: 'النص غير متوفر بـ{lang}. يتم عرض الترجمات المتاحة.' },
  'Indonesian (Bahasa Indonesia)': { outline: 'Cerita', slang: 'Kata Ajaib', ready: 'Siap?', start: 'Mulai', transcriptMismatch: 'Transkrip tidak tersedia dalam {lang}. Menampilkan teks yang tersedia.' },
  'Turkish (Türkçe)': { outline: 'Hikaye', slang: 'Sihirli Kelimeler', ready: 'Hazır mısın?', start: 'Başla', transcriptMismatch: '{lang} dilinde altyazı mevcut değil. Mevcut altyazılar gösteriliyor.' },
  'Vietnamese (Tiếng Việt)': { outline: 'Câu chuyện', slang: 'Từ ngữ phép thuật', ready: 'Sẵn sàng?', start: 'Bắt đầu', transcriptMismatch: 'Phụ đề không có sẵn bằng {lang}. Đang hiển thị phụ đề có sẵn.' }
};