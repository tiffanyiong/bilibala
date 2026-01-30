import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env: root .env.local first (overrides), then server/.env as fallback
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
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
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    proPriceId: process.env.STRIPE_PRO_PRICE_ID,
    proAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    // Credit pack price IDs (one-time payments)
    starterPackPriceId: process.env.STRIPE_STARTER_PACK_PRICE_ID,
    topupPriceId: process.env.STRIPE_TOPUP_PRICE_ID,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  deepl: {
    apiKey: process.env.DEEPL_API_KEY,
  },
};

// Validate required environment variables
if (!config.gemini.apiKey) {
  console.error('Missing GEMINI_API_KEY in server environment.');
}
if (!config.supadata.apiKey) {
  console.error('Missing SUPADATA_API_KEY in server environment.');
}
