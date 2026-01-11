import React, { useEffect, useRef, useState } from 'react';
import { getBackendOrigin } from '../../../shared/services/backend';
import { generateConversationHints } from '../../../shared/services/geminiService';
import { HistoryItem, VocabularyItem } from '../../../shared/types';

// Components
import ControlBar from '../../../shared/components/ControlBar';
import { BackIcon } from '../../../shared/components/icons/LiveIcons';
import StatusPill from '../../../shared/components/StatusPill';
import Transcript from '../../chat/components/Transcript';
import DuckAvatar from './DuckAvatar';
import RescueRing from './RescueRing';

// DEV build tag
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn('[BilibalaLive] build=ws-fixed-v7-debug');
}

// --- INLINE AUDIO HELPERS (No external imports needed) ---
function base64ToArrayBuffer(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function createPcm16kArrayBuffer(inputData: Float32Array, sampleRate: number) {
    // Simple downsampling to 16kHz
    const targetSampleRate = 16000;
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.ceil(inputData.length / ratio);
    const result = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const inputIndex = Math.floor(i * ratio);
        // Clamp value between -1 and 1, then convert to PCM16
        const sample = Math.max(-1, Math.min(1, inputData[inputIndex]));
        result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return result.buffer;
}
// ---------------------------------------------------------

interface LiveVoiceInterfaceProps {
  videoTitle: string;
  videoUrl: string;
  summary: string;
  vocabulary: VocabularyItem[];
  nativeLang: string;
  targetLang: string;
  level: string;
  onSessionEnd?: () => void;
}

const LiveVoiceInterface: React.FC<LiveVoiceInterfaceProps> = ({ 
    videoTitle, 
    videoUrl, 
    summary, 
    vocabulary, 
    nativeLang, 
    targetLang, 
    level, 
    onSessionEnd 
}) => {
  const debug = import.meta.env.DEV;
  const dlog = (...args: any[]) => {
    if (!debug) return;
    console.log('[BilibalaLive]', ...args);
  };

  // --- UI States ---
  const [isConnected, setIsConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callEndedNote, setCallEndedNote] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // --- Transcript States ---
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [realtimeInput, setRealtimeInput] = useState('');
  const [realtimeOutput, setRealtimeOutput] = useState('');
  
  // --- Hint States ---
  const [hints, setHints] = useState<string[]>([]);
  const [isHintsLoading, setIsHintsLoading] = useState(false);
  
  const lastAiMessageRef = useRef<string>('');

  // --- Audio / Network Refs ---
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const isMutedRef = useRef(false);
  
  // Audio Scheduling Refs
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioQueueRef = useRef<Promise<void>>(Promise.resolve());
  
  const wsRef = useRef<WebSocket | null>(null);
  const pendingAudioRef = useRef<any[]>([]);
  
  const liveReadyRef = useRef(false);
  const isStoppingRef = useRef(false);
  const hasSetupCompleteRef = useRef(false);
  const mountedRef = useRef(true);
  const lastDurationRef = useRef(0);
  
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showEndNote = (opts?: { durationSecs?: number }) => {
    if (!mountedRef.current) return;
    const dur = opts?.durationSecs ?? lastDurationRef.current ?? durationSeconds;
    const durLabel = dur > 0 ? ` • ${formatDuration(dur)}` : '';
    const text = `Call ended${durLabel}.`;
    setError(null);
    setCallEndedNote(text);
  };

  // --- Effects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [history, realtimeInput, realtimeOutput]);

  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(() => {
        setDurationSeconds(prev => {
          const next = prev + 1;
          lastDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      setDurationSeconds(0);
      if (durationSeconds > 0) {
        lastDurationRef.current = durationSeconds;
      }
    }
    return () => clearInterval(interval);
  }, [isConnected, durationSeconds]);

  // 👇 ADD THIS LINE. It resurrects the component after Strict Mode kills it.
  mountedRef.current = true;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSession();
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleManualHint = async () => {
      if (!isConnected || isHintsLoading) return;
      
      setIsHintsLoading(true);
      setHints([]);

      let textToHint = lastAiMessageRef.current;
      
      if ((!textToHint || textToHint.length < 2) && history.length > 0) {
          const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
          if (lastModelMsg) textToHint = lastModelMsg.text;
      }

      if (!textToHint) {
          textToHint = "Hello! Nice to meet you.";
      }

      try {
          const newHints = await generateConversationHints(textToHint, targetLang, level);
          if (mountedRef.current) {
              setHints(newHints);
              setIsHintsLoading(false);
          }
      } catch (e) {
          console.error(e);
          if (mountedRef.current) setIsHintsLoading(false);
      }
  };

  const stopSession = () => {
    dlog('stopSession()');
    isStoppingRef.current = true;
    liveReadyRef.current = false;
    
    // Cancel any pending audio queue
    audioQueueRef.current = Promise.resolve();

    if (wsRef.current) {
        try { wsRef.current.send(JSON.stringify({ type: 'stop' })); } catch {}
        try { wsRef.current.close(); } catch(e) {}
        wsRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
        try { inputAudioContextRef.current.close(); } catch(e) {}
        inputAudioContextRef.current = null;
    }
    
    // Stop playing audio
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    
    if (outputAudioContextRef.current) {
        try { outputAudioContextRef.current.close(); } catch(e) {}
        outputAudioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    
    setIsConnected(false);
    setIsAiSpeaking(false);
    setIsAiThinking(false);
    
    setIsMuted(false);
    isMutedRef.current = false;
    
    currentInputRef.current = '';
    currentOutputRef.current = '';
    setRealtimeInput('');
    setRealtimeOutput('');
    
    setHints([]);
    setIsHintsLoading(false);
    pendingAudioRef.current = [];
    liveReadyRef.current = false;

    // Friendly end-call note
    showEndNote({ durationSecs: lastDurationRef.current || durationSeconds });
    
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 0);
  };

  const handleBack = () => {
    stopSession();
    if (onSessionEnd) {
        onSessionEnd();
    }
  };

  const startSession = async () => {
    // --- 1. PREVENT DOUBLE START ---
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.warn("⚠️ Session already active. Ignoring start request.");
        return; 
    }

    setError(null);
    setCallEndedNote(null);
    lastDurationRef.current = 0;
    setDurationSeconds(0);
    dlog('startSession() clicked');
    try {
      hasSetupCompleteRef.current = false;
      liveReadyRef.current = false;
      
      // Reset audio queue
      audioQueueRef.current = Promise.resolve();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass();
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      try {
        if (inputCtx.state === 'suspended') await inputCtx.resume();
        if (outputCtx.state === 'suspended') await outputCtx.resume();
      } catch (e) {
        console.warn("Context resume failed during init", e);
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        dlog('mic granted');
      } catch (micError) {
        console.error("Mic Error:", micError);
        if (mountedRef.current) setError("Microphone access denied or failed.");
        stopSession();
        return;
      }

      // Backend health check
      try {
        const health = await fetch(`${getBackendOrigin()}/healthz`, { method: 'GET' });
        if (!health.ok) throw new Error('health not ok');
      } catch {
        setError(
          `Backend server is not reachable at ${getBackendOrigin()}. Check your server connection.`
        );
        stopSession();
        return;
      }

      // FIX: Force IPv4 for WebSocket connection
      const wsUrl = `ws://127.0.0.1:3001/live`;
      console.log("Connecting to WS:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🔥 WebSocket OPENED! Sending start command...");
        
        // if (!mountedRef.current) return;
        // Don't set isConnected(true) here yet, wait for server ack

        // ✅ ADD THIS DEBUG LOG:
        console.log("Status: Mounted?", mountedRef.current);

        const startMsg = {
            type: 'start',
            payload: { videoTitle, summary, vocabulary, nativeLang, targetLang, level },
        };
        
        try {
            ws.send(JSON.stringify(startMsg));
            console.log("🚀 Start command SENT!"); 
        } catch (e) {
            console.error("❌ Failed to send start command:", e);
        }
      };

      ws.onmessage = async (ev) => {
        if (!mountedRef.current) return;
        
        // --- 2. ADDED DEBUG LOGGING ---
        console.log("📩 Received from Server:", ev.data);
        
        let msg: any;
        try {
          msg = JSON.parse(String(ev.data));
        } catch (e) {
          console.error("Error parsing WS message:", e);
          return;
        }

        // --- 3. ROBUST CONNECTION HANDLING ---
        // Ensure UI unlocks if we get 'connected' OR 'live' content (fail-safe)
        if (
            (msg.type === 'status' && msg.status === 'connected') || 
            (msg.type === 'live') // If we start getting content, we are definitely connected
        ) {
             if (!liveReadyRef.current) {
                 console.log("✅ Server ACK received. Switching UI to Active Mode.");
                 setIsConnected(true);
                 liveReadyRef.current = true;
                 
                 // Flush queued audio
                 const queued = pendingAudioRef.current.splice(0);
                 queued.forEach((chunk: ArrayBuffer) => {
                   try { wsRef.current?.send(chunk); } catch {}
                 });
             }
        }

        if (msg.type === 'status') {
          if (msg.status === 'closed') {
            setIsConnected(false);
            if (isStoppingRef.current || msg.code === 1000) {
              showEndNote({ durationSecs: lastDurationRef.current || durationSeconds });
            } else if (!isStoppingRef.current) {
              setError(msg.code ? `Live connection closed (code ${msg.code}).` : 'Live connection closed.');
            }
          }
          return;
        }

        if (msg.type === 'error') {
            console.error("Server Error:", msg.error);
            if (!isStoppingRef.current) setError(String(msg.error || 'Live error'));
            return;
        }

        // Handle Live Content
        if (msg.type === 'live') {
            const content = msg.serverContent;
             
            if (content?.interrupted) {
                 dlog('Server signaled interruption');
                 activeSourcesRef.current.forEach(source => {
                     try { source.stop(); } catch(e) {}
                 });
                 activeSourcesRef.current.clear();
                 
                 nextStartTimeRef.current = 0;
                 setIsAiSpeaking(false);
                 setIsAiThinking(false);
                 audioQueueRef.current = Promise.resolve();
                 
                 currentOutputRef.current = '';
                 setRealtimeOutput('');
            }
    
            const base64Audio =
               content?.modelTurn?.parts?.find?.((p: any) => p?.inlineData?.data)?.inlineData?.data ||
               content?.modelTurn?.parts?.[0]?.inlineData?.data;
             
               if (base64Audio) {
                // Chain audio processing to ensure order
                audioQueueRef.current = audioQueueRef.current.then(async () => {
                    if (!mountedRef.current || !wsRef.current) return;
   
                    try {
                        setIsAiSpeaking(true);
                        setIsAiThinking(false); 
                        setIsHintsLoading(false);
                        
                        if (!outputAudioContextRef.current) return;
                        const ctx = outputAudioContextRef.current;
   
                        // --- FIX START: Manual PCM Decoding ---
                        
                        // 1. Convert Base64 -> Byte Array
                        const binaryString = window.atob(base64Audio);
                        const len = binaryString.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        
                        // 2. Convert Bytes -> 16-bit PCM (Int16)
                        const int16Data = new Int16Array(bytes.buffer);
                        
                        // 3. Convert Int16 -> Float32 (Audio Range -1.0 to 1.0)
                        const float32Data = new Float32Array(int16Data.length);
                        for (let i = 0; i < int16Data.length; i++) {
                            float32Data[i] = int16Data[i] / 32768.0;
                        }

                        // 4. Create AudioBuffer (Gemini usually sends 24000Hz)
                        const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
                        audioBuffer.getChannelData(0).set(float32Data);
                        
                        // --- FIX END ---

                        const currentTime = ctx.currentTime;
                        if (nextStartTimeRef.current < currentTime) {
                            nextStartTimeRef.current = currentTime + 0.05;
                        }
                        
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(ctx.destination);
                        
                        source.onended = () => {
                            activeSourcesRef.current.delete(source);
                            if (activeSourcesRef.current.size === 0) {
                                setIsAiSpeaking(false);
                            }
                        };
                        
                        activeSourcesRef.current.add(source);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                    } catch (e) {
                        console.error("Audio Play Error", e);
                    }
                });
           }
    
            if (content?.inputTranscription) {
                currentInputRef.current += content.inputTranscription.text;
                setRealtimeInput(currentInputRef.current);
            }
                 
            const hasModelAudio = !!content?.modelTurn;
            const hasModelText = !!content?.outputTranscription;
                 
            if ((hasModelAudio || hasModelText) && currentInputRef.current.trim()) {
                 const userText = currentInputRef.current.trim();
                 setHistory(prev => [...prev, { role: 'user', text: userText }]);
                 currentInputRef.current = '';
                 setRealtimeInput('');
            }
    
            if (content?.outputTranscription) {
                if (currentOutputRef.current === '') {
                    lastAiMessageRef.current = ''; 
                }
                currentOutputRef.current += content.outputTranscription.text;
                lastAiMessageRef.current += content.outputTranscription.text;
                setRealtimeOutput(currentOutputRef.current);
            }
                 
            if (content?.turnComplete) {
                const hasAudio = !!(
                  content?.modelTurn?.parts?.find?.((p: any) => p?.inlineData?.data) ||
                  content?.modelTurn?.parts?.[0]?.inlineData?.data
                );
                if (!hasAudio) {
                    setIsAiThinking(true);
                }
    
                if (currentInputRef.current.trim()) {
                     const userText = currentInputRef.current.trim();
                     setHistory(prev => [...prev, { role: 'user', text: userText }]);
                }
                
                if (currentOutputRef.current.trim()) {
                     const modelText = currentOutputRef.current.trim();
                     setHistory(prev => [...prev, { role: 'model', text: modelText }]);
                }
                
                currentInputRef.current = '';
                currentOutputRef.current = '';
                setRealtimeInput('');
                setRealtimeOutput('');
            }
        }
      };

      ws.onerror = (e) => {
        console.error("WS error", e);
        if (!isStoppingRef.current) setError("Connection error. Please try again.");
      };

      ws.onclose = (e) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        if (isStoppingRef.current || e.code === 1000) {
          showEndNote({ durationSecs: lastDurationRef.current || durationSeconds });
        } else if (!isStoppingRef.current) {
          setError(
            e.code ? `Live connection closed (code ${e.code}).` : "Live connection closed."
          );
        }
      };

      // Watchdog
      setTimeout(() => {
        if (!mountedRef.current) return;
        if (isStoppingRef.current) return;
        if (!hasSetupCompleteRef.current) {
            // NOTE: Relaxed this warning since we are logging everything now
        }
      }, 4000);

      // Start Recording
      if (!inputAudioContextRef.current) return;
      const ctx = inputAudioContextRef.current;
      const actualSampleRate = ctx.sampleRate;

      try {
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          // Use inline helper
          const pcmBytes = createPcm16kArrayBuffer(inputData, actualSampleRate);
          const sock = wsRef.current;
          if (!sock || sock.readyState !== WebSocket.OPEN || !liveReadyRef.current) {
            const q = pendingAudioRef.current;
            q.push(pcmBytes);
            if (q.length > 20) q.shift();
            return;
          }
          try {
            sock.send(pcmBytes);
          } catch (sendErr) {
            console.warn("ws send audio failed", sendErr);
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);

        const queued = pendingAudioRef.current.splice(0);
        queued.forEach((chunk) => {
          try { wsRef.current?.send(chunk); } catch {}
        });
      } catch (e) {
        console.error("Audio pipeline init failed", e);
      }

    } catch (err: any) {
      console.error("Start Session Error:", err);
      setError(err.message || "Failed to start session.");
    }
  };

  const toggleMute = () => {
    if (activeSourcesRef.current.size > 0) {
        const sources = Array.from(activeSourcesRef.current);
        activeSourcesRef.current.clear();
        sources.forEach((source: AudioBufferSourceNode) => {
            try { source.stop(); } catch(e) {}
        });
        setIsAiSpeaking(false);
        nextStartTimeRef.current = 0;
        audioQueueRef.current = Promise.resolve();
    }

    setIsMuted(prev => {
        const next = !prev;
        isMutedRef.current = next; 
        return next;
    });
  };

  const callEnded = Boolean(callEndedNote);
  const isIdle = !isConnected && !callEnded;
  const isActiveSession = isConnected && !callEnded;

  return (
    <div className="relative w-full h-full flex flex-col shadow-2xl rounded-[2.5rem] border border-white/40 ring-1 ring-black/5 bg-gradient-to-b from-cyan-50 to-white overflow-hidden min-h-0">
      
      <div className="absolute inset-0 z-0 opacity-50 pointer-events-none overflow-hidden rounded-[2.5rem]">
         <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-200/40 rounded-full blur-[60px] animate-pulse-slow"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] bg-blue-200/40 rounded-full blur-[60px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="absolute top-6 left-6 z-[60]">
          <button 
             onClick={handleBack}
             className="p-4 bg-white/80 hover:bg-white text-slate-600 rounded-full backdrop-blur-md shadow-md border border-white transition-all active:scale-95 group cursor-pointer"
             aria-label="Back to Dashboard"
          >
              <BackIcon />
          </button>
      </div>

      <header className="h-16 md:h-24 pt-4 md:pt-8 pb-2 px-6 flex flex-col items-center justify-center z-50 w-full shrink-0 transition-all">
         <div className="text-xs font-black uppercase tracking-widest text-cyan-600 mb-2 bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm border border-white/50">
             Bilibala AI
         </div>
         <div className="flex items-center gap-2 mt-1">
             <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`}></span>
             <span className="text-sm font-bold text-slate-400">
                {isConnected ? formatDuration(durationSeconds) : "--:--"}
             </span>
         </div>
      </header>

      {/* Main Avatar Area */}
      <div className={`${isActiveSession ? 'shrink-0 py-4' : 'flex-1 flex flex-col items-center justify-center'} relative w-full min-h-[160px] ${hints.length > 0 ? 'z-[70]' : 'z-10'}`}>
          
          {hints.length > 0 ? (
             <RescueRing hints={hints} onClose={() => setHints([])} />
          ) : (
            <>
              <div className="relative w-full max-w-sm mx-auto flex justify-center items-center">
                 <div className="w-32 h-32 md:w-40 md:h-40 relative z-10 transition-all">
                    <DuckAvatar />
                 </div>
              </div>

              <div className="min-h-[2rem] mt-4 flex items-center justify-center relative z-20 px-4">
                 {callEnded ? (
                   <div className="px-4 py-2 rounded-full text-xs md:text-sm font-bold bg-white text-slate-700 border border-slate-200 shadow-sm flex items-center gap-2">
                      <span>{callEndedNote}</span>
                   </div>
                 ) : isIdle ? null : (
                   <StatusPill 
                      isConnected={isConnected}
                      isAiSpeaking={isAiSpeaking}
                      isAiThinking={isAiThinking}
                      realtimeInput={realtimeInput}
                      error={error}
                   />
                 )}
              </div>
            </>
          )}
      </div>

      {isActiveSession && (
        <div className="w-full max-w-5xl mx-auto px-5 md:px-8 pb-6 flex-1 flex flex-col min-h-0">
          <Transcript 
            history={history}
            realtimeInput={realtimeInput}
            realtimeOutput={realtimeOutput}
            isConnected={isConnected}
            messagesEndRef={messagesEndRef}
          />
        </div>
      )}

      {/* Spacer removed to allow Avatar area to take full height in idle state */}
      
      {/* Show Tap Start text in both Idle AND Call Ended states */}
      {(isIdle || callEnded) && (
        <div className="text-center pb-2 text-slate-400 font-bold animate-pulse text-sm">
            Tap Start to chat
        </div>
      )}

      <ControlBar 
        isConnected={isConnected}
        isMuted={isMuted}
        isHintsLoading={isHintsLoading}
        onToggleMute={toggleMute}
        onStartSession={startSession}
        onStopSession={stopSession}
        onManualHint={handleManualHint}
      />
      
    </div>
  );
};

export default LiveVoiceInterface;