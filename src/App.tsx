import React, { useEffect, useRef, useState } from 'react';
import ContentTabs from './features/content/components/ContentTabs';
import TopicSelector from './features/content/components/TopicSelector';
import FloatingTutorWindow from './features/live-voice/components/FloatingTutorWindow';
import PracticeSession from './features/practice/components/PracticeSession';
import VideoPlayer, { VideoPlayerRef } from './features/video/components/VideoPlayer';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import Layout from './shared/components/Layout';
import UsageLimitModal from './shared/components/UsageLimitModal';
import { LANGUAGES, LEVELS } from './shared/constants';
import { useAuth } from './shared/context/AuthContext';
import {
  dbAnalysisToContentAnalysis,
  getCachedAnalysis,
  getOrCreateVideo,
  saveCachedAnalysis,
  savePracticeTopicsFromAnalysis,
} from './shared/services/database';
import { analyzeVideoContent } from './shared/services/geminiService';
import {
  checkAnonymousUsageLimit,
  getUsageDisplayInfo,
  recordAnonymousUsage,
  UsageDisplayInfo
} from './shared/services/usageTracking';
import { AppState, PracticeTopic, TopicPoint, VideoData, VocabularyItem } from './shared/types';

// Custom Chevron for Dropdowns
const ChevronDownIcon = () => (
  <svg className="w-4 h-4 text-zinc-500 pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const App: React.FC = () => {
  // Reveal body after mount to prevent FOUC with Tailwind CDN
  useEffect(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  }, []);
  const { user } = useAuth();
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [videoUrl, setVideoUrl] = useState('');

  // Language & Level State
  const [nativeLang, setNativeLang] = useState('Chinese (Mandarin - 中文)');
  const [targetLang, setTargetLang] = useState('English');
  const [level, setLevel] = useState('Easy');

  // Usage limit modal state
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageDisplayInfo | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Floating AI Tutor window state
  const [showTutorWindow, setShowTutorWindow] = useState(false);
  const [tutorWindowMinimized, setTutorWindowMinimized] = useState(false);

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  
  // Content State
  const [summary, setSummary] = useState('');
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [topics, setTopics] = useState<TopicPoint[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [transcript, setTranscript] = useState<{ text: string; duration: number; offset: number }[]>([]);
  const [discussionTopics, setDiscussionTopics] = useState<PracticeTopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [activePracticeTopic, setActivePracticeTopic] = useState<PracticeTopic | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparing your lesson...");
  const [currentTime, setCurrentTime] = useState(0);
  
  const [errorMsg, setErrorMsg] = useState('');

  // --- History / Navigation Logic ---
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;

      if (hash === '#dashboard') {
        if (videoData) setAppState(AppState.DASHBOARD);
        else {
            setAppState(AppState.LANDING);
            window.history.replaceState(null, '', ' ');
        }
      } else if (hash === '#practice') {
        if (videoData && activePracticeTopic) setAppState(AppState.PRACTICE_SESSION);
        else if (videoData) setAppState(AppState.DASHBOARD);
        else {
            setAppState(AppState.LANDING);
            window.history.replaceState(null, '', ' ');
        }
      } else {
        setAppState(AppState.LANDING);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [videoData, activePracticeTopic]);

  // Sync State -> Hash
  useEffect(() => {
    if (appState === AppState.LOADING) return;

    const currentHash = window.location.hash;
    let targetHash = '';

    if (appState === AppState.DASHBOARD) targetHash = '#dashboard';
    if (appState === AppState.PRACTICE_SESSION) targetHash = '#practice';
    if (appState === AppState.LANDING) targetHash = '';

    if (currentHash !== targetHash) {
        if (targetHash) {
            window.history.pushState(null, '', targetHash);
        } else {
            // Remove hash when going to landing
            window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
    }
  }, [appState]);

  // --- Persistence Logic ---
  const STORAGE_KEY = 'bilibala_state_v1';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.videoData) {
            setVideoUrl(p.videoUrl || '');
            setNativeLang(p.nativeLang || 'Chinese (Mandarin - 中文)');
            setTargetLang(p.targetLang || 'English');
            setLevel(p.level || 'Easy');
            setVideoData(p.videoData);
            setSummary(p.summary || '');
            setTranslatedSummary(p.translatedSummary || '');
            setTopics(p.topics || []);
            setVocabulary(p.vocabulary || []);
            setTranscript(p.transcript || []);
            setDiscussionTopics(p.discussionTopics || []);
            setSelectedTopics(p.selectedTopics || []);
            
            // Restore to Dashboard (safer than restoring active call session immediately)
            setAppState(AppState.DASHBOARD);
        }
      } catch (e) { 
          console.error("Failed to hydrate state", e); 
      }
    }
  }, []);

  useEffect(() => {
    if (videoData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            videoUrl, nativeLang, targetLang, level, videoData,
            summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics
        }));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
  }, [videoData, videoUrl, nativeLang, targetLang, level, summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics]);

  const playerRef = useRef<VideoPlayerRef>(null);

  const handleTimestampClick = (offsetMs: number) => {
    if (playerRef.current) {
        playerRef.current.seekTo(offsetMs / 1000);
    }
  };

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic) 
        : [...prev, topic]
    );
  };

  const handleStartPractice = (topic: PracticeTopic) => {
    setActivePracticeTopic(topic);
    setAppState(AppState.PRACTICE_SESSION);
  };

  const handleStart = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      setErrorMsg("Please enter a valid YouTube URL");
      return;
    }

    setErrorMsg('');

    // 1. CHECK USAGE LIMIT FIRST (before any loading state)
    // This keeps user on landing page if blocked
    if (!user) {
      const usageCheck = await checkAnonymousUsageLimit();

      if (!usageCheck.allowed) {
        // Show modal immediately, user stays on landing page
        const info = await getUsageDisplayInfo();
        setUsageInfo(info);
        setShowUsageLimitModal(true);
        return; // Don't proceed, don't change app state
      }
    }

    // 2. Now start loading (user has permission)
    setAppState(AppState.LOADING);
    setLoadingText("Preparing your lesson...");

    try {
      // 3. Fetch Video Metadata (Fast)
      const metadata = await fetchVideoMetadata(videoUrl);

      const vData: VideoData = {
        id: videoId,
        url: videoUrl,
        title: metadata.title
      };
      setVideoData(vData);

      // 4. Get or create video in database
      const dbVideo = await getOrCreateVideo(videoId, metadata.title);

      // 5. Check for cached analysis
      let cachedAnalysis = null;
      if (dbVideo) {
        cachedAnalysis = await getCachedAnalysis(
          dbVideo.id,
          level,
          targetLang,
          nativeLang
        );
      }

      if (cachedAnalysis) {
        // CACHE HIT - Use cached data immediately (no API cost!)
        console.log('Cache hit! Using cached analysis.');
        const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);

        setSummary(analysis.summary);
        setTranslatedSummary(analysis.translatedSummary);
        setTopics(analysis.topics);
        setVocabulary(analysis.vocabulary);
        setTranscript(analysis.transcript || []);
        setDiscussionTopics(analysis.discussionTopics || []);
        setSelectedTopics([]);
        setIsAnalysisLoading(false);
        setAppState(AppState.DASHBOARD);

        // Note: No usage recorded for cached results - Free for anonymous!
        return;
      }

      // --- CACHE MISS: AI REQUIRED ---
      console.log('Cache miss. Calling AI API...');
      setIsAnalysisLoading(true);

      // Hybrid Loading Logic:
      // - If analysis finishes fast (< 20s), go to dashboard immediately when done.
      // - At 10s, update loading text.
      // - If analysis is slow (> 25s), go to dashboard at 25s mark and show skeletons.

      const analysisPromise = analyzeVideoContent(metadata.title, videoUrl, nativeLang, targetLang, level);

      let isDashboardShown = false;
      const showDashboard = () => {
          if (!isDashboardShown) {
              setAppState(AppState.DASHBOARD);
              isDashboardShown = true;
          }
      };

      // Timer 1: Update message at 10s
      const messageTimerId = setTimeout(() => {
          setLoadingText("Longer videos require more time to analyze...");
      }, 10000);

      // Timer 2: Max wait time for loading screen: 25 seconds
      const maxWaitTimerId = setTimeout(() => {
          showDashboard();
      }, 25000);

      analysisPromise
        .then(async (analysis) => {
            setSummary(analysis.summary);
            setTranslatedSummary(analysis.translatedSummary);
            setTopics(analysis.topics);
            setVocabulary(analysis.vocabulary);
            setTranscript(analysis.transcript || []);
            setDiscussionTopics(analysis.discussionTopics || []);
            setSelectedTopics([]);

            // Save to cache (async, don't block UI)
            if (dbVideo) {
              const savedAnalysis = await saveCachedAnalysis(
                dbVideo.id,
                level,
                targetLang,
                nativeLang,
                analysis,
                user?.id
              );

              // Save practice topics for Quick Start feature
              if (savedAnalysis && analysis.discussionTopics) {
                savePracticeTopicsFromAnalysis(
                  savedAnalysis.id,
                  analysis.discussionTopics,
                  level
                );
              }
            }

            // Record anonymous usage (only for fresh analyses, not cached)
            if (!user) {
              recordAnonymousUsage();
              // Update local state if needed
              const info = await getUsageDisplayInfo();
              setUsageInfo(info);
            }

            // Done: Cancel timers and show dashboard now
            clearTimeout(messageTimerId);
            clearTimeout(maxWaitTimerId);
            showDashboard();
        })
        .catch(err => {
            console.error("Analysis background error:", err);
            clearTimeout(messageTimerId);
            clearTimeout(maxWaitTimerId);
            showDashboard(); // Proceed to dashboard even on partial error
        })
        .finally(() => {
            setIsAnalysisLoading(false);
        });

    } catch (err: any) {
      console.error(err);
      const message = err.message || "Failed to load video data. Please try again.";
      setErrorMsg(message);
      setAppState(AppState.LANDING);
    }
  };

  const handleVideoError = (msg: string) => {
    console.error("Video Error:", msg);
    setErrorMsg(msg);
    setVideoData(null);
    setAppState(AppState.LANDING);
  };

  const handleLogoClick = () => {
    setAppState(AppState.LANDING);
    setVideoUrl('');
    setVideoData(null);
    setSummary('');
    setTranslatedSummary('');
    setTopics([]);
    setVocabulary([]);
    setTranscript([]);
    setDiscussionTopics([]);
    setSelectedTopics([]);
    setErrorMsg('');
  };

  const StartCallButton = () => (
    <button
      onClick={() => setShowTutorWindow(true)}
      className="fixed bottom-8 right-8 z-50 group flex items-center gap-2 bg-zinc-900 text-white border border-zinc-700 p-4 rounded-full shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden max-w-[60px] hover:max-w-[200px]"
      aria-label="Start Chatting"
    >
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 9h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
         </svg>
      </div>
      <span className="font-medium text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
        Start Conversation
      </span>
    </button>
  );

  const shouldShowHeader = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION;
  const isScrollable = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION;

  return (
    <Layout
        onLogoClick={handleLogoClick}
        targetLang={shouldShowHeader ? targetLang : undefined}
        level={shouldShowHeader ? level : undefined}
        isScrollable={isScrollable}
        authModalOpen={showAuthModal}
        onAuthModalClose={() => setShowAuthModal(false)}
    >
      {/* 1. LANDING PAGE */}
      {appState === AppState.LANDING && (
        <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
           <div className="w-full max-w-xl text-center space-y-8">
              <div className="space-y-3">
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-800 tracking-tight">
                    Daily efforts
                  </h2>
                  <p className="text-base text-stone-500 max-w-md mx-auto leading-relaxed">
                    Turn any YouTube video into a structured language lesson.
                  </p>
              </div>

              <div className="bg-[#FAF9F6] p-6 md:p-8 border border-stone-200 shadow-sm rounded-2xl space-y-5 text-left">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">I Speak</label>
                        <div className="relative group">
                            <select 
                                value={nativeLang}
                                onChange={(e) => setNativeLang(e.target.value)}
                                className="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2.5 px-3 pr-8 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all cursor-pointer hover:bg-stone-50"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">I'm Learning</label>
                        <div className="relative group">
                            <select 
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                className="w-full appearance-none bg-white border border-stone-200 text-stone-700 text-sm rounded-lg py-2.5 px-3 pr-8 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all cursor-pointer hover:bg-stone-50"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">Depth Level</label>
                        <div className="flex flex-wrap md:flex-nowrap bg-white p-1 rounded-lg border border-stone-200 gap-1">
                            {LEVELS.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => setLevel(l.id)}
                                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                                        level === l.id 
                                        ? 'bg-[#FAF9F6] text-stone-800 shadow-sm border border-stone-200' 
                                        : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>

                 <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 ml-1">Source Material</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-200 transition-all rounded-lg shadow-sm"
                      placeholder="Paste YouTube Link..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                 </div>

                 {errorMsg && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-xs font-medium border border-red-100">{errorMsg}</div>}

                 <button
                    onClick={handleStart}
                    disabled={!videoUrl}
                    className="w-full bg-stone-800 text-white font-medium py-3 text-sm rounded-lg shadow-md hover:bg-stone-900 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                 >
                    Start
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 2. LOADING STATE */}
      {appState === AppState.LOADING && (
         <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="relative">
                <div className="w-16 h-16 border-2 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
            </div>
            <p className="text-stone-500 text-sm font-medium animate-pulse">{loadingText}</p>
         </div>
      )}

      {/* 3. DASHBOARD VIEW */}
      {appState === AppState.DASHBOARD && videoData && (
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 p-4 md:p-6 pt-24 max-w-[1600px] mx-auto min-h-screen">
           {/* Left Column: Video & Highlights */}
           <div className="lg:col-span-7 flex flex-col gap-6">
               <div className="w-full aspect-video shrink-0 rounded-xl overflow-hidden shadow-sm border border-stone-200 bg-black">
                   <VideoPlayer ref={playerRef} url={videoData.url} onError={handleVideoError} onTimeUpdate={setCurrentTime} />
               </div>
               
               <TopicSelector 
                  topics={discussionTopics}
                  selectedTopics={selectedTopics}
                  onTopicToggle={handleTopicToggle}
                  isLoading={isAnalysisLoading}
                  onStartPractice={handleStartPractice}
               />
           </div>

           {/* Right Column: Transcript & Vocabulary */}
           <div className="lg:col-span-5 h-[500px] lg:h-[calc(100vh-140px)]"> 
               <ContentTabs 
                  summary={summary}
                  translatedSummary={translatedSummary}
                  topics={topics} 
                  vocabulary={vocabulary} 
                  transcript={transcript}
                  onTimestampClick={handleTimestampClick}
                  isLoading={isAnalysisLoading} 
                  targetLang={targetLang}
                  layoutMode="fixed" 
                  currentTime={currentTime}
                />
           </div>

           {/* Start Conversation Button */}
           {!showTutorWindow && <StartCallButton />}

           {/* Floating AI Tutor Window */}
           <FloatingTutorWindow
             isOpen={showTutorWindow}
             onClose={() => setShowTutorWindow(false)}
             isMinimized={tutorWindowMinimized}
             onMinimizeChange={setTutorWindowMinimized}
             videoTitle={videoData.title}
             summary={summary}
             vocabulary={vocabulary}
             nativeLang={nativeLang}
             targetLang={targetLang}
             level={level}
           />
        </div>
      )}

      {/* 4. PRACTICE SESSION VIEW */}
      {appState === AppState.PRACTICE_SESSION && videoData && activePracticeTopic && (
          <PracticeSession
            topic={activePracticeTopic}
            level={level}
            nativeLang={nativeLang}
            targetLang={targetLang}
            onExit={() => setAppState(AppState.DASHBOARD)}
          />
      )}

      {/* Usage Limit Modal */}
      <UsageLimitModal
        isOpen={showUsageLimitModal}
        onClose={() => setShowUsageLimitModal(false)}
        onLogin={() => {
          setShowUsageLimitModal(false);
          setShowAuthModal(true);
        }}
        usageInfo={usageInfo}
      />
    </Layout>
  );
};

export default App;