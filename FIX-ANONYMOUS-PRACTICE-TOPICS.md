# 🐛 Fix: Practice Topics Disappearing for Anonymous Users

**Date**: 2026-02-18
**Issue**: After analyzing a video, anonymous users can't see Practice Topics in Quick Start

---

## 🔴 Problem

### What Happened
1. Anonymous user analyzes a video ✅
2. Video analysis completes successfully ✅
3. Topics are saved to database with `topicId` ✅
4. **Practice Topics section is empty** ❌

### Root Cause

**Flow:**
```typescript
// App.tsx line 273-304
useEffect(() => {
  // When discussionTopics has data with topicIds...
  const topicsWithQuestions = await getTopicIdsWithQuestionsAtLevel(topicIds, level);
  // ↓ This queries topic_questions table
  // ↓ Anonymous users have NO permission to read topic_questions
  // ↓ Query fails → returns empty Set
  // ↓ All topics filtered out
  setFilteredDiscussionTopics(filtered); // Empty array!
}, [discussionTopics, level]);
```

**database.ts line 827-842:**
```typescript
export async function getTopicIdsWithQuestionsAtLevel(topicIds, level) {
  const { data, error } = await supabase
    .from('topic_questions') // 🔴 Anonymous users can't read this!
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('difficulty_level', level.toLowerCase())
    .eq('is_public', true);

  // Returns empty Set on permission error
}
```

---

## ✅ Solution

### New RLS Policies

**Migration 024** - `topic_questions` table:
- ✅ Allow anonymous users to **read** `is_public = true` questions
- 🔒 Only authenticated users can insert/update/delete their own questions

**Migration 025** - `practice_topics` table:
- ✅ Allow anonymous users to **read** all practice topics
- 🔒 Only authenticated users can insert/update/delete topics

### Why This Is Safe

1. **Public Questions**: `is_public = true` questions are intentionally public content
2. **Topics Metadata**: Practice topics are content metadata, not user-specific data
3. **No PII**: These tables don't contain personally identifiable information
4. **Read-Only for Anonymous**: Anonymous users can only read, not modify

---

## 📝 Changes

### New Migrations

1. **024_fix_topic_questions_rls_for_anonymous.sql**
   ```sql
   -- Allow anonymous read for public questions
   CREATE POLICY "Allow read public questions to all"
     ON public.topic_questions FOR SELECT
     TO authenticated, anon
     USING (is_public = true);
   ```

2. **025_fix_practice_topics_rls_for_anonymous.sql**
   ```sql
   -- Allow anonymous read for all topics
   CREATE POLICY "Allow read practice topics to all"
     ON public.practice_topics FOR SELECT
     TO authenticated, anon
     USING (true);
   ```

---

## 🧪 Testing

### Before Fix
```
1. Anonymous user analyzes video
2. Topics saved to DB ✅
3. getTopicIdsWithQuestionsAtLevel() called
4. Permission denied on topic_questions ❌
5. Returns empty Set
6. All topics filtered out
7. Quick Start shows: "No practice topics available" ❌
```

### After Fix
```
1. Anonymous user analyzes video
2. Topics saved to DB ✅
3. getTopicIdsWithQuestionsAtLevel() called
4. Successfully reads public questions ✅
5. Returns Set of topic IDs with questions
6. Topics displayed in Quick Start ✅
7. User can practice speaking ✅
```

---

## 🚀 Deployment

### Local Testing (Railway CLI)
```bash
# Run migrations locally first
supabase migration up

# Or apply directly to hosted DB
psql $DATABASE_URL < supabase/migrations/024_fix_topic_questions_rls_for_anonymous.sql
psql $DATABASE_URL < supabase/migrations/025_fix_practice_topics_rls_for_anonymous.sql
```

### Production Deployment
```bash
# Commit migrations
git add supabase/migrations/024_*.sql supabase/migrations/025_*.sql
git commit -m "🐛 Fix RLS for anonymous users - practice topics

Issue: Anonymous users couldn't see practice topics after video analysis
Root cause: No read permission on topic_questions and practice_topics tables

Fixed:
- Allow anonymous read for topic_questions (is_public=true only)
- Allow anonymous read for practice_topics (all topics)
- Maintain write restrictions (auth required)

This enables anonymous users to see and practice with topics from analyzed videos."

# Push to Railway
git push origin main

# Migrations will run automatically on Railway
```

---

## 🔍 Related Issues

### Issue #1: Transcript Not Displaying

**Status**: Need to investigate

Check if there are similar RLS issues preventing anonymous users from reading transcript data.

**Possible tables to check**:
- `cached_analyses` - Does anonymous user have read access?
- `global_videos` - Already fixed in migration 017 ✅

---

## 📊 Impact

### Before Fix
- ❌ Anonymous users see empty Quick Start after video analysis
- ❌ Can't practice speaking (no topics to select)
- ❌ Poor conversion funnel (can't experience full value)

### After Fix
- ✅ Anonymous users see practice topics immediately
- ✅ Can start practicing right away
- ✅ Better conversion (full feature trial)

---

## 🔐 Security Checklist

- [x] Anonymous users can read `topic_questions` (public only)
- [x] Anonymous users can read `practice_topics` (all topics, read-only)
- [x] Anonymous users **cannot** modify topics/questions
- [x] Authenticated users can manage their own content
- [x] No PII exposed in these tables
- [x] Aligns with anonymous video analysis permission model

---

**Status**: ✅ Fix ready for deployment
**Priority**: 🔴 High (blocks anonymous user experience)
**Breaking Changes**: ❌ None
