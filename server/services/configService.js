import { supabaseAdmin } from './supabaseAdmin.js';

// In-memory cache
let configCache = {};
let lastFetchedAt = 0;

// Fallback defaults (used if DB is unreachable)
const DEFAULTS = {
  ai_tutor_session_max_minutes: '40',
  ai_tutor_monthly_max_minutes: '60',
  ai_tutor_warning_before_end_seconds: '60',
  free_videos_per_month: '3',
  free_practice_sessions_per_month: '5',
  free_video_library_max: '10',
  pro_videos_per_month: '100',
  anonymous_video_limit: '2',
  anonymous_practice_limit: '2',
  practice_recording_max_seconds: '240',
  speech_analysis_timeout_seconds: '150',
  // Starter Pack credits
  starter_pack_video_credits: '15',
  starter_pack_ai_tutor_minutes: '30',
  starter_pack_practice_sessions: '30',
  // Top-up Pack credits
  topup_video_credits: '10',
  topup_ai_tutor_minutes: '15',
  // Prices (for UI display only - actual prices come from Stripe)
  pro_monthly_price: '9',
  pro_annual_price: '7',
  pro_annual_total: '84',
  starter_pack_price: '5',
  topup_price: '3',
};

/**
 * Fetch all config from app_config table and cache in memory.
 */
export async function loadConfig() {
  if (!supabaseAdmin) {
    console.warn('[ConfigService] No Supabase client — using defaults');
    configCache = { ...DEFAULTS };
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value');

    if (error) throw error;

    const freshConfig = { ...DEFAULTS };
    for (const row of data) {
      freshConfig[row.key] = row.value;
    }
    configCache = freshConfig;
    lastFetchedAt = Date.now();
    console.log(`[ConfigService] Config loaded: ${data.length} values from DB`);
  } catch (err) {
    console.error('[ConfigService] Failed to load config from DB, using defaults:', err.message);
    if (Object.keys(configCache).length === 0) {
      configCache = { ...DEFAULTS };
    }
  }
}

/**
 * Get a config value. Returns a string — caller should parse to number if needed.
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string}
 */
export function getConfig(key, fallback) {
  return configCache[key] ?? fallback ?? DEFAULTS[key] ?? '';
}

/**
 * Get a config value as a number.
 * @param {string} key
 * @param {number} [fallback]
 * @returns {number}
 */
export function getConfigNumber(key, fallback = 0) {
  const val = configCache[key] ?? DEFAULTS[key];
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Get all config as a plain object with numeric values where possible.
 * @returns {Record<string, number | string>}
 */
export function getAllConfig() {
  const result = {};
  for (const [key, value] of Object.entries(configCache)) {
    const num = Number(value);
    result[key] = isNaN(num) ? value : num;
  }
  return result;
}

// Auto-refresh every 5 minutes
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function startConfigRefresh() {
  // Initial load
  loadConfig();
  // Periodic refresh
  setInterval(() => {
    loadConfig();
  }, REFRESH_INTERVAL_MS);
}
