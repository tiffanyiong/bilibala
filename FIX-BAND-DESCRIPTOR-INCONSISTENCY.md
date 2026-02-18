# 🐛 Fix: Band Descriptor Inconsistency & Language Issues

**Date**: 2026-02-18
**Issue**: Overall comment (band_descriptor/level_descriptor) shows inconsistently and in wrong language

---

## 🔴 Problem

### What User Observed

1. **Inconsistent display**: Overall comment only shows on "second retry" (delivery mode), not on first attempt
2. **Language inconsistency**: Sometimes in targetLang, sometimes in nativeLang
3. **Generic labels**: Shows "Modest User", "Good User" instead of descriptive feedback

### Screenshots Analysis

**Image 1** (HSK 7.5):
- Shows Chinese descriptor: "能够就各种话题进行较长的谈话，表达连贯且多样，词汇使用非常准确且多样，尽管由于母语习惯偶尔会有语速放慢的情况。"
- ✅ This is correct - detailed, in target language (Chinese)

**Image 2** (IELTS 6.0):
- Shows English descriptor: "You demonstrate a wide range of vocabulary but often use it inappropriately for the context, leading to a lack of coherence despite clear pronunciation."
- ✅ This is correct - detailed, in target language (English)

**Image 3** (5.5):
- Shows generic label: "Modest User"
- ❌ This is the fallback when AI doesn't provide band_descriptor

---

## 🔍 Root Cause

### AI Prompt Issues

1. **No explicit requirement**: The prompt showed EXAMPLES of band_descriptor/level_descriptor but didn't mandate them
2. **No language specification**: Prompt didn't tell AI which language to write these descriptors in
3. **Mode confusion**: Delivery mode vs Full Analysis mode had different implicit expectations

### Code Flow

```typescript
// Frontend (PerformanceCard.tsx line 132, 188)
const descriptor = b.band_descriptor || framework.bandDescriptors[bandFloor] || '';
```

**When AI provides descriptor**: Shows detailed AI-generated comment ✅
**When AI doesn't provide**: Falls back to hardcoded English labels ("Modest User", "Competent User") ❌

### Why "Only on Second Retry"

- **First attempt (Full Analysis)**: AI had clear examples in prompt → usually provided descriptor
- **Retry (Delivery Mode)**: Shorter prompt, less emphasis → AI sometimes skipped it
- Both modes should ALWAYS provide descriptors!

---

## ✅ Solution

### Prompt Changes

**For Delivery Mode (Retake Prompt):**

Added explicit requirements after each breakdown example:

```javascript
// IELTS
**REQUIRED: band_descriptor MUST be included with a descriptive comment in ${targetLang}:**
- Use descriptive phrases like "You demonstrate..." or "能够..." (NOT just labels like "Good User")
- Must be in ${targetLang} (the language being learned)
- Example: "You demonstrate a wide range of vocabulary but often use it inappropriately for the context, leading to a lack of coherence despite clear pronunciation."

// HSK
**REQUIRED: level_descriptor MUST be included with a descriptive comment in ${targetLang}:**
- Use descriptive phrases (NOT just labels like "Intermediate")
- Must be in ${targetLang} (the language being learned)
- Example for Chinese: "能够就各种话题进行较长的谈话，表达连贯且多样，词汇使用非常准确且多样。"
```

**For Full Analysis Mode (Main Prompt):**

Updated the output examples with detailed descriptors:

```javascript
// IELTS example
{ "band_descriptor": "You demonstrate a wide range of vocabulary but often use it inappropriately for the context, leading to a lack of coherence despite clear pronunciation." }

**CRITICAL: band_descriptor must be a DESCRIPTIVE comment in ${targetLang}, NOT just a label!**
- Write a detailed 1-2 sentence summary of their overall performance
- Use ${targetLang} (the target language they're learning)
- Focus on strengths + key weaknesses

// HSK example
{ "level_descriptor": "能够就常见话题进行交流，表达观点，但语法错误较多，声调准确性需要提高。" }

**CRITICAL: level_descriptor must be a DESCRIPTIVE comment in ${targetLang}, NOT just a label!**
- Write a detailed 1-2 sentence summary of their overall performance in Chinese
- Use ${targetLang} (the target language they're learning)
- Focus on strengths + key weaknesses
```

---

## 📊 Expected Behavior After Fix

### Every Analysis (Both Modes)

1. ✅ **Always shows descriptor**: AI now has explicit requirement to provide it
2. ✅ **Consistent language**: Always in targetLang (the language being learned)
3. ✅ **Descriptive feedback**: 1-2 sentences summarizing performance, not generic labels
4. ✅ **Strengths + weaknesses**: Balanced overview of user's speaking ability

### Examples

**IELTS English (Band 6.5):**
> "You can engage in extended conversations on various topics with coherent and varied expression, accurate vocabulary, but occasional grammatical errors."

**HSK Chinese (Level 4):**
> "能够就常见话题进行交流，表达观点，但语法错误较多，声调准确性需要提高。"

**IELTS Chinese (Band 7.0):**
> "能够就各种话题进行较长的谈话，表达连贯且多样，词汇使用准确，但声调偶尔不准确。"

---

## 🧪 Testing

### Test Cases

1. **First attempt (Full Analysis)**:
   - Record audio
   - Submit
   - ✅ Check: Detailed descriptor shows in targetLang

2. **Retry (Delivery Mode)**:
   - Click "Try Again" with reference transcript
   - Record audio
   - Submit
   - ✅ Check: Detailed descriptor shows in targetLang

3. **Language consistency**:
   - Test with English target language → descriptor in English
   - Test with Chinese target language → descriptor in Chinese
   - Test with other languages → descriptor in that language

4. **Different scoring frameworks**:
   - IELTS (English) → band_descriptor
   - HSK (Chinese) → level_descriptor
   - Generic → no breakdown (different UI)

---

## 📝 Files Changed

1. **server/routes/speechRoutes.js**
   - Lines 115-149: Updated delivery mode prompt with explicit descriptor requirements
   - Lines 402-412: Updated IELTS example with descriptive band_descriptor + requirements
   - Lines 428-438: Updated HSK example with descriptive level_descriptor + requirements

---

## 🎯 Why This Fix Works

1. **Explicit mandate**: "REQUIRED" and "MUST be included" leaves no ambiguity
2. **Clear examples**: Shows the AI exactly what format to use
3. **Language specification**: `in ${targetLang}` is crystal clear
4. **Anti-pattern warnings**: "NOT just labels" prevents generic responses
5. **Consistent across modes**: Both delivery and full analysis have same requirements

---

## 🔐 Backwards Compatibility

- ✅ Frontend fallback still exists: If AI somehow doesn't provide descriptor, shows generic label
- ✅ Schema already requires these fields, so no breaking changes
- ✅ Old session data unaffected (only new analyses use updated prompt)

---

**Status**: ✅ Ready for testing
**Priority**: 🟡 Medium (UX improvement, not a blocker)
**Impact**: 🟢 High (better user experience, consistent feedback)
