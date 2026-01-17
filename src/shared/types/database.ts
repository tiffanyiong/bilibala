import { TopicPoint, VocabularyItem, PracticeTopic } from './index';

// ============================================
// DATABASE ROW TYPES (matching Supabase schema)
// ============================================

export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export interface AnalysisContent {
  topics: TopicPoint[];
  vocabulary: VocabularyItem[];
  transcript: TranscriptItem[];
  discussionTopics: PracticeTopic[];
}

export interface DbGlobalVideo {
  id: string;
  youtube_id: string;
  title: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  channel_name: string | null;
  view_count: number;
  is_featured: boolean;
  category: string | null;
  created_at: string;
}

export interface DbCachedAnalysis {
  id: string;
  video_id: string;
  level: string;
  target_lang: string;
  native_lang: string;
  created_by: string | null;
  summary: string | null;
  translated_summary: string | null;
  content: AnalysisContent;
  created_at: string;
}

export interface DbPracticeTopic {
  id: string;
  topic: string;
  category: string | null;
  difficulty_level: string | null;
  target_words: string[] | null;
  source_type: string;
  analysis_id: string | null;
  practice_count: number;
  is_active: boolean;
  created_at: string;
}

export interface DbTopicQuestion {
  id: string;
  topic_id: string;
  question: string;
  source_type: string;
  created_by: string | null;
  is_public: boolean;
  use_count: number;
  created_at: string;
}

// ============================================
// INSERT TYPES (without auto-generated fields)
// ============================================

export type InsertGlobalVideo = {
  youtube_id: string;
  title?: string | null;
  thumbnail_url?: string | null;
  duration_sec?: number | null;
  channel_name?: string | null;
};

export type InsertCachedAnalysis = {
  video_id: string;
  level: string;
  target_lang: string;
  native_lang: string;
  created_by?: string | null;
  summary?: string | null;
  translated_summary?: string | null;
  content: AnalysisContent;
};

export type InsertPracticeTopic = {
  topic: string;
  category?: string | null;
  difficulty_level?: string | null;
  target_words?: string[] | null;
  source_type: string;
  analysis_id?: string | null;
};

export type InsertTopicQuestion = {
  topic_id: string;
  question: string;
  source_type: string;
  created_by?: string | null;
  is_public?: boolean;
};
