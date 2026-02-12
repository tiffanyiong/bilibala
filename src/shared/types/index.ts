export interface TopicPoint {
  title: string;
  translatedTitle: string;
  description: string;
  translatedDescription: string;
  timestamp?: string;
}

export interface VocabularyItem {
  word: string;
  translatedWord?: string;
  definition: string;
  translatedDefinition: string;
  context: string;
  translatedContext: string;
}

export interface PracticeTopic {
  topic: string;
  category?: string | null;
  question: string;
  targetWords?: string[];
  topicId?: string;
  questionId?: string;
}

// For browsing all questions under a topic
export interface TopicWithQuestions {
  topicId: string;
  topic: string;
  category: string | null;
  targetWords?: string[];
  practiceCount: number;
  questions: TopicQuestion[];
}

export interface TopicQuestion {
  questionId: string;
  question: string;
  sourceType: string; // 'video_generated' | 'ai_generated' | 'user_created'
  difficultyLevel?: string | null; // 'easy' | 'medium' | 'hard'
  useCount: number;
  videoTitle?: string | null;
  analysisId?: string | null;
  youtubeId?: string | null; // YouTube video ID for linking to the source video
}

export interface ContentAnalysis {
  summary: string;
  translatedSummary: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  transcript?: { text: string; duration: number; offset: number }[];
  transcriptLang?: string;
  transcriptLangMismatch?: boolean;
  discussionTopics?: PracticeTopic[];
  videoCategory?: string | null;
}

// --- NEW: Recursive Interfaces for Graph Nodes ---

export interface ArgumentNode {
  point: string;
  status: 'strong' | 'weak' | 'missing' | 'irrelevant';
  type: 'fact' | 'story' | 'opinion';
  evidence: string[];
  critique?: string;
  sub_points?: ArgumentNode[]; // Recursive for nested stories
}

export interface ImprovedArgumentNode {
  headline: string;
  elaboration: string;
  type: 'fact' | 'story' | 'opinion';
  evidence: string[];
  sub_points?: ImprovedArgumentNode[]; // Recursive for nested stories
}

// --- POC: Pronunciation Analysis ---
export interface PronunciationWord {
  word: string;
  status: 'good' | 'needs-work' | 'unclear';
  feedback?: string; // e.g., "Try stressing the second syllable"
}

export interface PronunciationAnalysis {
  overall: 'native-like' | 'clear' | 'accented' | 'needs-work';
  words: PronunciationWord[];
  intonation: {
    pattern: 'natural' | 'flat' | 'monotone' | 'overly-expressive';
    feedback: string; // e.g., "Try rising intonation on questions"
  };
  summary: string; // Brief overall pronunciation feedback
}

// --- Language-specific scoring breakdowns ---
export interface IELTSBreakdown {
  framework: 'ielts';
  band_score: number;           // 0-9, step 0.5
  fluency_coherence: number;    // 0-9, step 0.5
  lexical_resource: number;     // 0-9, step 0.5
  grammatical_range: number;    // 0-9, step 0.5
  pronunciation: number;        // 0-9, step 0.5
  band_descriptor?: string;     // e.g. "Good User"
}

export interface HSKBreakdown {
  framework: 'hsk';
  hsk_level: number;              // 1-6, step 0.5
  pronunciation_tones: number;    // 0-100
  vocabulary_grammar: number;     // 0-100
  fluency_coherence: number;      // 0-100
  content_expressiveness: number; // 0-100
  level_descriptor?: string;      // e.g. "Intermediate (中级)"
}

export type ScoringBreakdown = IELTSBreakdown | HSKBreakdown;

export interface SpeechAnalysisResult {
  transcription: string;
  detected_framework?: string;

  structure: {
    conclusion: string;
    arguments: ArgumentNode[];
  };

  improved_structure?: {
    recommended_framework?: string;
    conclusion: string;
    arguments: ImprovedArgumentNode[];
  };

  // Fluent speech version of improved_structure (no framework labels, natural flow)
  improved_transcription?: string;

  feedback: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    breakdown?: ScoringBreakdown; // Language-specific scoring (IELTS/HSK)
  };

  improvements: Array<{
    original: string;
    improved: string;
    explanation: string;
  }>;

  // POC: Pronunciation Analysis (optional - may not be present in older data)
  pronunciation?: PronunciationAnalysis;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface HistoryItem {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface VideoData {
  id: string;
  url: string;
  title: string;
}

export enum AppState {
  LANDING,
  LOADING,
  DASHBOARD,
  PRACTICE_SESSION,
  VIDEO_LIBRARY,
  PRACTICE_REPORTS,       // Full-page reports list: /{videoId}/reports
  PRACTICE_REPORT_DETAIL, // Full-page single report: /{videoId}/reports/{sessionId}
  REPORTS_DASHBOARD,      // Centralized reports dashboard: /reports
  SUBSCRIPTION,           // Subscription management page: /subscription
  PROFILE,                // Profile page: /profile
  SETTINGS,               // Settings page: /settings
  PRIVACY,                // Privacy Policy page: /privacy
  TERMS,                  // Terms of Service page: /terms
  RESET_PASSWORD,         // Password reset page: /reset-password
  ERROR
}