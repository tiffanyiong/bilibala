import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  buildSystemInstruction,
  extractLikelyJson,
  extractVideoId,
  safeJsonParse,
} from './helpers.js';

describe('server/utils/helpers', () => {
  describe('extractLikelyJson', () => {
    it('returns null for empty input', () => {
      assert.equal(extractLikelyJson(''), null);
      assert.equal(extractLikelyJson(null), null);
    });

    it('extracts a JSON object from markdown fences and surrounding text', () => {
      const response = 'Here is the result:\n```json\n{"score":90,"ok":true}\n```\nThanks!';

      assert.equal(extractLikelyJson(response), '{"score":90,"ok":true}');
    });

    it('returns trimmed plain text when no JSON object is present', () => {
      assert.equal(extractLikelyJson('  not json  '), 'not json');
    });
  });

  describe('safeJsonParse', () => {
    it('parses JSON embedded in a model-style response', () => {
      const parsed = safeJsonParse('Sure:\n```json\n{"words":["你好","世界"]}\n```');

      assert.deepEqual(parsed, { words: ['你好', '世界'] });
    });

    it('throws a clear error for empty input', () => {
      assert.throws(() => safeJsonParse(''), /Empty JSON/);
    });
  });

  describe('extractVideoId', () => {
    it('extracts ids from common YouTube URL formats', () => {
      assert.equal(extractVideoId('https://youtu.be/abcdefghijk'), 'abcdefghijk');
      assert.equal(extractVideoId('https://www.youtube.com/watch?v=12345678901'), '12345678901');
      assert.equal(extractVideoId('https://youtube.com/embed/a-b_cD12345'), 'a-b_cD12345');
    });

    it('returns null for unsupported urls', () => {
      assert.equal(extractVideoId('https://example.com/watch?v=abcdefghijk'), null);
      assert.equal(extractVideoId('not a url'), null);
    });
  });

  describe('buildSystemInstruction', () => {
    it('includes the learner profile, video context, vocabulary, and level guidance', () => {
      const instruction = buildSystemInstruction({
        videoTitle: 'Travel `Basics`',
        summary: 'A short `city` travel guide.',
        vocabulary: [{ word: 'station', definition: 'a place where trains stop' }],
        nativeLang: 'English',
        targetLang: 'Japanese',
        level: 'beginner',
        transcript: [{ text: 'Welcome to Tokyo station.' }],
      });

      assert.match(instruction, /Native Language: English/);
      assert.match(instruction, /Learning: Japanese/);
      assert.match(instruction, /Title: "Travel 'Basics'"/);
      assert.match(instruction, /Summary: "A short 'city' travel guide\."/);
      assert.match(instruction, /- station: a place where trains stop/);
      assert.match(instruction, /\*\*BEGINNER APPROACH\*\*/);
      assert.match(instruction, /Welcome to Tokyo station\./);
    });

    it('truncates very long transcripts to keep the prompt bounded', () => {
      const longText = 'a'.repeat(8100);
      const instruction = buildSystemInstruction({
        videoTitle: 'Long video',
        summary: 'Long summary',
        vocabulary: [],
        nativeLang: 'English',
        targetLang: 'Spanish',
        level: 'advanced',
        transcript: [{ text: longText }],
      });

      assert.match(instruction, /a{8000}\.\.\. \[transcript continues\]/);
      assert.doesNotMatch(instruction, /a{8100}/);
    });
  });
});
