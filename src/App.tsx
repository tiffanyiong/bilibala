import React, { useEffect, useState } from 'react';
import ContentTabs from './features/content/components/ContentTabs';
import LiveVoiceInterface from './features/live-voice/components/LiveVoiceInterface';
import VideoPlayer from './features/video/components/VideoPlayer';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import Layout from './shared/components/Layout';
import { LANGUAGES, LEVELS } from './shared/constants';
import { analyzeVideoContent } from './shared/services/geminiService';
import { AppState, TopicPoint, VideoData, VocabularyItem } from './shared/types';

// Custom Chevron for Dropdowns
const ChevronDownIcon = () => (
  <svg className="w-4 h-4 text-zinc-500 pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check(); // Initial check
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isDesktop;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [videoUrl, setVideoUrl] = useState('');
  
  // Language & Level State
  const [nativeLang, setNativeLang] = useState('Chinese');
  const [targetLang, setTargetLang] = useState('English');
  const [level, setLevel] = useState('Easy');

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  
  // Content State
  const [summary, setSummary] = useState('');
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [topics, setTopics] = useState<TopicPoint[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  
  const [errorMsg, setErrorMsg] = useState('');

  const isDesktop = useIsDesktop();

  const handleStart = async () => {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      setErrorMsg("Please enter a valid YouTube URL");
      return;
    }

    setAppState(AppState.LOADING);
    setErrorMsg('');

    try {
      // 1. Fetch Video Metadata
      const metadata = await fetchVideoMetadata(videoUrl);
      
      const vData: VideoData = {
        id: videoId,
        url: videoUrl,
        title: metadata.title
      };
      setVideoData(vData);

      // 2. AI Processing
      const analysis = await analyzeVideoContent(metadata.title, nativeLang, targetLang, level);
      
      setSummary(analysis.summary);
      setTranslatedSummary(analysis.translatedSummary);
      setTopics(analysis.topics);
      setVocabulary(analysis.vocabulary);

      setAppState(AppState.DASHBOARD);
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
    setErrorMsg('');
  };

  const StartCallButton = () => (
    <button
      onClick={() => setAppState(AppState.CALL_SESSION)}
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

  const shouldShowHeader = appState === AppState.DASHBOARD || appState === AppState.CALL_SESSION;
  const isDashboard = appState === AppState.DASHBOARD;
  
  // Allow scrolling for both Dashboard and Call Session
  // This ensures that on smaller desktop screens, the user can scroll to see the full phone UI
  const isScrollable = appState === AppState.DASHBOARD || appState === AppState.CALL_SESSION;

  return (
    <Layout 
        onLogoClick={handleLogoClick}
        targetLang={shouldShowHeader ? targetLang : undefined}
        level={shouldShowHeader ? level : undefined}
        isScrollable={isScrollable}
    >
      {/* 1. LANDING PAGE */}
      {appState === AppState.LANDING && (
        <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto bg-white">
           <div className="w-full max-w-xl text-center space-y-8">
              <div className="space-y-3">
                  <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 tracking-tight">
                    Daily output
                  </h2>
                  <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
                    Turn any YouTube video into a structured language lesson.
                  </p>
              </div>

              <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-2xl space-y-5 text-left">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ml-1">I Speak</label>
                        <div className="relative group">
                            <select 
                                value={nativeLang}
                                onChange={(e) => setNativeLang(e.target.value)}
                                className="w-full appearance-none bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm rounded-lg py-2.5 px-3 pr-8 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all cursor-pointer hover:bg-zinc-100"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ml-1">I'm Learning</label>
                        <div className="relative group">
                            <select 
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                className="w-full appearance-none bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm rounded-lg py-2.5 px-3 pr-8 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all cursor-pointer hover:bg-zinc-100"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ml-1">Depth Level</label>
                        <div className="flex flex-wrap md:flex-nowrap bg-zinc-50 p-1 rounded-lg border border-zinc-200 gap-1">
                            {LEVELS.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => setLevel(l.id)}
                                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                                        level === l.id 
                                        ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' 
                                        : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>

                 <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ml-1">Source Material</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-zinc-300 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200 transition-all rounded-lg shadow-sm"
                      placeholder="Paste YouTube Link..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                 </div>

                 {errorMsg && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-xs font-medium border border-red-100">{errorMsg}</div>}

                 <button
                    onClick={handleStart}
                    disabled={!videoUrl}
                    className="w-full bg-zinc-900 text-white font-medium py-3 text-sm rounded-lg shadow-md hover:bg-black hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                 >
                    Start Analysis
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 2. LOADING STATE */}
      {appState === AppState.LOADING && (
         <div className="h-full flex flex-col items-center justify-center space-y-6 bg-white">
            <div className="relative">
                <div className="w-16 h-16 border-2 border-zinc-100 border-t-zinc-800 rounded-full animate-spin"></div>
            </div>
            <p className="text-zinc-500 text-sm font-medium animate-pulse">Preparing your lesson...</p>
         </div>
      )}

      {/* 3. DASHBOARD VIEW */}
      {appState === AppState.DASHBOARD && videoData && (
        <div className="flex flex-col p-4 md:p-6 pt-24 max-w-5xl mx-auto gap-6 md:gap-8 relative min-h-screen bg-white">
           <div className="w-full aspect-video shrink-0 rounded-xl overflow-hidden shadow-sm border border-zinc-200 bg-zinc-100">
               <VideoPlayer url={videoData.url} onError={handleVideoError} />
           </div>

           <div className="w-full pb-24"> 
               <ContentTabs 
                  summary={summary}
                  translatedSummary={translatedSummary}
                  topics={topics} 
                  vocabulary={vocabulary} 
                  isLoading={false} 
                  targetLang={targetLang}
                  layoutMode="auto" 
                />
           </div>

           <StartCallButton />
        </div>
      )}

      {/* 4. CALL SESSION VIEW */}
      {appState === AppState.CALL_SESSION && videoData && (
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 p-4 md:p-6 pt-24 max-w-[1600px] mx-auto min-h-screen bg-white">
           {/* Left: Phone Interface */}
           <div className="lg:col-span-5 h-[85vh] lg:h-[calc(100vh-140px)] min-h-[550px] shrink-0">
               <LiveVoiceInterface 
                  videoTitle={videoData.title} 
                  videoUrl={videoData.url} 
                  summary={summary}
                  vocabulary={vocabulary}
                  nativeLang={nativeLang}
                  targetLang={targetLang}
                  level={level}
                  onSessionEnd={() => setAppState(AppState.DASHBOARD)}
               />
           </div>

           {/* Right: Content Reference 
               - Mobile: Auto height to fit content naturally below.
               - Desktop: Match height of left column.
           */}
           <div className="lg:col-span-7 h-auto lg:h-[calc(100vh-140px)] min-h-[400px] shrink-0">
               <ContentTabs 
                  summary={summary}
                  translatedSummary={translatedSummary}
                  topics={topics} 
                  vocabulary={vocabulary} 
                  isLoading={false} 
                  targetLang={targetLang}
                  layoutMode={isDesktop ? 'fixed' : 'auto'}
                />
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;