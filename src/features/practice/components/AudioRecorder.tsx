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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const base64Ref = useRef<string | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recorderState === RecorderState.RECORDING) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recorderState]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionError(false);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRecorderState(RecorderState.RECORDING);
      setupVisualizer(stream);

    } catch (err) {
      console.error("Microphone permission denied:", err);
      setPermissionError(true);
    }
  };

  const togglePause = () => {
      if (mediaRecorderRef.current) {
          if (recorderState === RecorderState.RECORDING) {
              mediaRecorderRef.current.pause();
              setRecorderState(RecorderState.PAUSED);
              if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          } else if (recorderState === RecorderState.PAUSED) {
              mediaRecorderRef.current.resume();
              setRecorderState(RecorderState.RECORDING);
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
      audioContextRef.current.close();
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
      startRecording();
  };

  const setupVisualizer = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyserRef.current = analyser;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64; // Smaller FFT for simpler bars
    drawVisualizer();
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || (recorderState !== RecorderState.RECORDING && recorderState !== RecorderState.IDLE)) return;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          animationFrameRef.current = requestAnimationFrame(draw);
      }
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 3;
      const gap = 2;
      let x = 0;

      // Center the bars
      const totalWidth = bufferLength * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;
      x = startX;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        // Simple elegant bars
        ctx.fillStyle = '#1c1917'; // stone-900
        // Rounded bars
        ctx.beginPath();
        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight, 2);
        ctx.fill();
        x += barWidth + gap;
      }
    };
    draw();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. REVIEW STATE
  if (recorderState === RecorderState.REVIEW) {
      return (
        <div className="w-full max-w-lg mx-auto bg-white rounded-xl border border-stone-200 p-4 shadow-sm animate-in fade-in zoom-in duration-200">
             <div className="flex items-center gap-4">
                 {audioUrl && <audio controls src={audioUrl} className="flex-1 h-10" />}
                 <div className="flex gap-2 shrink-0">
                     <button onClick={handleRetake} className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors">
                        Retake
                     </button>
                     <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-black transition-all shadow-md">
                        Analyze
                     </button>
                 </div>
             </div>
        </div>
      );
  }

  // 2. RECORDING STATE (Minimal Design)
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 py-4 animate-in fade-in duration-300">
        
        {/* Visualizer & Timer */}
        <div className="flex items-center gap-6">
            <div className={`w-3 h-3 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></div>
            
            <div className="h-10 w-48 flex items-center justify-center">
                {permissionError ? (
                    <span className="text-red-500 text-xs">Microphone Error</span>
                ) : (
                    <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />
                )}
            </div>

            <div className="font-mono text-xl font-medium text-stone-800 tabular-nums">
                {formatTime(duration)}
            </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8">
            <button 
                onClick={onCancel}
                className="text-stone-400 hover:text-stone-600 transition-colors p-2"
                title="Cancel"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* Main Stop Button */}
            <button 
                onClick={stopRecording}
                className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100"
                title="Finish Recording"
            >
                <div className="w-6 h-6 bg-white rounded-sm"></div>
            </button>

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
        </div>
        
        <p className="text-stone-400 text-xs font-medium tracking-wide uppercase">
            {recorderState === RecorderState.PAUSED ? "Recording Paused" : "Listening..."}
        </p>
    </div>
  );
};

export default AudioRecorder;
