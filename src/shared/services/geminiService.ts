import { ContentAnalysis } from '../types';
import { getBackendOrigin } from '../services/backend';

export const analyzeVideoContent = async (
  videoTitle: string, 
  nativeLang: string, 
  targetLang: string, 
  level: string
): Promise<ContentAnalysis> => {
  try {
    const resp = await fetch(`${getBackendOrigin()}/api/analyze-video-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoTitle, nativeLang, targetLang, level }),
    });
    if (!resp.ok) throw new Error('Failed to analyze video content. Please try again.');
    return (await resp.json()) as ContentAnalysis;
  } catch (error: any) {
    console.error("Error analyzing video:", error);
    throw new Error("Failed to analyze video content. Please try again.");
  }
};

export const generateConversationHints = async (
    lastAiQuestion: string,
    targetLang: string,
    level: string
): Promise<string[]> => {
    if (!lastAiQuestion) return [];

    try {
        const resp = await fetch(`${getBackendOrigin()}/api/conversation-hints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastAiQuestion, targetLang, level }),
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.hints || [];
    } catch (e) {
        console.error("Hint generation failed", e);
        return [];
    }
}