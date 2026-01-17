import { supabase } from './supabaseClient';
import { ContentAnalysis, PracticeTopic } from '../types';
import {
  DbGlobalVideo,
  DbCachedAnalysis,
  DbPracticeTopic,
  AnalysisContent,
  InsertGlobalVideo,
  InsertCachedAnalysis,
  InsertPracticeTopic,
  InsertTopicQuestion,
} from '../types/database';

// ============================================
// GLOBAL VIDEOS
// ============================================

/**
 * Get a video by YouTube ID, or create it if it doesn't exist
 */
export async function getOrCreateVideo(
  youtubeId: string,
  title: string,
  thumbnailUrl?: string
): Promise<DbGlobalVideo | null> {
  // First, try to find existing video
  const { data: existing, error: fetchError } = await supabase
    .from('global_videos')
    .select('*')
    .eq('youtube_id', youtubeId)
    .single();

  if (existing && !fetchError) {
    return existing as DbGlobalVideo;
  }

  // If not found (PGRST116 = no rows), create new
  if (fetchError?.code === 'PGRST116' || !existing) {
    const newVideo: InsertGlobalVideo = {
      youtube_id: youtubeId,
      title: title || null,
      thumbnail_url: thumbnailUrl || null,
    };

    const { data: created, error: insertError } = await supabase
      .from('global_videos')
      .insert(newVideo)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating video:', insertError);
      return null;
    }

    return created as DbGlobalVideo;
  }

  console.error('Error fetching video:', fetchError);
  return null;
}

/**
 * Get video by YouTube ID
 */
export async function getVideoByYoutubeId(
  youtubeId: string
): Promise<DbGlobalVideo | null> {
  const { data, error } = await supabase
    .from('global_videos')
    .select('*')
    .eq('youtube_id', youtubeId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching video:', error);
    }
    return null;
  }

  return data as DbGlobalVideo;
}

/**
 * Increment video view count
 */
export async function incrementVideoView(videoId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_video_view', {
    video_id_input: videoId,
  });

  if (error) {
    console.error('Error incrementing video view:', error);
  }
}

// ============================================
// CACHED ANALYSES
// ============================================

/**
 * Check if a cached analysis exists for given parameters
 * Cache key: video_id + level + target_lang + native_lang
 */
export async function getCachedAnalysis(
  videoId: string,
  level: string,
  targetLang: string,
  nativeLang: string
): Promise<DbCachedAnalysis | null> {
  const { data, error } = await supabase
    .from('cached_analyses')
    .select('*')
    .eq('video_id', videoId)
    .eq('level', level)
    .eq('target_lang', targetLang)
    .eq('native_lang', nativeLang)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching cached analysis:', error);
    }
    return null;
  }

  return data as DbCachedAnalysis;
}

/**
 * Save analysis to cache
 */
export async function saveCachedAnalysis(
  videoId: string,
  level: string,
  targetLang: string,
  nativeLang: string,
  analysis: ContentAnalysis,
  userId?: string | null
): Promise<DbCachedAnalysis | null> {
  const content: AnalysisContent = {
    topics: analysis.topics || [],
    vocabulary: analysis.vocabulary || [],
    transcript: analysis.transcript || [],
    discussionTopics: analysis.discussionTopics || [],
  };

  const insertData: InsertCachedAnalysis = {
    video_id: videoId,
    level,
    target_lang: targetLang,
    native_lang: nativeLang,
    summary: analysis.summary || null,
    translated_summary: analysis.translatedSummary || null,
    content,
    created_by: userId || null,
  };

  const { data, error } = await supabase
    .from('cached_analyses')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error saving cached analysis:', error);
    return null;
  }

  return data as DbCachedAnalysis;
}

/**
 * Convert cached analysis back to ContentAnalysis format for the app
 */
export function dbAnalysisToContentAnalysis(
  dbAnalysis: DbCachedAnalysis
): ContentAnalysis {
  const content = dbAnalysis.content as AnalysisContent;
  return {
    summary: dbAnalysis.summary || '',
    translatedSummary: dbAnalysis.translated_summary || '',
    topics: content?.topics || [],
    vocabulary: content?.vocabulary || [],
    transcript: content?.transcript || [],
    discussionTopics: content?.discussionTopics || [],
  };
}

// ============================================
// PRACTICE TOPICS & QUESTIONS
// ============================================

/**
 * Save practice topics and their questions from an analysis
 * Returns the created topic IDs
 */
export async function savePracticeTopicsFromAnalysis(
  analysisId: string,
  discussionTopics: PracticeTopic[],
  difficultyLevel?: string
): Promise<string[]> {
  if (!discussionTopics || discussionTopics.length === 0) {
    return [];
  }

  const createdTopicIds: string[] = [];

  for (const topic of discussionTopics) {
    // Check if topic already exists for this analysis
    const { data: existingTopic } = await supabase
      .from('practice_topics')
      .select('id')
      .eq('topic', topic.topic)
      .eq('analysis_id', analysisId)
      .single();

    if (existingTopic) {
      createdTopicIds.push(existingTopic.id);
      continue;
    }

    // Insert practice topic
    const topicData: InsertPracticeTopic = {
      topic: topic.topic,
      category: null,
      difficulty_level: difficultyLevel || null,
      target_words: topic.targetWords || null,
      source_type: 'video_generated',
      analysis_id: analysisId,
    };

    const { data: createdTopic, error: topicError } = await supabase
      .from('practice_topics')
      .insert(topicData)
      .select()
      .single();

    if (topicError) {
      console.error('Error saving practice topic:', topicError);
      continue;
    }

    createdTopicIds.push(createdTopic.id);

    // Insert associated question
    if (topic.question) {
      const questionData: InsertTopicQuestion = {
        topic_id: createdTopic.id,
        question: topic.question,
        source_type: 'video_generated',
        is_public: true,
      };

      const { error: questionError } = await supabase
        .from('topic_questions')
        .insert(questionData);

      if (questionError) {
        console.error('Error saving topic question:', questionError);
      }
    }
  }

  return createdTopicIds;
}

/**
 * Get popular practice topics for Quick Start
 */
export async function getPopularPracticeTopics(
  limit: number = 10
): Promise<DbPracticeTopic[]> {
  const { data, error } = await supabase
    .from('practice_topics')
    .select('*')
    .eq('is_active', true)
    .order('practice_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching popular topics:', error);
    return [];
  }

  return data as DbPracticeTopic[];
}

/**
 * Increment practice count for a topic (for popularity ranking)
 */
export async function incrementTopicPracticeCount(
  topicId: string
): Promise<void> {
  const { error } = await supabase.rpc('increment_topic_practice', {
    topic_id_input: topicId,
  });

  if (error) {
    // Fallback: manual increment
    const { data: current } = await supabase
      .from('practice_topics')
      .select('practice_count')
      .eq('id', topicId)
      .single();

    if (current) {
      await supabase
        .from('practice_topics')
        .update({ practice_count: (current.practice_count || 0) + 1 })
        .eq('id', topicId);
    }
  }
}

/**
 * Get practice topics for a specific analysis
 */
export async function getPracticeTopicsForAnalysis(
  analysisId: string
): Promise<DbPracticeTopic[]> {
  const { data, error } = await supabase
    .from('practice_topics')
    .select('*')
    .eq('analysis_id', analysisId);

  if (error) {
    console.error('Error fetching practice topics:', error);
    return [];
  }

  return data as DbPracticeTopic[];
}
