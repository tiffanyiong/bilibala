import { supabase } from './supabaseClient';
import { getBackendOrigin } from './backend';
import { ContentAnalysis, PracticeTopic, TopicQuestion } from '../types';
import {
  DbGlobalVideo,
  DbCachedAnalysis,
  DbPracticeTopic,
  DbTopicQuestion,
  DbPracticeSession,
  DbUserLibrary,
  AnalysisContent,
  InsertGlobalVideo,
  InsertCachedAnalysis,
  InsertPracticeTopic,
  InsertTopicQuestion,
  InsertPracticeSession,
  VideoHistoryItem,
  DashboardPracticeSession,
} from '../types/database';

// ============================================
// GLOBAL VIDEOS
// ============================================

/**
 * Check if a string is a valid YouTube video ID (11 characters, alphanumeric with - and _)
 */
function isValidYoutubeId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // YouTube IDs are exactly 11 characters: alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Get a video by YouTube ID, or create it if it doesn't exist
 * Returns null if the YouTube ID is invalid
 */
export async function getOrCreateVideo(
  youtubeId: string,
  title: string,
  thumbnailUrl?: string
): Promise<DbGlobalVideo | null> {
  // Validate YouTube ID format before saving
  if (!isValidYoutubeId(youtubeId)) {
    console.error('Invalid YouTube ID format:', youtubeId);
    return null;
  }

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
 * Get cached analysis by its ID (for loading from library)
 */
export async function getCachedAnalysisById(
  analysisId: string
): Promise<DbCachedAnalysis | null> {
  const { data, error } = await supabase
    .from('cached_analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (error) {
    console.error('Error fetching cached analysis by ID:', error);
    return null;
  }

  return data as DbCachedAnalysis;
}

// Type for analysis with video info (for explore feature)
export interface CachedAnalysisWithVideo extends DbCachedAnalysis {
  global_videos: {
    id: string;
    youtube_id: string;
    title: string | null;
    thumbnail_url: string | null;
  };
}

/**
 * Get cached analysis by its ID with video info (for explore feature)
 */
export async function getCachedAnalysisWithVideoById(
  analysisId: string
): Promise<CachedAnalysisWithVideo | null> {
  const { data, error } = await supabase
    .from('cached_analyses')
    .select(`
      *,
      global_videos (
        id,
        youtube_id,
        title,
        thumbnail_url
      )
    `)
    .eq('id', analysisId)
    .single();

  if (error) {
    console.error('Error fetching cached analysis with video:', error);
    return null;
  }

  return data as CachedAnalysisWithVideo;
}

/**
 * Get any cached analysis for a YouTube video ID (for direct URL access)
 * Returns the most recently created analysis if multiple exist
 */
export async function getAnyCachedAnalysisForYoutubeId(
  youtubeId: string
): Promise<(DbCachedAnalysis & { video_title: string }) | null> {
  // First get the video from global_videos
  const video = await getVideoByYoutubeId(youtubeId);
  if (!video) return null;

  // Get the most recent analysis for this video
  const { data, error } = await supabase
    .from('cached_analyses')
    .select('*')
    .eq('video_id', video.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching any cached analysis:', error);
    }
    return null;
  }

  return { ...data, video_title: video.title } as DbCachedAnalysis & { video_title: string };
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
    transcript_lang_mismatch: analysis.transcriptLangMismatch || false,
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
 * Update the content of a cached analysis (e.g., to use canonical topic names)
 */
export async function updateCachedAnalysisContent(
  analysisId: string,
  discussionTopics: PracticeTopic[]
): Promise<void> {
  // Fetch current content first
  const { data: current, error: fetchError } = await supabase
    .from('cached_analyses')
    .select('content')
    .eq('id', analysisId)
    .single();

  if (fetchError || !current) {
    console.error('Error fetching cached analysis for update:', fetchError);
    return;
  }

  // Update only the discussionTopics in the content
  const updatedContent = {
    ...(current.content as AnalysisContent),
    discussionTopics,
  };

  const { error: updateError } = await supabase
    .from('cached_analyses')
    .update({ content: updatedContent })
    .eq('id', analysisId);

  if (updateError) {
    console.error('Error updating cached analysis content:', updateError);
  }
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
    transcriptLangMismatch: dbAnalysis.transcript_lang_mismatch || false,
  };
}

