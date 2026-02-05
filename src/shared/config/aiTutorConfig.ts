/**
 * AI Tutor configuration
 *
 * Values are fetched from the server (backed by Supabase app_config table).
 * The constants below are fallback defaults used until the fetch completes.
 *
 * To change limits: edit the app_config table in Supabase dashboard.
 */

import { getBackendOrigin } from '../services/backend';
import { updateMaxDuration } from '../../features/practice/config/audioConfig';

// --- Fallback defaults (used until server config loads) ---
export let SESSION_MAX_MINUTES = 40;
export let MONTHLY_MAX_MINUTES = 60;
export let WARNING_BEFORE_END_SECONDS = 60;

// --- Free tier fallback defaults ---
export let FREE_VIDEOS_PER_MONTH = 3;
export let FREE_PRACTICE_SESSIONS_PER_MONTH = 5;
export let FREE_VIDEO_LIBRARY_MAX = 10;
export let ANONYMOUS_VIDEO_LIMIT = 2;
export let ANONYMOUS_PRACTICE_LIMIT = 2;

// --- Pro tier fallback defaults ---
export let PRO_VIDEOS_PER_MONTH = 100;

// --- Starter Pack defaults ---
export let STARTER_PACK_VIDEO_CREDITS = 15;
export let STARTER_PACK_AI_TUTOR_MINUTES = 30;
export let STARTER_PACK_PRACTICE_SESSIONS = 30;

// --- Top-up Pack defaults ---
export let TOPUP_VIDEO_CREDITS = 10;
export let TOPUP_AI_TUTOR_MINUTES = 15;

// --- Prices (for UI display only - actual charges come from Stripe) ---
export let PRO_MONTHLY_PRICE = 9;
export let PRO_ANNUAL_PRICE = 7;  // per month
export let PRO_ANNUAL_TOTAL = 84; // yearly total
export let STARTER_PACK_PRICE = 5;
export let TOPUP_PRICE = 3;

// --- Recording limits ---
export let PRACTICE_RECORDING_MAX_SECONDS = 240;

// --- Speech analysis limits ---
export let SPEECH_ANALYSIS_TIMEOUT_SECONDS = 150;

let configLoaded = false;

/**
 * Fetch app config from the server. Updates the exported variables in place.
 * Safe to call multiple times — only fetches once.
 */
export async function fetchAppConfig(): Promise<void> {
  if (configLoaded) return;
  try {
    const res = await fetch(`${getBackendOrigin()}/api/config/app`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    SESSION_MAX_MINUTES = data.ai_tutor_session_max_minutes ?? SESSION_MAX_MINUTES;
    MONTHLY_MAX_MINUTES = data.ai_tutor_monthly_max_minutes ?? MONTHLY_MAX_MINUTES;
    WARNING_BEFORE_END_SECONDS = data.ai_tutor_warning_before_end_seconds ?? WARNING_BEFORE_END_SECONDS;
    FREE_VIDEOS_PER_MONTH = data.free_videos_per_month ?? FREE_VIDEOS_PER_MONTH;
    FREE_PRACTICE_SESSIONS_PER_MONTH = data.free_practice_sessions_per_month ?? FREE_PRACTICE_SESSIONS_PER_MONTH;
    FREE_VIDEO_LIBRARY_MAX = data.free_video_library_max ?? FREE_VIDEO_LIBRARY_MAX;
    ANONYMOUS_VIDEO_LIMIT = data.anonymous_video_limit ?? ANONYMOUS_VIDEO_LIMIT;
    ANONYMOUS_PRACTICE_LIMIT = data.anonymous_practice_limit ?? ANONYMOUS_PRACTICE_LIMIT;
    PRO_VIDEOS_PER_MONTH = data.pro_videos_per_month ?? PRO_VIDEOS_PER_MONTH;
    STARTER_PACK_VIDEO_CREDITS = data.starter_pack_video_credits ?? STARTER_PACK_VIDEO_CREDITS;
    STARTER_PACK_AI_TUTOR_MINUTES = data.starter_pack_ai_tutor_minutes ?? STARTER_PACK_AI_TUTOR_MINUTES;
    STARTER_PACK_PRACTICE_SESSIONS = data.starter_pack_practice_sessions ?? STARTER_PACK_PRACTICE_SESSIONS;
    TOPUP_VIDEO_CREDITS = data.topup_video_credits ?? TOPUP_VIDEO_CREDITS;
    TOPUP_AI_TUTOR_MINUTES = data.topup_ai_tutor_minutes ?? TOPUP_AI_TUTOR_MINUTES;
    PRO_MONTHLY_PRICE = data.pro_monthly_price ?? PRO_MONTHLY_PRICE;
    PRO_ANNUAL_PRICE = data.pro_annual_price ?? PRO_ANNUAL_PRICE;
    PRO_ANNUAL_TOTAL = data.pro_annual_total ?? PRO_ANNUAL_TOTAL;
    STARTER_PACK_PRICE = data.starter_pack_price ?? STARTER_PACK_PRICE;
    TOPUP_PRICE = data.topup_price ?? TOPUP_PRICE;
    PRACTICE_RECORDING_MAX_SECONDS = data.practice_recording_max_seconds ?? PRACTICE_RECORDING_MAX_SECONDS;
    updateMaxDuration(PRACTICE_RECORDING_MAX_SECONDS);
    SPEECH_ANALYSIS_TIMEOUT_SECONDS = data.speech_analysis_timeout_seconds ?? SPEECH_ANALYSIS_TIMEOUT_SECONDS;

    configLoaded = true;
    console.log('[AppConfig] Loaded from server');
  } catch (err) {
    console.warn('[AppConfig] Failed to fetch from server, using defaults:', err);
  }
}
