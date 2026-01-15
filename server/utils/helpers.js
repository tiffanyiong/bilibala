/**
 * Extract likely JSON from a text response that might contain markdown code blocks
 */
export function extractLikelyJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return t.slice(first, last + 1);
  }
  return t;
}

/**
 * Safely parse JSON from text that might contain extra content
 */
export function safeJsonParse(text) {
  const candidate = extractLikelyJson(text);
  if (!candidate) throw new Error('Empty JSON');
  return JSON.parse(candidate);
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Build system instruction for Gemini Live session
 */
export function buildSystemInstruction({ videoTitle, summary, vocabulary, nativeLang, targetLang, level }) {
  const vocabListString = Array.isArray(vocabulary)
    ? vocabulary.map((v) => `- ${v.word}: ${v.definition}`).join('\n')
    : '';
  const safeTitle = String(videoTitle || '').replace(/`/g, "'");
  const safeSummary = String(summary || '').replace(/`/g, "'");

  return `
You are 'Bilibala', an energetic and proactive language coach.
User Native: ${nativeLang}. Learning: ${targetLang}. Level: ${level}.
Topic Video: "${safeTitle}".
Summary: "${safeSummary}"
Vocabulary:
${vocabListString}

GOAL: Help the user speak MORE.
1. Ask open-ended questions about the video topic.
2. If the user gives a one-word answer (e.g., "No", "Yes"), ALWAYS ask "Why?" or "Tell me more about that."
3. Keep your turns concise (under 20 seconds) so the user gets more speaking time.
4. Be encouraging but persistent. Don't let them get away with silence!

IMPORTANT: Start the conversation immediately by introducing yourself as Bilibala the coach, and asking a specific, engaging question directly related to the video content "${safeTitle}". Do not just say "Hello".
`.trim();
}
