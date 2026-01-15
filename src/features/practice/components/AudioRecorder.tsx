import React, { useEffect, useRef, useState } from 'react';
import { audioConfig } from '../config/audioConfig';

interface AudioRecorderProps {
  onRecordingComplete: (audioData: string) => void;
  onCancel: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  defaultTitle?: string;
  autoStart?: boolean;
  labels?: any;
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
    defaultTitle = "Record Answer",
    autoStart = true,
    labels = {} //  Default to empty object to prevent crashes
}) => {
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNearLimit, setIsNearLimit] = useState(false);
  const t = (key: string, fallback: string) => labels[key] || fallback;

  // Config values
  const maxDuration = audioConfig.recording.maxDurationSeconds;
  const warningThreshold = audioConfig.recording.warningThresholdSeconds;
  
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

  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    if (autoStart) {
      startRecording();
    }
    return () => {
      isMountedRef.current = false;
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // Visualizer redraw on resize/view change
  useEffect(() => {
      if (recorderState === RecorderState.RECORDING) {
          const timer = setTimeout(() => {
              drawVisualizer();
          }, 50);
          return () => clearTimeout(timer);
      }
  }, [isMinimized, recorderState]);

  // Timer with time limit check
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recorderState === RecorderState.RECORDING) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current - pausedDurationRef.current;
        const currentDuration = Math.max(0, Math.floor(elapsed / 1000));
        setDuration(currentDuration);

        // Check if approaching limit (warning)
        const timeRemaining = maxDuration - currentDuration;
        setIsNearLimit(timeRemaining <= warningThreshold && timeRemaining > 0);

        // Auto-stop when max duration reached
        if (audioConfig.recording.autoStopOnMaxDuration && currentDuration >= maxDuration) {
          stopRecording();
        }
      }, audioConfig.ui.timerIntervalMs);
    } else if (recorderState === RecorderState.REVIEW && isPlaying) {
        interval = setInterval(() => {
            if (audioRef.current) {
                setDuration(audioRef.current.currentTime);
            }
        }, audioConfig.ui.timerIntervalMs);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [recorderState, isPlaying, maxDuration, warningThreshold]);

  const startRecording = async () => {
    try {
      await stopRecordingCleanup();
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: audioConfig.quality.echoCancellation,
          noiseSuppression: audioConfig.quality.noiseSuppression,
          autoGainControl: audioConfig.quality.autoGainControl
        }
      });

      if (!isMountedRef.current) {
          rawStream.getTracks().forEach(track => track.stop());
          return;
      }
      
      streamRef.current = rawStream;
      setPermissionError(false);

      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm'; 
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'; 

      const mediaRecorder = new MediaRecorder(rawStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      isRecordingRef.current = true;
      setRecorderState(RecorderState.RECORDING);
      setDuration(0);

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
        analyser.fftSize = audioConfig.visualizer.fftSize;
        analyser.smoothingTimeConstant = audioConfig.visualizer.smoothingTimeConstant;
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
        isRecordingRef.current = false; 
        setRecorderState(RecorderState.PAUSED);
        pauseStartTimeRef.current = Date.now();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else if (recorderState === RecorderState.PAUSED) {
        if (mediaRecorderRef.current?.state === 'paused') mediaRecorderRef.current.resume();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        isRecordingRef.current = true;
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
        isRecordingRef.current = false; 
        stopMicOnly();
      };
      mediaRecorderRef.current.stop();
    }
  };

  const stopMicOnly = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => { track.stop(); track.enabled = false; });
          streamRef.current = null;
      }
      if (visualizerStreamRef.current) {
          visualizerStreamRef.current.getTracks().forEach(track => { track.stop(); track.enabled = false; });
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
      if (base64Ref.current) {
          onRecordingComplete(base64Ref.current);
          return;
      }
      if (chunksRef.current.length > 0) {
          const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                  const base64 = reader.result.split(',')[1];
                  base64Ref.current = base64;
                  onRecordingComplete(base64);
              }
          };
      }
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

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) return;
      if (!analyserRef.current || !canvasRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const barWidth = 4;
      const gap = 5;
      const maxBars = Math.floor(rect.width / (barWidth + gap));
      const barsToDraw = Math.min(maxBars, audioConfig.visualizer.maxBars); 
      const totalWaveWidth = (barsToDraw * barWidth) + ((barsToDraw - 1) * gap);
      let x = (rect.width - totalWaveWidth) / 2;
      const step = Math.floor(bufferLength / barsToDraw) || 1;

      for (let i = 0; i < barsToDraw; i++) {
        let val = dataArray[i * step];
        val = Math.min(255, val * 1.2); 
        const percent = val / 255;
        const h = Math.max(5, (percent * rect.height * 0.7)); 
        
        ctx.fillStyle = isMinimized ? '#a8a29e' : (val > 80 ? '#1c1917' : '#d6d3d1');
        const y = (rect.height - h) / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barWidth, h, 50);
        else ctx.fillRect(x, y, barWidth, h);
        ctx.fill();
        x += barWidth + gap;
      }
    };
    draw();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // --- RENDER FUNCTIONS ---

  const renderMinimized = () => (
    <div className="w-full h-full flex items-center justify-between px-5 text-white">
        {/* LEFT: IDLE (Mic) OR Status Indicator */}
        {recorderState === RecorderState.IDLE ? (
            <button onClick={startRecording} className="w-8 h-8 bg-white text-stone-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform" title="Start Recording">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
        ) : (
            <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${
                    recorderState === RecorderState.RECORDING ? (isNearLimit ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse') :
                    recorderState === RecorderState.PAUSED ? 'bg-amber-400' :
                    'bg-green-500'
                }`}></div>
                <span className={`font-mono text-lg font-medium tracking-wide ${isNearLimit ? 'text-amber-400' : ''}`}>{formatTime(duration)}</span>
                {isNearLimit && <span className="text-amber-400 text-xs">({formatTime(maxDuration - duration)} left)</span>}
            </div>
        )}

        {/* MIDDLE: Visualizer (Recording Only) */}
        {recorderState === RecorderState.RECORDING && (
            <div className="flex-1 max-w-[120px] h-8 mx-4 opacity-80"><canvas ref={canvasRef} className="w-full h-full" /></div>
        )}
        
        {recorderState !== RecorderState.RECORDING && <div className="flex-1" />}

        {/* RIGHT: Action Buttons */}
        <div className="flex items-center gap-2">
            {(recorderState === RecorderState.RECORDING || recorderState === RecorderState.PAUSED) && (
                <>
                    <button onClick={togglePause} className={`p-1.5 transition-colors ${recorderState === RecorderState.PAUSED ? 'text-amber-400 hover:text-amber-200' : 'text-stone-400 hover:text-white'}`}>
                         {recorderState === RecorderState.PAUSED ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>}
                    </button>
                    <button onClick={stopRecording} className="w-8 h-8 bg-white text-stone-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                    </button>
                </>
            )}

            {recorderState === RecorderState.REVIEW && (
                <>
                    <button onClick={handleRetake} className="p-1.5 text-stone-400 hover:text-white transition-colors" title="Retake">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                    <button onClick={togglePlayback} className="w-8 h-8 bg-white text-stone-900 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                        {isPlaying ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="6" height="16" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>}
                    </button>
                </>
            )}

            {onToggleMinimize && recorderState !== RecorderState.IDLE && (
                <button onClick={onToggleMinimize} className="p-1.5 text-stone-400 hover:text-white transition-colors ml-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                </button>
            )}
        </div>
    </div>
  );

  const renderExpanded = () => (
    <div className="w-full flex flex-col items-center gap-6 relative">
         <div className="text-center w-full">
            <h3 className="text-xl font-serif text-stone-800 font-bold">
                {recorderState === RecorderState.REVIEW ? t('reviewAnswer', 'Review Answer') : defaultTitle}
            </h3>
            <p className="text-stone-500 text-sm mt-1">
                {recorderState === RecorderState.REVIEW ? t('tapAnalyze', 'Tap analyze when ready.') : (defaultTitle === t('recordAnswer', 'Record Answer') ? t('takeYourTime', 'Take your time.') : t('tryIncorporateFeedback', 'Try to incorporate the feedback.'))}
            </p>
         </div>

        <div className="relative w-full flex flex-col items-center gap-2 py-4">
            <div className="flex items-center gap-6">
                <div className={`w-3 h-3 rounded-full ${recorderState === RecorderState.RECORDING ? (isNearLimit ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse') : recorderState === RecorderState.REVIEW ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                <div className="h-12 w-48 flex items-center justify-center">
                    {permissionError ? <span className="text-red-500 text-xs">{t('microphoneError', 'Microphone Error')}</span> : recorderState === RecorderState.REVIEW ? (
                        <div className="flex items-center justify-center gap-1 h-full w-full">
                        {[...Array(24)].map((_, i) => <div key={i} className="w-1 bg-stone-300 rounded-full" style={{ height: Math.max(6, Math.random() * 24) + 'px' }}></div>)}
                        </div>
                    ) : <canvas ref={canvasRef} className="w-full h-full" />}
                </div>
                <div className={`font-mono text-xl font-medium tabular-nums ${isNearLimit ? 'text-amber-600' : 'text-stone-800'}`}>{formatTime(duration)}</div>
            </div>
            {isNearLimit && (
                <div className="text-amber-600 text-sm font-medium animate-pulse">
                    {formatTime(maxDuration - duration)} remaining
                </div>
            )}
        </div>

        <div className="grid grid-cols-3 items-center w-full max-w-sm gap-4">
            <div className="justify-self-end">
                {recorderState !== RecorderState.IDLE && (
                    <button onClick={recorderState === RecorderState.REVIEW ? handleRetake : onCancel} className="text-stone-400 hover:text-stone-600 transition-colors p-2" title={recorderState === RecorderState.REVIEW ? "Retake" : "Cancel"}>
                        {recorderState === RecorderState.REVIEW ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
                    </button>
                )}
            </div>
            <div className="justify-self-center">
                {recorderState === RecorderState.IDLE ? (
                    <button onClick={startRecording} className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>
                ) : (
                    <button onClick={recorderState === RecorderState.REVIEW ? togglePlayback : stopRecording} className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100">
                        {recorderState === RecorderState.REVIEW ? (isPlaying ? <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z" /></svg>) : <div className="w-8 h-8 bg-white rounded-md"></div>}
                    </button>
                )}
            </div>
            <div className="justify-self-start">
                {recorderState === RecorderState.REVIEW ? (
                    <button onClick={handleSubmit} className="p-2 hover:scale-110 transition-all">
                        <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="analyze-icon-pulse">
                            <path d="M4,23a1,1,0,0,1-1-1V19a1,1,0,0,1,2,0v3A1,1,0,0,1,4,23Zm9-1V15a1,1,0,0,0-2,0v7a1,1,0,0,0,2,0Zm7-11a1,1,0,0,0-1,1V22a1,1,0,0,0,2,0V12A1,1,0,0,0,20,11Zm.382-9.923A.991.991,0,0,0,20,1H16a1,1,0,0,0,0,2h1.586L12,8.586,8.707,5.293a1,1,0,0,0-1.414,0l-4,4a1,1,0,0,0,1.414,1.414L8,7.414l3.293,3.293a1,1,0,0,0,1.414,0L19,4.414V6a1,1,0,0,0,2,0V2a1,1,0,0,0-.618-.923Z"/>
                        </svg>
                    </button>
                ) : recorderState !== RecorderState.IDLE && (
                    <button onClick={togglePause} className={`text-stone-400 hover:text-stone-600 transition-colors p-2 ${recorderState === RecorderState.PAUSED ? 'text-amber-500' : ''}`}>
                        {recorderState === RecorderState.PAUSED ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>}
                    </button>
                )}
            </div>
        </div>
    </div>
  );

  return (
    <div className="audio-recorder-container">
        <audio ref={audioRef} src={audioUrl || undefined} onEnded={handleAudioEnded} className="hidden" />
        {isMinimized ? renderMinimized() : renderExpanded()}
    </div>
  );
};

export default AudioRecorder;