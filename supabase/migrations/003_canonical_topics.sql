-- Migration: Restructure practice_topics as standalone canonical entities
-- Topics are no longer tied to a single video analysis.
-- Questions now link to both a topic AND the video they came from.
-- Deduplication is scoped by language (normalized_topic + target_lang).

-- ============================================
-- STEP 1: Add new columns (non-breaking)
-- ============================================

ALTER TABLE practice_topics ADD COLUMN IF NOT EXISTS normalized_topic text;
ALTER TABLE practice_topics ADD COLUMN IF NOT EXISTS target_lang text;
ALTER TABLE topic_questions ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES cached_analyses(id) ON DELETE SET NULL;
ALTER TABLE topic_questions ADD COLUMN IF NOT EXISTS difficulty_level text;

-- ============================================
-- STEP 2: Backfill topic_questions.analysis_id from practice_topics.analysis_id
-- (Only runs if practice_topics.analysis_id column exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_topics' AND column_name = 'analysis_id'
  ) THEN
    UPDATE topic_questions tq
    SET analysis_id = pt.analysis_id
    FROM practice_topics pt
    WHERE tq.topic_id = pt.id
      AND pt.analysis_id IS NOT NULL
      AND tq.analysis_id IS NULL;
  END IF;
END $$;

-- ============================================
-- STEP 3: Backfill normalized_topic and target_lang
-- ============================================

UPDATE practice_topics
SET normalized_topic = lower(trim(topic))
WHERE normalized_topic IS NULL;

-- Derive target_lang from cached_analyses via topic_questions (works regardless of practice_topics.analysis_id)
DO $$
BEGIN
  -- First try: if practice_topics.analysis_id exists, use it directly
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'practice_topics' AND column_name = 'analysis_id'
  ) THEN
    UPDATE practice_topics pt
    SET target_lang = ca.target_lang
    FROM cached_analyses ca
    WHERE pt.analysis_id = ca.id
      AND pt.target_lang IS NULL;
  ELSE
    -- Fallback: derive from topic_questions -> cached_analyses
    UPDATE practice_topics pt
    SET target_lang = sub.target_lang
    FROM (
      SELECT DISTINCT ON (tq.topic_id) tq.topic_id, ca.target_lang
      FROM topic_questions tq
      JOIN cached_analyses ca ON tq.analysis_id = ca.id
      WHERE ca.target_lang IS NOT NULL
      ORDER BY tq.topic_id, tq.created_at ASC
    ) sub
    WHERE pt.id = sub.topic_id
      AND pt.target_lang IS NULL;
  END IF;
END $$;

-- Default any remaining NULL target_lang to 'English'
UPDATE practice_topics
SET target_lang = 'English'
WHERE target_lang IS NULL;

-- ============================================
-- STEP 4: Merge duplicate topics (same normalized_topic + target_lang)
-- Keep the one with highest practice_count as the winner.
-- ============================================

-- 4a: Reassign topic_questions from losers to winners
WITH ranked AS (
  SELECT
    id,
    normalized_topic,
    target_lang,
    practice_count,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_topic, target_lang
      ORDER BY practice_count DESC, created_at ASC
    ) AS rn
  FROM practice_topics
),
winner_loser AS (
  SELECT w.id AS winner_id, l.id AS loser_id
  FROM ranked w
  JOIN ranked l ON w.normalized_topic = l.normalized_topic
                AND w.target_lang = l.target_lang
  WHERE w.rn = 1 AND l.rn > 1
)
UPDATE topic_questions tq
SET topic_id = wl.winner_id
FROM winner_loser wl
WHERE tq.topic_id = wl.loser_id;

-- 4b: Reassign practice_sessions from losers to winners
WITH ranked AS (
  SELECT
    id,
    normalized_topic,
    target_lang,
    practice_count,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_topic, target_lang
      ORDER BY practice_count DESC, created_at ASC
    ) AS rn
  FROM practice_topics
),
winner_loser AS (
  SELECT w.id AS winner_id, l.id AS loser_id
  FROM ranked w
  JOIN ranked l ON w.normalized_topic = l.normalized_topic
                AND w.target_lang = l.target_lang
  WHERE w.rn = 1 AND l.rn > 1
)
UPDATE practice_sessions ps
SET topic_id = wl.winner_id
FROM winner_loser wl
WHERE ps.topic_id = wl.loser_id;

