# Flashcard System Implementation Plan
**Feature Name:** 语言表达卡片 (My Expression Cards) / Language Expression Flashcards
**Goal:** Anki-style spaced repetition system for language improvements from video analysis
**Date:** 2026-02-22

---

## Table of Contents
1. [Overview](#overview)
2. [User Experience Flow](#user-experience-flow)
3. [Database Architecture](#database-architecture)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [SM-2 Algorithm Implementation](#sm-2-algorithm-implementation)
7. [Integration Points](#integration-points)
8. [Usage Limits & Monetization](#usage-limits--monetization)
9. [Implementation Phases](#implementation-phases)

---

## Overview

### What is This Feature?
Users can save language improvements (critiques) from video analysis feedback as flashcards. These cards use the **SM-2 spaced repetition algorithm** to optimize long-term retention.

### Key Features
- **Save from Analysis**: Bookmark improvements from `PyramidFeedback` component (lines 488-511)
- **Anki-Style Review**: Flip cards to reveal improved version + explanation
- **Spaced Repetition**: SM-2 algorithm schedules optimal review intervals
- **Deck Organization**: Group cards by video, topic, or custom collections
- **Progress Tracking**: Statistics, streaks, cards due today
- **Accessible from Menu**: New menu item in `UserMenu.tsx` (lines 50-57)

### User Personas
1. **Free User**: 100 cards max, review unlimited
2. **Pro User**: Unlimited cards, advanced statistics

---

## User Experience Flow

### 1. Saving a Card (From Video Analysis)
```
User watches video → Analyzes → Sees "Language Polish" section
→ Clicks "Save to Flashcards" button on improvement card
→ Quick modal: Add tags? Add to deck? [Default deck]
→ Card saved! ✓
```

### 2. Reviewing Cards (From Menu)
```
User clicks avatar → "My Flashcards" menu item
→ Flashcard Dashboard:
   - "15 cards due today" badge
   - Deck list (Default, Business English, HSK Prep...)
   - Quick stats (Total cards, Review streak, Mastery %)

→ Click "Review Now"
→ Review Session:
   [Card 1/15]
   ─────────────────
   Original: "makes me feel very exciting"
   Context: From video "Daily Conversation Tips"

   [Think... then TAP TO FLIP]

   ─────────────────
   Improved: "makes me feel very excited"
   Explanation: 在英语中，-ed形容词描述人的感受，
                -ing形容词描述引起感受的事物

   How difficult was this?
   [Again] [Hard] [Good] [Easy]

→ Algorithm schedules next review
→ Next card...
```

### 3. Deck Management
```
Flashcard Dashboard → "Create Deck" → Name: "Business Meetings"
→ Move cards between decks
→ Edit/Delete cards
→ Export deck (Pro feature)
```

---

## Database Architecture

### Migration 028: Create Flashcard System

```sql
-- saved_expression_cards table
CREATE TABLE saved_expression_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Card content
  original_text TEXT NOT NULL,
  improved_text TEXT NOT NULL,
  explanation TEXT, -- Chinese/native language explanation
  context TEXT, -- Additional context from video

  -- Source tracking (links back to analysis)
  video_id TEXT, -- YouTube/Bilibili video ID
  video_title TEXT,
  cached_analysis_id UUID REFERENCES cached_analyses(id) ON DELETE SET NULL,
  source_language TEXT DEFAULT 'en', -- Language being learned

  -- SM-2 Spaced Repetition Algorithm fields
  easiness_factor REAL DEFAULT 2.5, -- Range: 1.3-2.5, affects interval growth
  interval INTEGER DEFAULT 1, -- Days until next review
  repetition_count INTEGER DEFAULT 0, -- Number of successful reviews
  next_review_date DATE DEFAULT CURRENT_DATE, -- When card is due
  last_reviewed_at TIMESTAMPTZ, -- Timestamp of last review

  -- Performance tracking
  correct_count INTEGER DEFAULT 0, -- Number of "Good/Easy" ratings
  incorrect_count INTEGER DEFAULT 0, -- Number of "Again" ratings

  -- Organization
  deck_name TEXT DEFAULT 'default', -- User-defined deck
  tags TEXT[], -- User-added tags for filtering
  notes TEXT, -- Personal study notes
  is_suspended BOOLEAN DEFAULT false, -- User can pause a card

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_expression_cards_user
  ON saved_expression_cards(user_id);

CREATE INDEX idx_expression_cards_review
  ON saved_expression_cards(user_id, next_review_date)
  WHERE is_suspended = false; -- Only active cards

CREATE INDEX idx_expression_cards_deck
  ON saved_expression_cards(user_id, deck_name);

CREATE INDEX idx_expression_cards_video
  ON saved_expression_cards(video_id)
  WHERE video_id IS NOT NULL;

-- RLS Policies
ALTER TABLE saved_expression_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards"
  ON saved_expression_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON saved_expression_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON saved_expression_cards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON saved_expression_cards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_flashcard_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_flashcard_timestamp_trigger
  BEFORE UPDATE ON saved_expression_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_flashcard_timestamp();

-- Function to get due cards count
CREATE OR REPLACE FUNCTION get_due_cards_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.saved_expression_cards
    WHERE user_id = p_user_id
      AND is_suspended = false
      AND next_review_date <= CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Function to get deck stats
CREATE OR REPLACE FUNCTION get_deck_stats(p_user_id UUID)
RETURNS TABLE(
  deck_name TEXT,
  total_cards BIGINT,
  due_today BIGINT,
  new_cards BIGINT,
  mastered_cards BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.deck_name,
    COUNT(*) as total_cards,
    COUNT(*) FILTER (WHERE c.next_review_date <= CURRENT_DATE AND NOT c.is_suspended) as due_today,
    COUNT(*) FILTER (WHERE c.repetition_count = 0) as new_cards,
    COUNT(*) FILTER (WHERE c.repetition_count >= 5 AND c.interval >= 30) as mastered_cards
  FROM public.saved_expression_cards c
  WHERE c.user_id = p_user_id
  GROUP BY c.deck_name
  ORDER BY c.deck_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

---

## API Endpoints

### Server Routes: `server/routes/flashcardRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const {
  saveCard,
  getDueCards,
  recordReview,
  getDecks,
  getStats,
  updateCard,
  deleteCard,
  getCardById,
  bulkUpdateDeck,
  checkCardLimit
} = require('../controllers/flashcardController');

// Card CRUD
router.post('/flashcards/save', authenticateUser, checkCardLimit, saveCard);
router.get('/flashcards/:id', authenticateUser, getCardById);
router.patch('/flashcards/:id', authenticateUser, updateCard);
router.delete('/flashcards/:id', authenticateUser, deleteCard);

// Review session
router.get('/flashcards/due', authenticateUser, getDueCards);
router.post('/flashcards/review/:id', authenticateUser, recordReview);

// Organization
router.get('/flashcards/decks', authenticateUser, getDecks);
router.patch('/flashcards/bulk/deck', authenticateUser, bulkUpdateDeck);

// Statistics
router.get('/flashcards/stats', authenticateUser, getStats);

module.exports = router;
```

### Controller: `server/controllers/flashcardController.js`

```javascript
const { supabase } = require('../config/supabase');
const { calculateNextReview } = require('../utils/sm2Algorithm');

// Check card limit for free users
async function checkCardLimit(req, res, next) {
  const userId = req.user.id;

  // Get user tier
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single();

  const tier = subscription?.tier || 'free';

  // Pro users have unlimited cards
  if (tier === 'pro') {
    return next();
  }

  // Free users: 100 cards max
  const { count } = await supabase
    .from('saved_expression_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count >= 100) {
    return res.status(403).json({
      error: 'Card limit reached',
      message: 'Free users can save up to 100 cards. Upgrade to Pro for unlimited cards.'
    });
  }

  next();
}

async function saveCard(req, res) {
  const userId = req.user.id;
  const {
    original_text,
    improved_text,
    explanation,
    context,
    video_id,
    video_title,
    cached_analysis_id,
    source_language,
    deck_name,
    tags
  } = req.body;

  // Validate required fields
  if (!original_text || !improved_text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('saved_expression_cards')
    .insert({
      user_id: userId,
      original_text,
      improved_text,
      explanation,
      context,
      video_id,
      video_title,
      cached_analysis_id,
      source_language: source_language || 'en',
      deck_name: deck_name || 'default',
      tags: tags || []
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving flashcard:', error);
    return res.status(500).json({ error: 'Failed to save card' });
  }

  res.json({ card: data });
}

async function getDueCards(req, res) {
  const userId = req.user.id;
  const { deck, limit = 20 } = req.query;

  let query = supabase
    .from('saved_expression_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('is_suspended', false)
    .lte('next_review_date', new Date().toISOString().split('T')[0])
    .order('next_review_date', { ascending: true })
    .limit(limit);

  if (deck && deck !== 'all') {
    query = query.eq('deck_name', deck);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching due cards:', error);
    return res.status(500).json({ error: 'Failed to fetch cards' });
  }

  res.json({ cards: data });
}

async function recordReview(req, res) {
  const userId = req.user.id;
  const cardId = req.params.id;
  const { rating } = req.body; // 0=Again, 1=Hard, 2=Good, 3=Easy

  // Validate rating
  if (![0, 1, 2, 3].includes(rating)) {
    return res.status(400).json({ error: 'Invalid rating' });
  }

  // Get current card data
  const { data: card, error: fetchError } = await supabase
    .from('saved_expression_cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  // Calculate next review using SM-2 algorithm
  const updated = calculateNextReview(card, rating);

  // Update card
  const { data: updatedCard, error: updateError } = await supabase
    .from('saved_expression_cards')
    .update({
      easiness_factor: updated.easiness_factor,
      interval: updated.interval,
      repetition_count: updated.repetition_count,
      next_review_date: updated.next_review_date,
      last_reviewed_at: new Date().toISOString(),
      correct_count: rating >= 2 ? card.correct_count + 1 : card.correct_count,
      incorrect_count: rating < 2 ? card.incorrect_count + 1 : card.incorrect_count
    })
    .eq('id', cardId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating card:', updateError);
    return res.status(500).json({ error: 'Failed to update card' });
  }

  res.json({ card: updatedCard });
}

async function getDecks(req, res) {
  const userId = req.user.id;

  const { data, error } = await supabase.rpc('get_deck_stats', {
    p_user_id: userId
  });

  if (error) {
    console.error('Error fetching decks:', error);
    return res.status(500).json({ error: 'Failed to fetch decks' });
  }

  res.json({ decks: data });
}

async function getStats(req, res) {
  const userId = req.user.id;

  // Get overall stats
  const { data: cards, error } = await supabase
    .from('saved_expression_cards')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }

  const total = cards.length;
  const dueToday = cards.filter(c =>
    !c.is_suspended &&
    new Date(c.next_review_date) <= new Date()
  ).length;
  const newCards = cards.filter(c => c.repetition_count === 0).length;
  const mastered = cards.filter(c =>
    c.repetition_count >= 5 && c.interval >= 30
  ).length;

  // Calculate review streak (consecutive days with reviews)
  // TODO: Implement streak tracking in future iteration
  const reviewStreak = 0;

  res.json({
    total,
    dueToday,
    newCards,
    mastered,
    reviewStreak,
    masteryPercentage: total > 0 ? Math.round((mastered / total) * 100) : 0
  });
}

async function updateCard(req, res) {
  const userId = req.user.id;
  const cardId = req.params.id;
  const { deck_name, tags, notes, is_suspended } = req.body;

  const updates = {};
  if (deck_name !== undefined) updates.deck_name = deck_name;
  if (tags !== undefined) updates.tags = tags;
  if (notes !== undefined) updates.notes = notes;
  if (is_suspended !== undefined) updates.is_suspended = is_suspended;

  const { data, error } = await supabase
    .from('saved_expression_cards')
    .update(updates)
    .eq('id', cardId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update card' });
  }

  res.json({ card: data });
}

async function deleteCard(req, res) {
  const userId = req.user.id;
  const cardId = req.params.id;

  const { error } = await supabase
    .from('saved_expression_cards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: 'Failed to delete card' });
  }

  res.json({ success: true });
}

async function getCardById(req, res) {
  const userId = req.user.id;
  const cardId = req.params.id;

  const { data, error } = await supabase
    .from('saved_expression_cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json({ card: data });
}

async function bulkUpdateDeck(req, res) {
  const userId = req.user.id;
  const { card_ids, deck_name } = req.body;

  if (!card_ids || !Array.isArray(card_ids) || !deck_name) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { data, error } = await supabase
    .from('saved_expression_cards')
    .update({ deck_name })
    .in('id', card_ids)
    .eq('user_id', userId)
    .select();

  if (error) {
    return res.status(500).json({ error: 'Failed to update cards' });
  }

  res.json({ updated: data.length });
}

module.exports = {
  saveCard,
  getDueCards,
  recordReview,
  getDecks,
  getStats,
  updateCard,
  deleteCard,
  getCardById,
  bulkUpdateDeck,
  checkCardLimit
};
```

---

## SM-2 Algorithm Implementation

### Utility: `server/utils/sm2Algorithm.js`

```javascript
/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 *
 * @param {Object} card - Current card data
 * @param {number} rating - User's difficulty rating (0-3)
 *   0 = Again (complete failure)
 *   1 = Hard (difficult recall)
 *   2 = Good (correct recall with effort)
 *   3 = Easy (perfect recall)
 * @returns {Object} Updated card data with new SRS values
 */
function calculateNextReview(card, rating) {
  const {
    easiness_factor: currentEF = 2.5,
    interval: currentInterval = 1,
    repetition_count: currentRep = 0
  } = card;

  let newEF = currentEF;
  let newInterval = currentInterval;
  let newRep = currentRep;
  let nextReviewDate;

  // Update easiness factor based on rating
  // Formula: EF' = EF + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02))
  newEF = currentEF + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));

  // EF should never go below 1.3
  newEF = Math.max(1.3, newEF);

  // Calculate new interval based on rating
  if (rating < 2) {
    // Failed or hard → Reset interval and repetition count
    newInterval = 1;
    newRep = 0;
  } else {
    // Correct recall
    newRep = currentRep + 1;

    if (newRep === 1) {
      newInterval = 1; // First review: 1 day
    } else if (newRep === 2) {
      newInterval = 6; // Second review: 6 days
    } else {
      // Subsequent reviews: multiply previous interval by EF
      newInterval = Math.round(currentInterval * newEF);
    }
  }

  // Calculate next review date
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  nextReviewDate = new Date(today);
  nextReviewDate.setDate(today.getDate() + newInterval);

  // Format as YYYY-MM-DD for PostgreSQL DATE type
  const formattedDate = nextReviewDate.toISOString().split('T')[0];

  return {
    easiness_factor: newEF,
    interval: newInterval,
    repetition_count: newRep,
    next_review_date: formattedDate
  };
}

module.exports = { calculateNextReview };
```

---

## Frontend Components

### 1. Menu Integration: `src/shared/components/UserMenu.tsx`

**Location:** Lines 50-57 in UserMenu.tsx

**Add new menu item:**

```typescript
const menuItems = [
  { label: 'Profile', icon: ProfileIcon, onClick: () => onOpenProfile?.() },
  { label: 'Video Library', icon: VideoIcon, onClick: () => onOpenVideoLibrary?.() },
  { label: 'My Flashcards', icon: FlashcardIcon, onClick: () => onOpenFlashcards?.() }, // NEW
  { label: 'Practice Reports', icon: ReportsIcon, onClick: () => onOpenReports?.() },
  { label: 'Subscription Plan', icon: SubscriptionIcon, onClick: () => onOpenSubscription?.() },
];

// Add FlashcardIcon component
const FlashcardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    <line x1="10" y1="8" x2="16" y2="8"></line>
    <line x1="10" y1="12" x2="16" y2="12"></line>
    <line x1="10" y1="16" x2="14" y2="16"></line>
  </svg>
);
```

### 2. Save Button: `src/features/practice/components/SaveToFlashcardButton.tsx`

**NEW COMPONENT** - Add save button to improvements section

```typescript
import React, { useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';

interface SaveToFlashcardButtonProps {
  original: string;
  improved: string;
  explanation: string;
  videoId?: string;
  videoTitle?: string;
  cachedAnalysisId?: string;
}

const SaveToFlashcardButton: React.FC<SaveToFlashcardButtonProps> = ({
  original,
  improved,
  explanation,
  videoId,
  videoTitle,
  cachedAnalysisId
}) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      // Show auth modal
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify({
          original_text: original,
          improved_text: improved,
          explanation,
          video_id: videoId,
          video_title: videoTitle,
          cached_analysis_id: cachedAnalysisId,
          deck_name: 'default'
        })
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await response.json();
        if (data.error === 'Card limit reached') {
          // Show upgrade modal
          alert(data.message);
        }
      }
    } catch (error) {
      console.error('Failed to save flashcard:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving || saved}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        saved
          ? 'bg-green-100 text-green-700'
          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
      }`}
    >
      {saved ? (
        <>
          <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Saved!
        </>
      ) : saving ? (
        'Saving...'
      ) : (
        <>
          <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Save
        </>
      )}
    </button>
  );
};

export default SaveToFlashcardButton;
```

### 3. Flashcard Dashboard: `src/features/flashcards/components/FlashcardDashboard.tsx`

**NEW PAGE** - Main flashcard management page

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';

interface DeckStats {
  deck_name: string;
  total_cards: number;
  due_today: number;
  new_cards: number;
  mastered_cards: number;
}

const FlashcardDashboard: React.FC = () => {
  const { user } = useAuth();
  const [decks, setDecks] = useState<DeckStats[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    dueToday: 0,
    newCards: 0,
    mastered: 0,
    masteryPercentage: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [decksRes, statsRes] = await Promise.all([
        fetch('/api/flashcards/decks', {
          headers: { 'Authorization': `Bearer ${user.access_token}` }
        }),
        fetch('/api/flashcards/stats', {
          headers: { 'Authorization': `Bearer ${user.access_token}` }
        })
      ]);

      const decksData = await decksRes.json();
      const statsData = await statsRes.json();

      setDecks(decksData.decks || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch flashcard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-stone-900">My Flashcards</h1>
        <button className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800">
          Create Deck
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Cards" value={stats.total} color="stone" />
        <StatCard label="Due Today" value={stats.dueToday} color="blue" />
        <StatCard label="New Cards" value={stats.newCards} color="green" />
        <StatCard label="Mastered" value={stats.mastered} color="amber" />
      </div>

      {/* Decks List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-stone-800">Your Decks</h2>
        {decks.map(deck => (
          <DeckCard key={deck.deck_name} deck={deck} />
        ))}
      </div>
    </div>
  );
};

// Component implementations...
```

### 4. Review Session: `src/features/flashcards/components/FlashcardReviewSession.tsx`

**NEW COMPONENT** - Anki-style review interface with flip animation

```typescript
// Full implementation in separate component file
// Features:
// - Card flip animation
// - Rating buttons (Again/Hard/Good/Easy)
// - Progress indicator
// - Keyboard shortcuts (1/2/3/4 for ratings, Space to flip)
```

---

## Integration Points

### Answer to Your Question: Should users bookmark vocab from analyzed video page?

**YES! Two bookmark sources:**

1. **From "Language Polish" section** (PyramidFeedback.tsx, lines 488-511)
   - These are the **critiques/improvements** shown in your screenshot
   - Add "Save to Flashcards" button to each improvement card

2. **From Vocabulary section** (VocabularyCard component)
   - Users can also save individual vocabulary items
   - Store as: `original_text = word`, `improved_text = definition`, `explanation = usage examples`

### Where to Add Save Buttons

**In PyramidFeedback.tsx:**
```typescript
// Line 493-508, modify improvement cards:
<div key={idx} className="...">
  <div className="flex-1 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase...">Original</span>
      <SaveToFlashcardButton
        original={imp.original}
        improved={imp.improved}
        explanation={imp.explanation}
        videoId={/* pass from props */}
        videoTitle={/* pass from props */}
      />
    </div>
    <p className="text-stone-600 italic...">"{imp.original}"</p>
  </div>
  {/* ... rest of card */}
</div>
```

**In VocabularyCard.tsx:**
```typescript
// Add bookmark icon/button to each vocabulary card
// Save as: word → definition flashcard
```

---

## Usage Limits & Monetization

### Free Tier
- **100 cards maximum**
- Unlimited reviews
- All decks
- Basic statistics

### Pro Tier
- **Unlimited cards**
- Advanced statistics (heatmaps, retention graphs)
- Deck export (CSV, Anki format)
- Custom review sessions

### Upgrade Prompts
- When free user tries to save 101st card → Upgrade modal
- "Upgrade to Pro for unlimited flashcards" CTA in dashboard

---

## Implementation Phases

### Phase 1: Core MVP (Week 1-2)
- [ ] Database migration 028
- [ ] API routes + SM-2 algorithm
- [ ] Save button in PyramidFeedback
- [ ] Basic flashcard dashboard
- [ ] Simple review session (no animations)
- [ ] Menu integration

### Phase 2: Polish & UX (Week 3)
- [ ] Card flip animations
- [ ] Keyboard shortcuts
- [ ] Deck creation/management
- [ ] Save from vocabulary cards
- [ ] Mobile responsive design

### Phase 3: Advanced Features (Week 4+)
- [ ] Statistics dashboard (graphs, heatmaps)
- [ ] Custom study modes (cram, new cards only)
- [ ] Deck export (Pro feature)
- [ ] Review streak tracking
- [ ] Batch operations (move multiple cards)

---

## Technical Decisions

### Why SM-2 Algorithm?
- **Proven**: Used by Anki, SuperMemo, millions of users
- **Simple**: Easy to implement and understand
- **Effective**: Scientifically optimized for long-term retention
- **Better than simple intervals**: Adapts to individual card difficulty

### Why Store in Supabase?
- **Sync**: Works across devices automatically
- **RLS**: Secure, users only see their cards
- **Performance**: Indexed queries for fast review sessions
- **Scalable**: Handles millions of cards

### Why No Anonymous Flashcards?
- **Requires account** for persistent study data
- **Motivates signup**: "Save this improvement → Sign up to review later"
- **Usage tracking**: Helps understand engagement

---

## Success Metrics

### User Engagement
- % of users who save at least 1 card
- Average cards saved per user
- Daily active reviewers
- Review completion rate

### Learning Outcomes
- Average mastery percentage
- Cards reaching 30+ day intervals
- User retention (7-day, 30-day)

### Monetization
- Conversion rate: Free → Pro (from card limit)
- Upgrade attribution: "Flashcard limit" source

---

## Future Enhancements

### Phase 5+
- [ ] Shared decks (community feature)
- [ ] AI-generated practice questions from cards
- [ ] Pronunciation recording on cards
- [ ] Gamification (badges, leaderboards)
- [ ] Mobile app (React Native)
- [ ] Anki deck import/export
- [ ] ChatGPT integration (explain card in context)

---

## Questions to Answer Before Building

1. ✅ **Should users bookmark vocab?** → YES, from both improvements AND vocabulary sections
2. ✅ **Feature naming?** → "My Flashcards" / "语言表达卡片"
3. ✅ **Algorithm?** → SM-2 (Anki standard)
4. ✅ **Where in menu?** → Between "Video Library" and "Practice Reports"
5. ⏳ **Deck limit for free users?** → Suggest: Unlimited decks, but 100 cards total
6. ⏳ **Default deck name?** → "Default" or "未分类" (Uncategorized)

---

## Related Documentation
- See `MEMORY.md` for Supabase RLS patterns
- See `subscription-and-usage.md` for tier limits implementation
- See `PyramidFeedback.tsx` (lines 488-511) for improvements UI
- See `UserMenu.tsx` (lines 50-57) for menu structure

---

**Next Steps:**
1. Review this plan with stakeholders
2. Create migration 028 in `supabase/migrations/`
3. Implement Phase 1 MVP
4. User testing with 5-10 beta users
5. Iterate based on feedback

