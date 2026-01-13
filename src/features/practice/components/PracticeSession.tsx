import React, { useRef, useState } from 'react';
import { getBackendOrigin } from '../../../shared/services/backend';
import { PracticeTopic, SpeechAnalysisResult } from '../../../shared/types';
import AudioRecorder from './AudioRecorder';
import PyramidFeedback from './PyramidFeedback';

interface PracticeSessionProps {
  topic: PracticeTopic;
  level: string;
  nativeLang: string;
  targetLang: string;
  onExit: () => void;
}

enum SessionState {
  PREP,
  RECORDING,
  ANALYZING,
  RESULTS
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ topic, level, nativeLang, targetLang, onExit }) => {
  const [state, setState] = useState<SessionState>(SessionState.PREP);
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [userNote, setUserNote] = useState('');
  const [isReRecording, setIsReRecording] = useState(false);
  const [reRecordKey, setReRecordKey] = useState(0);

  // Floating Modal State
  const [modalPosition, setModalPosition] = useState<{x: number, y: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleStartRecording = () => {
    setState(SessionState.RECORDING);
  };

  const handleRecordingComplete = async (audioData: string) => {
    // If re-recording, keep state as RESULTS but show loading overlay or similar, 
    // OR switch to ANALYZING to show spinner (standard flow).
    // Let's switch to ANALYZING for clarity.
    setIsReRecording(false);
    setModalPosition(null); // Reset position on close
    setState(SessionState.ANALYZING);
    setError('');
    
    try {
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        // Revoke old URL if exists
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(url);
    } catch (e) {
        console.error("Failed to create audio URL from base64", e);
    }

    try {
      const response = await fetch(`${getBackendOrigin()}/api/analyze-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          topic: topic.topic,
          question: topic.question,
          level
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysisResult(result);
      setState(SessionState.RESULTS);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze speech. Please try again.");
      setState(SessionState.PREP); // Fallback
    }
  };

  const handleRetryClick = () => {
      // Don't reset state to PREP. Just enable re-recording mode.
      setIsReRecording(true);
  };

  // Dragging Logic
  const handleMouseDown = (e: React.MouseEvent) => {
      // Prevent drag if clicking buttons or inputs
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

      const startX = e.clientX;
      const startY = e.clientY;
      
      let initialX = 0;
      let initialY = 0;

      // If initially centered (position is null), calculate current rect
      if (modalRef.current) {
          const rect = modalRef.current.getBoundingClientRect();
          initialX = rect.left;
          initialY = rect.top;
          
          // If we haven't set a hard position yet, lock it in now
          if (!modalPosition) {
              setModalPosition({ x: initialX, y: initialY });
          } else {
              initialX = modalPosition.x;
              initialY = modalPosition.y;
          }
      }

      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          setModalPosition({ x: initialX + dx, y: initialY + dy });
      };

      const handleMouseUp = () => {
          setIsDragging(false);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="min-h-screen bg-[#F6F4EF] p-6 lg:p-12 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
        <button 
            onClick={onExit}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="font-medium">Exit Practice</span>
        </button>
        <div className="text-sm font-medium text-stone-400 uppercase tracking-widest">Pyramid Speaking Module</div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col justify-start pt-4 space-y-10">
        
        {/* SHARED HEADER: Topic & Question (Always Visible) */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="bg-stone-200 text-stone-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Topic: {topic.topic}
            </span>
            <h1 className="text-3xl md:text-4xl font-serif text-stone-900 leading-tight max-w-3xl mx-auto">
                {topic.question}
            </h1>
            {state === SessionState.PREP && (
                 <p className="text-stone-500">
                    Take a moment to structure your answer. Think about your main point and supporting arguments.
                </p>
            )}
        </div>

        {/* CONTENT AREA */}
        <div className="w-full transition-all duration-300">
            
            {/* 1. PREP & RECORDING STATES */}
            {(state === SessionState.PREP || state === SessionState.RECORDING) && (
                <div className="max-w-2xl mx-auto w-full space-y-10 animate-in fade-in duration-300">
                    
                    {/* Notes Area */}
                    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 block text-center">Your Notes / Outline</label>
                        <textarea
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder="Type your key points here to help you speak..."
                            className="w-full min-h-[120px] p-4 bg-stone-50 border border-stone-100 rounded-lg text-stone-700 text-sm focus:outline-none focus:border-stone-300 focus:bg-white resize-none transition-all placeholder:text-stone-400"
                        />
                    </div>

                    <div className="flex justify-center min-h-[120px] items-center">
                        {state === SessionState.PREP ? (
                            <button 
                                onClick={handleStartRecording}
                                className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-100 group"
                                title="Start Recording"
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform duration-300">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            </button>
                        ) : (
                            <AudioRecorder 
                                onRecordingComplete={handleRecordingComplete} 
                                onCancel={() => setState(SessionState.PREP)} 
                            />
                        )}
                    </div>
                    
                    {error && <p className="text-red-500 text-center text-sm">{error}</p>}
                </div>
            )}

            {/* 3. ANALYZING STATE */}
            {state === SessionState.ANALYZING && (
                <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500 py-12">
                    <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-stone-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-stone-800 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-medium text-stone-800">Analyzing Structure...</h3>
                        <p className="text-stone-500">Checking for Minto Pyramid logic...</p>
                    </div>
                </div>
            )}

            {/* 4. RESULTS STATE */}
            {state === SessionState.RESULTS && analysisResult && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <PyramidFeedback 
                        analysis={analysisResult} 
                        onRetry={handleRetryClick} 
                        audioUrl={currentAudioUrl}
                    />

                    {/* RE-RECORDING MODAL - Floating & Draggable */}
                    {isReRecording && (
                        <div 
                            ref={modalRef}
                            onMouseDown={handleMouseDown}
                            style={{
                                position: 'fixed',
                                left: modalPosition ? modalPosition.x : '50%',
                                top: modalPosition ? modalPosition.y : '50%',
                                transform: modalPosition ? 'none' : 'translate(-50%, -50%)',
                                zIndex: 50,
                                cursor: isDragging ? 'grabbing' : 'grab',
                                userSelect: 'none' // Prevent text selection while dragging
                            }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 animate-in fade-in zoom-in-95 duration-200 border border-stone-200"
                        >
                            <button 
                                onClick={() => setIsReRecording(false)}
                                className="absolute top-6 right-6 text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                            
                            <div className="text-center mb-8 pointer-events-none"> {/* Text non-interactive to prevent interference, but user can click buttons below */}
                                <h3 className="text-xl font-serif text-stone-800">Record Answer Again</h3>
                                <p className="text-stone-500 text-sm mt-1">Try to incorporate the feedback into your new answer.</p>
                            </div>

                            <div className="flex justify-center cursor-auto" onMouseDown={(e) => e.stopPropagation()}> 
                                {/* 
                                    Stop propagation here so interacting with recorder doesn't trigger drag? 
                                    Actually, we used button checks in handleMouseDown, so propagation is okay 
                                    if we want to drag by grabbing whitespace in recorder.
                                    But 'cursor-auto' resets the grab cursor.
                                */}
                                <AudioRecorder 
                                    key={reRecordKey}
                                    onRecordingComplete={handleRecordingComplete} 
                                    onCancel={() => setReRecordKey(prev => prev + 1)} 
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default PracticeSession;