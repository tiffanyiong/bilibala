import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioData: string) => void;
  onCancel: () => void;
}

enum RecorderState {
    IDLE,
    RECORDING,
    PAUSED,
    REVIEW
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, onCancel }) => {
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [isDark, setIsDark] = useState(false);
  
  // Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const base64Ref = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Timer Accuracy Refs
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);

  const isMountedRef = useRef(true);

  // 1. Mount/Unmount & Analyze Button Animation
  useEffect(() => {
    isMountedRef.current = true;
    startRecording();
    
    // Breathing animation for Analyze button
    const interval = setInterval(() => setIsDark(d => !d), 2000);
    
    return () => {
      isMountedRef.current = false;
      stopRecordingCleanup();
      clearInterval(interval);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // 2. Timer Logic (Fixed)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (recorderState === RecorderState.RECORDING) {
      // Calculate elapsed time based on Date.now() to avoid drift from visualizer lag
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current - pausedDurationRef.current;
        setDuration(Math.max(0, Math.floor(elapsed / 1000)));
      }, 100); // Check every 100ms for responsiveness, but display seconds
    } else if (recorderState === RecorderState.REVIEW && isPlaying) {
        // Playback timer
        interval = setInterval(() => {
            if (audioRef.current) {
                setDuration(audioRef.current.currentTime);
            }
        }, 100);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [recorderState, isPlaying]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!isMountedRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
      }

      streamRef.current = stream;
      setPermissionError(false);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      
      // -- Reset Timer Refs --
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      pauseStartTimeRef.current = 0;
      
      setRecorderState(RecorderState.RECORDING);
      setDuration(0);
      setupVisualizer(stream);

    } catch (err) {
      if (isMountedRef.current) {
          console.error("Microphone permission denied:", err);
          setPermissionError(true);
      }
    }
  };

  const togglePause = () => {
      if (mediaRecorderRef.current) {
          if (recorderState === RecorderState.RECORDING) {
              // --- PAUSING ---
              mediaRecorderRef.current.pause();
              setRecorderState(RecorderState.PAUSED);
              pauseStartTimeRef.current = Date.now(); // Mark when we paused
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          } else if (recorderState === RecorderState.PAUSED) {
              // --- RESUMING ---
              mediaRecorderRef.current.resume();
              setRecorderState(RecorderState.RECORDING);
              
              // Calculate how long we were paused and add to total ignored time
              const timeSpentPaused = Date.now() - pauseStartTimeRef.current;
              pausedDurationRef.current += timeSpentPaused;
              
              drawVisualizer();
          }
      }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED)) {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/mp3' }); 
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          base64Ref.current = base64data.split(',')[1];
        };

        setRecorderState(RecorderState.REVIEW);
        setDuration(0); // Reset for playback
      };
      mediaRecorderRef.current.stop();
      stopRecordingCleanup();
    }
  };

  const stopRecordingCleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
        }
        audioContextRef.current = null;
    }
  };

  const handleSubmit = () => {
      if (base64Ref.current) onRecordingComplete(base64Ref.current);
  };

  const handleRetake = () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      base64Ref.current = null;
      setDuration(0);
      setIsPlaying(false);
      
      // Clean up previous context before starting new
      stopRecordingCleanup();
      startRecording();
  };

  const togglePlayback = () => {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
          setIsPlaying(!isPlaying);
      }
  };

  const handleAudioEnded = () => {
      setIsPlaying(false);
      setDuration(0); 
      if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const setupVisualizer = async (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64; 
      
      drawVisualizer();
    } catch (err) {
      console.error("AudioContext error:", err);
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      
      // Stop drawing if we aren't recording anymore
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          animationFrameRef.current = requestAnimationFrame(draw);
      }
      
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 3;
      const gap = 2;
      
      const totalWidth = bufferLength * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;
      let x = startX;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = Math.max(2, (val / 255) * canvas.height);
        
        ctx.fillStyle = '#1c1917'; // stone-900
        
        // Simple fillRect for compatibility
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        
        x += barWidth + gap;
      }
    };
    draw();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 py-4 animate-in fade-in duration-300">
        <audio 
            ref={audioRef} 
            src={audioUrl || undefined} 
            onEnded={handleAudioEnded}
            className="hidden"
        />
        
        {/* Visualizer & Timer */}
        <div className="flex items-center gap-6">
            <div className={`w-3 h-3 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500 animate-pulse' : recorderState === RecorderState.REVIEW ? 'bg-green-500' : 'bg-amber-400'}`}></div>
            
            <div className="h-10 w-48 flex items-center justify-center">
                {permissionError ? (
                    <span className="text-red-500 text-xs">Microphone Error</span>
                ) : recorderState === RecorderState.REVIEW ? (
                    <div className="flex items-center justify-center gap-1 h-full w-full opacity-50">
                       {[...Array(20)].map((_, i) => (
                           <div key={i} className="w-1 bg-stone-800 rounded-full" style={{ height: Math.max(4, Math.random() * 30) + 'px' }}></div>
                       ))}
                    </div>
                ) : (
                    <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />
                )}
            </div>

            <div className="font-mono text-xl font-medium text-stone-800 tabular-nums">
                {formatTime(duration)}
            </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 items-center w-full max-w-sm gap-4">
            {/* Left Button: Cancel / Retake */}
            <div className="justify-self-end">
                <button 
                    onClick={recorderState === RecorderState.REVIEW ? handleRetake : onCancel}
                    className="text-stone-400 hover:text-stone-600 transition-colors p-2"
                    title={recorderState === RecorderState.REVIEW ? "Retake" : "Cancel"}
                >
                    {recorderState === RecorderState.REVIEW ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    )}
                </button>
            </div>

            {/* Center Button: Stop / Play / Pause */}
            <div className="justify-self-center">
                <button 
                    onClick={recorderState === RecorderState.REVIEW ? togglePlayback : stopRecording}
                    className="w-24 h-24 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100"
                    title={recorderState === RecorderState.REVIEW ? (isPlaying ? "Pause" : "Play Recording") : "Finish Recording"}
                >
                    {recorderState === RecorderState.REVIEW ? (
                        isPlaying ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z" /></svg>
                        )
                    ) : (
                        <div className="w-8 h-8 bg-white rounded-md"></div>
                    )}
                </button>
            </div>

            {/* Right Button: Pause / Analyze */}
            <div className="justify-self-start">
                {recorderState === RecorderState.REVIEW ? (
                    <button 
                        onClick={handleSubmit}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-full font-medium text-sm transition-colors duration-[2000ms] shadow-md border border-transparent ${isDark ? 'bg-black border-stone-800' : 'bg-stone-500 border-stone-400'}`}
                        title="Analyze Answer"
                    >
                        <span>Analyze</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                ) : (
                    <button 
                        onClick={togglePause}
                        className={`text-stone-400 hover:text-stone-600 transition-colors p-2 ${recorderState === RecorderState.PAUSED ? 'text-amber-500' : ''}`}
                        title={recorderState === RecorderState.PAUSED ? "Resume" : "Pause"}
                    >
                        {recorderState === RecorderState.PAUSED ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        )}
                    </button>
                )}
            </div>
        </div>
        
        <p className="text-stone-400 text-xs font-medium tracking-wide uppercase">
            {recorderState === RecorderState.PAUSED ? "Recording Paused" : 
             recorderState === RecorderState.REVIEW ? "Review Your Answer" : 
             "Listening..."}
        </p>
    </div>
  );
};

export default AudioRecorder;