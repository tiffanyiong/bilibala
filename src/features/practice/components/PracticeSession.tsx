import { TIER_LIMITS } from '@/shared/types/database';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import { getBackendOrigin } from '../../../shared/services/backend';
import { getUserVideoLibrary, incrementQuestionUseCount, incrementTopicPracticeCount, savePracticeSession, updateLibraryPracticeStats, uploadPracticeAudio } from '../../../shared/services/database';
import { checkAnonymousPracticeLimit, recordAnonymousPractice } from '../../../shared/services/usageTracking';
import { PracticeTopic, SpeechAnalysisResult, TopicQuestion } from '../../../shared/types';
import DinoGame from '../../content/components/DinoGame';
import AudioRecorder from './AudioRecorder';
import PyramidFeedback from './PyramidFeedback';

interface PracticeSessionProps {
  topic: PracticeTopic;
  allTopics?: PracticeTopic[];
  onTopicChange?: (topic: PracticeTopic) => void;
  allQuestions?: TopicQuestion[];
  onQuestionChange?: (question: TopicQuestion) => void;
  onGenerateQuestion?: () => Promise<TopicQuestion | null>;
  aiGeneratedCount?: number;
  level: string;
  nativeLang: string;
  targetLang: string;
  analysisId?: string | null;
  videoTitle?: string;
  videoId?: string;
  onRequireAuth?: () => void;
}

enum SessionState {
  PREP,
  RECORDING,
  ANALYZING,
  RESULTS
}

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
    aiVoice: 'AI Voice',
    recordAnswer: 'Record Answer',
    reviewAnswer: 'Review Answer',
    takeYourTime: 'Take your time',
    tapAnalyze: 'Tap analyze when ready',
    retake: 'Retake',
    tryIncorporateFeedback: 'Try to incorporate the feedback.',
    microphoneError: 'Microphone Error',
    topic: 'Topic',
    structureYourAnswer: 'Take a moment to structure your answer. Think about your main point and supporting arguments.',
    yourNotesOutline: 'Your Notes / Outline',
    notesPlaceholder: 'Type your key points here to help you speak...',
    analyzingStructure: 'Analyzing Structure...',
    scorePerfect: 'Perfect!',
    scoreExcellent: 'Excellent',
    scoreGreatJob: 'Great Job',
    scoreGoodStart: 'Good Start',
    scoreKeepGrowing: 'Keep Growing',
    pronunciationIntonation: 'Pronunciation & Intonation',
    overallPronunciation: 'Overall Pronunciation',
    intonation: 'Intonation',
    wordPronunciation: 'Word Pronunciation',
    pronunciationNativeLike: 'native-like',
    pronunciationClear: 'clear',
    pronunciationAccented: 'accented',
    pronunciationNeedsWork: 'needs work',
    intonationNatural: 'natural',
    intonationFlat: 'flat',
    intonationMonotone: 'monotone',
    intonationOverlyExpressive: 'overly-expressive',
    pronunciationGood: 'Good',
    pronunciationNeedsWorkLabel: 'Needs Work',
    pronunciationUnclear: 'Unclear',
    tapToStart: 'Tap to start recording',
    retryPrompt: 'Try again with the feedback in mind!'
};

