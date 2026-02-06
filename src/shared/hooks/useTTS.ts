import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useTTS(language: string) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100
  const [duration, setDuration] = useState(0); // in seconds
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldRevokeRef = useRef(false);
  const audioUrlRef = useRef<string | null>(null);

  // Update progress during playback
  useEffect(() => {
    if (!isSpeaking) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        const audio = audioRef.current;
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
          setCurrentTime(audio.currentTime);
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  const speak = useCallback(async (text: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      if (shouldRevokeRef.current && audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioRef.current = null;
    }

    // If clicking the same text that's playing, just stop
    if (currentText === text && isSpeaking) {
      setIsSpeaking(false);
      setCurrentText(null);
      setProgress(0);
      setCurrentTime(0);
      return;
    }

    setIsSpeaking(true);
    setCurrentText(text);
    setProgress(0);
    setCurrentTime(0);

    try {
      const response = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      const data = await response.json();

      // Handle both cached URL and base64 audio responses
      let audioUrl: string;
      let shouldRevoke = false;

      if (data.audioUrl) {
        // Cached: use signed URL directly
        audioUrl = data.audioUrl;
      } else if (data.audioContent) {
        // Not cached: convert base64 to blob URL
        const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
        audioUrl = URL.createObjectURL(audioBlob);
        shouldRevoke = true;
      } else {
        throw new Error('No audio data in response');
      }

      shouldRevokeRef.current = shouldRevoke;
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (!isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        setProgress(100);
        setTimeout(() => setProgress(0), 500);
        if (shouldRevoke) URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        setProgress(0);
        if (shouldRevoke) URL.revokeObjectURL(audioUrl);
      };

      await audio.play();

    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      setCurrentText(null);
      setProgress(0);

      // Fallback to Web Speech API if Google TTS fails
      fallbackToWebSpeech(text, language);
    }
  }, [language, currentText, isSpeaking]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (shouldRevokeRef.current && audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setCurrentText(null);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  // Seek to a specific position (0-100)
  const seek = useCallback((percent: number) => {
    if (audioRef.current && audioRef.current.duration) {
      const newTime = (percent / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(percent);
    }
  }, []);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    speak,
    stop,
    seek,
    isSpeaking,
    currentText,
    progress,
    duration,
    currentTime,
    formatTime
  };
}

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Fallback to Web Speech API
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'English': 'en-US',
  'Spanish': 'es-ES',
  'French': 'fr-FR',
  'German': 'de-DE',
  'Portuguese': 'pt-BR',
  'Japanese': 'ja-JP',
  'Korean': 'ko-KR',
  'Chinese': 'zh-CN',
  'Hindi': 'hi-IN',
  'Italian': 'it-IT',
  'Russian': 'ru-RU',
  'Arabic': 'ar-SA',
  'Indonesian': 'id-ID',
  'Turkish': 'tr-TR',
  'Vietnamese': 'vi-VN',
};

function fallbackToWebSpeech(text: string, language: string) {
  if (!window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANGUAGE_CODE_MAP[language] || 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
