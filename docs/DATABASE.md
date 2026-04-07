# Bilibala Database Documentation

## Overview

Bilibala uses **Supabase** (PostgreSQL) as its database backend. The schema is designed to support:

- **Video content caching** - Store AI-analyzed video content for reuse
- **Quick Start practice** - Universal topics ranked by popularity
- **User learning progress** - Personal vocabulary, practice history, and scores
- **Multi-language support** - Content in 15+ languages at different difficulty levels

---

## Table of Contents

1. [Entity Relationship Diagram](#entity-relationship-diagram)
2. [Tables Overview](#tables-overview)
3. [Detailed Table Schemas](#detailed-table-schemas)
4. [User Flows](#user-flows)
5. [Common Queries](#common-queries)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Helper Functions](#helper-functions)

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BILIBALA DATABASE SCHEMA                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   auth.users    │
                              │   (Supabase)    │
                              └────────┬────────┘
                                       │
           ┌───────────────┬───────────┼───────────┬───────────────┐
           │               │           │           │               │
           ▼               ▼           ▼           ▼               ▼
   ┌───────────────┐ ┌───────────┐ ┌────────┐ ┌─────────┐ ┌─────────────────┐
   │user_preferences│ │user_library│ │practice│ │  user   │ │ topic_questions │
   │               │ │           │ │sessions│ │vocabulary│ │ (created_by)    │
   └───────────────┘ └─────┬─────┘ └───┬────┘ └────┬────┘ └────────┬────────┘
                           │           │           │               │
                           │           │           │               │
                           ▼           │           │               ▼
                   ┌───────────────┐   │           │       ┌───────────────┐
                   │cached_analyses│◄──┼───────────┘       │practice_topics│
                   └───────┬───────┘   │                   └───────┬───────┘
                           │           │                           │
                           │           ▼                           │
                           │    ┌─────────────┐                    │
                           │    │   topic_id  │◄───────────────────┘
                           │    │ question_id │
                           │    └─────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ global_videos │
                   └───────────────┘

LEGEND:
  ─────▶  Foreign Key Reference
  │       One-to-Many Relationship
```

### Relationship Summary

| Parent Table | Child Table | Relationship | On Delete |
|-------------|-------------|--------------|-----------|
| `auth.users` | `user_preferences` | 1:1 | CASCADE |
| `auth.users` | `user_library` | 1:N | CASCADE |
| `auth.users` | `practice_sessions` | 1:N | CASCADE |
| `auth.users` | `user_vocabulary` | 1:N | CASCADE |
| `auth.users` | `topic_questions` | 1:N (created_by) | - |
| `auth.users` | `cached_analyses` | 1:N (created_by) | - |
| `global_videos` | `cached_analyses` | 1:N | CASCADE |
| `cached_analyses` | `user_library` | 1:N | CASCADE |
| `cached_analyses` | `practice_topics` | 1:N | SET NULL |
| `cached_analyses` | `user_vocabulary` | 1:N | SET NULL |
| `practice_topics` | `topic_questions` | 1:N | CASCADE |
| `practice_topics` | `practice_sessions` | 1:N | SET NULL |
| `topic_questions` | `practice_sessions` | 1:N | SET NULL |

---

## Tables Overview

| Table | Purpose | Access |
|-------|---------|--------|
| `global_videos` | YouTube video metadata | Public (read) |
| `cached_analyses` | AI-analyzed video content | Public (read) |
| `practice_topics` | Universal speaking topics | Public (read) |
| `topic_questions` | Questions for each topic | Public (read, if public) |
| `user_preferences` | User language settings | Private (owner only) |
| `user_library` | User's saved videos | Private (owner only) |
| `practice_sessions` | User's practice attempts | Private (owner only) |
| `user_vocabulary` | User's saved vocabulary | Private (owner only) |

---

## Detailed Table Schemas

### 1. `global_videos`

Stores unique YouTube video metadata. Shared across all users.

```sql
create table global_videos (
  id uuid primary key,
  youtube_id text not null unique,    -- e.g., 'dQw4w9WgXcQ'
  title text,
  thumbnail_url text,
  duration_sec integer,
  channel_name text,
  view_count integer default 0,       -- Popularity tracking
  is_featured boolean default false,  -- Curated content
  category text,                      -- e.g., 'Education', 'News'
  created_at timestamptz
);
```

**Indexes:**
- `idx_global_videos_view_count` - For popular video queries

---

### 2. `cached_analyses`

Stores expensive AI-generated content. Unique per video + level + language combination.

```sql
create table cached_analyses (
  id uuid primary key,
  video_id uuid references global_videos(id),

  -- Content fingerprint (unique combination)
  level text not null,           -- 'Easy', 'Medium', 'Hard'
  target_lang text not null,     -- Language being learned
  native_lang text not null,     -- User's native language

  created_by uuid references auth.users(id),

  -- Searchable fields
  summary text,
  translated_summary text,

  -- JSONB content structure:
  -- {
  --   "topics": [{
  --     "title": string,
  --     "translatedTitle": string,
  --     "description": string,
  --     "translatedDescription": string,
  --     "timestamp": string
  --   }],
  --   "vocabulary": [{
  --     "word": string,
  --     "translatedWord": string,
  --     "definition": string,
  --     "translatedDefinition": string,
  --     "context": string,
  --     "translatedContext": string
  --   }],
  --   "transcript": [{
  --     "text": string,
  --     "duration": number,
  --     "offset": number
  --   }],
  --   "discussionTopics": [{
  --     "topic": string,
  --     "question": string,
  --     "targetWords": string[]
  --   }]
  -- }
  content jsonb not null,

  created_at timestamptz,

  unique(video_id, level, target_lang, native_lang)
);
```

**Indexes:**
- `idx_cached_analyses_lang_level` - For language/level filtering

---

### 3. `practice_topics`

Universal topics for Quick Start feature. Ranked by practice count.

```sql
create table practice_topics (
  id uuid primary key,

  topic text not null,                 -- e.g., "Daily Routine"
  category text,                       -- e.g., "Personal", "Opinion"
  difficulty_level text,               -- Suggested level
  target_words text[],                 -- Vocabulary suggestions

  -- Source tracking
  source_type text default 'standalone',  -- 'standalone' | 'video_generated'
  analysis_id uuid references cached_analyses(id),

  -- Quick Start ranking
  practice_count integer default 0,    -- Total times practiced
  is_active boolean default true,      -- Visibility flag

  created_at timestamptz,

  unique(topic, analysis_id)
);
```

**Source Types:**
- `standalone` - Curated topic, no video link
- `video_generated` - Extracted from video analysis

**Indexes:**
- `idx_practice_topics_popular` - For Quick Start ranking
- `idx_practice_topics_category` - For category filtering

---

### 4. `topic_questions`

Multiple questions per topic from different sources.

```sql
create table topic_questions (
  id uuid primary key,
  topic_id uuid references practice_topics(id),

  question text not null,

  -- Question source
  source_type text not null,    -- 'video_generated' | 'ai_generated' | 'user_created'
  created_by uuid references auth.users(id),

  is_public boolean default true,
  use_count integer default 0,

  created_at timestamptz
);
```

**Source Types:**
- `video_generated` - Original question from video analysis
- `ai_generated` - AI created a new question for existing topic
- `user_created` - User typed their own custom question

**Indexes:**
- `idx_topic_questions_topic` - For fetching questions by topic

---

### 5. `user_preferences`

Stores user's language and level settings.

```sql
create table user_preferences (
  user_id uuid primary key references auth.users(id),

  native_lang text default 'English',
  target_lang text default 'English',
  default_level text default 'Medium',

  updated_at timestamptz
);
```

---

### 6. `user_library`

User's saved/bookmarked video analyses.

```sql
create table user_library (
  id uuid primary key,
  user_id uuid references auth.users(id),
  analysis_id uuid references cached_analyses(id),

  is_favorite boolean default false,    -- "My List" flag
  practice_count integer default 0,     -- Times practiced from this video
  last_score integer,                   -- Most recent practice score

  last_accessed_at timestamptz,
  created_at timestamptz,

  unique(user_id, analysis_id)
);
```

**Indexes:**
- `idx_user_library_user` - For user library queries

---

### 7. `practice_sessions`

Records of user's speaking practice attempts.

```sql
create table practice_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id),

  -- What was practiced
  topic_id uuid references practice_topics(id),
  question_id uuid references topic_questions(id),

  -- Snapshot (preserved if topic/question deleted)
  topic_text text not null,
  question_text text not null,

  -- Language context
  target_lang text not null,
  native_lang text not null,
  level text not null,

  -- Recording
  audio_url text,
  recording_duration_sec integer,

  -- Results
  transcription text,
  score integer,

  -- Full feedback JSONB structure:
  -- {
  --   "detected_framework": string,
  --   "structure": {
  --     "conclusion": string,
  --     "arguments": ArgumentNode[]
  --   },
  --   "improved_structure": {
  --     "recommended_framework": string,
  --     "conclusion": string,
  --     "arguments": ImprovedArgumentNode[]
  --   },
  --   "feedback": {
  --     "score": number,
  --     "strengths": string[],
  --     "weaknesses": string[],
  --     "suggestions": string[]
  --   },
  --   "improvements": [{
  --     "original": string,
  --     "improved": string,
  --     "explanation": string
  --   }]
  -- }
  feedback_data jsonb,

  created_at timestamptz
);
```

**Indexes:**
- `idx_practice_sessions_user` - For user history
- `idx_practice_sessions_topic` - For topic analytics

---

### 8. `user_vocabulary`

User's personal vocabulary collection.

```sql
create table user_vocabulary (
  id uuid primary key,
  user_id uuid references auth.users(id),
  analysis_id uuid references cached_analyses(id),  -- Source video (optional)

  -- Vocabulary content
  word text not null,
  translated_word text,
  definition text,
  translated_definition text,
  context text,                    -- Example sentence
  translated_context text,

  -- Learning progress
  status text default 'new',       -- 'new' | 'learning' | 'mastered'
  notes text,                      -- User's personal notes

  -- Language context
  target_lang text not null,
  native_lang text not null,

  created_at timestamptz,
  updated_at timestamptz,

  unique(user_id, word, target_lang)
);
```

**Status Values:**
- `new` - Just saved, not studied yet
- `learning` - Currently reviewing
- `mastered` - User feels confident

**Indexes:**
- `idx_user_vocabulary_user` - For vocabulary list
- `idx_user_vocabulary_status` - For filtering by status
- `idx_user_vocabulary_lang` - For language filtering

---

### 9. `browser_fingerprints`

Tracks anonymous (non-logged-in) user activity for usage limiting and analytics. One row per device/browser.

```sql
create table browser_fingerprints (
  id uuid primary key,
  fingerprint_hash text not null unique,  -- Browser fingerprint (FingerprintJS visitorId)
  user_id uuid references auth.users(id), -- Set when anonymous user signs up/logs in

  -- Video analysis usage (anonymous users)
  monthly_usage_count integer default 0,  -- # of video analyses this month
  usage_reset_month text,                 -- YYYY-MM of last reset (shared by both counters below)

  -- Practice session usage (anonymous users)
  -- NOTE: Two columns exist for historical reasons:
  --   practice_session_count  → used by authenticated user queries (via get_all_monthly_usage())
  --   monthly_practice_count  → used by anonymous user limit checks (checkSubscriptionLimit middleware)
  -- Anonymous limit checks use monthly_practice_count (separate from video analysis count).
  practice_session_count integer default 0,   -- For authenticated user monthly usage queries
  practice_reset_month text,                   -- Reset month for practice_session_count
  monthly_practice_count integer default 0,    -- For anonymous user practice limit checks (checkSubscriptionLimit)

  -- Page visit analytics
  page_visit_count integer default 0,
  first_page_visit_at timestamptz,
  last_page_visit_at timestamptz,

  -- Network info
  ip_address inet,
  last_ip_at timestamptz,

  first_seen_at timestamptz,
  last_seen_at timestamptz
);
```

**Column clarification — practice counts:**

| Column | Used by | Purpose |
|--------|---------|---------|
| `monthly_usage_count` | Server middleware + client `checkAnonymousUsageLimit()` | Anonymous video analysis limit (2/month) |
| `monthly_practice_count` | Server middleware + client `checkAnonymousPracticeLimit()` | Anonymous practice session limit (2/month) |
| `practice_session_count` | `get_all_monthly_usage()` DB function | Authenticated user monthly practice count |
| `practice_reset_month` | `get_all_monthly_usage()` DB function | Reset tracking for `practice_session_count` |
| `usage_reset_month` | Server middleware + client code | Reset tracking for `monthly_usage_count` and `monthly_practice_count` |

**Key rules:**
- Anonymous video analyses increment `monthly_usage_count`
- Anonymous practice sessions increment `monthly_practice_count`
- Both share `usage_reset_month` for monthly reset tracking
- `practice_session_count` is only for authenticated users and is managed separately

---

## User Flows

### Flow 1: Video Analysis (Existing User Journey)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VIDEO ANALYSIS FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

User pastes YouTube URL
        │
        ▼
┌───────────────────┐
│ Check global_videos│  Does video exist?
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
   Yes          No
    │           │
    │           ▼
    │   ┌───────────────┐
    │   │ INSERT video  │  Create new video record
    │   │ metadata      │
    │   └───────┬───────┘
    │           │
    ▼           ▼
┌───────────────────────┐
│ Check cached_analyses │  Does analysis exist for this
│ WHERE video_id = X    │  level + target_lang + native_lang?
│   AND level = Y       │
│   AND target_lang = Z │
└─────────┬─────────────┘
          │
    ┌─────┴─────┐
    │           │
   Yes          No
    │           │
    │           ▼
    │   ┌───────────────┐
    │   │ Call AI API   │  Analyze video content
    │   │ INSERT into   │
    │   │cached_analyses│
    │   └───────┬───────┘
    │           │
    │           ▼
    │   ┌───────────────┐
    │   │ Extract topics│  Create practice_topics from
    │   │ INSERT into   │  discussionTopics in content
    │   │practice_topics│
    │   │topic_questions│
    │   └───────┬───────┘
    │           │
    ▼           ▼
┌───────────────────┐
│ Return analysis   │  Display to user
│ to frontend       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ User adds to      │  Optional: save to library
│ user_library      │
└───────────────────┘
```

---

### Flow 2: Quick Start Practice

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          QUICK START FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

Landing Page
        │
        ▼
┌───────────────────────────────┐
│ SELECT * FROM practice_topics │  Get popular topics
│ WHERE is_active = true        │
│ ORDER BY practice_count DESC  │
│ LIMIT 10                      │
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│ Display topics with:          │
│ - Topic name                  │
│ - Category badge              │
│ - Practice count              │
│ - Video link (if exists)      │
└─────────────┬─────────────────┘
              │
              ▼ User selects topic
┌───────────────────────────────┐
│ SELECT * FROM topic_questions │
│ WHERE topic_id = X            │
│ AND (is_public OR created_by) │
│ ORDER BY source_type, use_count│
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│ Display questions:            │
│ 1. Video-generated (default)  │
│ 2. AI-generated alternatives  │
│ 3. User's custom questions    │
│ 4. [+ Type your own]          │
└─────────────┬─────────────────┘
              │
              ▼ User selects/types question
┌───────────────────────────────┐
│ Practice Session begins       │
│ - Recording                   │
│ - AI analysis                 │
│ - Feedback display            │
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│ INSERT INTO practice_sessions │  Save results
│ CALL increment_topic_practice │  Update popularity
│ CALL increment_question_use   │
└─────────────┬─────────────────┘
              │
              ▼ If topic has source video
┌───────────────────────────────┐
│ Show "Watch source video"     │
│ Link to cached_analyses       │
│ → global_videos               │
└───────────────────────────────┘
```

---

### Flow 3: Save Vocabulary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SAVE VOCABULARY FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

User viewing video content
        │
        ▼
┌───────────────────────────────┐
│ Vocabulary list displayed     │
│ from cached_analyses.content  │
│ → vocabulary[]                │
└─────────────┬─────────────────┘
              │
              ▼ User clicks "Save" on a word
┌───────────────────────────────┐
│ INSERT INTO user_vocabulary   │
│ (user_id, analysis_id, word,  │
│  translated_word, definition, │
│  ..., target_lang, native_lang)│
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│ Word appears in user's        │
│ vocabulary collection         │
│ Status: 'new'                 │
└─────────────┬─────────────────┘
              │
              ▼ User studies vocabulary
┌───────────────────────────────┐
│ UPDATE user_vocabulary        │
│ SET status = 'learning'       │
│ WHERE id = X                  │
└─────────────┬─────────────────┘
              │
              ▼ User masters word
┌───────────────────────────────┐
│ UPDATE user_vocabulary        │
│ SET status = 'mastered'       │
└───────────────────────────────┘
```

---

## Common Queries

### Quick Start: Get Popular Topics

```sql
select
  pt.id,
  pt.topic,
  pt.category,
  pt.difficulty_level,
  pt.practice_count,
  pt.source_type,
  -- Video info (if exists)
  gv.youtube_id,
  gv.title as video_title,
  gv.thumbnail_url
from practice_topics pt
left join cached_analyses ca on pt.analysis_id = ca.id
left join global_videos gv on ca.video_id = gv.id
where pt.is_active = true
order by pt.practice_count desc
limit 10;
```

### Get Questions for a Topic

```sql
select
  id,
  question,
  source_type,
  use_count
from topic_questions
where topic_id = $1
  and (is_public = true or created_by = auth.uid())
order by
  case source_type
    when 'video_generated' then 1
    when 'ai_generated' then 2
    when 'user_created' then 3
  end,
  use_count desc;
```

### Check for Cached Analysis

```sql
select ca.*, gv.youtube_id, gv.title
from cached_analyses ca
join global_videos gv on ca.video_id = gv.id
where gv.youtube_id = $1
  and ca.level = $2
  and ca.target_lang = $3
  and ca.native_lang = $4;
```

### Get User's Library

```sql
select
  ul.*,
  ca.summary,
  ca.level,
  ca.target_lang,
  gv.title,
  gv.thumbnail_url,
  gv.youtube_id
from user_library ul
join cached_analyses ca on ul.analysis_id = ca.id
join global_videos gv on ca.video_id = gv.id
where ul.user_id = auth.uid()
order by ul.last_accessed_at desc;
```

### Get User's Vocabulary

```sql
select * from user_vocabulary
where user_id = auth.uid()
order by created_at desc;
```

### Get Vocabulary by Status

```sql
select * from user_vocabulary
where user_id = auth.uid()
  and status = 'learning'
order by updated_at desc;
```

### Get Vocabulary Stats

```sql
select
  status,
  count(*) as count
from user_vocabulary
where user_id = auth.uid()
group by status;
```

### Get User's Practice History

```sql
select
  ps.*,
  pt.topic,
  pt.category
from practice_sessions ps
left join practice_topics pt on ps.topic_id = pt.id
where ps.user_id = auth.uid()
order by ps.created_at desc
limit 20;
```

### Get Random Video for Practice

```sql
select * from cached_analyses
where target_lang = $1
  and level = $2
order by random()
limit 1;
```

### Insert New Practice Session

```sql
insert into practice_sessions (
  user_id, topic_id, question_id,
  topic_text, question_text,
  target_lang, native_lang, level,
  audio_url, recording_duration_sec,
  transcription, score, feedback_data
) values (
  auth.uid(), $1, $2,
  $3, $4,
  $5, $6, $7,
  $8, $9,
  $10, $11, $12
);
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Here's the access matrix:

### Public Tables (Read: All Authenticated Users)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `global_videos` | All | All | - | - |
| `cached_analyses` | All | All | - | - |
| `practice_topics` | All (active) | All | - | - |
| `topic_questions` | All (public) | All | Owner | Owner |

### Private Tables (Owner Only)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `user_preferences` | Owner | Owner | Owner | Owner |
| `user_library` | Owner | Owner | Owner | Owner |
| `practice_sessions` | Owner | Owner | - | - |
| `user_vocabulary` | Owner | Owner | Owner | Owner |

---

## Helper Functions

### `increment_video_view(video_id_input uuid)`

Atomically increments the view count for a video.

```sql
select increment_video_view('video-uuid-here');
```

### `increment_topic_practice(topic_id_input uuid)`

Atomically increments the practice count for Quick Start ranking.

```sql
select increment_topic_practice('topic-uuid-here');
```

### `increment_question_use(question_id_input uuid)`

Atomically increments the use count for a question.

```sql
select increment_question_use('question-uuid-here');
```

### `update_vocabulary_timestamp()` (Trigger)

Automatically updates `updated_at` when a vocabulary record is modified.

---

## Supported Languages

The app supports 15 languages:

- English
- Spanish
- French
- German
- Portuguese
- Japanese
- Korean
- Chinese (Mandarin)
- Hindi
- Italian
- Russian
- Arabic
- Indonesian
- Turkish
- Vietnamese

## Difficulty Levels

- **Easy** - Beginner level content
- **Medium** - Intermediate level content
- **Hard** - Advanced level content

---

## Future Considerations

1. **Full-text search** - Add GIN indexes on `summary` and `transcription` for search
2. **Analytics tables** - Track daily active users, popular topics over time
3. **Spaced repetition** - Add `next_review_at` to `user_vocabulary` for SRS
4. **Achievement system** - Track milestones and streaks
5. **Audio storage** - Supabase Storage buckets for practice recordings
