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

export interface SpeechAnalysisResult {
  transcription: string;
  detected_framework?: string; // <--- ADDED THIS (Fixes your error)

  structure: {
    conclusion: string;
    arguments: ArgumentNode[]; // Updated to use recursive type
  };

  improved_structure?: {
    recommended_framework?: string;
    conclusion: string;
    arguments: ImprovedArgumentNode[]; // Updated to use recursive type
  };

  feedback: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
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
  SUBSCRIPTION,           // Subscription management page: /subscription
  PROFILE,                // Profile page: /profile
  SETTINGS,               // Settings page: /settings
  ERROR
}