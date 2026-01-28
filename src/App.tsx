import React, { useEffect, useRef, useState } from 'react';
import ContentTabs from './features/content/components/ContentTabs';
import TopicSelector from './features/content/components/TopicSelector';
import VideoLibraryPage from './features/library/components/VideoLibraryPage';
import PracticeReportsPage from './features/library/components/PracticeReportsPage';
import PracticeReportDetailPage from './features/library/components/PracticeReportDetailPage';
import FloatingTutorWindow from './features/live-voice/components/FloatingTutorWindow';
import PracticeSession from './features/practice/components/PracticeSession';
import VideoPlayer, { VideoPlayerRef } from './features/video/components/VideoPlayer';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import Layout from './shared/components/Layout';
import UsageLimitModal from './shared/components/UsageLimitModal';
import { LANGUAGES, LEVELS } from './shared/constants';
import { useAuth } from './shared/context/AuthContext';
import {
  addToUserLibrary,
  dbAnalysisToContentAnalysis,
  getCachedAnalysis,
  getCachedAnalysisById,
  getOrCreateVideo,
  getPracticeTopicsForAnalysis,
  saveCachedAnalysis,
  savePracticeTopicsFromAnalysis,
  toggleLibraryFavorite,
  updateLibraryAccess,
} from './shared/services/database';
import { analyzeVideoContent } from './shared/services/geminiService';
import {
  checkAnonymousUsageLimit,
  getUsageDisplayInfo,
  recordAnonymousUsage,
  UsageDisplayInfo
} from './shared/services/usageTracking';
import { AppState, PracticeTopic, TopicPoint, VideoData, VocabularyItem } from './shared/types';
import { VideoHistoryItem } from './shared/types/database';

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
  const [allSelectedPracticeTopics, setAllSelectedPracticeTopics] = useState<PracticeTopic[]>([]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparing your lesson...");
  const [currentTime, setCurrentTime] = useState(0);

  // Library entry state (for save/favorite functionality)
  const [libraryEntry, setLibraryEntry] = useState<{ libraryId: string; isFavorite: boolean } | null>(null);

  // Practice reports full-page state
  const [currentReportsVideo, setCurrentReportsVideo] = useState<VideoHistoryItem | null>(null);
  const [currentReportSessionId, setCurrentReportSessionId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState('');

  // --- History / Navigation Logic ---
  // Helper to parse path-based routes
  const parsePathRoute = (pathname: string) => {
    // Remove leading slash and split
    const parts = pathname.slice(1).split('/').filter(Boolean);

    if (parts.length === 0) {
      return { type: 'landing' as const };
    }
    if (parts[0] === 'library') {
      return { type: 'library' as const };
    }
    // Assume first part is video ID (which is actually analysisId for reports)
    const videoId = parts[0];
    if (parts[1] === 'practice') {
      return { type: 'practice' as const, videoId };
    }
    if (parts[1] === 'reports') {
      if (parts[2]) {
        return { type: 'report-detail' as const, videoId, sessionId: parts[2] };
      }
      return { type: 'reports' as const, videoId };
    }
    return { type: 'dashboard' as const, videoId };
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = parsePathRoute(window.location.pathname);

      if (route.type === 'library') {
        setCurrentReportsVideo(null);
        setCurrentReportSessionId(null);
        setAppState(AppState.VIDEO_LIBRARY);
      } else if (route.type === 'reports') {
        if (currentReportsVideo && currentReportsVideo.analysisId === route.videoId) {
          setCurrentReportSessionId(null);
          setAppState(AppState.PRACTICE_REPORTS);
        } else {
          // No video context, redirect to library
          setAppState(AppState.VIDEO_LIBRARY);
          window.history.replaceState(null, '', '/library');
        }
      } else if (route.type === 'report-detail') {
        if (currentReportsVideo && currentReportsVideo.analysisId === route.videoId) {
          setCurrentReportSessionId(route.sessionId);
          setAppState(AppState.PRACTICE_REPORT_DETAIL);
        } else {
          // No video context, redirect to library
          setAppState(AppState.VIDEO_LIBRARY);
          window.history.replaceState(null, '', '/library');
        }
      } else if (route.type === 'dashboard') {
        if (videoData && videoData.id === route.videoId) {
          setAppState(AppState.DASHBOARD);
        } else {
          // Video ID in URL doesn't match current video - go to landing
          setAppState(AppState.LANDING);
          window.history.replaceState(null, '', '/');
        }
      } else if (route.type === 'practice') {
        if (videoData && videoData.id === route.videoId && activePracticeTopic) {
          setAppState(AppState.PRACTICE_SESSION);
        } else if (videoData && videoData.id === route.videoId) {
          setAppState(AppState.DASHBOARD);
          window.history.replaceState(null, '', `/${route.videoId}`);
        } else {
          setAppState(AppState.LANDING);
          window.history.replaceState(null, '', '/');
        }
      } else {
        setAppState(AppState.LANDING);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [videoData, activePracticeTopic, currentReportsVideo]);

  // Sync State -> URL path
  useEffect(() => {
    if (appState === AppState.LOADING) return;

    const currentPath = window.location.pathname;
    let targetPath = '/';

    if (appState === AppState.DASHBOARD && videoData) {
      targetPath = `/${videoData.id}`;
    } else if (appState === AppState.PRACTICE_SESSION && videoData) {
      targetPath = `/${videoData.id}/practice`;
    } else if (appState === AppState.VIDEO_LIBRARY) {
      targetPath = '/library';
    } else if (appState === AppState.PRACTICE_REPORTS && currentReportsVideo) {
      targetPath = `/${currentReportsVideo.analysisId}/reports`;
    } else if (appState === AppState.PRACTICE_REPORT_DETAIL && currentReportsVideo && currentReportSessionId) {
      targetPath = `/${currentReportsVideo.analysisId}/reports/${currentReportSessionId}`;
    }

    if (currentPath !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [appState, videoData, currentReportsVideo, currentReportSessionId]);

  // --- Persistence Logic ---
  const STORAGE_KEY = 'bilibala_state_v1';

  useEffect(() => {
    // Check initial URL path for routing
    const route = parsePathRoute(window.location.pathname);

    // Handle library route directly
    if (route.type === 'library') {
      setAppState(AppState.VIDEO_LIBRARY);
      return;
    }

    // Handle reports routes - redirect to library (need context to view reports)
    if (route.type === 'reports' || route.type === 'report-detail') {
      setAppState(AppState.VIDEO_LIBRARY);
      window.history.replaceState(null, '', '/library');
      return;
    }

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
            setCurrentAnalysisId(p.currentAnalysisId || null);

            // Check if URL contains a video ID that matches saved data
            if (route.type === 'dashboard' && route.videoId === p.videoData.id) {
              setAppState(AppState.DASHBOARD);
            } else if (route.type === 'practice' && route.videoId === p.videoData.id) {
              // Can't restore practice without active topic, go to dashboard
              setAppState(AppState.DASHBOARD);
              window.history.replaceState(null, '', `/${p.videoData.id}`);
            } else if (route.type === 'landing') {
              // No video ID in URL, restore to dashboard with saved video
              setAppState(AppState.DASHBOARD);
            } else {
              // URL video ID doesn't match saved data - go to landing
              setAppState(AppState.LANDING);
              window.history.replaceState(null, '', '/');
            }
            return;
        }
      } catch (e) {
          console.error("Failed to hydrate state", e);
      }
    }

    // No saved state - if URL has a video ID, redirect to landing
    if (route.type === 'dashboard' || route.type === 'practice') {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  useEffect(() => {
    if (videoData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            videoUrl, nativeLang, targetLang, level, videoData,
            summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics,
            currentAnalysisId
        }));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
  }, [videoData, videoUrl, nativeLang, targetLang, level, summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics, currentAnalysisId]);

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
    console.log('[App] handleStartPractice called. currentAnalysisId:', currentAnalysisId);
    // Get all selected topic objects
    const allTopics = discussionTopics.filter(t => selectedTopics.includes(t.topic));
    setAllSelectedPracticeTopics(allTopics);
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
        console.log('Cache hit! Using cached analysis. Analysis ID:', cachedAnalysis.id);
        const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);

        setSummary(analysis.summary);
        setTranslatedSummary(analysis.translatedSummary);
        setTopics(analysis.topics);
        setVocabulary(analysis.vocabulary);
        setTranscript(analysis.transcript || []);
        setSelectedTopics([]);
        setCurrentAnalysisId(cachedAnalysis.id);
        console.log('[App] setCurrentAnalysisId called with:', cachedAnalysis.id);
        setIsAnalysisLoading(false);
        setAppState(AppState.DASHBOARD);

        // Fetch practice topics with database IDs and merge with discussion topics
        const dbTopics = await getPracticeTopicsForAnalysis(cachedAnalysis.id);
        if (dbTopics.length > 0 && analysis.discussionTopics) {
          // Merge database IDs into discussion topics
          const topicsWithIds = analysis.discussionTopics.map(topic => {
            const dbTopic = dbTopics.find(dt => dt.topic === topic.topic);
            if (dbTopic) {
              return {
                ...topic,
                topicId: dbTopic.id,
                questionId: dbTopic.questionId,
              };
            }
            return topic;
          });
          setDiscussionTopics(topicsWithIds);
          console.log('[App] Discussion topics with IDs:', topicsWithIds);
        } else {
          setDiscussionTopics(analysis.discussionTopics || []);
        }

        // Add to user's library (even if it's someone else's cached analysis)
        // This ensures the video appears in their library for future access
        if (user) {
          addToUserLibrary(user.id, cachedAnalysis.id)
            .then((entry) => {
              if (entry) {
                setLibraryEntry({
                  libraryId: entry.id,
                  isFavorite: entry.is_favorite,
                });
              }
            })
            .catch((err) => {
              console.error('Failed to add to user library:', err);
            });
        } else {
          setLibraryEntry(null);
        }

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

              // Store the analysis ID for linking practice sessions
              if (savedAnalysis) {
                setCurrentAnalysisId(savedAnalysis.id);

                // Add to user's library (for logged-in users)
                if (user) {
                  addToUserLibrary(user.id, savedAnalysis.id)
                    .then((entry) => {
                      if (entry) {
                        setLibraryEntry({
                          libraryId: entry.id,
                          isFavorite: entry.is_favorite,
                        });
                      }
                    })
                    .catch((err) => {
                      console.error('Failed to add to user library:', err);
                    });
                } else {
                  setLibraryEntry(null);
                }

                // Save practice topics for Quick Start feature and get IDs
                if (analysis.discussionTopics) {
                  const topicsWithIds = await savePracticeTopicsFromAnalysis(
                    savedAnalysis.id,
                    analysis.discussionTopics,
                    level
                  );
                  // Update discussion topics with database IDs
                  if (topicsWithIds.length > 0) {
                    setDiscussionTopics(topicsWithIds);
                  }
                }
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
    setCurrentAnalysisId(null);
    setLibraryEntry(null);
    setErrorMsg('');
  };

  // Handle loading a video from the library
  const handleLoadFromLibrary = async (video: VideoHistoryItem) => {
    // Set loading state
    setAppState(AppState.LOADING);
    setLoadingText('Loading your video...');

    try {
      // Reconstruct video URL from youtubeId
      const videoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
      setVideoUrl(videoUrl);

      // Set language/level from the stored analysis
      setNativeLang(video.nativeLang);
      setTargetLang(video.targetLang);
      setLevel(video.level);

      // Set video data
      setVideoData({
        id: video.youtubeId,
        url: videoUrl,
        title: video.title,
      });

      // Fetch the cached analysis directly by analysisId
      const cachedAnalysis = await getCachedAnalysisById(video.analysisId);

      if (cachedAnalysis) {
        const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);
        setSummary(analysis.summary);
        setTranslatedSummary(analysis.translatedSummary || '');
        setTopics(analysis.topics);
        setVocabulary(analysis.vocabulary);
        setTranscript(analysis.transcript || []);
        setCurrentAnalysisId(video.analysisId);

        // Fetch practice topics with database IDs and merge with discussion topics
        const dbTopics = await getPracticeTopicsForAnalysis(video.analysisId);
        if (dbTopics.length > 0 && analysis.discussionTopics) {
          // Merge database IDs into discussion topics
          const topicsWithIds = analysis.discussionTopics.map(topic => {
            const dbTopic = dbTopics.find(dt => dt.topic === topic.topic);
            if (dbTopic) {
              return {
                ...topic,
                topicId: dbTopic.id,
                questionId: dbTopic.questionId,
              };
            }
            return topic;
          });
          setDiscussionTopics(topicsWithIds);
        } else {
          setDiscussionTopics(analysis.discussionTopics || []);
        }

        // Update last_accessed_at and set library entry
        if (user) {
          updateLibraryAccess(user.id, video.analysisId).catch((err) => {
            console.error('Failed to update library access:', err);
          });
        }

        // Set library entry state
        setLibraryEntry({
          libraryId: video.libraryId,
          isFavorite: video.isFavorite,
        });

        setAppState(AppState.DASHBOARD);
      } else {
        throw new Error('Failed to load analysis');
      }
    } catch (error) {
      console.error('Error loading from library:', error);
      setErrorMsg('Failed to load video. Please try again.');
      setAppState(AppState.LANDING);
    }
  };

  // Handle saving current video to library (for users viewing someone else's analysis)
  const handleSaveToLibrary = async () => {
    if (!user || !currentAnalysisId) return;

    const entry = await addToUserLibrary(user.id, currentAnalysisId);
    if (entry) {
      setLibraryEntry({
        libraryId: entry.id,
        isFavorite: entry.is_favorite,
      });
    }
  };

  // Handle toggling favorite on current video
  const handleToggleFavorite = async () => {
    if (!user || !libraryEntry) return;

    const newValue = await toggleLibraryFavorite(user.id, libraryEntry.libraryId);
    if (newValue !== null) {
      setLibraryEntry(prev => prev ? { ...prev, isFavorite: newValue } : null);
    }
  };

  // Handle expanding reports from modal to full page
  const handleExpandReports = (video: VideoHistoryItem, sessionId?: string) => {
    setCurrentReportsVideo(video);
    if (sessionId) {
      setCurrentReportSessionId(sessionId);
      setAppState(AppState.PRACTICE_REPORT_DETAIL);
    } else {
      setCurrentReportSessionId(null);
      setAppState(AppState.PRACTICE_REPORTS);
    }
  };

  // Handle viewing a report from the reports page
  const handleViewReportFromPage = (session: { id: string }) => {
    setCurrentReportSessionId(session.id);
    setAppState(AppState.PRACTICE_REPORT_DETAIL);
  };

  // Handle going back to reports list from report detail
  const handleBackToReportsList = () => {
    // Use replaceState to avoid duplicate history entries
    if (currentReportsVideo) {
      window.history.replaceState(null, '', `/${currentReportsVideo.analysisId}/reports`);
    }
    setCurrentReportSessionId(null);
    setAppState(AppState.PRACTICE_REPORTS);
  };

  // Handle going back to library from reports
  const handleBackFromReportsToLibrary = () => {
    // Use replaceState to avoid duplicate history entries
    window.history.replaceState(null, '', '/library');
    setCurrentReportsVideo(null);
    setCurrentReportSessionId(null);
    setAppState(AppState.VIDEO_LIBRARY);
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
  const isScrollable = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION || appState === AppState.VIDEO_LIBRARY || appState === AppState.PRACTICE_REPORTS || appState === AppState.PRACTICE_REPORT_DETAIL;

  return (
    <Layout
        onLogoClick={handleLogoClick}
        targetLang={shouldShowHeader ? targetLang : undefined}
        level={shouldShowHeader ? level : undefined}
        isScrollable={isScrollable}
        authModalOpen={showAuthModal}
        onAuthModalClose={() => setShowAuthModal(false)}
        onOpenVideoLibrary={() => setAppState(AppState.VIDEO_LIBRARY)}
    >
      {/* 1. LANDING PAGE */}
      {appState === AppState.LANDING && (
        <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
           <div className="w-full max-w-xl text-center space-y-8">
              <div className="space-y-3">
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-800 tracking-tight">
                    Bilibala
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

               {/* Video Title & Actions */}
               <div className="flex items-start justify-between gap-4">
                 <h1 className="text-lg md:text-xl font-medium text-stone-800 line-clamp-2">
                   {videoData.title}
                 </h1>
                 {user && (
                   <div className="flex items-center gap-2 shrink-0">
                     {libraryEntry ? (
                       <button
                         onClick={handleToggleFavorite}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                           libraryEntry.isFavorite
                             ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                             : 'bg-white text-stone-600 border-stone-200 hover:border-red-300 hover:text-red-500'
                         }`}
                       >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill={libraryEntry.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                         </svg>
                         {libraryEntry.isFavorite ? 'Favorited' : 'Favorite'}
                       </button>
                     ) : (
                       <button
                         onClick={handleSaveToLibrary}
                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-stone-800 text-white hover:bg-stone-900 transition-all"
                       >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                         </svg>
                         Save to Library
                       </button>
                     )}
                   </div>
                 )}
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
            allTopics={allSelectedPracticeTopics}
            onTopicChange={setActivePracticeTopic}
            level={level}
            nativeLang={nativeLang}
            targetLang={targetLang}
            analysisId={currentAnalysisId}
            onExit={() => setAppState(AppState.DASHBOARD)}
          />
      )}

      {/* 5. VIDEO LIBRARY PAGE */}
      {appState === AppState.VIDEO_LIBRARY && (
        <VideoLibraryPage
          onSelectVideo={handleLoadFromLibrary}
          onExpandReports={handleExpandReports}
        />
      )}

      {/* 6. PRACTICE REPORTS PAGE (full page) */}
      {appState === AppState.PRACTICE_REPORTS && currentReportsVideo && (
        <PracticeReportsPage
          video={currentReportsVideo}
          onBack={handleBackFromReportsToLibrary}
          onViewReport={handleViewReportFromPage}
        />
      )}

      {/* 7. PRACTICE REPORT DETAIL PAGE (full page) */}
      {appState === AppState.PRACTICE_REPORT_DETAIL && currentReportsVideo && currentReportSessionId && (
        <PracticeReportDetailPage
          sessionId={currentReportSessionId}
          video={currentReportsVideo}
          onBack={handleBackToReportsList}
          onBackToLibrary={handleBackFromReportsToLibrary}
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