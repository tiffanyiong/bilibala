import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env from server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 3001),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    liveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',
    apiVersion: process.env.GEMINI_API_VERSION,
  },
  supadata: {
    apiKey: process.env.SUPADATA_API_KEY,
  },
};

// Validate required environment variables
if (!config.gemini.apiKey) {
  console.error('Missing GEMINI_API_KEY in server environment.');
}
if (!config.supadata.apiKey) {
  console.error('Missing SUPADATA_API_KEY in server environment.');
}
