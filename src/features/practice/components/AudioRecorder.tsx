import React, { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioData: string) => void;
  onCancel: () => void;
  isMinimized?: boolean;            
  onToggleMinimize?: () => void;
  // This prop allows the parent (PyramidFeedback) to hook into the header for dragging
  dragHeaderProps?: any; 
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
    dragHeaderProps
}) => {
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
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const base64Ref = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Timer Accuracy Refs
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);

  const isMountedRef = useRef(true);

  // 1. Initialize
  useEffect(() => {
    isMountedRef.current = true;
    startRecording();
    const interval = setInterval(() => setIsDark(d => !d), 2000);
    
    return () => {
      isMountedRef.current = false;
      stopRecordingCleanup();
      clearInterval(interval);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // 2. Redraw visualizer when minimizing/expanding to fix canvas size
  useEffect(() => {
      if (recorderState === RecorderState.RECORDING) {
          setTimeout(() => drawVisualizer(), 100);
      }
  }, [isMinimized]);

  // 3. Timer
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

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // CRITICAL: Force Resume to prevent silence
      if (audioContext.state === 'suspended') {
          await audioContext.resume();
      }

      const rawStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1, 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
      });

      if (!isMountedRef.current) {
          rawStream.getTracks().forEach(track => track.stop());
          return;
      }
      streamRef.current = rawStream;
      setPermissionError(false);

      const source = audioContext.createMediaStreamSource(rawStream);
      sourceNodeRef.current = source;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; 
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;
      
      const destination = audioContext.createMediaStreamDestination();
      // mediaStreamDestinationRef.current = destination;

      source.connect(analyser);
      source.connect(destination);

      const processedStream = destination.stream;
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(processedStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      pauseStartTimeRef.current = 0;
      
      setRecorderState(RecorderState.RECORDING);
      setDuration(0);
      
      drawVisualizer();
    } catch (err) {
      if (isMountedRef.current) {
          console.error("Microphone permission denied:", err);
          setPermissionError(true);
      }
    }
  };

  const togglePause = async () => {
    if (audioContextRef.current) {
        if (recorderState === RecorderState.RECORDING) {
            await audioContextRef.current.suspend();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.pause();
            }
            setRecorderState(RecorderState.PAUSED);
            pauseStartTimeRef.current = Date.now();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            
        } else if (recorderState === RecorderState.PAUSED) {
            await audioContextRef.current.resume();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
                mediaRecorderRef.current.resume();
            }
            setRecorderState(RecorderState.RECORDING);
            const timeSpentPaused = Date.now() - pauseStartTimeRef.current;
            pausedDurationRef.current += timeSpentPaused;
            drawVisualizer();
        }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED)) {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          base64Ref.current = base64data.split(',')[1];
        };

        setRecorderState(RecorderState.REVIEW);
        setDuration(0);
        
        // Auto-expand on finish
        if (isMinimized && onToggleMinimize) onToggleMinimize(); 
      };
      mediaRecorderRef.current.stop();
      stopMicOnly();
    }
  };

  const stopMicOnly = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const stopRecordingCleanup = async () => {
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
    }
    if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
        try {
            if (audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
            }
        } catch (e) { console.error("Error closing context", e); }
        audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
      });
      streamRef.current = null;
    }
  };

  const handleSubmit = () => {
      if (base64Ref.current) onRecordingComplete(base64Ref.current);
  };

  const handleRetake = async () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      base64Ref.current = null;
      setDuration(0);
      setIsPlaying(false);
      await stopRecordingCleanup();
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

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI canvas scaling
    if (canvas.width !== canvas.clientWidth * 2) {
        canvas.width = canvas.clientWidth * 2;
        canvas.height = canvas.clientHeight * 2;
        ctx.scale(2, 2);
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      
      if (recorderState === RecorderState.RECORDING || (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording')) {
          animationFrameRef.current = requestAnimationFrame(draw);
      }
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      
      ctx.clearRect(0, 0, width, height);

      const barWidth = 4; 
      const gap = 3;      
      const totalBarWidth = barWidth + gap;
      
      const numBarsToDraw = Math.floor(width / totalBarWidth);
      const dataStep = Math.floor(bufferLength / numBarsToDraw) || 1;
      
      let x = (width - (numBarsToDraw * totalBarWidth)) / 2; 

      for (let i = 0; i < numBarsToDraw; i++) {
        const val = dataArray[i * dataStep];
        const activeColor = isMinimized ? '#a8a29e' : '#1c1917'; 
        
        let barHeight = Math.max(4, (val / 255) * height * 0.8);
        
        ctx.fillStyle = isMinimized ? '#57534e' : '#d6d3d1'; 
        if (val > 100) ctx.fillStyle = activeColor;

        const y = (height - barHeight) / 2;
        
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 50); 
            ctx.fill();
        } else {
            ctx.fillRect(x, y, barWidth, barHeight);
        }

        x += totalBarWidth;
      }
    };
    draw();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- MINIMIZED VIEW ---
  if (isMinimized) {
    return (
        <div className="w-full h-full flex items-center justify-between px-5 text-white">
             <audio 
                ref={audioRef} 
                src={audioUrl || undefined} 
                onEnded={handleAudioEnded}
                className="hidden"
            />
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                <span className="font-mono text-lg font-medium tracking-wide">{formatTime(duration)}</span>
            </div>

            <div className="flex-1 max-w-[120px] h-8 mx-4 opacity-80">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={stopRecording}
                    className="w-8 h-8 bg-white text-stone-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                </button>
                {onToggleMinimize && (
                    <button onClick={onToggleMinimize} className="p-1.5 text-stone-400 hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    </button>
                )}
            </div>
        </div>
    );
  }

  // --- EXPANDED VIEW ---
  return (
    <div className="w-full flex flex-col items-center gap-6 relative">
        <audio 
            ref={audioRef} 
            src={audioUrl || undefined} 
            onEnded={handleAudioEnded}
            className="hidden"
        />
        
        {/* HEADER: Title + Drag Handle + Minimize Button */}
        <div 
            {...dragHeaderProps} // Make this header draggable on desktop
            className={`w-full flex justify-between items-start relative ${dragHeaderProps ? 'cursor-move' : ''}`}
        >
             {/* <div className="text-center w-full">
                {recorderState === RecorderState.REVIEW ? (
                    <h3 className="text-xl font-serif text-stone-800 font-bold">Review Answer</h3>
                ) : (
                    <h3 className="text-xl font-serif text-stone-800 font-bold">Record Answer Again page two</h3>
                )}
                <p className="text-stone-500 text-sm mt-1">
                    {recorderState === RecorderState.REVIEW ? "Tap analyze when ready." : "Try to incorporate the feedback."}
                </p>
             </div> */}
             
             {/* Minimize Icon - CORRECTED POSITION (Inside the header) */}
             {onToggleMinimize && (
                <button 
                    // Stop propagation so clicking button doesn't trigger drag
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={onToggleMinimize}
                    className="absolute right-0 top-0 p-1 text-stone-400 hover:text-stone-600 transition-colors"
                    title="Minimize"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>
                    </svg>
                </button>
             )}
        </div>

        <div className="relative w-full flex flex-col items-center gap-2 py-4">
            <div className="flex items-center gap-6">
                <div className={`w-3 h-3 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500 animate-pulse' : recorderState === RecorderState.REVIEW ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                <div className="h-12 w-48 flex items-center justify-center">
                    {permissionError ? (
                        <span className="text-red-500 text-xs">Microphone Error</span>
                    ) : recorderState === RecorderState.REVIEW ? (
                        <div className="flex items-center justify-center gap-1 h-full w-full">
                        {[...Array(24)].map((_, i) => (
                            <div key={i} className="w-1 bg-stone-300 rounded-full" style={{ height: Math.max(4, Math.random() * 24) + 'px' }}></div>
                        ))}
                        </div>
                    ) : (
                        <canvas ref={canvasRef} className="w-full h-full" />
                    )}
                </div>
                <div className="font-mono text-xl font-medium text-stone-800 tabular-nums">
                    {formatTime(duration)}
                </div>
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