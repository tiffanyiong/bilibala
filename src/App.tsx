import React, { useEffect, useRef, useState } from 'react';
import ContentTabs from './features/content/components/ContentTabs';
import TopicSelector from './features/content/components/TopicSelector';
import VideoLibraryPage from './features/library/components/VideoLibraryPage';
import PracticeReportsPage from './features/library/components/PracticeReportsPage';
import PracticeReportDetailPage from './features/library/components/PracticeReportDetailPage';
import SubscriptionPage from './features/subscription/components/SubscriptionPage';
import { ProfilePage } from './features/profile';
import SettingsPage from './features/settings/components/SettingsPage';
import TranslationPopup from './features/translation/components/TranslationPopup';
import { CubeCarousel } from './features/explore';
import FloatingTutorWindow from './features/live-voice/components/FloatingTutorWindow';
import PracticeSession from './features/practice/components/PracticeSession';
import VideoPlayer, { VideoPlayerRef } from './features/video/components/VideoPlayer';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import Layout from './shared/components/Layout';
import UsageLimitModal from './shared/components/UsageLimitModal';
import { useAuth } from './shared/context/AuthContext';
import { useSubscription } from './shared/context/SubscriptionContext';
import UpgradeModal from './features/subscription/components/UpgradeModal';
import {
  addToUserLibrary,
  dbAnalysisToContentAnalysis,
  getAnyCachedAnalysisForYoutubeId,
  getCachedAnalysis,
  getCachedAnalysisById,
  getCachedAnalysisWithVideoById,
  getOrCreateVideo,
  getVideoByYoutubeId,
  getPracticeTopicsForAnalysis,
  getQuestionsForTopic,
  getUserVideoLibrary,
  incrementVideoView,
  saveCachedAnalysis,
  savePracticeTopicsFromAnalysis,
  updateCachedAnalysisContent,
  saveGeneratedQuestion,
  countAiGeneratedQuestions,
  updateVideoCategory,
  getLibraryEntry,
  toggleLibraryFavorite,
  updateLibraryAccess,
} from './shared/services/database';
import { getBackendOrigin } from './shared/services/backend';
import { analyzeVideoContent } from './shared/services/geminiService';
import {
  checkAnonymousPracticeLimit,
  checkAnonymousUsageLimit,
  getUsageDisplayInfo,
  recordAnonymousUsage,
  UsageDisplayInfo
} from './shared/services/usageTracking';
import { AppState, PracticeTopic, TopicQuestion, TopicPoint, VideoData, VocabularyItem } from './shared/types';
import { VideoHistoryItem, TIER_LIMITS } from './shared/types/database';