// ============================================
// PRACTICE TOPICS & QUESTIONS
// ============================================

/**
 * Save practice topics and their questions from an analysis.
 * Topics are canonical (standalone, deduplicated by normalized name + language).
 * Questions link to both a topic and the video analysis they came from.
 */
export async function savePracticeTopicsFromAnalysis(
  analysisId: string,
  discussionTopics: PracticeTopic[],
  targetLang: string,
  difficultyLevel?: string
): Promise<PracticeTopic[]> {
  if (!discussionTopics || discussionTopics.length === 0) {
    return [];
  }

  // 1. Fetch all existing canonical topics for this language
  const { data: existingTopics } = await supabase
    .from('practice_topics')
    .select('id, topic, normalized_topic, target_words')
    .eq('target_lang', targetLang)
    .eq('is_active', true);

  // 2. Phase 1: exact normalized match
  const unmatched: PracticeTopic[] = [];
  const matched: { topic: PracticeTopic; existingId: string }[] = [];

  for (const topic of discussionTopics) {
    const normalized = topic.topic.toLowerCase().trim();
    const exactMatch = (existingTopics || []).find(
      (e: any) => e.normalized_topic === normalized
    );
    if (exactMatch) {
      matched.push({ topic, existingId: exactMatch.id });
    } else {
      unmatched.push(topic);
    }
  }

  // 3. Phase 2: AI semantic match for unmatched topics
  let aiMatches: { new_topic: string; match: string | null }[] = [];
  if (unmatched.length > 0 && (existingTopics || []).length > 0) {
    try {
      const backendOrigin = getBackendOrigin();
      const response = await fetch(`${backendOrigin}/api/match-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTopics: unmatched.map(t => t.topic),
          existingTopics: (existingTopics || []).map((t: any) => ({ id: t.id, topic: t.topic })),
          targetLang,
        }),
      });
      const data = await response.json();
      aiMatches = data.matches || [];
    } catch (err) {
      console.error('AI topic matching failed, treating all as new:', err);
    }
  }

  // 4. Process all topics
  const topicsWithIds: PracticeTopic[] = [];

  // Process exact matches - use canonical topic name from DB
  for (const { topic, existingId } of matched) {
    const canonicalTopic = (existingTopics || []).find((e: any) => e.id === existingId);
    const questionId = await upsertTopicQuestion(existingId, topic.question, analysisId, difficultyLevel);
    await mergeTargetWords(existingId, topic.targetWords);
    topicsWithIds.push({
      ...topic,
      topic: canonicalTopic?.topic || topic.topic, // Use canonical name
      topicId: existingId,
      questionId
    });
  }

  // Process unmatched (may have AI matches)
  for (const topic of unmatched) {
    const aiMatch = aiMatches.find(m => m.new_topic === topic.topic);

    if (aiMatch?.match) {
      // AI found a semantic match to existing topic - use canonical name
      const canonicalTopic = (existingTopics || []).find((e: any) => e.id === aiMatch.match);
      const questionId = await upsertTopicQuestion(aiMatch.match, topic.question, analysisId, difficultyLevel);
      await mergeTargetWords(aiMatch.match, topic.targetWords);
      topicsWithIds.push({
        ...topic,
        topic: canonicalTopic?.topic || topic.topic, // Use canonical name
        topicId: aiMatch.match,
        questionId
      });
    } else {
      // Create new canonical topic - topic name becomes the canonical name
      const newTopicId = await createCanonicalTopic(topic, targetLang, difficultyLevel);
      if (newTopicId) {
        const questionId = await upsertTopicQuestion(newTopicId, topic.question, analysisId, difficultyLevel);
        topicsWithIds.push({ ...topic, topicId: newTopicId, questionId });
      } else {
        topicsWithIds.push(topic); // Add without IDs on error
      }
    }
  }

  return topicsWithIds;
}

/**
 * Insert a question under a topic if it doesn't already exist.
 * Links the question to the analysis (video) it came from.
 */
async function upsertTopicQuestion(
  topicId: string,
  question: string,
  analysisId: string,
  difficultyLevel?: string | null
): Promise<string | undefined> {
  // Check if this exact question already exists for this topic
  const { data: existing } = await supabase
    .from('topic_questions')
    .select('id')
    .eq('topic_id', topicId)
    .eq('question', question)
    .single();

  if (existing) return existing.id;

  const questionData: InsertTopicQuestion = {
    topic_id: topicId,
    question,
    analysis_id: analysisId,
    source_type: 'video_generated',
    difficulty_level: difficultyLevel?.toLowerCase() || null,
    is_public: true,
  };

  const { data: created, error } = await supabase
    .from('topic_questions')
    .insert(questionData)
    .select()
    .single();

  if (error) {
    console.error('Error saving topic question:', error);
    return undefined;
  }
  return created.id;
}

/**
 * Create a new canonical topic with normalized name and language.
 */
async function createCanonicalTopic(
  topic: PracticeTopic,
  targetLang: string,
  difficultyLevel?: string
): Promise<string | null> {
  const topicData: InsertPracticeTopic = {
    topic: topic.topic,
    normalized_topic: topic.topic.toLowerCase().trim(),
    target_lang: targetLang,
    category: topic.category || null,
    difficulty_level: difficultyLevel?.toLowerCase() || null,
    target_words: topic.targetWords || null,
    source_type: 'video_generated',
  };

  const { data, error } = await supabase
    .from('practice_topics')
    .insert(topicData)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating canonical topic:', error);
    return null;
  }
  return data.id;
}

/**
 * Merge new target words into an existing topic's target_words array.
 */
async function mergeTargetWords(
  topicId: string,
  newWords: string[] | undefined
): Promise<void> {
  if (!newWords || newWords.length === 0) return;

  const { data: existing } = await supabase
    .from('practice_topics')
    .select('target_words')
    .eq('id', topicId)
    .single();

  const existingWords: string[] = existing?.target_words || [];
  const merged = [...new Set([...existingWords, ...newWords])];

  await supabase
    .from('practice_topics')
    .update({ target_words: merged })
    .eq('id', topicId);
}

/**
 * Save a new AI-generated question under a topic.
 * Used by the "Generate" button in PracticeSession.
 */
export async function saveGeneratedQuestion(
  topicId: string,
  question: string,
  analysisId?: string | null,
  userId?: string | null,
  difficultyLevel?: string | null
): Promise<DbTopicQuestion | null> {
  const questionData: InsertTopicQuestion = {
    topic_id: topicId,
    question,
    analysis_id: analysisId || null,
    source_type: 'ai_generated',
    difficulty_level: difficultyLevel?.toLowerCase() || null,
    created_by: userId || null,
    is_public: true,
  };

  console.log('[saveGeneratedQuestion] Saving with data:', {
    topicId,
    question: question.substring(0, 50) + '...',
    analysisId,
    userId,
    difficultyLevel,
    difficulty_level_to_save: questionData.difficulty_level,
    created_by: questionData.created_by,
  });

  const { data, error } = await supabase
    .from('topic_questions')
    .insert(questionData)
    .select()
    .single();

  if (error) {
    console.error('Error saving generated question:', error);
    return null;
  }

  console.log('[saveGeneratedQuestion] Saved question result:', {
    id: data.id,
    created_by: data.created_by,
    difficulty_level: data.difficulty_level,
  });

  return data as DbTopicQuestion;
}

/**
 * Get all questions for a topic, ordered by use count.
 * Includes the video title for questions that came from a video analysis.
 */
export async function getQuestionsForTopic(
  topicId: string,
  userLevel?: string // 'easy' | 'medium' | 'hard' - filters questions to match user's level
): Promise<TopicQuestion[]> {
  let query = supabase
    .from('topic_questions')
    .select(`
      id,
      question,
      analysis_id,
      source_type,
      difficulty_level,
      use_count,
      cached_analyses (
        id,
        global_videos ( title, youtube_id )
      )
    `)
    .eq('topic_id', topicId)
    .eq('is_public', true);

  // Filter by difficulty level if provided (strict matching only)
  if (userLevel) {
    query = query.eq('difficulty_level', userLevel.toLowerCase());
  }

  const { data, error } = await query.order('use_count', { ascending: false });

  if (error) {
    console.error('Error fetching questions for topic:', error);
    return [];
  }

  return (data || []).map((q: any) => ({
    questionId: q.id,
    question: q.question,
    sourceType: q.source_type,
    difficultyLevel: q.difficulty_level,
    useCount: q.use_count,
    videoTitle: q.cached_analyses?.global_videos?.title || null,
    analysisId: q.analysis_id || null,
    youtubeId: q.cached_analyses?.global_videos?.youtube_id || null,
  }));
}

/**
 * Count AI-generated questions for a topic (for enforcing the 3-per-topic limit).
 * If userId is provided, counts only questions created by that user (per-user limit).
 * If userId is not provided, counts all AI-generated questions (global limit).
 */
export async function countAiGeneratedQuestions(
  topicId: string,
  userId?: string | null
): Promise<number> {
  let query = supabase
    .from('topic_questions')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .eq('source_type', 'ai_generated');

  // If userId provided, count only this user's generated questions
  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error counting AI questions:', error);
    return 0;
  }
  return count || 0;
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
  console.log('[DB] incrementTopicPracticeCount called for:', topicId);

  // Try RPC function first
  const { error: rpcError } = await supabase.rpc('increment_topic_practice', {
    topic_id_input: topicId,
  });

  if (rpcError) {
    console.log('[DB] RPC increment_topic_practice failed, using fallback:', rpcError.message);

    // Fallback: manual increment
    const { data: current, error: fetchError } = await supabase
      .from('practice_topics')
      .select('practice_count')
      .eq('id', topicId)
      .single();

    if (fetchError) {
      console.error('[DB] Error fetching topic practice count:', fetchError);
      return;
    }

    const newCount = (current?.practice_count || 0) + 1;
    console.log('[DB] Updating topic practice_count from', current?.practice_count, 'to', newCount);

    const { data: updateData, error: updateError } = await supabase
      .from('practice_topics')
      .update({ practice_count: newCount })
      .eq('id', topicId)
      .select();

    if (updateError) {
      console.error('[DB] Error updating topic practice count:', updateError);
    } else {
      console.log('[DB] Topic practice_count updated successfully:', updateData);
    }
  } else {
    console.log('[DB] RPC increment_topic_practice succeeded');
  }
}

/**
 * Increment use count for a question (for popularity ranking)
 */
export async function incrementQuestionUseCount(
  questionId: string
): Promise<void> {
  console.log('[DB] incrementQuestionUseCount called for:', questionId);

  // First get current use count
  const { data: current, error: fetchError } = await supabase
    .from('topic_questions')
    .select('use_count')
    .eq('id', questionId)
    .single();

  if (fetchError) {
    console.error('[DB] Error fetching question use count:', fetchError);
    return;
  }

  const newCount = (current?.use_count || 0) + 1;
  console.log('[DB] Updating question use_count from', current?.use_count, 'to', newCount);

  const { data: updateData, error: updateError } = await supabase
    .from('topic_questions')
    .update({ use_count: newCount })
    .eq('id', questionId)
    .select();

  if (updateError) {
    console.error('[DB] Error incrementing question use count:', updateError);
  } else {
    console.log('[DB] Question use_count updated successfully:', updateData);
  }
}

/**
 * Get practice topics for a specific analysis with their question IDs.
 * Now queries via topic_questions.analysis_id since topics are canonical (not tied to a single analysis).
 */
export async function getPracticeTopicsForAnalysis(
  analysisId: string
): Promise<(DbPracticeTopic & { questionId?: string; question?: string })[]> {
  // Find questions that came from this analysis, then get their topics
  const { data, error } = await supabase
    .from('topic_questions')
    .select(`
      id,
      question,
      practice_topics (*)
    `)
    .eq('analysis_id', analysisId);

  if (error) {
    console.error('Error fetching practice topics:', error);
    return [];
  }

  // Deduplicate topics (a topic may have multiple questions from the same analysis)
  // Use the first question found for each topic as the default questionId
  const topicMap = new Map<string, DbPracticeTopic & { questionId?: string; question?: string }>();
  for (const q of (data || []) as any[]) {
    if (q.practice_topics && !topicMap.has(q.practice_topics.id)) {
      topicMap.set(q.practice_topics.id, {
        ...q.practice_topics,
        questionId: q.id,
        question: q.question, // Include question text for matching
      });
    }
  }

  const result = Array.from(topicMap.values());
  console.log('[DB] Practice topics with questionId:', result.map(t => ({ topic: t.topic, topicId: t.id, questionId: t.questionId, question: t.question?.substring(0, 30) })));

  return result;
}

/**
 * Get topic IDs that have at least one question at a specific difficulty level.
 * Used to filter out topics with no questions for the user's selected level.
 */
export async function getTopicIdsWithQuestionsAtLevel(
  topicIds: string[],
  level: string
): Promise<Set<string>> {
  if (topicIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('topic_questions')
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('difficulty_level', level.toLowerCase())
    .eq('is_public', true);

  if (error) {
    console.error('Error fetching topics with questions:', error);
    return new Set(topicIds); // On error, don't filter out any topics
  }

  return new Set((data || []).map((q: any) => q.topic_id));
}

/**
 * Update a video's category
 */
export async function updateVideoCategory(
  videoId: string,
  category: string
): Promise<void> {
  const { error } = await supabase
    .from('global_videos')
    .update({ category })
    .eq('id', videoId);

  if (error) {
    console.error('Error updating video category:', error);
  }
}

// ============================================
// PRACTICE SESSIONS
// ============================================

/**
 * Upload practice audio to Supabase Storage
 * Returns the public URL of the uploaded audio
 * @param mimeType - The actual MIME type of the audio (e.g., 'audio/webm', 'audio/mp4')
 */
export async function uploadPracticeAudio(
  userId: string,
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<string | null> {
  try {
    // Convert base64 to blob with the correct MIME type
    const byteCharacters = atob(audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Determine file extension based on MIME type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
    };
    const extension = extensionMap[mimeType] || 'webm';

    // Generate unique filename with correct extension
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}.${extension}`;

    // Upload to Supabase Storage with correct content type
    const { data, error } = await supabase.storage
      .from('practice-recordings')
      .upload(filename, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Error uploading audio:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('practice-recordings')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Error processing audio upload:', err);
    return null;
  }
}

/**
 * Save a practice session (user's speech practice attempt)
 */
export async function savePracticeSession(
  session: InsertPracticeSession
): Promise<DbPracticeSession | null> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .insert(session)
    .select()
    .single();

  if (error) {
    console.error('Error saving practice session:', error);
    return null;
  }

  return data as DbPracticeSession;
}

/**
 * Get practice sessions for a user
 */
export async function getUserPracticeSessions(
  userId: string,
  limit: number = 20
): Promise<DbPracticeSession[]> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching practice sessions:', error);
    return [];
  }

  return data as DbPracticeSession[];
}

