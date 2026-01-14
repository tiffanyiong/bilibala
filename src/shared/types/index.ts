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