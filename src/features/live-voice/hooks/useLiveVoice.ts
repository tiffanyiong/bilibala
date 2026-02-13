import { useCallback, useEffect, useRef, useState } from 'react';
import { getBackendOrigin, getBackendWsOrigin } from '../../../shared/services/backend';
import { generateConversationHints } from '../../../shared/services/geminiService';
import { HistoryItem, VocabularyItem } from '../../../shared/types';

// --- INLINE AUDIO HELPERS ---
function createPcm16kArrayBuffer(inputData: Float32Array, sampleRate: number) {
  const targetSampleRate = 16000;
  const ratio = sampleRate / targetSampleRate;
  const newLength = Math.ceil(inputData.length / ratio);
  const result = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const inputIndex = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, inputData[inputIndex]));
    result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return result.buffer;
}

export interface UseLiveVoiceConfig {
  videoTitle: string;
  summary: string;
  vocabulary: VocabularyItem[];
  nativeLang: string;
  targetLang: string;
  level: string;
  transcript?: { text: string; duration: number; offset: number }[];
  /** User ID for server-side usage tracking */
  userId: string | null;
  /** Max seconds allowed for this session (e.g. 40 min = 2400) */
  maxSessionSeconds: number;
  /** Seconds remaining in monthly allowance */
  remainingMonthlySeconds: number;
  /** Seconds before the limit to show a warning */
  warningBeforeEndSeconds: number;
  /** Called when the session is auto-stopped due to a limit */
  onLimitReached?: (durationSeconds: number, reason: 'session' | 'monthly') => void;
}

export interface UseLiveVoiceReturn {
  // States
  isConnected: boolean;
  isAiSpeaking: boolean;
  isAiThinking: boolean;
  isMuted: boolean;
  error: string | null;
  callEndedNote: string | null;
  durationSeconds: number;
  /** Warning text shown when approaching a time limit, e.g. "1:00 remaining" */
  timeWarning: string | null;

  // Transcript
  history: HistoryItem[];
  realtimeInput: string;
  realtimeOutput: string;

  // Hints
  hints: string[];
  isHintsLoading: boolean;

  // Actions
  startSession: () => Promise<void>;
  stopSession: () => void;
  toggleMute: () => void;
  requestHint: () => Promise<void>;
  clearHints: () => void;

  // Refs for scrolling
  messagesEndRef: React.RefObject<HTMLDivElement>;

  // Computed
  isIdle: boolean;
  isActiveSession: boolean;
  callEnded: boolean;
  formatDuration: (secs: number) => string;
}

