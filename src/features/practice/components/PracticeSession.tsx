import React, { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { getBackendOrigin } from '../../../shared/services/backend';
import { savePracticeSession, updateLibraryPracticeStats, uploadPracticeAudio, incrementTopicPracticeCount, incrementQuestionUseCount } from '../../../shared/services/database';
import { PracticeTopic, SpeechAnalysisResult } from '../../../shared/types';
import AudioRecorder from './AudioRecorder';
import PyramidFeedback from './PyramidFeedback';

interface PracticeSessionProps {
  topic: PracticeTopic;
  allTopics?: PracticeTopic[];
  onTopicChange?: (topic: PracticeTopic) => void;
  level: string;
  nativeLang: string;
  targetLang: string;
  analysisId?: string | null;
  onExit: () => void;
}

enum SessionState {
  PREP,
  RECORDING,
  ANALYZING,
  RESULTS
}

// English defaults to serve as source text and fallback
const defaultLabels = {
    communicationLogic: 'Communication Logic',
    detected: 'Detected',
    myLogic: 'My Logic',
    aiImproved: 'AI Improved',
    legend: 'Legend',
    strong: 'Strong',
    weak: 'Weak',
    elaboration: 'Elaboration',
    critique: 'Critique',
    languagePolish: 'Language Polish & Alternatives',
    original: 'Original',
    betterAlternative: 'Better Alternative',
    coachFeedback: "Coach's Feedback",
    strengths: 'Strengths',
    areasForImprovement: 'Areas for Improvement',
    actionableTips: 'Actionable Tips',
    transcription: 'Transcription',
    yourRecording: 'Your Recording',
    recordAnswer: 'Record Answer',
    reviewAnswer: 'Review Answer',
    takeYourTime: 'Take your time',
    tapAnalyze: 'Tap analyze when ready',
    retake: 'Retake',
    // PracticeSession specific labels
    topic: 'Topic',
    structureYourAnswer: 'Take a moment to structure your answer. Think about your main point and supporting arguments.',
    yourNotesOutline: 'Your Notes / Outline',
    notesPlaceholder: 'Type your key points here to help you speak...',
    analyzingStructure: 'Analyzing Structure...',
    // Score labels
    scorePerfect: 'Perfect!',
    scoreExcellent: 'Excellent',
    scoreGreatJob: 'Great Job',
    scoreGoodStart: 'Good Start',
    scoreKeepGrowing: 'Keep Growing'
};

const PracticeSession: React.FC<PracticeSessionProps> = ({ topic, allTopics = [], onTopicChange, level, nativeLang, targetLang, analysisId, onExit }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SessionState>(SessionState.PREP);
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [userNote, setUserNote] = useState('');

  // NEW: Store the translated labels here
  const [translatedLabels, setTranslatedLabels] = useState<any>(defaultLabels);

  const handleStartRecording = () => {
    setState(SessionState.RECORDING);
  };

  const handleRecordingComplete = async (audioData: string) => {
    // Switch to ANALYZING to show spinner
    setState(SessionState.ANALYZING);
    setError('');
    
    // Create Audio URL for playback
    try {
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(url);
    } catch (e) {
        console.error("Failed to create audio URL from base64", e);
    }

    try {
      // --- PARALLEL REQUESTS START ---
      
      // 1. Speech Analysis Request
      const analysisPromise = fetch(`${getBackendOrigin()}/api/analyze-speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData,
          topic: topic.topic,
          question: topic.question,
          level,
          targetLang,
          nativeLang
        }),
      }).then(res => res.json());

      // 2. Translation Request (Only if needed)
      let translationPromise = Promise.resolve({ labels: null }); // Default no-op
      
      const isEasy = level.toLowerCase() === 'easy';
      const languageToUse = isEasy ? nativeLang : targetLang;
      const isEnglish = languageToUse && languageToUse.toLowerCase().includes('english');

      if (languageToUse && !isEnglish) {
          translationPromise = fetch(`${getBackendOrigin()}/api/translate-ui-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                language: languageToUse, 
                isEasyLevel: isEasy,
                sourceLabels: defaultLabels // Send source so backend knows what to translate
            })
          }).then(res => res.json());
      }

      // --- AWAIT BOTH ---
      const [analysisData, translationData] = await Promise.all([analysisPromise, translationPromise]);

      if (analysisData.error) {
        throw new Error(analysisData.error);
      }

      // Set Data
      setAnalysisResult(analysisData);

      // Update Labels (Merge new translations with defaults)
      if (translationData && translationData.labels) {
          setTranslatedLabels({ ...defaultLabels, ...translationData.labels });
      } else {
          setTranslatedLabels(defaultLabels);
      }

      // Save practice session to database (only for logged-in users)
      if (user) {
        // Extract score - use undefined check to handle score of 0
        // Round to integer since database expects integer type
        const score = analysisData.feedback?.score !== undefined
          ? Math.round(analysisData.feedback.score)
          : null;

        console.log('[PracticeSession] Starting save process...', {
          userId: user.id,
          analysisId,
          topicId: topic.topicId,
          questionId: topic.questionId,
          score,
        });

        // Save practice session async (don't block UI)
        (async () => {
          try {
            // 1. Upload audio to storage
            console.log('[PracticeSession] Uploading audio...');
            const audioUrl = await uploadPracticeAudio(user.id, audioData);
            console.log('[PracticeSession] Audio uploaded:', audioUrl ? 'success' : 'failed (null)');

            // 2. Save practice session
            console.log('[PracticeSession] Saving practice session...');
            const savedSession = await savePracticeSession({
              user_id: user.id,
              analysis_id: analysisId || null,
              topic_id: topic.topicId || null,
              question_id: topic.questionId || null,
              topic_text: topic.topic,
              question_text: topic.question,
              target_lang: targetLang,
              native_lang: nativeLang,
              level,
              audio_url: audioUrl,
              transcription: analysisData.transcription || null,
              score,
              feedback_data: {
                detected_framework: analysisData.detected_framework,
                structure: analysisData.structure,
                improved_structure: analysisData.improved_structure,
                feedback: analysisData.feedback,
                improvements: analysisData.improvements,
              },
            });

            if (savedSession) {
              console.log('[PracticeSession] Practice session saved successfully:', savedSession.id);
            } else {
              console.error('[PracticeSession] Practice session save returned null - check database.ts logs');
            }

            // 3. Update library practice stats (practice count and last score)
            if (analysisId && score !== null) {
              console.log('[PracticeSession] Updating library stats...');
              await updateLibraryPracticeStats(user.id, analysisId, score);
              console.log('[PracticeSession] Library stats updated for analysis:', analysisId);
            } else {
              console.log('[PracticeSession] Skipping library stats update:', { analysisId, score });
            }

            // 4. Increment topic practice count (for popularity ranking)
            if (topic.topicId) {
              console.log('[PracticeSession] Incrementing topic practice count...');
              await incrementTopicPracticeCount(topic.topicId);
              console.log('[PracticeSession] Topic practice count incremented:', topic.topicId);
            }

            // 5. Increment question use count (for popularity ranking)
            if (topic.questionId) {
              console.log('[PracticeSession] Incrementing question use count...');
              await incrementQuestionUseCount(topic.questionId);
              console.log('[PracticeSession] Question use count incremented:', topic.questionId);
            }
          } catch (err) {
            console.error('[PracticeSession] Failed to save practice session:', err);
          }
        })();
      } else {
        console.log('[PracticeSession] User not logged in, skipping save');
      }

      // Finally, show results (User sees everything ready at once)
      setState(SessionState.RESULTS);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze speech. Please try again.");
      setState(SessionState.PREP); 
    }
  };

  const startRetake = (audioData: string) => {
      handleRecordingComplete(audioData);
  };

  const handleTopicSwitch = (newTopic: PracticeTopic) => {
    if (newTopic.topic === topic.topic) return;
    // Reset state for new topic
    setState(SessionState.PREP);
    setAnalysisResult(null);
    setError('');
    setUserNote('');
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null);
    // Notify parent
    onTopicChange?.(newTopic);
  };

  const currentTopicIndex = allTopics.findIndex(t => t.topic === topic.topic);
  const hasMultipleTopics = allTopics.length > 1;

  return (
    <div className="min-h-screen bg-[#F6F4EF] p-6 lg:p-12 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
        <button 
            onClick={onExit}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
         
        </button>
       
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col justify-start pt-4 space-y-10">
        
        {/* SHARED HEADER: Topic & Question (Always Visible) */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Topic indicator with arrows */}
            <div className="flex items-center justify-center gap-6">
              {/* Previous Arrow */}
              {hasMultipleTopics && (
                <button
                  onClick={() => {
                    const prevIndex = currentTopicIndex > 0 ? currentTopicIndex - 1 : allTopics.length - 1;
                    handleTopicSwitch(allTopics[prevIndex]);
                  }}
                  className="text-stone-300 hover:text-stone-500 transition-colors p-1"
                  aria-label="Previous topic"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

              {/* Current Topic Pill */}
              <span className="bg-stone-100 text-stone-600 px-4 py-1.5 rounded-full text-xs font-medium border border-stone-200">
                {hasMultipleTopics ? `${currentTopicIndex + 1}/${allTopics.length} ${topic.topic}` : topic.topic}
              </span>

              {/* Next Arrow */}
              {hasMultipleTopics && (
                <button
                  onClick={() => {
                    const nextIndex = currentTopicIndex < allTopics.length - 1 ? currentTopicIndex + 1 : 0;
                    handleTopicSwitch(allTopics[nextIndex]);
                  }}
                  className="text-stone-300 hover:text-stone-500 transition-colors p-1"
                  aria-label="Next topic"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-stone-900 leading-tight max-w-3xl mx-auto">
                {topic.question}
            </h1>
            {state === SessionState.PREP && (
                 <p className="text-stone-500">
                    {translatedLabels.structureYourAnswer}
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
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 block text-center">{translatedLabels.yourNotesOutline}</label>
                        <textarea
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            placeholder={translatedLabels.notesPlaceholder}
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
                        <h3 className="text-xl font-medium text-stone-800">{translatedLabels.analyzingStructure}</h3>
                        <p className="text-stone-500">{translatedLabels.checkingLogic}</p>
                    </div>
                </div>
            )}

            {/* 4. RESULTS STATE */}
            {state === SessionState.RESULTS && analysisResult && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <PyramidFeedback 
                        analysis={analysisResult} 
                        onRetry={() => setState(SessionState.PREP)} 
                        audioUrl={currentAudioUrl}
                        startRetake={startRetake}
                        // PASS THE PRE-FETCHED LABELS HERE
                        preFetchedLabels={translatedLabels} 
                        
                        // We still pass these for safety/future use, but the heavy lifting is done above
                        level={level}
                        nativeLang={nativeLang}
                        targetLang={targetLang}
                    />
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default PracticeSession;