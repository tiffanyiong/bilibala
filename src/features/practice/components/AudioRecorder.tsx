import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioData: string) => void;
  onCancel: () => void;
  isMinimized?: boolean;            
  onToggleMinimize?: () => void;
  dragHeaderProps?: any;
  defaultTitle?: string;
}

enum RecorderState {
    IDLE,
    RECORDING,
    PAUSED,
    REVIEW
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
    onRecordingComplete, 
    onCancel,
    isMinimized = false, 
    onToggleMinimize,
    dragHeaderProps,
    defaultTitle = "Record Answer"
}) => {
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Stream Refs
  const streamRef = useRef<MediaStream | null>(null);
  const visualizerStreamRef = useRef<MediaStream | null>(null);
  
  // Data Refs
  const base64Ref = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);

  // --- NEW: State Ref to fix animation freezing ---
  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    startRecording();
    return () => {
      isMountedRef.current = false;
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // Visualizer redraw on resize
  useEffect(() => {
      if (recorderState === RecorderState.RECORDING) {
          setTimeout(() => drawVisualizer(), 100);
      }
  }, [isMinimized]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recorderState === RecorderState.RECORDING) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current - pausedDurationRef.current;
        setDuration(Math.max(0, Math.floor(elapsed / 1000)));
      }, 100);
    } else if (recorderState === RecorderState.REVIEW && isPlaying) {
        interval = setInterval(() => {
            if (audioRef.current) {
                setDuration(audioRef.current.currentTime);
            }
        }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [recorderState, isPlaying]);

  const startRecording = async () => {
    try {
      await stopRecordingCleanup();

      // 1. Get Microphone Stream
      const rawStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
            echoCancellation: true, 
            noiseSuppression: true,
            autoGainControl: true // Added back for better levels
        } 
      });

      if (!isMountedRef.current) {
          rawStream.getTracks().forEach(track => track.stop());
          return;
      }
      
      streamRef.current = rawStream;
      setPermissionError(false);

      // 2. Setup Recording
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'; 
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'; 
      }

      const mediaRecorder = new MediaRecorder(rawStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();

      // 3. Update States
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      
      // --- CRITICAL FIX: Update Ref Synchronously ---
      isRecordingRef.current = true;
      setRecorderState(RecorderState.RECORDING);
      setDuration(0);

      // 4. Setup Visualizer (Clone stream)
      setupVisualizer(rawStream.clone());

    } catch (err) {
      if (isMountedRef.current) {
          console.error("Microphone error:", err);
          setPermissionError(true);
      }
    }
  };

  const setupVisualizer = async (visStream: MediaStream) => {
      try {
        visualizerStreamRef.current = visStream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        if (audioContext.state === 'suspended') await audioContext.resume();

        const source = audioContext.createMediaStreamSource(visStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; 
        analyser.smoothingTimeConstant = 0.4; // Slightly more responsive
        analyserRef.current = analyser;
        
        source.connect(analyser); 
        
        drawVisualizer();
      } catch (e) {
          console.error("Visualizer setup failed", e);
      }
  };

  const togglePause = () => {
    if (recorderState === RecorderState.RECORDING) {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.pause();
        if (audioContextRef.current?.state === 'running') audioContextRef.current.suspend();
        
        isRecordingRef.current = false; // Stop animation
        setRecorderState(RecorderState.PAUSED);
        pauseStartTimeRef.current = Date.now();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else if (recorderState === RecorderState.PAUSED) {
        if (mediaRecorderRef.current?.state === 'paused') mediaRecorderRef.current.resume();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        
        isRecordingRef.current = true; // Resume animation
        setRecorderState(RecorderState.RECORDING);
        pausedDurationRef.current += (Date.now() - pauseStartTimeRef.current);
        drawVisualizer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED)) {
      mediaRecorderRef.current.onstop = () => {
        const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type }); 
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const result = reader.result as string;
          base64Ref.current = result.split(',')[1];
        };

        setRecorderState(RecorderState.REVIEW);
        setDuration(0);
        isRecordingRef.current = false; // Stop animation
        
        if (isMinimized && onToggleMinimize) onToggleMinimize(); 

        stopMicOnly(); 
      };
      
      mediaRecorderRef.current.stop();
    }
  };

  const stopMicOnly = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
              track.stop();
              track.enabled = false;
          });
          streamRef.current = null;
      }
      if (visualizerStreamRef.current) {
          visualizerStreamRef.current.getTracks().forEach(track => {
              track.stop();
              track.enabled = false;
          });
          visualizerStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(console.error);
          audioContextRef.current = null;
      }
  };

  const stopRecordingCleanup = async () => {
    isRecordingRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
    }
    stopMicOnly();
  };

  const handleSubmit = () => {
      if (base64Ref.current) onRecordingComplete(base64Ref.current);
  };

  const handleRetake = async () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setDuration(0);
      setIsPlaying(false);
      await stopRecordingCleanup();
      startRecording();
  };

  const togglePlayback = () => {
      if (audioRef.current && audioUrl) {
          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.volume = 1.0;
              audioRef.current.muted = false;
              audioRef.current.play().catch(e => console.error("Playback failed:", e));
          }
          setIsPlaying(!isPlaying);
      }
  };

  const handleAudioEnded = () => {
      setIsPlaying(false);
      setDuration(0); 
      if (audioRef.current) audioRef.current.currentTime = 0;
  };

