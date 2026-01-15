import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

/**
 * Create a new Gemini AI instance
 */
export function createAi() {
  return new GoogleGenAI({
    apiKey: config.gemini.apiKey,
    httpOptions: config.gemini.apiVersion ? { apiVersion: config.gemini.apiVersion } : undefined,
  });
}