const PracticeSession: React.FC<PracticeSessionProps> = ({
  topic,
  allTopics = [],
  onTopicChange,
  allQuestions = [],
  onQuestionChange,
  onGenerateQuestion,
  aiGeneratedCount = 0,
  level,
  nativeLang,
  targetLang,
  analysisId,
  videoTitle,
  videoId,
  onRequireAuth
}) => {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { recordAction } = useSubscription();
  
  // Basic State
  const [state, setState] = useState<SessionState>(SessionState.PREP);
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [userNote, setUserNote] = useState('');
  const [analyzingElapsed, setAnalyzingElapsed] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Cache for storing analysis results per question
  const [resultsCache, setResultsCache] = useState<Record<string, {
    analysisResult: SpeechAnalysisResult;
    audioUrl: string | null;
    translatedLabels: any;
    userNote: string;
  }>>({});

  const AI_GENERATED_LIMIT = 3;

  // --- EFFECT: SYNC UI WITH CACHE ON QUESTION CHANGE ---
 useEffect(() => {
  if (!topic.questionId && !topic.question) return;

  // Use a composite key: ID + Text
  const cacheKey = `${topic.questionId}-${topic.question}`;
  const cached = resultsCache[cacheKey];

  if (cached) {
    setAnalysisResult(cached.analysisResult);
    setCurrentAudioUrl(cached.audioUrl);
    setTranslatedLabels(cached.translatedLabels);
    setUserNote(cached.userNote);
    setState(SessionState.RESULTS);
  } else {
    // This is a brand new question (no cache), so keep it in PREP
    setState(SessionState.PREP);
    setAnalysisResult(null);
    setCurrentAudioUrl(null);
    setUserNote('');
  }
  setError('');
}, [topic.questionId, topic.question]); // Trigger on ID OR Text change


  // Elapsed time tracker for analyzing state
  useEffect(() => {
    if (state !== SessionState.ANALYZING) {
      setAnalyzingElapsed(0);
      return;
    }
    const interval = setInterval(() => setAnalyzingElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  // Labels logic
  const getInitialLabels = () => {
    const isEasy = level.toLowerCase() === 'easy';
    const languageToUse = isEasy ? nativeLang : targetLang;
    if (languageToUse && !languageToUse.toLowerCase().includes('english')) {
      try {
        const cached = localStorage.getItem(`ui-labels-${languageToUse}-${isEasy}`);
        if (cached) return { ...defaultLabels, ...JSON.parse(cached) };
      } catch {}
    }
    return defaultLabels;
  };

  const [translatedLabels, setTranslatedLabels] = useState<any>(getInitialLabels);

  // Fetch/Update Translations
  useEffect(() => {
    const isEasy = level.toLowerCase() === 'easy';
    const languageToUse = isEasy ? nativeLang : targetLang;
    if (languageToUse && !languageToUse.toLowerCase().includes('english')) {
      fetch(`${getBackendOrigin()}/api/translate-ui-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: languageToUse, isEasyLevel: isEasy, sourceLabels: defaultLabels })
      })
        .then(res => res.json())
        .then(data => {
          if (data?.labels) {
            setTranslatedLabels({ ...defaultLabels, ...data.labels });
            localStorage.setItem(`ui-labels-${languageToUse}-${isEasy}`, JSON.stringify(data.labels));
          }
        })
        .catch(err => console.error('Translation error:', err));
    }
  }, [level, nativeLang, targetLang]);

  const handleStartRecording = () => setState(SessionState.RECORDING);

  // referenceTranscript: If provided, this is a "retake" where user is practicing the improved version
  // The backend will focus on delivery scoring rather than content restructuring
  const handleRecordingComplete = async (audioData: string, mimeType: string = 'audio/webm', referenceTranscript?: string) => {
    setState(SessionState.ANALYZING);
    setError('');

    let newAudioUrl: string | null = null;
    try {
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        newAudioUrl = URL.createObjectURL(blob);
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl(newAudioUrl);
    } catch (e) { console.error("Audio error", e); }

    try {
      const isEasy = level.toLowerCase() === 'easy';
      const languageToUse = isEasy ? nativeLang : targetLang;
      const isEnglish = languageToUse && languageToUse.toLowerCase().includes('english');

      // Include referenceTranscript for retake mode (practicing improved version)
      const analysisPromise = fetch(`${getBackendOrigin()}/api/analyze-speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData,
          topic: topic.topic,
          question: topic.question,
          level,
          targetLang,
          nativeLang,
          ...(referenceTranscript && { referenceTranscript }) // Only include if it's a retake
        }),
      }).then(res => res.json());

      let translationPromise = Promise.resolve({ labels: null });
      if (languageToUse && !isEnglish) {
          translationPromise = fetch(`${getBackendOrigin()}/api/translate-ui-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: languageToUse, isEasyLevel: isEasy, sourceLabels: defaultLabels })
          }).then(res => res.json());
      }

      const [analysisData, translationData] = await Promise.all([analysisPromise, translationPromise]);
      if (analysisData.error) throw new Error(analysisData.error);

      // Translate band_descriptor / level_descriptor into nativeLang when level is Easy
      if (isEasy && !isEnglish && analysisData.scoring_breakdown) {
        const descriptorKey = analysisData.scoring_breakdown.band_descriptor ? 'band_descriptor' : 'level_descriptor';
        const descriptorText = analysisData.scoring_breakdown[descriptorKey];
        if (descriptorText) {
          try {
            const descTranslation = await fetch(`${getBackendOrigin()}/api/translate-ui-labels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ language: languageToUse, isEasyLevel: true, sourceLabels: { descriptor: descriptorText } })
            }).then(res => res.json());
            if (descTranslation?.labels?.descriptor) {
              analysisData.scoring_breakdown[descriptorKey] = descTranslation.labels.descriptor;
            }
          } catch (err) { console.error('Descriptor translation failed:', err); }
        }
      }

      setAnalysisResult(analysisData);
      const finalLabels = translationData?.labels ? { ...defaultLabels, ...translationData.labels } : defaultLabels;
      setTranslatedLabels(finalLabels);

      // Save logic for logged in users
      if (user) {
        const score = analysisData.feedback?.score !== undefined ? Math.round(analysisData.feedback.score) : null;

        // 1. Check if the video is already in the user's library
        const libraryLimit = TIER_LIMITS[tier].videoLibraryMax;
        const currentLibrary = await getUserVideoLibrary(user.id);
        const isAlreadyInLibrary = currentLibrary.some(v => v.analysisId === analysisId);

        // 2. Decide if we should allow a "Library Link"
        // If NOT in library and at 10 slots, we set a flag to skip auto-linking
        const isLibraryFull = !isAlreadyInLibrary && currentLibrary.length >= libraryLimit;
        (async () => {
          try {
            const audioUrl = await uploadPracticeAudio(user.id, audioData, mimeType);
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
              feedback_data: analysisData
            });
            if (savedSession) recordAction('practice_session');
            // Only update stats if the video actually exists in the library
            if (analysisId && score !== null && !isLibraryFull) await updateLibraryPracticeStats(user.id, analysisId, score);
            if (topic.topicId) await incrementTopicPracticeCount(topic.topicId);
            if (topic.questionId) await incrementQuestionUseCount(topic.questionId);
          } catch (err) { console.error('Save failed', err); }
        })();
      } else {
        recordAnonymousPractice();
      }

      // CACHE UPDATING
      if (topic.questionId || topic.question) {
        const cacheKey = `${topic.questionId}-${topic.question}`; // Use composite key
        setResultsCache(prev => ({
        ...prev,
        [cacheKey]: {
          analysisResult: analysisData,
          audioUrl: newAudioUrl,
          translatedLabels: finalLabels,
          userNote,
        }
      }));
    }

      setState(SessionState.RESULTS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "Failed to analyze speech.");
      setState(SessionState.PREP);
    }
  };

  const handleQuestionSwitch = async (newQuestion: TopicQuestion) => {
  if (newQuestion.questionId === topic.questionId && newQuestion.question === topic.question) return;

  // Save CURRENT question to cache before leaving
  if (analysisResult && state === SessionState.RESULTS) {
    const currentCacheKey = `${topic.questionId}-${topic.question}`;
    setResultsCache(prev => ({
      ...prev,
      [currentCacheKey]: {
        analysisResult,
        audioUrl: currentAudioUrl,
        translatedLabels,
        userNote,
      }
    }));
  }

  onQuestionChange?.(newQuestion);
};

  const handleTopicSwitch = async (newTopic: PracticeTopic) => {
    if (newTopic.topic === topic.topic) return;
    if (!user && onRequireAuth) {
      const practiceStatus = await checkAnonymousPracticeLimit();
      if (!practiceStatus.allowed) { onRequireAuth(); return; }
    }
    setState(SessionState.PREP);
    setAnalysisResult(null);
    setUserNote('');
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null);
    onTopicChange?.(newTopic);
  };

  const handleGenerateQuestion = async () => {
  if (!canGenerate || isGenerating) return;
  
  setIsGenerating(true);
  setError('');
  
  // CRITICAL: Clear current state so the old report doesn't 
  // show up for the new incoming question
  setAnalysisResult(null);
  setState(SessionState.PREP);
  setUserNote('');
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  setCurrentAudioUrl(null);

  try {
    await onGenerateQuestion?.();
    // The parent will now push a new question with a unique ID
  } catch (err) {
    console.error('Failed to generate question:', err);
    setError('Failed to generate new question. Please try again.');
  } finally {
    setIsGenerating(false);
  }
};

  // UI Helpers
  const currentTopicIndex = allTopics.findIndex(t => t.topic === topic.topic);
  const currentQuestionIndex = allQuestions.findIndex(q => q.questionId === topic.questionId);
  const isAnalyzing = state === SessionState.ANALYZING;
  const canGenerate = aiGeneratedCount < AI_GENERATED_LIMIT && !!onGenerateQuestion && !isAnalyzing;

  return (
    <div className="min-h-screen bg-[#F6F4EF] p-1 lg:p-6 flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col justify-start pt-4 space-y-10">
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Topic Navigation */}
            <div className="flex items-center justify-center gap-6">
              {allTopics.length > 1 && (
                <button onClick={() => handleTopicSwitch(allTopics[currentTopicIndex > 0 ? currentTopicIndex - 1 : allTopics.length - 1])} disabled={isAnalyzing} className="text-stone-300 hover:text-stone-500 p-1 disabled:opacity-30">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
              )}
              <span className="bg-stone-100 text-stone-600 px-4 py-1.5 rounded-full text-xs font-medium border border-stone-200">
                {allTopics.length > 1 ? `${currentTopicIndex + 1}/${allTopics.length} ${topic.topic}` : topic.topic}
              </span>
              {allTopics.length > 1 && (
                <button onClick={() => handleTopicSwitch(allTopics[currentTopicIndex < allTopics.length - 1 ? currentTopicIndex + 1 : 0])} disabled={isAnalyzing} className="text-stone-300 hover:text-stone-500 p-1 disabled:opacity-30">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              )}
            </div>

            {/* Question Navigation */}
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col items-center gap-2 max-w-3xl px-4 md:px-12">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif text-stone-900 leading-relaxed sm:leading-snug md:leading-tight">
                  {topic.question}

                  {/* AI Generate Button */}
                  {onGenerateQuestion && (
                    <button
                      onClick={handleGenerateQuestion}
                      disabled={!canGenerate || isGenerating}
                      className={`group inline-flex items-center gap-1 ml-2 align-middle rounded-full transition-all duration-300 ease-out ${
                        !canGenerate
                          ? 'text-stone-300 cursor-not-allowed'
                          : isGenerating
                            ? 'text-stone-500'
                            : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      <span className="flex-shrink-0">
                        {isGenerating ? (
                          <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent animate-spin rounded-full"/>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`grid transition-all duration-300 ease-out ${
                          isGenerating
                            ? 'grid-cols-[1fr] opacity-100'
                            : 'grid-cols-[0fr] opacity-0 group-hover:grid-cols-[1fr] group-hover:opacity-100'
                        }`}
                      >
                        <span className="overflow-hidden whitespace-nowrap text-xs font-medium">
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </span>
                      </span>
                    </button>
                  )}
                </h1>
                {/* Video Source Reference */}
                {(() => {
                  // Get the current question's source info from allQuestions
                  const currentQuestion = allQuestions.find(q => q.questionId === topic.questionId);
                  const sourceTitle = currentQuestion?.videoTitle || videoTitle;
                  // Use the question's source video ID, or fall back to current video
                  const linkVideoId = currentQuestion?.youtubeId || videoId;

                  if (sourceTitle) {
                    return (
                      <p className="text-xs text-stone-400 mt-1">
                        <span className="italic">Source: </span>
                        {linkVideoId ? (
                          <a
                            href={`/${linkVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-stone-600 hover:underline transition-colors"
                          >
                            {sourceTitle}
                          </a>
                        ) : (
                          <span>{sourceTitle}</span>
                        )}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              {/* Question Arrow Navigation - below source */}
              {allQuestions.length > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button onClick={() => handleQuestionSwitch(allQuestions[currentQuestionIndex > 0 ? currentQuestionIndex - 1 : allQuestions.length - 1])} disabled={isAnalyzing} className="text-stone-300 hover:text-stone-500 p-1 disabled:opacity-30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="text-xs text-stone-400">{currentQuestionIndex + 1} / {allQuestions.length}</span>
                  <button onClick={() => handleQuestionSwitch(allQuestions[currentQuestionIndex < allQuestions.length - 1 ? currentQuestionIndex + 1 : 0])} disabled={isAnalyzing} className="text-stone-300 hover:text-stone-500 p-1 disabled:opacity-30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              )}
            </div>
        </div>

        <div className="w-full">
            {(state === SessionState.PREP || state === SessionState.RECORDING) && (
                <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in">
                    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 block text-center">{translatedLabels.yourNotesOutline}</label>
                        <textarea value={userNote} onChange={(e) => setUserNote(e.target.value)} placeholder={translatedLabels.notesPlaceholder} className="w-full min-h-[120px] p-4 bg-stone-50 border border-stone-100 rounded-lg text-sm focus:outline-none focus:bg-white resize-none"/>
                    </div>
                    <div className="flex justify-center min-h-[120px] items-center">
                        {state === SessionState.PREP ? (
                            <div className="flex flex-col items-center gap-3">
                                <button onClick={handleStartRecording} className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-all">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                                </button>
                                <p className="text-stone-400 text-sm font-medium">{translatedLabels.tapToStart}</p>
                            </div>
                        ) : (
                            <AudioRecorder
                                onRecordingComplete={handleRecordingComplete}
                                onCancel={() => setState(SessionState.PREP)}
                                defaultTitle={translatedLabels.recordAnswer}
                                labels={translatedLabels}
                            />
                        )}
                    </div>
                    {error && <p className="text-red-500 text-center text-sm">{error}</p>}
                </div>
            )}

            {state === SessionState.ANALYZING && (
                <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in py-12">
                    {/** set the DinoGame to appear after 60 seconds of analyzing **/}
                    {analyzingElapsed < 60 ? (
                      <>
                        <div className="w-24 h-24 border-4 border-stone-200 border-t-stone-800 animate-spin rounded-full"></div>
                        <h3 className="text-xl font-medium text-stone-800">{translatedLabels.analyzingStructure}</h3>
                      </>
                    ) : (
                      <div className="w-full max-w-lg space-y-4">
                        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden h-[180px]"><DinoGame /></div>
                      </div>
                    )}
                </div>
            )}

            {state === SessionState.RESULTS && analysisResult && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 pb-20">
                    <PyramidFeedback
                        analysis={analysisResult}
                        onRetry={() => setState(SessionState.PREP)}
                        audioUrl={currentAudioUrl}
                        startRetake={handleRecordingComplete}
                        preFetchedLabels={translatedLabels}
                        level={level}
                        nativeLang={nativeLang}
                        targetLang={targetLang}
                        onRequireAuth={!user ? onRequireAuth : undefined}
                    />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PracticeSession;