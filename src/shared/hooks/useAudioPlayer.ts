import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioPlayer(audioUrl?: string | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [duration, setDuration] = useState(0); // in seconds
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element when URL changes
  useEffect(() => {
    if (!audioUrl) {
      // Clean up if no URL
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setDuration(0);
      setCurrentTime(0);
      return;
    }

    // Create new audio element
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setCurrentTime(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      }, 500);
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
    };
  }, [audioUrl]);

  // Update progress during playback
  useEffect(() => {
    if (!isPlaying) return;

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
  }, [isPlaying]);

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setIsPaused(false);
      } catch (error) {
        console.error('Audio play error:', error);
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
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
    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    isPlaying,
    isPaused,
    progress,
    duration,
    currentTime,
    formatTime
  };
}
