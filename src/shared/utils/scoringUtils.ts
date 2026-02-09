import { ScoringBreakdown, IELTSBreakdown, HSKBreakdown, SpeechAnalysisResult } from '../types';
import { getScoringFramework } from '../constants';

/**
 * Extract or estimate the scoring breakdown from feedback data.
 * New sessions: uses feedback.breakdown directly.
 * Old sessions: estimates from the 0-100 score.
 */
export function getBreakdown(
  feedback: SpeechAnalysisResult['feedback'] | null | undefined,
  targetLang: string
): ScoringBreakdown | null {
  if (!feedback) return null;

  // If breakdown already exists, return it (with HSK level recalculation if needed)
  if (feedback.breakdown) {
    const bd = { ...feedback.breakdown };
    // Recalculate HSK level from non-zero sub-scores (fix old data with 0-value sub-scores)
    if (bd.framework === 'hsk') {
      const hsk = bd as HSKBreakdown;
      const subs = [hsk.pronunciation_tones, hsk.vocabulary_grammar, hsk.fluency_coherence, hsk.content_expressiveness];
      const nonZero = subs.filter((v) => v > 0);
      if (nonZero.length > 0 && nonZero.length < 4) {
        const avgScore = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
        const framework = getScoringFramework(targetLang);
        if (framework) {
          hsk.hsk_level = Math.max(1, Math.round(framework.fromGenericScore(avgScore) * 2) / 2);
        }
      }
      return hsk;
    }
    return bd;
  }

  // Otherwise, estimate from generic score for known frameworks
  const framework = getScoringFramework(targetLang);
  if (!framework || feedback.score == null) return null;

  if (framework.id === 'ielts') {
    const band = framework.fromGenericScore(feedback.score);
    return {
      framework: 'ielts',
      band_score: band,
      fluency_coherence: band,
      lexical_resource: band,
      grammatical_range: band,
      pronunciation: band,
      band_descriptor: framework.bandDescriptors[Math.floor(band)] || '',
    } as IELTSBreakdown;
  }

  if (framework.id === 'hsk') {
    const level = framework.fromGenericScore(feedback.score);
    return {
      framework: 'hsk',
      hsk_level: level,
      pronunciation_tones: feedback.score,
      vocabulary_grammar: feedback.score,
      fluency_coherence: feedback.score,
      content_expressiveness: feedback.score,
      level_descriptor: framework.bandDescriptors[Math.floor(level)] || '',
    } as HSKBreakdown;
  }

  return null;
}

/** Whether the breakdown was estimated from old data (vs. AI-generated). */
export function isEstimatedBreakdown(
  feedback: SpeechAnalysisResult['feedback'] | null | undefined
): boolean {
  return !feedback?.breakdown;
}

/** Get the primary display score for a language framework. */
export function getDisplayScore(
  feedback: SpeechAnalysisResult['feedback'] | null | undefined,
  targetLang: string
): { label: string; value: string; subtitle: string } {
  const breakdown = getBreakdown(feedback, targetLang);
  if (!breakdown) {
    return {
      label: 'Score',
      value: String(feedback?.score ?? 0),
      subtitle: 'out of 100',
    };
  }

  if (breakdown.framework === 'ielts') {
    return {
      label: 'Band Score',
      value: breakdown.band_score.toFixed(1),
      subtitle: breakdown.band_descriptor || '',
    };
  }

  if (breakdown.framework === 'hsk') {
    return {
      label: 'Level',
      value: String(Math.round(breakdown.hsk_level)),
      subtitle: breakdown.level_descriptor || '',
    };
  }

  return {
    label: 'Score',
    value: String(feedback?.score ?? 0),
    subtitle: 'out of 100',
  };
}
