export interface TopicPoint {
  title: string;
  translatedTitle: string;
  description: string;
  translatedDescription: string;
  // emoji removed
}

export interface VocabularyItem {
  word: string;
  definition: string;
  translatedDefinition: string;
  context: string;
  translatedContext: string;
}

export interface ContentAnalysis {
  summary: string;
  translatedSummary: string;
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
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
  ERROR
}