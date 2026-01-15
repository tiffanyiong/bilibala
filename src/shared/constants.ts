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

export const LEVELS = [
  { id: 'Easy', label: 'Beginner' },
  { id: 'Medium', label: 'Intermediate' },
  { id: 'Hard', label: 'Advanced' }
];

export const UI_TRANSLATIONS: Record<string, { outline: string; slang: string; ready: string; start: string }> = {
  'English': { outline: 'Story Outline', slang: 'Magic Words', ready: 'Ready to Chat?', start: 'Start Adventure' },
  'Spanish (Español)': { outline: 'Historia', slang: 'Palabras Mágicas', ready: '¿Listo?', start: 'Comenzar' },
  'French (Français)': { outline: 'Histoire', slang: 'Mots Magiques', ready: 'Prêt?', start: 'Commencer' },
  'German (Deutsch)': { outline: 'Geschichte', slang: 'Zauberwörter', ready: 'Bereit?', start: 'Starten' },
  'Portuguese (Português)': { outline: 'História', slang: 'Palavras Mágicas', ready: 'Pronto?', start: 'Começar' },
  'Japanese (日本語)': { outline: 'ストーリー', slang: '魔法の言葉', ready: '準備OK？', start: 'スタート' },
  'Korean (한국어)': { outline: '스토리', slang: '마법의 단어', ready: '준비됐나요?', start: '시작하기' },
  'Chinese (Mandarin - 中文)': { outline: '故事大纲', slang: '魔法词汇', ready: '准备好了吗？', start: '开始冒险' },
  'Hindi (हिन्दी)': { outline: 'कहानी', slang: 'जादुई शब्द', ready: 'तैयार?', start: 'शुरू करें' },
  'Italian (Italiano)': { outline: 'Storia', slang: 'Parole Magiche', ready: 'Pronto?', start: 'Inizia' },
  'Russian (Русский)': { outline: 'История', slang: 'Магические слова', ready: 'Готовы?', start: 'Начать' },
  'Arabic (العربية)': { outline: 'القصة', slang: 'كلمات سحرية', ready: 'مستعد؟', start: 'ابدأ' },
  'Indonesian (Bahasa Indonesia)': { outline: 'Cerita', slang: 'Kata Ajaib', ready: 'Siap?', start: 'Mulai' },
  'Turkish (Türkçe)': { outline: 'Hikaye', slang: 'Sihirli Kelimeler', ready: 'Hazır mısın?', start: 'Başla' },
  'Vietnamese (Tiếng Việt)': { outline: 'Câu chuyện', slang: 'Từ ngữ phép thuật', ready: 'Sẵn sàng?', start: 'Bắt đầu' }
};