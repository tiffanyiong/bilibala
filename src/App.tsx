import React, { useState, useEffect } from 'react';
import Layout from './shared/components/Layout';
import ContentTabs from './features/content/components/ContentTabs';
import LiveVoiceInterface from './features/live-voice/components/LiveVoiceInterface';
import VideoPlayer from './features/video/components/VideoPlayer';
import { AppState, VideoData, TopicPoint, VocabularyItem } from './shared/types';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import { analyzeVideoContent } from './shared/services/geminiService';
import { LANGUAGES, LEVELS } from './shared/constants';

// Custom Chevron for Dropdowns
const ChevronDownIcon = () => (
  <svg className="w-5 h-5 text-cyan-800 pointer-events-none absolute right-5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
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
      className="fixed bottom-8 right-8 z-50 group flex items-center gap-2 bg-yellow-400 text-yellow-900 border-4 border-white p-4 rounded-full shadow-xl shadow-yellow-600/20 hover:-translate-y-2 transition-all duration-300 overflow-hidden max-w-[80px] hover:max-w-[240px]"
      aria-label="Start Chatting"
    >
      <div className="w-8 h-8 flex items-center justify-center shrink-0 text-yellow-900">
         <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 9h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M8 13h5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
         </svg>
      </div>
      <span className="font-black uppercase font-display text-lg tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
        Jump In!
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
        <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
           <div className="w-full max-w-2xl text-center space-y-4 md:space-y-5">
              <div className="space-y-1 md:space-y-2">
                  <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight font-display drop-shadow-lg" style={{ textShadow: '4px 4px 0px rgba(8, 145, 178, 0.4)' }}>
                    Dive Into<br/>
                    <span className="text-yellow-300">Language Fluency</span>
                  </h2>
                  <p className="text-lg md:text-xl text-cyan-50 font-bold w-full mx-auto leading-relaxed drop-shadow-md">
                    Turn any YouTube video into a refreshing language pool party.
                  </p>
              </div>

              <div className="bg-white/20 backdrop-blur-xl p-4 md:p-6 shadow-2xl shadow-cyan-900/20 rounded-[2rem] md:rounded-[3rem] space-y-3 relative border border-white/40">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                        <label className="text-xs font-bold uppercase tracking-wider text-cyan-100 ml-4 mb-1 block">I Speak</label>
                        <div className="relative group">
                            <select 
                                value={nativeLang}
                                onChange={(e) => setNativeLang(e.target.value)}
                                className="w-full appearance-none bg-white/40 backdrop-blur-md border-2 border-white/60 text-cyan-900 font-bold rounded-2xl py-2 px-5 pr-12 outline-none focus:bg-white/60 focus:border-white focus:ring-4 focus:ring-cyan-300/30 transition-all cursor-pointer hover:bg-white/50 text-base shadow-sm"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="space-y-1 text-left">
                        <label className="text-xs font-bold uppercase tracking-wider text-cyan-100 ml-4 mb-1 block">I'm Learning</label>
                        <div className="relative group">
                            <select 
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                className="w-full appearance-none bg-white/40 backdrop-blur-md border-2 border-white/60 text-cyan-900 font-bold rounded-2xl py-2 px-5 pr-12 outline-none focus:bg-white/60 focus:border-white focus:ring-4 focus:ring-cyan-300/30 transition-all cursor-pointer hover:bg-white/50 text-base shadow-sm"
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDownIcon />
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-1 text-left">
                        <label className="text-xs font-bold uppercase tracking-wider text-cyan-100 ml-4 mb-1 block">Depth Level</label>
                        <div className="flex flex-wrap md:flex-nowrap bg-white/30 p-1.5 rounded-2xl border border-white/40 shadow-inner gap-2">
                            {LEVELS.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => setLevel(l.id)}
                                    className={`flex-1 min-w-[30%] py-1.5 md:py-2 rounded-xl font-black transition-all text-sm md:text-base ${
                                        level === l.id 
                                        ? 'bg-white text-cyan-600 shadow-md transform scale-[1.02] ring-2 ring-white/50' 
                                        : 'text-cyan-800 hover:bg-white/20'
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>

                 <div className="relative mt-1">
                    <input
                      type="text"
                      className="w-full bg-white/60 border-2 border-white/60 px-5 py-2.5 pr-12 text-base md:text-lg font-bold placeholder:text-cyan-800/40 text-cyan-900 focus:outline-none focus:bg-white/80 focus:ring-4 focus:ring-cyan-300/30 transition-all rounded-2xl shadow-inner"
                      placeholder="Paste YouTube Link..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                 </div>

                 {errorMsg && <div className="bg-red-400 text-white font-bold p-3 rounded-2xl text-sm shadow-lg border border-red-300">{errorMsg}</div>}

                 <button
                    onClick={handleStart}
                    disabled={!videoUrl}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-black py-2.5 md:py-3 text-lg md:text-xl rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 border-t border-white/30"
                 >
                    Splash In!
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 2. LOADING STATE */}
      {appState === AppState.LOADING && (
         <div className="h-full flex flex-col items-center justify-center space-y-8">
            <div className="relative">
                <div className="w-32 h-32 border-8 border-white/30 border-t-white rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                        <circle cx="12" cy="12" r="10" fillOpacity="0.8"/>
                    </svg>
                </div>
            </div>
            <p className="text-white font-bold text-3xl font-display animate-pulse drop-shadow-md">Inflating Ducks...</p>
         </div>
      )}

      {/* 3. DASHBOARD VIEW */}
      {appState === AppState.DASHBOARD && videoData && (
        <div className="flex flex-col p-4 md:p-6 pt-20 md:pt-24 max-w-5xl mx-auto gap-6 md:gap-8 relative">
           <div className="w-full aspect-video shrink-0 rounded-[2rem] overflow-hidden shadow-2xl shadow-cyan-900/40 z-0 ring-4 ring-white/30">
               <VideoPlayer url={videoData.url} onError={handleVideoError} />
           </div>

           <div className="w-full rounded-[2rem] pb-24"> 
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
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 p-4 md:p-6 pt-20 md:pt-24 max-w-[1600px] mx-auto">
           {/* Left: Phone Interface 
               - Mobile: 85vh to cover most screen, but allow scroll to see content below.
               - Desktop: Fixed height calc.
           */}
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