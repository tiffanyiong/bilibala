import React, { useState } from 'react';
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

  const handleStartRecording = () => {
    setState(SessionState.RECORDING);
  };

  const handleRecordingComplete = async (audioData: string) => {
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
      setState(SessionState.PREP); // Go back to prep on error
    }
  };

  const handleRetry = () => {
      if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
          setCurrentAudioUrl(null);
      }
      setAnalysisResult(null);
      setState(SessionState.PREP);
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
        
        {/* SHARED HEADER: Topic & Question */}
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
            
            {/* 1. PREP & RECORDING STATES (Unified) */}
            {(state === SessionState.PREP || state === SessionState.RECORDING) && (
                <div className="max-w-2xl mx-auto w-full space-y-10 animate-in fade-in duration-300">
                    
                    {/* Notes Area (Replaces Target Words) */}
                    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 block text-center">Your Notes / Outline</label>
                        <textarea
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder="Type your key points here to help you speak..."
                            className="w-full min-h-[120px] p-4 bg-stone-50 border border-stone-100 rounded-lg text-stone-700 text-sm focus:outline-none focus:border-stone-300 focus:bg-white resize-none transition-all placeholder:text-stone-400"
                        />
                        {/* Optional: Show suggestions toggle? Keeping it clean as requested. */}
                    </div>

                    <div className="flex justify-center min-h-[120px] items-center">
                        {state === SessionState.PREP ? (
                            <button 
                                onClick={handleStartRecording}
                                className="bg-stone-900 text-white px-8 py-4 rounded-full text-lg font-medium shadow-xl hover:bg-black hover:-translate-y-1 transition-all flex items-center gap-3"
                            >
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                Start Recording Answer
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <PyramidFeedback 
                        analysis={analysisResult} 
                        onRetry={handleRetry} 
                        audioUrl={currentAudioUrl}
                    />
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default PracticeSession;