// --- SOFT & CLEAN VISUALIZER --- audio wave
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Ensure accurate sizing
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    
    const draw = () => {
      // Check ref to ensure we stop drawing when needed
      if (!isRecordingRef.current) return;
      if (!analyserRef.current || !canvasRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // --- CONFIGURATION ---
      const barWidth = 4;   // Keep standard width
      const gap = 5;        // More air between bars (cleaner look)
      const maxBars = Math.floor(rect.width / (barWidth + gap));
      const barsToDraw = Math.min(maxBars, 20); // Limit bars for minimal look
      
      const totalWaveWidth = (barsToDraw * barWidth) + ((barsToDraw - 1) * gap);
      let x = (rect.width - totalWaveWidth) / 2;

      const step = Math.floor(bufferLength / barsToDraw) || 1;

      for (let i = 0; i < barsToDraw; i++) {
        let val = dataArray[i * step];
        
        // --- 1. GENTLER SENSITIVITY ---
        // Previous was 2.2 (Too intense). 
        // We use 1.2 to give it life without looking "angry".
        val = Math.min(255, val * 1.2); 

        // --- 2. CONTROLLED HEIGHT ---
        const percent = val / 255;
        // Max height is now 70% of container (0.7), so it never hits the edges.
        // Min height is 5px so it never disappears completely.
        const h = Math.max(5, (percent * rect.height * 0.7)); 
        
        // --- 3. COLORS ---
        if (isMinimized) {
            ctx.fillStyle = '#a8a29e';
        } else {
             // Dark only when distinct sound is detected
            ctx.fillStyle = val > 80 ? '#1c1917' : '#d6d3d1'; 
        }

        const y = (rect.height - h) / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, h, 50); // Full rounded pill
        } else {
            ctx.fillRect(x, y, barWidth, h);
        }
        ctx.fill();

        x += barWidth + gap;
      }
    };
    draw();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (isMinimized) {
    return (
        <div className="w-full h-full flex items-center justify-between px-5 text-white">
             <audio ref={audioRef} src={audioUrl || undefined} onEnded={handleAudioEnded} className="hidden" />
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-red-500/60 shadow-lg"></div>
                <span className="font-mono text-lg font-medium tracking-wide">{formatTime(duration)}</span>
            </div>
            <div className="flex-1 max-w-[120px] h-8 mx-4 opacity-80"><canvas ref={canvasRef} className="w-full h-full" /></div>
            <div className="flex items-center gap-3">
                <button onClick={stopRecording} className="w-8 h-8 bg-white text-stone-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-6 relative">
        <audio ref={audioRef} src={audioUrl || undefined} onEnded={handleAudioEnded} className="hidden" />
        
        <div {...dragHeaderProps} className={`w-full flex flex-col items-center justify-center relative ${dragHeaderProps ? 'cursor-move' : ''}`}>
             <div className="text-center w-full">
                <h3 className="text-xl font-serif text-stone-800 font-bold">
                    {recorderState === RecorderState.REVIEW ? "Review Answer" : defaultTitle}
                </h3>
                <p className="text-stone-500 text-sm mt-1">
                    {recorderState === RecorderState.REVIEW ? "Tap analyze when ready." : (defaultTitle === "Record Answer" ? "Take your time." : "Try to incorporate the feedback.")}
                </p>
             </div>
        </div>

        <div className="relative w-full flex flex-col items-center gap-2 py-4">
            <div className="flex items-center gap-6">
                <div className={`w-3 h-3 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500 animate-pulse' : recorderState === RecorderState.REVIEW ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                <div className="h-12 w-48 flex items-center justify-center">
                    {permissionError ? <span className="text-red-500 text-xs">Microphone Error</span> : recorderState === RecorderState.REVIEW ? (
                        <div className="flex items-center justify-center gap-1 h-full w-full">
                        {[...Array(24)].map((_, i) => <div key={i} className="w-1 bg-stone-300 rounded-full" style={{ height: Math.max(6, Math.random() * 24) + 'px' }}></div>)}
                        </div>
                    ) : <canvas ref={canvasRef} className="w-full h-full" />}
                </div>
                <div className="font-mono text-xl font-medium text-stone-800 tabular-nums">{formatTime(duration)}</div>
            </div>
        </div>

        <div className="grid grid-cols-3 items-center w-full max-w-sm gap-4">
            <div className="justify-self-end">
                <button onClick={recorderState === RecorderState.REVIEW ? handleRetake : onCancel} className="text-stone-400 hover:text-stone-600 transition-colors p-2">
                    {recorderState === RecorderState.REVIEW ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
                </button>
            </div>
            <div className="justify-self-center">
                <button onClick={recorderState === RecorderState.REVIEW ? togglePlayback : stopRecording} className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100">
                    {recorderState === RecorderState.REVIEW ? (isPlaying ? <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z" /></svg>) : <div className="w-8 h-8 bg-white rounded-md"></div>}
                </button>
            </div>
            <div className="justify-self-start">
                {recorderState === RecorderState.REVIEW ? (
                    <button onClick={handleSubmit} className="flex items-center gap-2 px-4 py-2 text-white rounded-full font-medium text-sm transition-colors duration-[2000ms] shadow-md border border-transparent bg-stone-900">
                        <span>Analyze</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                ) : (
                    <button onClick={togglePause} className={`text-stone-400 hover:text-stone-600 transition-colors p-2 ${recorderState === RecorderState.PAUSED ? 'text-amber-500' : ''}`}>
                        {recorderState === RecorderState.PAUSED ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default AudioRecorder;