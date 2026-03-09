import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Create a rate limiter with per-user/fingerprint key generation
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum number of requests allowed in the window
 * @param {string} message - Custom error message
 * @returns {Function} Express middleware
 */
export const createLimiter = (windowMs, max, message = 'Too many requests, please slow down') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

    // Generate unique key per user/fingerprint/IP
    keyGenerator: (req) => {
      // Priority: user ID > fingerprint > IP (with IPv6 normalization)
      if (req.user?.id) return `user:${req.user.id}`;
      if (req.body?.fingerprintHash) return `fingerprint:${req.body.fingerprintHash}`;
      return ipKeyGenerator(req); // Properly handles IPv6 normalization
    },

    // Custom error response with logging
    handler: (req, res) => {
      const key = req.user?.id
        ? `user:${req.user.id}`
        : req.body?.fingerprintHash
          ? `fingerprint:${req.body.fingerprintHash.slice(0, 8)}...`
          : `ip:${req.ip}`;

      console.warn(`[RateLimit] BLOCKED | key: ${key} | endpoint: ${req.path} | window: ${windowMs}ms | max: ${max}`);

      res.status(429).json({
        error: 'RATE_LIMIT',
        message,
        retryAfter: Math.ceil(windowMs / 1000) // seconds
      });
    },

    // Skip rate limiting for successful responses (only count towards limit on error)
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });
};

// ==========================================
// Main API Rate Limiters (user-triggered)
// ==========================================

/**
 * Video analysis: 5 minutes, 15 requests
 * Expensive operation (Gemini API + Supadata API)
 * Note: Each video triggers 3 requests (Easy, Medium, Hard levels)
 * So 15 requests = 5 videos per 5 minutes
 */
export const videoAnalysisLimiter = createLimiter(
  5 * 60 * 1000,
  15,
  'Too many video analysis requests. Please wait 5 minutes before trying again.'
);

/**
 * Practice session (speech analysis): 10 minutes, 30 requests
 * Expensive operation (Gemini API)
 * Note: Each question answered calls this API, so limit is generous
 */
export const practiceLimiter = createLimiter(
  10 * 60 * 1000,
  30,
  'Too many practice attempts. Please wait 10 minutes before trying again.'
);

/**
 * Generate question: 1 minute, 5 requests
 * Lightweight operation
 */
export const questionGenLimiter = createLimiter(
  60 * 1000,
  5,
  'Too many question generation requests. Please wait 1 minute.'
);

/**
 * Conversation hints: 1 minute, 5 requests
 * Used in AI Tutor for "rescue ring" feature
 */
export const hintsLimiter = createLimiter(
  60 * 1000,
  5,
  'Too many hint requests. Please wait 1 minute.'
);

/**
 * Search videos: 1 minute, 10 requests
 * Lightweight operation
 */
export const searchLimiter = createLimiter(
  60 * 1000,
  10,
  'Too many search requests. Please wait 1 minute.'
);

// ==========================================
// Sub-API Rate Limiters (auto-triggered)
// More lenient than main APIs
// ==========================================

/**
 * Fetch transcript: 5 minutes, 5 requests
 * Called before video analysis (allows retries)
 */
export const transcriptLimiter = createLimiter(
  5 * 60 * 1000,
  5,
  'Too many transcript requests. Please wait 5 minutes.'
);

/**
 * Match topics: 5 minutes, 10 requests
 * Called after video analysis (lightweight)
 */
export const matchTopicsLimiter = createLimiter(
  5 * 60 * 1000,
  10,
  'Too many topic matching requests. Please wait 5 minutes.'
);

/**
 * Text-to-speech: 1 minute, 30 requests
 * Used in practice sessions (users may click many words)
 */
export const ttsLimiter = createLimiter(
  60 * 1000,
  30,
  'Too many audio requests. Please wait 1 minute.'
);
