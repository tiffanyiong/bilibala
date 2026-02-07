import { TopicPoint, VocabularyItem, PracticeTopic } from './index';
import { MONTHLY_MAX_MINUTES, PRO_VIDEOS_PER_MONTH } from '../config/aiTutorConfig';

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
  transcript_lang_mismatch: boolean;
  created_at: string;
}

export interface DbPracticeTopic {
  id: string;
  topic: string;
  normalized_topic: string;
  target_lang: string;
  category: string | null;
  difficulty_level: string | null;
  target_words: string[] | null;
  source_type: string;
  practice_count: number;
  is_active: boolean;
  created_at: string;
}

export interface DbTopicQuestion {
  id: string;
  topic_id: string;
  question: string;
  analysis_id: string | null;
  source_type: string;
  difficulty_level: string | null;
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
  transcript_lang_mismatch?: boolean;
};

export type InsertPracticeTopic = {
  topic: string;
  normalized_topic: string;
  target_lang: string;
  category?: string | null;
  difficulty_level?: string | null;
  target_words?: string[] | null;
  source_type: string;
};

export type InsertTopicQuestion = {
  topic_id: string;
  question: string;
  analysis_id?: string | null;
  source_type: string;
  difficulty_level?: string | null;
  created_by?: string | null;
  is_public?: boolean;
};

// ============================================
// PRACTICE SESSIONS
// ============================================

export interface DbPracticeSession {
  id: string;
  user_id: string;
  analysis_id: string | null;
  topic_id: string | null;
  question_id: string | null;
  topic_text: string;
  question_text: string;
  target_lang: string;
  native_lang: string;
  level: string;
  audio_url: string | null;
  recording_duration_sec: number | null;
  transcription: string | null;
  score: number | null;
  feedback_data: object | null;
  created_at: string;
}

export type InsertPracticeSession = {
  user_id: string;
  analysis_id?: string | null;
  topic_id?: string | null;
  question_id?: string | null;
  topic_text: string;
  question_text: string;
  target_lang: string;
  native_lang: string;
  level: string;
  audio_url?: string | null;
  recording_duration_sec?: number | null;
  transcription?: string | null;
  score?: number | null;
  feedback_data?: object | null;
};

// ============================================
// USER LIBRARY
// ============================================

export interface DbUserLibrary {
  id: string;
  user_id: string;
  analysis_id: string;
  is_favorite: boolean;
  practice_count: number;
  last_score: number | null;
  last_accessed_at: string;
  created_at: string;
}

export type InsertUserLibrary = {
  user_id: string;
  analysis_id: string;
  is_favorite?: boolean;
  practice_count?: number;
  last_score?: number | null;
};

// Combined type for UI display (joins user_library + cached_analyses + global_videos)
export interface VideoHistoryItem {
  // From user_library
  libraryId: string;
  isFavorite: boolean;
  practiceCount: number;
  lastScore: number | null;
  lastAccessedAt: string;
  addedAt: string;

  // From cached_analyses
  analysisId: string;
  level: string;
  targetLang: string;
  nativeLang: string;
  analyzedAt: string;

  // From global_videos
  videoId: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;

  // Computed: actual count of practice reports for this video (from practice_sessions)
  reportCount: number;
}

// For Explore section on landing page (public videos, no user-specific fields)
export interface ExploreVideo {
  // From cached_analyses
  analysisId: string;
  level: string;
  targetLang: string;
  nativeLang: string;
  analyzedAt: string;

  // From global_videos
  videoId: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  channelName: string | null;
}

// ============================================
// SUBSCRIPTIONS
// ============================================

export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | null;

export interface DbUserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  monthly_usage_count: number;
  usage_reset_month: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_interval: 'month' | 'year';
  credits_balance: number;
  // Credit pack purchases (never expire, don't reset monthly)
  ai_tutor_credit_minutes: number;
  practice_session_credits: number;
  video_credits: number;
  created_at: string;
  updated_at: string;
}

export type UsageActionType = 'video_analysis' | 'practice_session' | 'ai_tutor' | 'pdf_export';

export interface DbUsageHistory {
  id: string;
  user_id: string;
  action_type: UsageActionType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MonthlyUsage {
  videosUsed: number;
  practiceSessionsUsed: number;
  aiTutorMinutesUsed: number;
  pdfExportsUsed: number;
}

// Tier limits configuration
export const TIER_LIMITS = {
  free: {
    videosPerMonth: 3,
    practiceSessionsPerMonth: 5,
    aiTutorMinutesPerMonth: 0,
    pdfExport: false,
    videoLibraryMax: 10,
  },
  pro: {
    videosPerMonth: PRO_VIDEOS_PER_MONTH,
    practiceSessionsPerMonth: Infinity,
    aiTutorMinutesPerMonth: MONTHLY_MAX_MINUTES,
    pdfExport: true,
    videoLibraryMax: Infinity,
  },
} as const;