// ============================================
// USER LIBRARY
// ============================================

/**
 * Get the count of videos in user's library
 */
export async function getUserLibraryCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_library')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('[getUserLibraryCount] Error:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if adding to library is allowed based on tier limits
 * Returns { allowed: true } or { allowed: false, currentCount, limit }
 */
export async function checkLibraryLimit(
  userId: string,
  libraryLimit: number
): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  const currentCount = await getUserLibraryCount(userId);

  // Check if this analysis is already in the library (re-adding doesn't count against limit)
  return {
    allowed: currentCount < libraryLimit || libraryLimit === Infinity,
    currentCount,
    limit: libraryLimit,
  };
}

/**
 * Add a video analysis to user's library (upsert - won't duplicate)
 * Called when user analyzes a video or loads from cache
 *
 * @param userId - The user's ID
 * @param analysisId - The analysis ID to add
 * @param libraryLimit - The user's library limit (from TIER_LIMITS)
 * @returns The library entry or null if failed/limit reached
 */
export async function addToUserLibrary(
  userId: string,
  analysisId: string,
  libraryLimit?: number
): Promise<DbUserLibrary | null> {
  console.log('[addToUserLibrary] Attempting to add:', { userId, analysisId, libraryLimit });

  // Check if already in library (allow updating existing entries)
  const { data: existing } = await supabase
    .from('user_library')
    .select('id')
    .eq('user_id', userId)
    .eq('analysis_id', analysisId)
    .single();

  // If not already in library and limit is specified, check the limit
  if (!existing && libraryLimit !== undefined && libraryLimit !== Infinity) {
    const { allowed, currentCount } = await checkLibraryLimit(userId, libraryLimit);
    if (!allowed) {
      console.log('[addToUserLibrary] Library limit reached:', { currentCount, limit: libraryLimit });
      return null;
    }
  }

  const { data, error } = await supabase
    .from('user_library')
    .upsert(
      {
        user_id: userId,
        analysis_id: analysisId,
        last_accessed_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,analysis_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[addToUserLibrary] Error:', error);
    return null;
  }

  console.log('[addToUserLibrary] Success:', data);
  return data as DbUserLibrary;
}

/**
 * Check if an analysis is in the user's library and return library info
 */
export async function getLibraryEntry(
  userId: string,
  analysisId: string
): Promise<{ libraryId: string; isFavorite: boolean } | null> {
  const { data, error } = await supabase
    .from('user_library')
    .select('id, is_favorite')
    .eq('user_id', userId)
    .eq('analysis_id', analysisId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    libraryId: data.id,
    isFavorite: data.is_favorite,
  };
}

/**
 * Get user's video library with full details (joins with cached_analyses and global_videos)
 * Also includes hasReports flag indicating if user has practice sessions for each video
 */
export async function getUserVideoLibrary(
  userId: string
): Promise<VideoHistoryItem[]> {
  // First, get the library entries
  const { data, error } = await supabase
    .from('user_library')
    .select(`
      id,
      is_favorite,
      practice_count,
      last_score,
      last_accessed_at,
      created_at,
      cached_analyses (
        id,
        level,
        target_lang,
        native_lang,
        created_at,
        global_videos (
          id,
          youtube_id,
          title,
          thumbnail_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user library:', error);
    return [];
  }

  // Get all analysis IDs from the library
  const analysisIds = (data || [])
    .filter((item: any) => item.cached_analyses)
    .map((item: any) => item.cached_analyses.id);

  // Fetch practice session counts for all analysis IDs in one query
  let reportCounts: Record<string, number> = {};
  if (analysisIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from('practice_sessions')
      .select('analysis_id')
      .eq('user_id', userId)
      .in('analysis_id', analysisIds);

    if (!sessionsError && sessions) {
      // Count sessions per analysis_id
      sessions.forEach((session: { analysis_id: string | null }) => {
        if (session.analysis_id) {
          reportCounts[session.analysis_id] = (reportCounts[session.analysis_id] || 0) + 1;
        }
      });
    }
  }

  // Transform the nested data into VideoHistoryItem format
  return (data || [])
    .filter((item: any) => item.cached_analyses && item.cached_analyses.global_videos)
    .map((item: any) => ({
      libraryId: item.id,
      isFavorite: item.is_favorite,
      practiceCount: item.practice_count,
      lastScore: item.last_score,
      lastAccessedAt: item.last_accessed_at,
      addedAt: item.created_at,
      analysisId: item.cached_analyses.id,
      level: item.cached_analyses.level,
      targetLang: item.cached_analyses.target_lang,
      nativeLang: item.cached_analyses.native_lang,
      analyzedAt: item.cached_analyses.created_at,
      videoId: item.cached_analyses.global_videos.id,
      youtubeId: item.cached_analyses.global_videos.youtube_id,
      title: item.cached_analyses.global_videos.title || 'Untitled Video',
      thumbnailUrl: item.cached_analyses.global_videos.thumbnail_url,
      reportCount: reportCounts[item.cached_analyses.id] || 0,
    }));
}

/**
 * Update last_accessed_at when user opens a video from library
 */
export async function updateLibraryAccess(
  userId: string,
  analysisId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_library')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('analysis_id', analysisId);

  if (error) {
    console.error('Error updating library access:', error);
  }
}

/**
 * Toggle favorite status for a library entry
 */
export async function toggleLibraryFavorite(
  userId: string,
  libraryId: string
): Promise<boolean | null> {
  // First get current state
  const { data: current, error: fetchError } = await supabase
    .from('user_library')
    .select('is_favorite')
    .eq('id', libraryId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !current) {
    console.error('Error fetching library entry:', fetchError);
    return null;
  }

  // Toggle the value
  const newValue = !current.is_favorite;
  const { error: updateError } = await supabase
    .from('user_library')
    .update({ is_favorite: newValue })
    .eq('id', libraryId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error toggling favorite:', updateError);
    return null;
  }

  return newValue;
}

/**
 * Update practice count and last score after a practice session
 * Creates the library entry if it doesn't exist (handles race conditions)
 */
export async function updateLibraryPracticeStats(
  userId: string,
  analysisId: string,
  score: number
): Promise<void> {
  // First get current practice count
  const { data: current, error: fetchError } = await supabase
    .from('user_library')
    .select('practice_count')
    .eq('user_id', userId)
    .eq('analysis_id', analysisId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // Real error (not "no rows found")
    console.error('Error fetching library stats:', fetchError);
    return;
  }

  if (!current) {
    // Library entry doesn't exist - create it with initial practice count of 1
    console.log('Library entry not found, creating new entry with practice stats');
    const { error: insertError } = await supabase
      .from('user_library')
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        practice_count: 1,
        last_score: score,
        last_accessed_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating library entry with practice stats:', insertError);
    }
    return;
  }

  // Update existing entry
  const newCount = (current.practice_count || 0) + 1;

  const { error: updateError } = await supabase
    .from('user_library')
    .update({
      practice_count: newCount,
      last_score: score,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('analysis_id', analysisId);

  if (updateError) {
    console.error('Error updating library practice stats:', updateError);
  }
}

/**
 * Get practice sessions for a specific analysis
 * Now uses direct analysis_id link on practice_sessions
 */
export async function getPracticeSessionsForAnalysis(
  userId: string,
  analysisId: string
): Promise<DbPracticeSession[]> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('analysis_id', analysisId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching practice sessions for analysis:', error);
    return [];
  }

  return data as DbPracticeSession[];
}

/**
 * Get a single practice session by ID
 */
export async function getPracticeSessionById(
  userId: string,
  sessionId: string
): Promise<DbPracticeSession | null> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching practice session:', error);
    return null;
  }

  return data as DbPracticeSession;
}

/**
 * Remove a video from user's library
 */
export async function removeFromLibrary(
  userId: string,
  libraryId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_library')
    .delete()
    .eq('id', libraryId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing from library:', error);
    return false;
  }

  return true;
}

/**
 * Delete a practice session by ID (user must own it via RLS)
 */
export async function deletePracticeSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('practice_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting practice session:', error);
    return false;
  }

  return true;
}

/**
 * Toggle the is_favorited flag on a practice session
 */
export async function togglePracticeSessionFavorite(
  userId: string,
  sessionId: string,
  isFavorited: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('practice_sessions')
    .update({ is_favorited: isFavorited })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error toggling favorite:', error);
    return false;
  }

  return true;
}

// ============================================
// REPORTS DASHBOARD
// ============================================

/**
 * Fetch ALL practice sessions for a user across all videos,
 * joined with video metadata from cached_analyses + global_videos.
 * Used by the centralized reports dashboard.
 */
export async function getAllPracticeSessionsWithVideoMetadata(
  userId: string
): Promise<DashboardPracticeSession[]> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select(`
      *,
      cached_analyses (
        id,
        target_lang,
        level,
        global_videos (
          youtube_id,
          title,
          thumbnail_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all practice sessions:', error);
    return [];
  }

  return (data || [])
    .filter((s: any) => s.cached_analyses?.global_videos)
    .map((s: any) => {
      const { cached_analyses, ...session } = s;
      return {
        ...session,
        videoTitle: cached_analyses.global_videos.title || 'Untitled Video',
        videoThumbnailUrl: cached_analyses.global_videos.thumbnail_url,
        youtubeId: cached_analyses.global_videos.youtube_id,
      } as DashboardPracticeSession;
    });
}