const App: React.FC = () => {
  // Reveal body after mount to prevent FOUC with Tailwind CDN
  useEffect(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  }, []);

  const { user, loading: authLoading } = useAuth();
  const { canAddVideo, canStartPractice, canUseAiTutor, canExportPdf, recordAction, tier, syncWithStripe, aiTutorRemainingMinutes, createCreditCheckout } = useSubscription();

  // Sync subscription with Stripe when returning from checkout (handles missed webhooks)
  // This runs at app level to catch success redirects regardless of which page user lands on
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && user) {
      // Only handle sync here if NOT on subscription page (SubscriptionPage handles its own case)
      const isSubscriptionPage = window.location.pathname === '/subscription';
      if (!isSubscriptionPage) {
        // Clean up URL query params
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
      }
      // Always sync with Stripe
      syncWithStripe().then((synced) => {
        if (synced) {
          console.log('[App] Synced subscription with Stripe after checkout');
        }
      });
    }
  }, [user, syncWithStripe]);


  // Filter out questions that don't match the target language script
  // (e.g., English questions when target is Chinese — from old cached data)
  const LANG_SCRIPT_PATTERNS: Record<string, RegExp> = {
    'Chinese (Mandarin - 中文)': /[\u4e00-\u9fff]/,
    'Japanese (日本語)': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
    'Korean (한국어)': /[\uac00-\ud7af\u1100-\u11ff]/,
    'Hindi (हिन्दी)': /[\u0900-\u097f]/,
    'Arabic (العربية)': /[\u0600-\u06ff]/,
    'Russian (Русский)': /[\u0400-\u04ff]/,
  };
  const filterQuestionsByLang = (questions: TopicQuestion[], lang: string): TopicQuestion[] => {
    const pattern = LANG_SCRIPT_PATTERNS[lang];
    if (!pattern) return questions; // Latin-script languages — no filtering needed
    return questions.filter(q => pattern.test(q.question));
  };

  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [videoUrl, setVideoUrl] = useState('');
  // Video ID to load from URL (when visiting a direct video link)
  const [pendingVideoIdFromUrl, setPendingVideoIdFromUrl] = useState<string | null>(null);

  // Navigate back to landing when user signs out
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      setAppState(AppState.LANDING);
      setShowTutorWindow(false);
    }
    prevUserRef.current = user;
  }, [user]);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  // Language & Level State
  const [nativeLang, setNativeLang] = useState('Chinese (Mandarin - 中文)');
  const [targetLang, setTargetLang] = useState('English');
  const [level, setLevel] = useState('Easy');

  // Translator setting: null = use video's native language, string = always translate to this
  const [translatorTargetLang, setTranslatorTargetLang] = useState<string | null>(null);



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
  const [transcriptLangMismatch, setTranscriptLangMismatch] = useState(false);
  const [discussionTopics, setDiscussionTopics] = useState<PracticeTopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [activePracticeTopic, setActivePracticeTopic] = useState<PracticeTopic | null>(null);
  const [allSelectedPracticeTopics, setAllSelectedPracticeTopics] = useState<PracticeTopic[]>([]);
  const [allQuestionsForTopic, setAllQuestionsForTopic] = useState<TopicQuestion[]>([]);
  const [aiGeneratedQuestionCount, setAiGeneratedQuestionCount] = useState(0);
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
    if (parts[0] === 'subscription') {
      return { type: 'subscription' as const };
    }
    if (parts[0] === 'profile') {
      return { type: 'profile' as const };
    }
    if (parts[0] === 'settings') {
      return { type: 'settings' as const };
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

      if (route.type === 'subscription') {
        setAppState(AppState.SUBSCRIPTION);
      } else if (route.type === 'profile') {
        setAppState(AppState.PROFILE);
      } else if (route.type === 'settings') {
        setAppState(AppState.SETTINGS);
      } else if (route.type === 'library') {
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

  // Track if app has been initialized (to prevent URL sync on first render)
  const isInitializedRef = useRef(false);

  // Sync State -> URL path
  useEffect(() => {
    // Skip on initial render - let the initialization effect handle routing first
    if (!isInitializedRef.current) return;
    if (appState === AppState.LOADING) return;

    const currentPath = window.location.pathname;
    let targetPath = '/';

    if (appState === AppState.DASHBOARD && videoData) {
      targetPath = `/${videoData.id}`;
    } else if (appState === AppState.PRACTICE_SESSION && videoData) {
      targetPath = `/${videoData.id}/practice`;
    } else if (appState === AppState.SUBSCRIPTION) {
      targetPath = '/subscription';
    } else if (appState === AppState.PROFILE) {
      targetPath = '/profile';
    } else if (appState === AppState.SETTINGS) {
      targetPath = '/settings';
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
      isInitializedRef.current = true;
      return;
    }

    // Handle subscription route directly
    if (route.type === 'subscription') {
      setAppState(AppState.SUBSCRIPTION);
      isInitializedRef.current = true;
      return;
    }

    // Handle profile route directly
    if (route.type === 'profile') {
      setAppState(AppState.PROFILE);
      isInitializedRef.current = true;
      return;
    }

    // Handle settings route directly
    if (route.type === 'settings') {
      setAppState(AppState.SETTINGS);
      isInitializedRef.current = true;
      return;
    }

    // Handle reports routes - redirect to library (need context to view reports)
    if (route.type === 'reports' || route.type === 'report-detail') {
      setAppState(AppState.VIDEO_LIBRARY);
      window.history.replaceState(null, '', '/library');
      isInitializedRef.current = true;
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.videoData) {
            // Check if URL contains a video ID that matches saved data BEFORE loading state
            const shouldRestoreSavedState =
              (route.type === 'dashboard' && route.videoId === p.videoData.id) ||
              (route.type === 'practice' && route.videoId === p.videoData.id) ||
              (route.type === 'landing'); // No video in URL, restore saved video

            if (shouldRestoreSavedState) {
              // URL matches saved data OR no video in URL - restore state
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
              setLibraryEntry(p.libraryEntry || null);

              if (route.type === 'dashboard' && route.videoId === p.videoData.id) {
                setAppState(AppState.DASHBOARD);
              } else if (route.type === 'practice' && route.videoId === p.videoData.id) {
                // Can't restore practice without active topic, go to dashboard
                setAppState(AppState.DASHBOARD);
                window.history.replaceState(null, '', `/${p.videoData.id}`);
              } else {
                // No video ID in URL (landing), restore to dashboard with saved video
                setAppState(AppState.DASHBOARD);
              }
              isInitializedRef.current = true;
              return;
            } else {
              // URL video ID doesn't match saved data - try to load from library
              // Don't load the old video data
              localStorage.removeItem(STORAGE_KEY);
              setPendingVideoIdFromUrl(route.videoId);
              setAppState(AppState.LOADING);
              setLoadingText('Loading video...');
              setTranscriptLangMismatch(false);
              isInitializedRef.current = true;
              return;
            }
        }
      } catch (e) {
          console.error("Failed to hydrate state", e);
      }
    }

    // No saved state - if URL has a video ID, try to load from library
    if (route.type === 'dashboard' || route.type === 'practice') {
      setPendingVideoIdFromUrl(route.videoId);
      setAppState(AppState.LOADING);
      setLoadingText('Loading video...');
      setTranscriptLangMismatch(false);
      isInitializedRef.current = true;
      return;
    }

    // Mark as initialized so URL sync effect can start working
    isInitializedRef.current = true;
  }, []);

  // Effect to load video from URL when visiting a direct link
  useEffect(() => {
    if (!pendingVideoIdFromUrl) return;

    // Wait for auth to finish loading before making decisions
    if (authLoading) return;

    const loadVideoFromUrl = async () => {
      // If user is logged in, try to find video in their library
      if (user) {
        try {
          const library = await getUserVideoLibrary(user.id);
          const videoInLibrary = library.find(v => v.youtubeId === pendingVideoIdFromUrl);

          if (videoInLibrary) {
            // Found in library - load it
            const videoUrl = `https://www.youtube.com/watch?v=${videoInLibrary.youtubeId}`;
            setVideoUrl(videoUrl);
            setNativeLang(videoInLibrary.nativeLang);
            setTargetLang(videoInLibrary.targetLang);
            setLevel(videoInLibrary.level);
            setVideoData({
              id: videoInLibrary.youtubeId,
              url: videoUrl,
              title: videoInLibrary.title,
            });

            const cachedAnalysis = await getCachedAnalysisById(videoInLibrary.analysisId);
            if (cachedAnalysis) {
              const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);
              setSummary(analysis.summary);
              setTranslatedSummary(analysis.translatedSummary || '');
              setTopics(analysis.topics);
              setVocabulary(analysis.vocabulary);
              setTranscript(analysis.transcript || []);
              setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
              setCurrentAnalysisId(videoInLibrary.analysisId);

              const dbTopics = await getPracticeTopicsForAnalysis(videoInLibrary.analysisId);
              if (dbTopics.length > 0 && analysis.discussionTopics) {
                const topicsWithIds = analysis.discussionTopics.map(topic => {
                  const dbTopic = dbTopics.find(dt => dt.topic === topic.topic);
                  if (dbTopic) {
                    return { ...topic, topicId: dbTopic.id, questionId: dbTopic.questionId };
                  }
                  return topic;
                });
                setDiscussionTopics(topicsWithIds);
              } else {
                setDiscussionTopics(analysis.discussionTopics || []);
              }

              setLibraryEntry({
                libraryId: videoInLibrary.libraryId,
                isFavorite: videoInLibrary.isFavorite,
              });

              setPendingVideoIdFromUrl(null);
              setAppState(AppState.DASHBOARD);
              return;
            }
          }
        } catch (err) {
          console.error('Error loading video from library:', err);
        }
      }

      // Not found in user's library - check if video exists globally (analyzed by anyone)
      try {
        const globalAnalysis = await getAnyCachedAnalysisForYoutubeId(pendingVideoIdFromUrl);
        if (globalAnalysis) {
          // Found a cached analysis - load it
          const videoUrl = `https://www.youtube.com/watch?v=${pendingVideoIdFromUrl}`;
          setVideoUrl(videoUrl);
          setNativeLang(globalAnalysis.native_lang);
          setTargetLang(globalAnalysis.target_lang);
          setLevel(globalAnalysis.level);
          setVideoData({
            id: pendingVideoIdFromUrl,
            url: videoUrl,
            title: globalAnalysis.video_title,
          });

          const analysis = dbAnalysisToContentAnalysis(globalAnalysis);
          setSummary(analysis.summary);
          setTranslatedSummary(analysis.translatedSummary || '');
          setTopics(analysis.topics);
          setVocabulary(analysis.vocabulary);
          setTranscript(analysis.transcript || []);
          setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
          setCurrentAnalysisId(globalAnalysis.id);

          const dbTopics = await getPracticeTopicsForAnalysis(globalAnalysis.id);
          if (dbTopics.length > 0 && analysis.discussionTopics) {
            const topicsWithIds = analysis.discussionTopics.map(topic => {
              const dbTopic = dbTopics.find(dt => dt.topic === topic.topic);
              if (dbTopic) {
                return { ...topic, topicId: dbTopic.id, questionId: dbTopic.questionId };
              }
              return topic;
            });
            setDiscussionTopics(topicsWithIds);
          } else {
            setDiscussionTopics(analysis.discussionTopics || []);
          }

          // Don't auto-add to library - let user choose to save it
          // This shows "Save to Library" button instead of "Favorite"
          setLibraryEntry(null);

          setPendingVideoIdFromUrl(null);
          setAppState(AppState.DASHBOARD);
          return;
        }
      } catch (err) {
        console.error('Error checking global analysis:', err);
      }

      // Video has never been analyzed - go to landing
      setPendingVideoIdFromUrl(null);
      setAppState(AppState.LANDING);
      window.history.replaceState(null, '', '/');
    };

    loadVideoFromUrl();
  }, [pendingVideoIdFromUrl, user, authLoading]);

  useEffect(() => {
    if (videoData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            videoUrl, nativeLang, targetLang, level, videoData,
            summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics,
            currentAnalysisId, libraryEntry
        }));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
  }, [videoData, videoUrl, nativeLang, targetLang, level, summary, translatedSummary, topics, vocabulary, transcript, discussionTopics, selectedTopics, currentAnalysisId, libraryEntry]);

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

  const handleStartPractice = async (topic: PracticeTopic, question: TopicQuestion) => {
    if (!user) {
      // Check anonymous practice limit (2 sessions)
      const practiceStatus = await checkAnonymousPracticeLimit();
      if (!practiceStatus.allowed) {
        setShowAuthModal(true);
        return;
      }
    } else if (!canStartPractice) {
      setUpgradeFeature('Practice Session');
      setShowUpgradeModal(true);
      return;
    }

    console.log('[App] handleStartPractice called. currentAnalysisId:', currentAnalysisId, 'topic:', topic.topic, 'question:', question.question);

    // Get all selected topic objects
    const allTopics = discussionTopics.filter(t => selectedTopics.includes(t.topic));
    setAllSelectedPracticeTopics(allTopics);

    // Update the topic with the selected question
    const topicWithQuestion: PracticeTopic = {
      ...topic,
      question: question.question,
      questionId: question.questionId,
    };
    setActivePracticeTopic(topicWithQuestion);

    // Fetch all questions for this topic (filtered by user's level)
    if (topic.topicId) {
      try {
        const questions = filterQuestionsByLang(await getQuestionsForTopic(topic.topicId, level), targetLang);
        setAllQuestionsForTopic(questions);

        // If the selected question has no real ID, use the first fetched question's ID
        if (!question.questionId && questions.length > 0) {
          const matched = questions.find(q => q.question === question.question);
          if (matched) {
            topicWithQuestion.questionId = matched.questionId;
            setActivePracticeTopic({ ...topicWithQuestion, questionId: matched.questionId });
          }
        }

        // Count AI-generated questions for the limit (per-user)
        const aiCount = await countAiGeneratedQuestions(topic.topicId, user?.id);
        setAiGeneratedQuestionCount(aiCount);
      } catch (err) {
        console.error('Failed to fetch questions for topic:', err);
        setAllQuestionsForTopic([]);
        setAiGeneratedQuestionCount(0);
      }
    } else {
      setAllQuestionsForTopic([]);
      setAiGeneratedQuestionCount(0);
    }

    setAppState(AppState.PRACTICE_SESSION);
  };

  // Handle topic change in PracticeSession (fetch questions for new topic)
  const handleTopicChange = async (newTopic: PracticeTopic) => {
    setActivePracticeTopic(newTopic);

    // Fetch questions and AI count for the new topic
    if (newTopic.topicId) {
      try {
        const questions = filterQuestionsByLang(await getQuestionsForTopic(newTopic.topicId, level), targetLang);
        setAllQuestionsForTopic(questions);
        const aiCount = await countAiGeneratedQuestions(newTopic.topicId, user?.id);
        setAiGeneratedQuestionCount(aiCount);
      } catch (err) {
        console.error('Failed to fetch questions for new topic:', err);
        setAllQuestionsForTopic([]);
        setAiGeneratedQuestionCount(0);
      }
    } else {
      setAllQuestionsForTopic([]);
      setAiGeneratedQuestionCount(0);
    }
  };

  // Handle question change in PracticeSession
  const handleQuestionChange = (question: TopicQuestion) => {
    if (!activePracticeTopic) return;

    // Update active topic with new question
    setActivePracticeTopic({
      ...activePracticeTopic,
      question: question.question,
      questionId: question.questionId,
    });
  };

  // Handle generating a new question for the current topic
  const handleGenerateQuestion = async (): Promise<TopicQuestion | null> => {
    if (!activePracticeTopic?.topicId || !currentAnalysisId) {
      console.error('Cannot generate question: missing topic or analysis ID', {
        topicId: activePracticeTopic?.topicId,
        currentAnalysisId,
        activePracticeTopic,
      });
      return null;
    }

    try {
      // Call the backend to generate a new question
      // Pass video summary and existing questions for better context
      const response = await fetch(`${getBackendOrigin()}/api/generate-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: activePracticeTopic.topic,
          targetLang,
          nativeLang,
          level,
          analysisId: currentAnalysisId,
          videoSummary: summary, // Pass video summary for context
          existingQuestions: allQuestionsForTopic.map(q => q.question), // Avoid duplicates
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate question');
      }

      const { question, targetWords, difficultyLevel } = await response.json();

      console.log('[handleGenerateQuestion] API response:', {
        question: question?.substring(0, 50) + '...',
        difficultyLevel,
        fallbackLevel: level,
        userId: user?.id,
      });

      // Save the generated question to the database with the difficulty level
      const levelToSave = difficultyLevel || level;
      console.log('[handleGenerateQuestion] Saving with level:', levelToSave);

      const savedQuestion = await saveGeneratedQuestion(
        activePracticeTopic.topicId,
        question,
        currentAnalysisId,
        user?.id,
        levelToSave
      );

      if (!savedQuestion) {
        throw new Error('Failed to save generated question');
      }

      // Create TopicQuestion object
      const newQuestion: TopicQuestion = {
        questionId: savedQuestion.id,
        question: savedQuestion.question,
        sourceType: 'ai_generated',
        difficultyLevel: (difficultyLevel || level)?.toLowerCase(),
        useCount: 0,
        videoTitle: null,
        analysisId: currentAnalysisId,
      };

      // Update state
      setAllQuestionsForTopic(prev => [...prev, newQuestion]);
      setAiGeneratedQuestionCount(prev => prev + 1);

      // Merge target words into topic if provided
      if (targetWords && targetWords.length > 0 && activePracticeTopic.topicId) {
        // This is handled server-side, but we could update local state if needed
      }

      // Switch to the new question
      handleQuestionChange(newQuestion);

      return newQuestion;
    } catch (err) {
      console.error('Failed to generate question:', err);
      return null;
    }
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
    } else if (!canAddVideo) {
      // Logged-in user hit their video limit
      setUpgradeFeature('Video Analysis');
      setShowUpgradeModal(true);
      return;
    }

    // 2. Now start loading (user has permission)
    setAppState(AppState.LOADING);
    setLoadingText("Preparing your lesson...");
    setTranscriptLangMismatch(false); // Reset warning for new video

    try {
      // 3. Fetch Video Metadata (Fast)
      const metadata = await fetchVideoMetadata(videoUrl);

      const vData: VideoData = {
        id: videoId,
        url: videoUrl,
        title: metadata.title
      };
      setVideoData(vData);

      // 4. Check if video exists in database (don't create yet)
      const existingVideo = await getVideoByYoutubeId(videoId);

      // 5. Check for cached analysis (only if video exists)
      let cachedAnalysis = null;
      if (existingVideo) {
        cachedAnalysis = await getCachedAnalysis(
          existingVideo.id,
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
        setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
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
          const libraryLimit = TIER_LIMITS[tier].videoLibraryMax;
          addToUserLibrary(user.id, cachedAnalysis.id, libraryLimit)
            .then((entry) => {
              if (entry) {
                setLibraryEntry({
                  libraryId: entry.id,
                  isFavorite: entry.is_favorite,
                });
              } else {
                // Library limit reached - show upgrade modal
                setUpgradeFeature('Library Storage');
                setShowUpgradeModal(true);
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
            setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
            setDiscussionTopics(analysis.discussionTopics || []);
            setSelectedTopics([]);

            // Analysis succeeded - now save video to database
            const dbVideo = await getOrCreateVideo(videoId, metadata.title);

            // Save to cache
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
                  const libraryLimit = TIER_LIMITS[tier].videoLibraryMax;
                  addToUserLibrary(user.id, savedAnalysis.id, libraryLimit)
                    .then((entry) => {
                      if (entry) {
                        setLibraryEntry({
                          libraryId: entry.id,
                          isFavorite: entry.is_favorite,
                        });
                      } else {
                        // Library limit reached - show upgrade modal
                        setUpgradeFeature('Library Storage');
                        setShowUpgradeModal(true);
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
                    targetLang,
                    level
                  );
                  // Update discussion topics with database IDs (now with canonical names)
                  if (topicsWithIds.length > 0) {
                    setDiscussionTopics(topicsWithIds);
                    // Update cached analysis with canonical topic names for future loads
                    await updateCachedAnalysisContent(savedAnalysis.id, topicsWithIds);
                  }
                }

                // Save video category from AI analysis
                if (analysis.videoCategory && dbVideo) {
                  updateVideoCategory(dbVideo.id, analysis.videoCategory);
                }
              }
            }

            // Record usage (only for fresh analyses, not cached)
            if (!user) {
              recordAnonymousUsage();
              // Update local state if needed
              const info = await getUsageDisplayInfo();
              setUsageInfo(info);
            } else {
              // Record usage for logged-in user
              recordAction('video_analysis');
            }

            // Done: Cancel timers and show dashboard now
            clearTimeout(messageTimerId);
            clearTimeout(maxWaitTimerId);
            showDashboard();
        })
        .catch(err => {
            // Analysis failed (e.g., transcript unavailable) - show error on landing page
            console.error("Analysis failed:", err);
            clearTimeout(messageTimerId);
            clearTimeout(maxWaitTimerId);
            setErrorMsg(err.message || "Failed to analyze video. Please try again.");
            setAppState(AppState.LANDING);
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
    setTranscriptLangMismatch(false); // Reset warning for new video

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
        setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
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

  // Handle loading a video from the Explore section (public video, no library entry)
  const handleExploreVideoSelect = async (analysisId: string) => {
    setAppState(AppState.LOADING);
    setLoadingText('Loading video...');
    setTranscriptLangMismatch(false); // Reset warning for new video

    try {
      const cachedAnalysis = await getCachedAnalysisWithVideoById(analysisId);

      if (!cachedAnalysis) {
        throw new Error('Video not found');
      }

      // Reconstruct video URL from youtubeId
      const youtubeId = cachedAnalysis.global_videos.youtube_id;
      if (!youtubeId) {
        throw new Error('Invalid video data');
      }

      const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      setVideoUrl(videoUrl);

      // Set language/level from the stored analysis
      setNativeLang(cachedAnalysis.native_lang);
      setTargetLang(cachedAnalysis.target_lang);
      setLevel(cachedAnalysis.level);

      // Set video data
      setVideoData({
        id: youtubeId,
        url: videoUrl,
        title: cachedAnalysis.global_videos.title || 'Untitled Video',
      });

      // Convert and set the analysis content
      const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);
      setSummary(analysis.summary);
      setTranslatedSummary(analysis.translatedSummary || '');
      setTopics(analysis.topics);
      setVocabulary(analysis.vocabulary);
      setTranscript(analysis.transcript || []);
      setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
      setCurrentAnalysisId(analysisId);

      // Fetch practice topics with database IDs
      if (analysis.discussionTopics && analysis.discussionTopics.length > 0) {
        const dbTopics = await getPracticeTopicsForAnalysis(analysisId);

        // Match by QUESTION text (not topic name) since canonical topics may have different names
        // e.g., analysis has "Dealing with Boredom" but DB has canonical "Overcoming Boredom"
        const topicsWithIds = analysis.discussionTopics.map(topic => {
          const dbTopic = dbTopics.find(dt => dt.question === topic.question);
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
        setDiscussionTopics([]);
      }

      // Check if this video is already in the user's library
      if (user) {
        const existingEntry = await getLibraryEntry(user.id, analysisId);
        setLibraryEntry(existingEntry);
      } else {
        setLibraryEntry(null);
      }

      // Increment view count for popularity tracking
      if (cachedAnalysis.video_id) {
        incrementVideoView(cachedAnalysis.video_id).catch((err) => {
          console.error('Failed to increment view count:', err);
        });
      }

      // Update URL for shareability
      window.history.pushState({}, '', `/${analysisId}`);

      setAppState(AppState.DASHBOARD);
    } catch (error) {
      console.error('Error loading explore video:', error);
      setErrorMsg('Failed to load video. Please try again.');
      setAppState(AppState.LANDING);
    }
  };

  // Handle saving current video to library (for users viewing someone else's analysis)
  const handleSaveToLibrary = async () => {
    if (!user || !currentAnalysisId) {
      console.error('[handleSaveToLibrary] Cannot save: user=', !!user, 'currentAnalysisId=', currentAnalysisId);
      return;
    }

    console.log('[handleSaveToLibrary] Saving to library:', { userId: user.id, analysisId: currentAnalysisId });
    const libraryLimit = TIER_LIMITS[tier].videoLibraryMax;
    const entry = await addToUserLibrary(user.id, currentAnalysisId, libraryLimit);
    if (entry) {
      console.log('[handleSaveToLibrary] Success:', entry);
      setLibraryEntry({
        libraryId: entry.id,
        isFavorite: entry.is_favorite,
      });
    } else {
      // Library limit reached - show upgrade modal
      console.log('[handleSaveToLibrary] Library limit reached');
      setUpgradeFeature('Library Storage');
      setShowUpgradeModal(true);
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

  const handleStartTutor = () => {
    if (!user) {
      // AI Tutor requires login
      setShowAuthModal(true);
      return;
    }
    if (!canUseAiTutor) {
      // Check if this is a Pro user who exhausted their monthly limit + credits
      // vs a Free user who has no access or exhausted their credits
      if (tier === 'pro' && aiTutorRemainingMinutes <= 0) {
        // Pro user who exhausted monthly limit + credits — show top-up option
        setUpgradeFeature('AI Tutor Limit Reached');
        setShowUpgradeModal(true);
      } else {
        // Free user (with or without exhausted credits) — show upgrade to Pro with Starter Pack option
        setUpgradeFeature('AI Tutor');
        setShowUpgradeModal(true);
      }
      return;
    }
    setShowTutorWindow(true);
  };

  const StartCallButton = () => (
    <button
      onClick={handleStartTutor}
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

  // Compute the actual translation target language for the popup
  // If user has a custom setting, use that; otherwise use video's native language
  const translationPopupTargetLang = translatorTargetLang || nativeLang;

  const shouldShowHeader = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION;
  const isScrollable = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION || appState === AppState.VIDEO_LIBRARY || appState === AppState.PRACTICE_REPORTS || appState === AppState.PRACTICE_REPORT_DETAIL || appState === AppState.SUBSCRIPTION || appState === AppState.PROFILE || appState === AppState.SETTINGS;

  return (
    <Layout
        onLogoClick={handleLogoClick}
        targetLang={shouldShowHeader ? targetLang : undefined}
        level={shouldShowHeader ? level : undefined}
        isScrollable={isScrollable}
        authModalOpen={showAuthModal}
        onAuthModalClose={() => setShowAuthModal(false)}
        onOpenVideoLibrary={() => setAppState(AppState.VIDEO_LIBRARY)}
        onOpenSubscription={() => setAppState(AppState.SUBSCRIPTION)}
        onOpenProfile={() => setAppState(AppState.PROFILE)}
        onOpenSettings={() => setAppState(AppState.SETTINGS)}
        translatorLang={shouldShowHeader && tier === 'pro' ? translationPopupTargetLang : undefined}
        onTranslatorLangChange={shouldShowHeader && tier === 'pro' ? setTranslatorTargetLang : undefined}
    >
      {/* 1. LANDING PAGE */}
      {appState === AppState.LANDING && (
        <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
          <CubeCarousel
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            nativeLang={nativeLang}
            setNativeLang={setNativeLang}
            targetLang={targetLang}
            setTargetLang={setTargetLang}
            level={level}
            setLevel={setLevel}
            onStart={handleStart}
            errorMsg={errorMsg}
            onExploreVideoSelect={handleExploreVideoSelect}
          />
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
                  nativeLang={nativeLang}
                  layoutMode="fixed"
                  currentTime={currentTime}
                  transcriptLangMismatch={transcriptLangMismatch}
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
            onTopicChange={handleTopicChange}
            allQuestions={allQuestionsForTopic}
            onQuestionChange={handleQuestionChange}
            onGenerateQuestion={user && activePracticeTopic?.topicId && currentAnalysisId ? handleGenerateQuestion : undefined}
            aiGeneratedCount={aiGeneratedQuestionCount}
            level={level}
            nativeLang={nativeLang}
            targetLang={targetLang}
            analysisId={currentAnalysisId}
            onExit={() => setAppState(AppState.DASHBOARD)}
            onRequireAuth={() => setShowAuthModal(true)}
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

      {/* 8. SUBSCRIPTION PAGE */}
      {appState === AppState.SUBSCRIPTION && (
        <SubscriptionPage
          onOpenAuthModal={() => setShowAuthModal(true)}
        />
      )}

      {/* 9. PROFILE PAGE */}
      {appState === AppState.PROFILE && (
        <ProfilePage
          onOpenSubscription={() => setAppState(AppState.SUBSCRIPTION)}
        />
      )}

      {/* 10. SETTINGS PAGE */}
      {appState === AppState.SETTINGS && (
        <SettingsPage />
      )}

      {/* Translation Popup - Pro only, active on all content pages */}
      {/* Note: sourceLang is omitted so DeepL auto-detects the source language */}
      {tier === 'pro' &&
        (appState === AppState.DASHBOARD ||
        appState === AppState.PRACTICE_SESSION ||
        appState === AppState.PRACTICE_REPORTS ||
        appState === AppState.PRACTICE_REPORT_DETAIL) && (
        <TranslationPopup
          targetLang={translationPopupTargetLang}
        />
      )}

      {/* Upgrade Modal (for subscription gating) */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          setAppState(AppState.SUBSCRIPTION);
        }}
        onBuyCredits={async () => {
          setShowUpgradeModal(false);
          const packType = tier === 'pro' ? 'topup' : 'starter';
          const url = await createCreditCheckout(packType);
          if (url) {
            window.location.href = url;
          }
        }}
        feature={upgradeFeature}
        tier={tier}
      />

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