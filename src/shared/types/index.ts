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
  question: string;
  targetWords: string[];
}

export interface ContentAnalysis {
  summary: string;
  translatedSummary: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  transcript?: { text: string; duration: number; offset: number }[];
  discussionTopics?: PracticeTopic[];
}

export interface SpeechAnalysisResult {
  transcription: string;
  structure: {
    conclusion: string;
    arguments: Array<{
      point: string;
      status: 'strong' | 'weak' | 'missing' | 'irrelevant';
      type: 'fact' | 'story' | 'opinion';
      evidence: string[];
      critique?: string;
    }>;
  };
  improved_structure?: {
    conclusion: string;
    arguments: Array<{
      headline: string;
      elaboration: string;
      type: 'fact' | 'story' | 'opinion';
      evidence: string[];
    }>;
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
  CALL_SESSION,
  PRACTICE_SESSION,
  ERROR
}
