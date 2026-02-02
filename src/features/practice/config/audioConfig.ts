/**
 * Audio Recorder Configuration
 *
 * Centralized configuration for audio recording settings.
 * The maxDurationSeconds value can be overridden from the app_config table
 * via updateMaxDuration(). The default (240s) is used until config loads.
 */

export const audioConfig = {
  // Recording time limits (in seconds)
  recording: {
    /** Maximum recording duration in seconds (default: 4 minutes = 240 seconds) */
    maxDurationSeconds: 240,

    /** Warning threshold - show warning when this many seconds remain */
    warningThresholdSeconds: 30,

    /** Auto-stop recording when max duration is reached */
    autoStopOnMaxDuration: true,
  },

  // Audio quality settings
  quality: {
    /** Enable echo cancellation */
    echoCancellation: true,

    /** Enable noise suppression */
    noiseSuppression: true,

    /** Enable automatic gain control */
    autoGainControl: true,
  },

  // Visualizer settings
  visualizer: {
    /** FFT size for audio analysis (must be power of 2) */
    fftSize: 64,

    /** Smoothing for visualizer animation (0-1) */
    smoothingTimeConstant: 0.4,

    /** Number of bars to display in visualizer */
    maxBars: 20,
  },

  // UI settings
  ui: {
    /** Timer update interval in milliseconds */
    timerIntervalMs: 100,
  },
};

// Update max duration from server config (called after fetchAppConfig)
export const updateMaxDuration = (seconds: number) => {
  if (seconds > 0) {
    audioConfig.recording.maxDurationSeconds = seconds;
  }
};

// Helper function to get max duration in minutes (for display)
export const getMaxDurationMinutes = () => {
  return Math.floor(audioConfig.recording.maxDurationSeconds / 60);
};

// Helper function to format time remaining
export const formatTimeRemaining = (currentSeconds: number) => {
  const remaining = audioConfig.recording.maxDurationSeconds - currentSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
