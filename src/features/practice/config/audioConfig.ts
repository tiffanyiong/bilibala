/**
 * Audio Recorder Configuration
 *
 * Centralized configuration for audio recording settings.
 * Modify these values to adjust recording behavior across the app.
 */

export const audioConfig = {
  // Recording time limits (in seconds)
  recording: {
    /** Maximum recording duration in seconds (default: 6 minutes = 360 seconds) */
    maxDurationSeconds: 360,

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