-- 4c: Sum practice_counts into winners
WITH ranked AS (
  SELECT
    id,
    normalized_topic,
    target_lang,
    practice_count,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_topic, target_lang
      ORDER BY practice_count DESC, created_at ASC
    ) AS rn
  FROM practice_topics
),
loser_sums AS (
  SELECT
    w.id AS winner_id,
    COALESCE(SUM(l.practice_count), 0) AS extra_count
  FROM ranked w
  JOIN ranked l ON w.normalized_topic = l.normalized_topic
               AND w.target_lang = l.target_lang
               AND l.rn > 1
  WHERE w.rn = 1
  GROUP BY w.id
)
UPDATE practice_topics pt
SET practice_count = pt.practice_count + ls.extra_count
FROM loser_sums ls
WHERE pt.id = ls.winner_id;

-- 4d: Merge target_words arrays from losers into winners
WITH ranked AS (
  SELECT
    id,
    normalized_topic,
    target_lang,
    target_words,
    practice_count,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_topic, target_lang
      ORDER BY practice_count DESC, created_at ASC
    ) AS rn
  FROM practice_topics
),
merged_words AS (
  SELECT
    w.id AS winner_id,
    array_agg(DISTINCT word) AS all_words
  FROM ranked w
  JOIN ranked l ON w.normalized_topic = l.normalized_topic
               AND w.target_lang = l.target_lang
  CROSS JOIN LATERAL unnest(COALESCE(l.target_words, ARRAY[]::text[])) AS word
  WHERE w.rn = 1
  GROUP BY w.id
)
UPDATE practice_topics pt
SET target_words = mw.all_words
FROM merged_words mw
WHERE pt.id = mw.winner_id;

-- 4e: Delete loser topics
WITH ranked AS (
  SELECT
    id,
    normalized_topic,
    target_lang,
    practice_count,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_topic, target_lang
      ORDER BY practice_count DESC, created_at ASC
    ) AS rn
  FROM practice_topics
)
DELETE FROM practice_topics
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================
-- STEP 5: Add constraints
-- ============================================

-- Make normalized_topic and target_lang NOT NULL now that they're backfilled
ALTER TABLE practice_topics ALTER COLUMN normalized_topic SET NOT NULL;
ALTER TABLE practice_topics ALTER COLUMN target_lang SET NOT NULL;

-- Add unique constraint scoped by language (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practice_topics_normalized_topic_lang_key'
  ) THEN
    ALTER TABLE practice_topics
      ADD CONSTRAINT practice_topics_normalized_topic_lang_key
      UNIQUE (normalized_topic, target_lang);
  END IF;
END $$;

-- Add index on topic_questions.analysis_id
CREATE INDEX IF NOT EXISTS idx_topic_questions_analysis
  ON topic_questions(analysis_id);

-- ============================================
-- STEP 6: Drop old constraint and column from practice_topics
-- ============================================

ALTER TABLE practice_topics DROP CONSTRAINT IF EXISTS practice_topics_topic_analysis_id_key;
ALTER TABLE practice_topics DROP COLUMN IF EXISTS analysis_id;

-- ============================================
-- STEP 7: Backfill global_videos.category from topics
-- ============================================

UPDATE global_videos gv
SET category = sub.top_category
FROM (
  SELECT
    ca.video_id,
    pt.category AS top_category,
    ROW_NUMBER() OVER (
      PARTITION BY ca.video_id
      ORDER BY COUNT(*) DESC
    ) AS rn
  FROM topic_questions tq
  JOIN practice_topics pt ON tq.topic_id = pt.id
  JOIN cached_analyses ca ON tq.analysis_id = ca.id
  WHERE pt.category IS NOT NULL
  GROUP BY ca.video_id, pt.category
) sub
WHERE gv.id = sub.video_id
  AND sub.rn = 1
  AND gv.category IS NULL;
