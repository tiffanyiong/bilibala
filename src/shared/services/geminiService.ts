import { getBackendOrigin } from '../services/backend';
import { ContentAnalysis } from '../types';

export const analyzeVideoContent = async (
  videoTitle: string,
  videoUrl: string,
  nativeLang: string,
  targetLang: string,
  level: string
): Promise<ContentAnalysis> => {
  const resp = await fetch(`${getBackendOrigin()}/api/analyze-video-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoTitle, videoUrl, nativeLang, targetLang, level }),
  });

  if (!resp.ok) {
    // Extract specific error message from API response
    const errorData = await resp.json().catch(() => ({}));
    const errorMessage = errorData.error || 'Failed to analyze video content. Please try again.';
    throw new Error(errorMessage);
  }

  return (await resp.json()) as ContentAnalysis;
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
};

export interface SearchableVideo {
  libraryId: string;
  title: string;
  targetLang: string;
  level: string;
  summary?: string;
  topics?: string[];
  vocabulary?: string[];
}

export const searchVideos = async (
  query: string,
  videos: SearchableVideo[]
): Promise<string[]> => {
  if (!query.trim() || videos.length === 0) {
    return videos.map(v => v.libraryId);
  }

  try {
    const resp = await fetch(`${getBackendOrigin()}/api/search-videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, videos }),
    });
    if (!resp.ok) {
      // On error, return all videos
      return videos.map(v => v.libraryId);
    }
    const data = await resp.json();
    return data.matchedVideoIds || videos.map(v => v.libraryId);
  } catch (e) {
    console.error("Video search failed", e);
    return videos.map(v => v.libraryId);
  }
};