export function useLiveVoice(config: UseLiveVoiceConfig): UseLiveVoiceReturn {
  const {
    videoTitle, summary, vocabulary, nativeLang, targetLang, level, transcript, userId,
    maxSessionSeconds, remainingMonthlySeconds, warningBeforeEndSeconds,
    onLimitReached,
  } = config;

  // Effective time cap: whichever limit is lower
  const effectiveMaxSeconds = Math.min(maxSessionSeconds, remainingMonthlySeconds);

  const debug = import.meta.env.DEV;
  const dlog = (...args: unknown[]) => {
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
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

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
  const pendingAudioRef = useRef<ArrayBuffer[]>([]);

  const liveReadyRef = useRef(false);
  const isStoppingRef = useRef(false);
  const hasSetupCompleteRef = useRef(false);
  const mountedRef = useRef(true);
  const lastDurationRef = useRef(0);
  const stopSessionRef = useRef<() => void>(() => {});
  const onLimitReachedRef = useRef(onLimitReached);
  onLimitReachedRef.current = onLimitReached;

  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const showEndNote = useCallback((opts?: { durationSecs?: number }) => {
    if (!mountedRef.current) return;
    const dur = opts?.durationSecs ?? lastDurationRef.current ?? durationSeconds;
    const durLabel = dur > 0 ? ` • ${formatDuration(dur)}` : '';
    const text = `Call ended${durLabel}`;
    setError(null);
    setCallEndedNote(text);
  }, [durationSeconds]);

  // Auto-scroll effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [history, realtimeInput, realtimeOutput]);

  // Duration timer with limit enforcement
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnected) {
      interval = setInterval(() => {
        setDurationSeconds(prev => {
          const next = prev + 1;
          lastDurationRef.current = next;

          const secondsLeft = effectiveMaxSeconds - next;

          // Auto-stop when limit reached (only if there's a valid cap)
          if (effectiveMaxSeconds > 0 && next >= effectiveMaxSeconds) {
            const reason: 'session' | 'monthly' = remainingMonthlySeconds <= maxSessionSeconds ? 'monthly' : 'session';
            // Defer stop to avoid state update during render
            setTimeout(() => {
              stopSessionRef.current();
              const durLabel = ` • ${formatDuration(next)}`;
              const reasonLabel = reason === 'monthly'
                ? 'Monthly limit reached'
                : `Session limit reached — ${Math.floor(maxSessionSeconds / 60)} min max`;
              setCallEndedNote(`${reasonLabel}${durLabel}`);
              onLimitReachedRef.current?.(next, reason);
            }, 0);
            setTimeWarning(null);
            return next;
          }

          // Show warning when approaching limit
          if (effectiveMaxSeconds > 0 && secondsLeft <= warningBeforeEndSeconds && secondsLeft > 0) {
            const m = Math.floor(secondsLeft / 60);
            const s = secondsLeft % 60;
            setTimeWarning(`${m}:${s.toString().padStart(2, '0')} remaining`);
          } else {
            setTimeWarning(null);
          }

          return next;
        });
      }, 1000);
    } else {
      setDurationSeconds(0);
      setTimeWarning(null);
      if (durationSeconds > 0) {
        lastDurationRef.current = durationSeconds;
      }
    }
    return () => clearInterval(interval);
  }, [isConnected, durationSeconds, effectiveMaxSeconds, maxSessionSeconds, remainingMonthlySeconds, warningBeforeEndSeconds]);

  // Mount tracking
  mountedRef.current = true;
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSession();
    };
  }, []);

  const stopSession = useCallback(() => {
    dlog('stopSession()');
    isStoppingRef.current = true;
    liveReadyRef.current = false;

    audioQueueRef.current = Promise.resolve();

    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'stop' })); } catch {}
      try { wsRef.current.close(); } catch {}
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
      try { inputAudioContextRef.current.close(); } catch {}
      inputAudioContextRef.current = null;
    }

    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    activeSourcesRef.current.clear();

    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch {}
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

    showEndNote({ durationSecs: lastDurationRef.current || durationSeconds });

    setTimeout(() => {
      isStoppingRef.current = false;
    }, 0);
  }, [showEndNote, durationSeconds]);

  // Keep ref in sync so the duration timer can call stopSession without forward-reference issues
  stopSessionRef.current = stopSession;

  const startSession = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.warn("⚠️ Session already active. Ignoring start request.");
      return;
    }

    setError(null);
    setCallEndedNote(null);
    lastDurationRef.current = 0;
    setDurationSeconds(0);
    setHistory([]);
    setRealtimeInput('');
    setRealtimeOutput('');
    currentInputRef.current = '';
    currentOutputRef.current = '';
    dlog('startSession() clicked');

    try {
      hasSetupCompleteRef.current = false;
      liveReadyRef.current = false;
      audioQueueRef.current = Promise.resolve();

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

      try {
        const health = await fetch(`${getBackendOrigin()}/healthz`, { method: 'GET' });
        if (!health.ok) throw new Error('health not ok');
      } catch {
        setError(`Backend server is not reachable at ${getBackendOrigin()}. Check your server connection.`);
        stopSession();
        return;
      }

      const wsUrl = `${getBackendWsOrigin()}/live`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        const startMsg = {
          type: 'start',
          payload: { videoTitle, summary, vocabulary, nativeLang, targetLang, level, transcript, userId },
        };
        try {
          ws.send(JSON.stringify(startMsg));
        } catch (e) {
          console.error("❌ Failed to send start command:", e);
        }
      };

      ws.onmessage = async (ev) => {
        if (!mountedRef.current) return;

        let msg: { type: string; status?: string; code?: number; error?: string; secondsLeft?: number; reason?: string; durationSeconds?: number; serverContent?: {
          interrupted?: boolean;
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
          inputTranscription?: { text: string };
          outputTranscription?: { text: string };
          turnComplete?: boolean;
        } };
        try {
          msg = JSON.parse(String(ev.data));
        } catch (e) {
          console.error("Error parsing WS message:", e);
          return;
        }

        if (
          (msg.type === 'status' && msg.status === 'connected') ||
          (msg.type === 'live')
        ) {
          if (!liveReadyRef.current) {
            setIsConnected(true);
            liveReadyRef.current = true;

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

        // Server-side time warning (countdown before limit)
        if (msg.type === 'time_warning') {
          const secs = msg.secondsLeft ?? 0;
          const m = Math.floor(secs / 60);
          const s = secs % 60;
          setTimeWarning(`${m}:${s.toString().padStart(2, '0')} remaining`);
          return;
        }

        // Server-side session limit reached — server will disconnect
        if (msg.type === 'session_limit') {
          const dur = msg.durationSeconds ?? lastDurationRef.current;
          const reason = msg.reason as 'session' | 'monthly' ?? 'session';
          const durLabel = ` • ${formatDuration(dur)}`;
          const reasonLabel = reason === 'monthly'
            ? 'Monthly limit reached'
            : `Session limit reached — ${Math.floor(maxSessionSeconds / 60)} min max`;
          setCallEndedNote(`${reasonLabel}${durLabel}`);
          setTimeWarning(null);
          // Immediately stop any playing audio
          activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch {}
          });
          activeSourcesRef.current.clear();
          audioQueueRef.current = Promise.resolve();
          setIsAiSpeaking(false);
          onLimitReachedRef.current?.(dur, reason);
          // Server will close the connection — ws.onclose handles cleanup
          return;
        }

        if (msg.type === 'live') {
          const content = msg.serverContent;

          if (content?.interrupted) {
            dlog('Server signaled interruption');
            activeSourcesRef.current.forEach(source => {
              try { source.stop(); } catch {}
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
            content?.modelTurn?.parts?.find?.((p) => p?.inlineData?.data)?.inlineData?.data ||
            content?.modelTurn?.parts?.[0]?.inlineData?.data;

          if (base64Audio) {
            audioQueueRef.current = audioQueueRef.current.then(async () => {
              if (!mountedRef.current || !wsRef.current) return;

              try {
                setIsAiSpeaking(true);
                setIsAiThinking(false);
                setIsHintsLoading(false);

                if (!outputAudioContextRef.current) return;
                const ctx = outputAudioContextRef.current;

                const binaryString = window.atob(base64Audio);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                const int16Data = new Int16Array(bytes.buffer);
                const float32Data = new Float32Array(int16Data.length);
                for (let i = 0; i < int16Data.length; i++) {
                  float32Data[i] = int16Data[i] / 32768.0;
                }

                const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
                audioBuffer.getChannelData(0).set(float32Data);

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
            setHistory(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
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
              content?.modelTurn?.parts?.find?.((p) => p?.inlineData?.data) ||
              content?.modelTurn?.parts?.[0]?.inlineData?.data
            );
            if (!hasAudio) {
              setIsAiThinking(true);
            }

            if (currentInputRef.current.trim()) {
              const userText = currentInputRef.current.trim();
              setHistory(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
            }

            if (currentOutputRef.current.trim()) {
              const modelText = currentOutputRef.current.trim();
              setHistory(prev => [...prev, { role: 'model', text: modelText, timestamp: Date.now() }]);
            }

            currentInputRef.current = '';
            currentOutputRef.current = '';
            setRealtimeInput('');
            setRealtimeOutput('');
          }
        }
      };

      ws.onerror = () => {
        if (!isStoppingRef.current) setError("Connection error. Please try again.");
      };

      ws.onclose = (e) => {
        if (!mountedRef.current) return;

        // Stop any audio still playing (covers server-initiated close)
        activeSourcesRef.current.forEach(source => {
          try { source.stop(); } catch {}
        });
        activeSourcesRef.current.clear();
        audioQueueRef.current = Promise.resolve();
        nextStartTimeRef.current = 0;

        setIsConnected(false);
        setIsAiSpeaking(false);
        if (isStoppingRef.current || e.code === 1000) {
          showEndNote({ durationSecs: lastDurationRef.current || durationSeconds });
        } else if (!isStoppingRef.current) {
          setError(e.code ? `Live connection closed (code ${e.code}).` : "Live connection closed.");
        }
      };

      setTimeout(() => {
        if (!mountedRef.current) return;
        if (isStoppingRef.current) return;
        if (!hasSetupCompleteRef.current) {
          // Watchdog - connection timeout handling could go here
        }
      }, 4000);

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

    } catch (err) {
      console.error("Start Session Error:", err);
      setError((err as Error).message || "Failed to start session.");
    }
  }, [videoTitle, summary, vocabulary, nativeLang, targetLang, level, transcript, userId, stopSession, showEndNote, durationSeconds]);

  const toggleMute = useCallback(() => {
    // Only toggle microphone mute state, don't interrupt AI audio
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  }, []);

  const requestHint = useCallback(async () => {
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
  }, [isConnected, isHintsLoading, history, targetLang, level]);

  const clearHints = useCallback(() => {
    setHints([]);
  }, []);

  const callEnded = Boolean(callEndedNote);
  const isIdle = !isConnected && !callEnded;
  const isActiveSession = isConnected && !callEnded;

  return {
    // States
    isConnected,
    isAiSpeaking,
    isAiThinking,
    isMuted,
    error,
    callEndedNote,
    durationSeconds,
    timeWarning,

    // Transcript
    history,
    realtimeInput,
    realtimeOutput,

    // Hints
    hints,
    isHintsLoading,

    // Actions
    startSession,
    stopSession,
    toggleMute,
    requestHint,
    clearHints,

    // Refs
    messagesEndRef,

    // Computed
    isIdle,
    isActiveSession,
    callEnded,
    formatDuration,
  };
}
