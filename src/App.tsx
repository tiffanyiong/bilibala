import React, { useEffect, useRef, useState } from 'react';
import ContentTabs from './features/content/components/ContentTabs';
import TopicSelector from './features/content/components/TopicSelector';
import ExploreVideoCard from './features/explore/components/ExploreVideoCard';
import LandingFormCard from './features/explore/components/LandingFormCard';
import { PrivacyPage, ResetPasswordPage, TermsPage } from './features/legal';
import PracticeReportDetailPage from './features/library/components/PracticeReportDetailPage';
import VideoLibraryPage from './features/library/components/VideoLibraryPage';
import FloatingTutorWindow from './features/live-voice/components/FloatingTutorWindow';
import PracticeSession from './features/practice/components/PracticeSession';
import { ProfilePage } from './features/profile';
import ReportsDashboardPage from './features/reports/components/ReportsDashboardPage';
import SettingsPage from './features/settings/components/SettingsPage';
import SubscriptionPage from './features/subscription/components/SubscriptionPage';
import UpgradeModal from './features/subscription/components/UpgradeModal';
import TranslationPopup from './features/translation/components/TranslationPopup';
import VideoPlayer, { VideoPlayerRef } from './features/video/components/VideoPlayer';
import { extractVideoId, fetchVideoMetadata } from './features/video/services/youtubeService';
import Layout from './shared/components/Layout';
import LevelSelector from './shared/components/LevelSelector';
import UsageLimitModal from './shared/components/UsageLimitModal';
import { DEEPL_SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from './shared/constants';
import { useAuth } from './shared/context/AuthContext';
import { useSubscription } from './shared/context/SubscriptionContext';
import { getBackendOrigin } from './shared/services/backend';
import {
  addToUserLibrary,
  countAiGeneratedQuestions,
  dbAnalysisToContentAnalysis,
  getAnyCachedAnalysisForYoutubeId,
  getCachedAnalysis,
  getCachedAnalysisById,
  getCachedAnalysisWithVideoById,
  getLibraryEntry,
  getOrCreateVideo,
  getPracticeTopicsForAnalysis,
  getQuestionsForTopic,
  getTopicIdsWithQuestionsAtLevel,
  getUserVideoLibrary,
  getVideoByYoutubeId,
  incrementVideoView,
  saveCachedAnalysis,
  saveGeneratedQuestion,
  savePracticeTopicsFromAnalysis,
  toggleLibraryFavorite,
  updateCachedAnalysisContent,
  updateLibraryAccess,
  updateVideoCategory,
  loadUserPreferences,
  saveUserPreferences,
} from './shared/services/database';
import { analyzeVideoContent, fetchTranscript } from './shared/services/geminiService';
import { getFingerprint } from './shared/services/fingerprint';
import { getDailyPracticeUsage } from './shared/services/subscriptionDatabase';
import {
  checkAnonymousPracticeLimit,
  checkAnonymousUsageLimit,
  getUsageDisplayInfo,
  getPracticeUsageDisplayInfo,
  recordAnonymousUsage,
  trackPageVisit,
  UsageDisplayInfo
} from './shared/services/usageTracking';
import { AppState, PracticeTopic, TopicPoint, TopicQuestion, VideoData, VocabularyItem } from './shared/types';
import { ExploreVideo, TIER_LIMITS, VideoHistoryItem } from './shared/types/database';

// Explore videos configuration
const EXPLORE_VIDEOS_LIMIT = 21;

// Mobile-only translator selector component
const MobileTranslatorSelector: React.FC<{
  translatorLang: string;
  onTranslatorLangChange: (lang: string) => void;
}> = ({ translatorLang, onTranslatorLangChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const getShortLabel = (langName: string) => {
    const match = langName.match(/[-–]\s*(.+?)\)?$/);
    if (match) return match[1].replace(')', '');
    return langName.split(' ')[0];
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 px-2.5 py-1 rounded-lg shadow-sm ring-1 ring-black/[0.04] text-[11px] font-medium uppercase tracking-wide hover:bg-white/70 transition-all"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l6 6" />
          <path d="M4 14l6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="M22 22l-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
        {getShortLabel(translatorLang)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-52 bg-white rounded-2xl border border-stone-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] py-1 z-[300] max-h-64 overflow-y-auto">
          {DEEPL_SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onTranslatorLangChange(lang.name);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                translatorLang === lang.name
                  ? 'bg-stone-100 text-stone-900 font-medium'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Reveal body after mount to prevent FOUC with Tailwind CDN
  useEffect(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  }, []);

  const { user, session, loading: authLoading } = useAuth();

  // Track page visit for analytics (once per session)
  useEffect(() => {
    trackPageVisit(user?.id);
  }, [user?.id]);
  const { canAddVideo, canUseAiTutor, canExportPdf, recordAction, tier, syncWithStripe, aiTutorRemainingMinutes, createCreditCheckout, subscription } = useSubscription();

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
    // Load preferences from profile when user signs in
    if (!prevUserRef.current && user) {
      loadUserPreferences(user.id).then((prefs) => {
        if (!prefs) return;
        setNativeLangState(prefs.nativeLang);
        setTargetLangState(prefs.targetLang);
        setLevelState(prefs.level);
        localStorage.setItem('bilibala_nativeLang', prefs.nativeLang);
        localStorage.setItem('bilibala_targetLang', prefs.targetLang);
        localStorage.setItem('bilibala_level', prefs.level);
      });
    }
    prevUserRef.current = user;
  }, [user]);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  // Language & Level State — persisted to localStorage so settings survive page refresh
  const [nativeLang, setNativeLangState] = useState(
    () => localStorage.getItem('bilibala_nativeLang') || 'Chinese (Mandarin - 中文)'
  );
  const [targetLang, setTargetLangState] = useState(
    () => localStorage.getItem('bilibala_targetLang') || 'English'
  );
  const [level, setLevelState] = useState(
    () => localStorage.getItem('bilibala_level') || 'Easy'
  );

  // Use these when the user explicitly changes their preference (LandingFormCard).
  // Persists to localStorage and Supabase profile.
  const setNativeLang = (lang: string) => {
    localStorage.setItem('bilibala_nativeLang', lang);
    setNativeLangState(lang);
    if (user) saveUserPreferences(user.id, { nativeLang: lang });
  };
  const setTargetLang = (lang: string) => {
    localStorage.setItem('bilibala_targetLang', lang);
    setTargetLangState(lang);
    if (user) saveUserPreferences(user.id, { targetLang: lang });
  };
  const setLevel = (l: string) => {
    localStorage.setItem('bilibala_level', l);
    setLevelState(l);
    if (user) saveUserPreferences(user.id, { level: l });
  };

  // Use these when loading a video (library, explore, deep-link, session restore).
  // Updates UI context only — does NOT touch localStorage or Supabase preferences.
  const setNativeLangForVideo = setNativeLangState;
  const setTargetLangForVideo = setTargetLangState;
  const setLevelForVideo = setLevelState;

  // Multi-level analysis state
  const [availableLevels, setAvailableLevels] = useState<Set<string>>(new Set(['Easy'])); // Tracks which levels have been analyzed
  const [levelAnalysisIds, setLevelAnalysisIds] = useState<Map<string, string>>(new Map()); // Maps level -> analysisId

  // Translator setting: null = use video's native language, string = always translate to this
  const [translatorTargetLang, setTranslatorTargetLang] = useState<string | null>(null);



  // Usage limit modal state
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitType, setUsageLimitType] = useState<'video' | 'practice'>('video');
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
  const [filteredDiscussionTopics, setFilteredDiscussionTopics] = useState<PracticeTopic[]>([]);
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
  const [reportNavSource, setReportNavSource] = useState<'library' | 'dashboard'>('library');

  const [errorMsg, setErrorMsg] = useState('');
  const [exploreVideos, setExploreVideos] = useState<ExploreVideo[]>([]);
  const gridAnimStyle = 'stagger';
  const [gridKey, setGridKey] = useState(0);

  // Fetch explore videos for landing page
  useEffect(() => {
    if (appState !== AppState.LANDING) return;
    const fetchVideos = async () => {
      try {
        const params = new URLSearchParams({ targetLang, nativeLang, level, limit: String(EXPLORE_VIDEOS_LIMIT) });
        const response = await fetch(`${getBackendOrigin()}/api/explore?${params}`);
        if (response.ok) {
          const data = await response.json();
          setExploreVideos(data.videos || []);
          setGridKey((k) => k + 1);
        }
      } catch (err) {
        console.error('[App] Error fetching explore videos:', err);
      }
    };
    const timeoutId = setTimeout(fetchVideos, 300);
    return () => clearTimeout(timeoutId);
  }, [appState, targetLang, nativeLang, level]);

  // Filter discussion topics to only show those with questions at the user's level
  useEffect(() => {
    const filterTopics = async () => {
      if (discussionTopics.length === 0) {
        setFilteredDiscussionTopics([]);
        return;
      }

      // Get topic IDs that have questions at the user's level
      const topicIds = discussionTopics
        .map(t => t.topicId)
        .filter((id): id is string => !!id);

      if (topicIds.length === 0) {
        // No topics have IDs yet (fresh analysis), show all
        setFilteredDiscussionTopics(discussionTopics);
        return;
      }

      const topicsWithQuestions = await getTopicIdsWithQuestionsAtLevel(topicIds, level);
      const filtered = discussionTopics.filter(t =>
        !t.topicId || topicsWithQuestions.has(t.topicId)
      );
      setFilteredDiscussionTopics(filtered);

      // Clear selection if selected topic no longer has questions at this level
      setSelectedTopics(prev => prev.filter(topic =>
        filtered.some(t => t.topic === topic)
      ));
    };

    filterTopics();
  }, [discussionTopics, level]);

  // --- History / Navigation Logic ---
  // Helper to parse path-based routes and extract level from query params
  const parsePathRoute = (pathname: string, search?: string) => {
    // Remove leading slash and split
    const parts = pathname.slice(1).split('/').filter(Boolean);

    // Extract level from query params if present
    const searchParams = new URLSearchParams(search || window.location.search);
    const levelParam = searchParams.get('level');

    if (parts.length === 0) {
      return { type: 'landing' as const };
    }
    if (parts[0] === 'reports' && parts.length === 1) {
      return { type: 'reports-dashboard' as const };
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
    if (parts[0] === 'privacy') {
      return { type: 'privacy' as const };
    }
    if (parts[0] === 'terms') {
      return { type: 'terms' as const };
    }
    if (parts[0] === 'reset-password') {
      return { type: 'reset-password' as const };
    }
    // Assume first part is video ID (which is actually analysisId for reports)
    const videoId = parts[0];
    if (parts[1] === 'practice') {
      return { type: 'practice' as const, videoId, level: levelParam };
    }
    if (parts[1] === 'reports') {
      if (parts[2]) {
        return { type: 'report-detail' as const, videoId, sessionId: parts[2] };
      }
      return { type: 'reports' as const, videoId };
    }
    return { type: 'dashboard' as const, videoId, level: levelParam };
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
      } else if (route.type === 'privacy') {
        setAppState(AppState.PRIVACY);
      } else if (route.type === 'terms') {
        setAppState(AppState.TERMS);
      } else if (route.type === 'reset-password') {
        setAppState(AppState.RESET_PASSWORD);
      } else if (route.type === 'reports-dashboard') {
        setAppState(AppState.REPORTS_DASHBOARD);
      } else if (route.type === 'library') {
        setCurrentReportsVideo(null);
        setCurrentReportSessionId(null);
        setAppState(AppState.VIDEO_LIBRARY);
      } else if (route.type === 'reports') {
        // Reports list page removed — redirect to library
        setAppState(AppState.VIDEO_LIBRARY);
        window.history.replaceState(null, '', '/library');
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

  // Sync State -> URL path (with level query param)
  useEffect(() => {
    // Skip on initial render - let the initialization effect handle routing first
    if (!isInitializedRef.current) return;
    if (appState === AppState.LOADING) return;

    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    let targetPath = '/';
    let targetUrl = '/';

    if (appState === AppState.DASHBOARD && videoData) {
      targetPath = `/${videoData.id}`;
      targetUrl = `${targetPath}?level=${level}`;
    } else if (appState === AppState.PRACTICE_SESSION && videoData) {
      targetPath = `/${videoData.id}/practice`;
      targetUrl = `${targetPath}?level=${level}`;
    } else if (appState === AppState.SUBSCRIPTION) {
      targetUrl = '/subscription';
    } else if (appState === AppState.PROFILE) {
      targetUrl = '/profile';
    } else if (appState === AppState.SETTINGS) {
      targetUrl = '/settings';
    } else if (appState === AppState.PRIVACY) {
      targetUrl = '/privacy';
    } else if (appState === AppState.TERMS) {
      targetUrl = '/terms';
    } else if (appState === AppState.RESET_PASSWORD) {
      targetUrl = '/reset-password';
    } else if (appState === AppState.VIDEO_LIBRARY) {
      targetUrl = '/library';
    } else if (appState === AppState.REPORTS_DASHBOARD) {
      targetUrl = '/reports';
    } else if (appState === AppState.PRACTICE_REPORT_DETAIL && currentReportsVideo && currentReportSessionId) {
      targetUrl = `/${currentReportsVideo.analysisId}/reports/${currentReportSessionId}`;
    }

    const currentFullUrl = currentPath + currentSearch;
    if (currentFullUrl !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, [appState, videoData, currentReportsVideo, currentReportSessionId, level]);

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

    // Handle privacy route directly
    if (route.type === 'privacy') {
      setAppState(AppState.PRIVACY);
      isInitializedRef.current = true;
      return;
    }

    // Handle terms route directly
    if (route.type === 'terms') {
      setAppState(AppState.TERMS);
      isInitializedRef.current = true;
      return;
    }

    // Handle reset password route directly
    if (route.type === 'reset-password') {
      setAppState(AppState.RESET_PASSWORD);
      isInitializedRef.current = true;
      return;
    }

    // Handle reports dashboard route directly
    if (route.type === 'reports-dashboard') {
      setAppState(AppState.REPORTS_DASHBOARD);
      isInitializedRef.current = true;
      return;
    }

    // Handle per-video reports routes - redirect to library (need context to view reports)
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
              setNativeLangForVideo(p.nativeLang || 'Chinese (Mandarin - 中文)');
              setTargetLangForVideo(p.targetLang || 'English');
              setLevelForVideo(p.level || 'Easy');
              setVideoData(p.videoData);
              setSummary(p.summary || '');
              setTranslatedSummary(p.translatedSummary || '');
              setTopics(p.topics || []);
              setVocabulary(p.vocabulary || []);
              setTranscript(p.transcript || []);
              setTranscriptLangMismatch(p.transcriptLangMismatch || false);
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
      // Check if URL has a level parameter
      const urlParams = new URLSearchParams(window.location.search);
      const levelFromUrl = urlParams.get('level');

      // If user is logged in, try to find video in their library
      if (user) {
        try {
          const library = await getUserVideoLibrary(user.id);
          const videoInLibrary = library.find(v => v.youtubeId === pendingVideoIdFromUrl);

          if (videoInLibrary) {
            // Found in library - determine which level to load
            const levelToLoad = levelFromUrl || videoInLibrary.level;

            const videoUrl = `https://www.youtube.com/watch?v=${videoInLibrary.youtubeId}`;
            setVideoUrl(videoUrl);
            setNativeLangForVideo(videoInLibrary.nativeLang);
            setTargetLangForVideo(videoInLibrary.targetLang);
            setLevelForVideo(levelToLoad);
            setVideoData({
              id: videoInLibrary.youtubeId,
              url: videoUrl,
              title: videoInLibrary.title,
            });

            // If URL specifies a different level, try to load that level's analysis
            let analysisToLoad = await getCachedAnalysisById(videoInLibrary.analysisId);
            if (levelFromUrl && levelFromUrl !== videoInLibrary.level) {
              // URL wants a different level - check if it exists
              const existingVideo = await getVideoByYoutubeId(videoInLibrary.youtubeId);
              if (existingVideo) {
                const differentLevelAnalysis = await getCachedAnalysis(
                  existingVideo.id,
                  levelFromUrl,
                  videoInLibrary.targetLang,
                  videoInLibrary.nativeLang
                );
                if (differentLevelAnalysis) {
                  analysisToLoad = differentLevelAnalysis;
                  console.log(`[URL Load] Loaded ${levelFromUrl} analysis from URL parameter`);
                }
              }
            }

            if (analysisToLoad) {
              const analysis = dbAnalysisToContentAnalysis(analysisToLoad);
              setSummary(analysis.summary);
              setTranslatedSummary(analysis.translatedSummary || '');
              setTopics(analysis.topics);
              setVocabulary(analysis.vocabulary);
              setTranscript(analysis.transcript || []);
              setTranscriptLangMismatch(analysis.transcriptLangMismatch || false);
              setCurrentAnalysisId(analysisToLoad.id);

              const dbTopics = await getPracticeTopicsForAnalysis(analysisToLoad.id);
              if (dbTopics.length > 0 && analysis.discussionTopics) {
                const topicsWithIds = analysis.discussionTopics.map(topic => {
                  // Match by question text (more reliable) or topic name as fallback
                  const dbTopic = dbTopics.find(dt => dt.question === topic.question) ||
                                  dbTopics.find(dt => dt.topic === topic.topic);
                  if (dbTopic) {
                    return { ...topic, topicId: dbTopic.id, questionId: dbTopic.questionId };
                  }
                  return topic;
                });
                setDiscussionTopics(topicsWithIds);
              } else {
                setDiscussionTopics(analysis.discussionTopics || []);
              }
              // Clear selected topics to prevent stale selection
              setSelectedTopics([]);

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
        let globalAnalysis = await getAnyCachedAnalysisForYoutubeId(pendingVideoIdFromUrl);

        // If URL specifies a level, try to find that specific level
        if (levelFromUrl && globalAnalysis) {
          const existingVideo = await getVideoByYoutubeId(pendingVideoIdFromUrl);
          if (existingVideo) {
            const specificLevelAnalysis = await getCachedAnalysis(
              existingVideo.id,
              levelFromUrl,
              globalAnalysis.target_lang,
              globalAnalysis.native_lang
            );
            if (specificLevelAnalysis) {
              // Preserve video_title from original globalAnalysis
              globalAnalysis = { ...specificLevelAnalysis, video_title: globalAnalysis.video_title };
              console.log(`[URL Load] Loaded ${levelFromUrl} analysis from URL parameter (global)`);
            }
          }
        }

        if (globalAnalysis) {
          // Found a cached analysis - load it
          const videoUrl = `https://www.youtube.com/watch?v=${pendingVideoIdFromUrl}`;
          setVideoUrl(videoUrl);
          setNativeLangForVideo(globalAnalysis.native_lang);
          setTargetLangForVideo(globalAnalysis.target_lang);
          setLevelForVideo(globalAnalysis.level);
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
              // Match by question text (more reliable) or topic name as fallback
              const dbTopic = dbTopics.find(dt => dt.question === topic.question) ||
                              dbTopics.find(dt => dt.topic === topic.topic);
              if (dbTopic) {
                return { ...topic, topicId: dbTopic.id, questionId: dbTopic.questionId };
              }
              return topic;
            });
            setDiscussionTopics(topicsWithIds);
          } else {
            setDiscussionTopics(analysis.discussionTopics || []);
          }
          // Clear selected topics to prevent stale selection
          setSelectedTopics([]);

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
            summary, translatedSummary, topics, vocabulary, transcript, transcriptLangMismatch, discussionTopics, selectedTopics,
            currentAnalysisId, libraryEntry
        }));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
  }, [videoData, videoUrl, nativeLang, targetLang, level, summary, translatedSummary, topics, vocabulary, transcript, transcriptLangMismatch, discussionTopics, selectedTopics, currentAnalysisId, libraryEntry]);

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
        const info = await getPracticeUsageDisplayInfo();
        setUsageInfo(info);
        setUsageLimitType('practice');
        setShowUsageLimitModal(true);
        return;
      }
    } else {
      // For authenticated users, fetch the latest daily practice usage count
      const currentDailyUsage = await getDailyPracticeUsage(user.id);
      const dailyLimit = TIER_LIMITS[tier].practiceSessionsPerDay;
      const practiceCredits = subscription?.practice_session_credits || 0;

      // For free users, check if they've hit their daily limit AND have no credits
      if (tier === 'free' && currentDailyUsage >= dailyLimit && practiceCredits <= 0) {
        setUpgradeFeature('Practice Session');
        setShowUpgradeModal(true);
        return;
      }
      // Pro users have unlimited practice, so no check needed
    }


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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
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

  // Handle switching between difficulty levels
  const handleLevelChange = async (newLevel: string) => {
    if (!videoData || newLevel === level) return;

    console.log(`[handleLevelChange] Switching from ${level} to ${newLevel}`);

    // Check if we have the analysis for this level
    const analysisId = levelAnalysisIds.get(newLevel);
    if (!analysisId) {
      console.warn(`[handleLevelChange] No analysis found for level ${newLevel}`);
      return;
    }

    try {
      // Load the cached analysis for the new level
      const cachedAnalysis = await getCachedAnalysisById(analysisId);
      if (!cachedAnalysis) {
        console.error(`[handleLevelChange] Failed to load analysis ${analysisId}`);
        return;
      }

      const analysis = dbAnalysisToContentAnalysis(cachedAnalysis);

      // Update all content state with the new level's analysis
      setLevelForVideo(newLevel);
      setSummary(analysis.summary);
      setTranslatedSummary(analysis.translatedSummary);
      setTopics(analysis.topics);
      setVocabulary(analysis.vocabulary);
      setCurrentAnalysisId(analysisId);

      // Fetch practice topics for the new level
      const dbTopics = await getPracticeTopicsForAnalysis(analysisId);
      let topicsWithIds: PracticeTopic[] = [];

      if (dbTopics.length > 0 && analysis.discussionTopics) {
        topicsWithIds = analysis.discussionTopics.map(topic => {
          const dbTopic = dbTopics.find(dt => dt.question === topic.question) ||
                          dbTopics.find(dt => dt.topic === topic.topic);
          if (dbTopic) {
            return { ...topic, topicId: dbTopic.id, questionId: dbTopic.questionId };
          }
          return topic;
        });
        setDiscussionTopics(topicsWithIds);
      } else {
        topicsWithIds = analysis.discussionTopics || [];
        setDiscussionTopics(topicsWithIds);
      }

      // Clear selected topics and practice state when switching levels
      setSelectedTopics([]);

      // If in practice session, load all topics from new level
      if (appState === AppState.PRACTICE_SESSION && topicsWithIds.length > 0) {
        // Show all topics from the new level
        setAllSelectedPracticeTopics(topicsWithIds);

        // Set first topic as active
        const firstTopic = topicsWithIds[0];
        setActivePracticeTopic(firstTopic);

        // Load questions for first topic
        if (firstTopic.topicId) {
          const newQuestions = filterQuestionsByLang(
            await getQuestionsForTopic(firstTopic.topicId, newLevel),
            targetLang
          );
          setAllQuestionsForTopic(newQuestions);

          const aiCount = await countAiGeneratedQuestions(
            firstTopic.topicId,
            user?.id
          );
          setAiGeneratedQuestionCount(aiCount);
        } else {
          setAllQuestionsForTopic([]);
          setAiGeneratedQuestionCount(0);
        }
      } else {
        // Not in practice session or no topics available
        setAllSelectedPracticeTopics([]);
        setAllQuestionsForTopic([]);
        setActivePracticeTopic(null);
        setAiGeneratedQuestionCount(0);
      }

      // Update URL with new level parameter
      const currentPath = window.location.pathname;
      const newUrl = `${currentPath}?level=${newLevel}`;
      window.history.replaceState(null, '', newUrl);

      console.log(`[handleLevelChange] Successfully switched to ${newLevel}`);
    } catch (err) {
      console.error('[handleLevelChange] Failed to switch level:', err);
    }
  };

  // Analyze remaining difficulty levels in the background
  const analyzeRemainingLevels = async (
    videoId: string,
    videoTitle: string,
    primaryLevel: string,
    transcriptData: { transcript: { text: string; offset: number; duration: number }[]; transcriptLang: string | null; transcriptLangMismatch: boolean; duration: number }
  ) => {
    const LEVELS_TO_ANALYZE = ['Easy', 'Medium', 'Hard'];
    const remainingLevels = LEVELS_TO_ANALYZE.filter(l => l !== primaryLevel);

    console.log(`[Background Analysis] Starting background analysis for levels: ${remainingLevels.join(', ')}`);

    for (const levelToAnalyze of remainingLevels) {
      try {
        // Check if this level is already cached
        const existingVideo = await getVideoByYoutubeId(videoId);
        if (existingVideo) {
          const existingAnalysis = await getCachedAnalysis(
            existingVideo.id,
            levelToAnalyze,
            targetLang,
            nativeLang
          );

          if (existingAnalysis) {
            console.log(`[Background Analysis] ${levelToAnalyze} already cached, skipping`);
            // Mark as available
            setAvailableLevels(prev => new Set([...prev, levelToAnalyze]));
            setLevelAnalysisIds(prev => new Map(prev).set(levelToAnalyze, existingAnalysis.id));
            continue;
          }
        }

        console.log(`[Background Analysis] Analyzing ${levelToAnalyze}...`);

        // Run AI analysis for this level
        const analysis = await analyzeVideoContent(
          videoTitle,
          `https://www.youtube.com/watch?v=${videoId}`,
          nativeLang,
          targetLang,
          levelToAnalyze,
          transcriptData,
          session?.access_token
        );

        // Save to cache
        const dbVideo = await getOrCreateVideo(videoId, videoTitle);
        if (dbVideo) {
          const savedAnalysis = await saveCachedAnalysis(
            dbVideo.id,
            levelToAnalyze,
            targetLang,
            nativeLang,
            analysis,
            user?.id
          );

          if (savedAnalysis) {
            // Save practice topics
            if (analysis.discussionTopics) {
              await savePracticeTopicsFromAnalysis(
                savedAnalysis.id,
                analysis.discussionTopics,
                targetLang,
                levelToAnalyze,
                session?.access_token
              );
            }

            // Save video category
            if (analysis.videoCategory && dbVideo) {
              updateVideoCategory(dbVideo.id, analysis.videoCategory);
            }

            // Mark level as available
            setAvailableLevels(prev => new Set([...prev, levelToAnalyze]));
            setLevelAnalysisIds(prev => new Map(prev).set(levelToAnalyze, savedAnalysis.id));

            console.log(`[Background Analysis] ${levelToAnalyze} analysis complete and cached`);
          }
        }
      } catch (err) {
        console.error(`[Background Analysis] Failed to analyze ${levelToAnalyze}:`, err);
        // Continue with next level even if this one fails
      }
    }

    console.log('[Background Analysis] All background analyses complete');
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
        setUsageLimitType('video');
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
            // Match by question text (more reliable) or topic name as fallback
            const dbTopic = dbTopics.find(dt => dt.question === topic.question) ||
                            dbTopics.find(dt => dt.topic === topic.topic);
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

        // Check which other levels are already cached
        const LEVELS_TO_CHECK = ['Easy', 'Medium', 'Hard'];
        const levelMap = new Map<string, string>([[level, cachedAnalysis.id]]);
        const availableSet = new Set([level]);

        for (const levelToCheck of LEVELS_TO_CHECK) {
          if (levelToCheck === level) continue;

          try {
            const otherLevelAnalysis = await getCachedAnalysis(
              existingVideo!.id,
              levelToCheck,
              targetLang,
              nativeLang
            );

            if (otherLevelAnalysis) {
              console.log(`[Cache Check] ${levelToCheck} is also cached`);
              availableSet.add(levelToCheck);
              levelMap.set(levelToCheck, otherLevelAnalysis.id);
            }
          } catch (err) {
            console.error(`[Cache Check] Error checking ${levelToCheck}:`, err);
          }
        }

        setAvailableLevels(availableSet);
        setLevelAnalysisIds(levelMap);

        console.log(`[Cache Check] Available levels: ${Array.from(availableSet).join(', ')}`);

        // Note: No usage recorded for cached results - Free for anonymous!
        return;
      }

      // --- CACHE MISS: AI REQUIRED ---
      console.log('Cache miss. Progressive loading: fetch transcript first, then AI analysis...');
      setIsAnalysisLoading(true);
      setLoadingText("Analyzing video...");

      // PROGRESSIVE LOADING FLOW:
      // Step 1: Fetch transcript first (~10-20s) → Show dashboard with transcript immediately
      // Step 2: Run AI analysis in background (~20-30s) → Update summary/vocab when ready
      // This makes the app feel 2-3x faster!

      const anonFingerprint = !session?.access_token ? await getFingerprint() : undefined;

      let isDashboardShown = false;
      const showDashboard = () => {
          if (!isDashboardShown) {
              setAppState(AppState.DASHBOARD);
              isDashboardShown = true;
          }
      };

      // Timer 1: Update to "fetching transcript" after 2s
      const messageTimer1 = setTimeout(() => {
          setLoadingText("Fetching video transcript...");
      }, 5000);

      // Timer 2: Update to "longer videos" message at 12s (if transcript is slow)
      const messageTimer2 = setTimeout(() => {
          setLoadingText("Longer videos require more time to fetch the transcript...");
      }, 12000);

      // Step 1: Fetch transcript FIRST (faster!)
      fetchTranscript(videoUrl, targetLang, session?.access_token, anonFingerprint)
        .then(async (transcriptData) => {
          // Show transcript immediately
          setTranscript(transcriptData.transcript || []);
          setTranscriptLangMismatch(transcriptData.transcriptLangMismatch || false);

          // Switch to dashboard and show transcript tab
          clearTimeout(messageTimer1);
          clearTimeout(messageTimer2);
          showDashboard();

          // Update loading text for AI analysis phase
          setLoadingText("Analyzing video content with AI...");

          // Step 2: Run AI analysis in BACKGROUND with preloaded transcript

          const analysis = await analyzeVideoContent(
            metadata.title,
            videoUrl,
            nativeLang,
            targetLang,
            level,
            transcriptData, // Pass preloaded transcript to skip re-fetching
            session?.access_token,
            anonFingerprint
          );

          // AI analysis complete - update summary, vocab, outline


          setSummary(analysis.summary);
          setTranslatedSummary(analysis.translatedSummary);
          setTopics(analysis.topics);
          setVocabulary(analysis.vocabulary);
          // Transcript already set from Step 1
          setDiscussionTopics(analysis.discussionTopics || []);
          setSelectedTopics([]);

          // Stop showing loading state now that content is ready
          setIsAnalysisLoading(false);

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

              // Initialize level tracking for the primary level
              setAvailableLevels(new Set([level]));
              setLevelAnalysisIds(new Map([[level, savedAnalysis.id]]));

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
                  level,
                  session?.access_token
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

          // Trigger background analysis for remaining levels (non-blocking)
          analyzeRemainingLevels(videoId, metadata.title, level, transcriptData);
        })
        .catch(err => {
            // Analysis failed (transcript or AI analysis error)
            console.error("❌ Analysis failed:", err);
            clearTimeout(messageTimer1);
            clearTimeout(messageTimer2);
            setErrorMsg(err.message || "Failed to analyze video. Please try again.");
            setAppState(AppState.LANDING);
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
      setNativeLangForVideo(video.nativeLang);
      setTargetLangForVideo(video.targetLang);
      setLevelForVideo(video.level);

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
          // Match by QUESTION text (not topic name) since canonical topics may have different names
          // e.g., analysis has "Dealing with Setbacks" but DB has canonical "Overcoming Obstacles"
          const topicsForUI: PracticeTopic[] = analysis.discussionTopics.map(topic => {
            // Find matching DB topic by question text (most reliable)
            const dbTopic = dbTopics.find(dt => dt.question === topic.question);
            if (dbTopic) {
              return {
                ...topic, // Keep original topic name and all properties from analysis
                topicId: dbTopic.id,
                questionId: dbTopic.questionId,
              };
            }
            return topic;
          });

          setDiscussionTopics(topicsForUI);
        } else {
          // Fallback to what was in the analysis JSON if DB is empty
          setDiscussionTopics(analysis.discussionTopics || []);
        }
      // Clear selected topics to prevent stale selection
      setSelectedTopics([]);

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

        // Check which other levels are already cached
        const LEVELS_TO_CHECK = ['Easy', 'Medium', 'Hard'];
        const levelMap = new Map<string, string>([[video.level, video.analysisId]]);
        const availableSet = new Set([video.level]);

        const existingVideo = await getVideoByYoutubeId(video.youtubeId);
        if (existingVideo) {
          for (const levelToCheck of LEVELS_TO_CHECK) {
            if (levelToCheck === video.level) continue;

            try {
              const otherLevelAnalysis = await getCachedAnalysis(
                existingVideo.id,
                levelToCheck,
                video.targetLang,
                video.nativeLang
              );

              if (otherLevelAnalysis) {
                console.log(`[Library] ${levelToCheck} is also cached`);
                availableSet.add(levelToCheck);
                levelMap.set(levelToCheck, otherLevelAnalysis.id);
              }
            } catch (err) {
              console.error(`[Library] Error checking ${levelToCheck}:`, err);
            }
          }
        }

        setAvailableLevels(availableSet);
        setLevelAnalysisIds(levelMap);

        console.log(`[Library] Available levels: ${Array.from(availableSet).join(', ')}`);

        setAppState(AppState.DASHBOARD);

        // Trigger background analysis for missing levels if any
        if (availableSet.size < 3) {
          console.log(`[Library] Triggering background analysis for missing levels`);
          // Fetch transcript for background analysis
          fetchTranscript(videoUrl, video.targetLang, session?.access_token)
            .then((transcriptData) => {
              analyzeRemainingLevels(
                video.youtubeId,
                video.title,
                video.level,
                transcriptData
              );
            })
            .catch((err) => {
              console.error('[Library] Failed to fetch transcript for background analysis:', err);
            });
        }
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
      setNativeLangForVideo(cachedAnalysis.native_lang);
      setTargetLangForVideo(cachedAnalysis.target_lang);
      setLevelForVideo(cachedAnalysis.level);

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
      // Clear selected topics to prevent stale selection
      setSelectedTopics([]);

      // Check if this video is already in the user's library
      if (user) {
        const existingEntry = await getLibraryEntry(user.id, analysisId);
        setLibraryEntry(existingEntry);
      } else {
        setLibraryEntry(null);
      }

      // Check which other levels are already cached
      const LEVELS_TO_CHECK = ['Easy', 'Medium', 'Hard'];
      const levelMap = new Map<string, string>([[cachedAnalysis.level, analysisId]]);
      const availableSet = new Set([cachedAnalysis.level]);

      for (const levelToCheck of LEVELS_TO_CHECK) {
        if (levelToCheck === cachedAnalysis.level) continue;

        try {
          const otherLevelAnalysis = await getCachedAnalysis(
            cachedAnalysis.video_id,
            levelToCheck,
            cachedAnalysis.target_lang,
            cachedAnalysis.native_lang
          );

          if (otherLevelAnalysis) {
            console.log(`[Explore] ${levelToCheck} is also cached`);
            availableSet.add(levelToCheck);
            levelMap.set(levelToCheck, otherLevelAnalysis.id);
          }
        } catch (err) {
          console.error(`[Explore] Error checking ${levelToCheck}:`, err);
        }
      }

      setAvailableLevels(availableSet);
      setLevelAnalysisIds(levelMap);

      console.log(`[Explore] Available levels: ${Array.from(availableSet).join(', ')}`);

      // Increment view count for popularity tracking
      if (cachedAnalysis.video_id) {
        incrementVideoView(cachedAnalysis.video_id).catch((err) => {
          console.error('Failed to increment view count:', err);
        });
      }

      // Update URL for shareability with level parameter
      window.history.pushState({}, '', `/${analysisId}?level=${cachedAnalysis.level}`);

      setAppState(AppState.DASHBOARD);

      // Trigger background analysis for missing levels if any (authenticated users only)
      if (availableSet.size < 3 && user) {
        console.log(`[Explore] Triggering background analysis for missing levels`);
        // Fetch transcript for background analysis
        fetchTranscript(videoUrl, cachedAnalysis.target_lang, session?.access_token)
          .then((transcriptData) => {
            analyzeRemainingLevels(
              youtubeId,
              cachedAnalysis.global_videos.title || 'Untitled Video',
              cachedAnalysis.level,
              transcriptData
            );
          })
          .catch((err) => {
            console.error('[Explore] Failed to fetch transcript for background analysis:', err);
          });
      }
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

  // Handle viewing a report from the dashboard
  const handleViewReportFromDashboard = (session: { id: string; analysis_id: string | null; videoTitle: string; videoThumbnailUrl: string | null; youtubeId: string; target_lang: string; native_lang: string; level: string }) => {
    // Construct a minimal VideoHistoryItem from dashboard session data
    const minimalVideo: VideoHistoryItem = {
      libraryId: '',
      isFavorite: false,
      practiceCount: 0,
      lastScore: null,
      lastAccessedAt: new Date().toISOString(),
      addedAt: new Date().toISOString(),
      analysisId: session.analysis_id || '',
      analyzedAt: new Date().toISOString(),
      level: session.level,
      targetLang: session.target_lang,
      nativeLang: session.native_lang,
      videoId: '',
      youtubeId: session.youtubeId,
      title: session.videoTitle,
      thumbnailUrl: session.videoThumbnailUrl,
      reportCount: 0,
    };
    setCurrentReportsVideo(minimalVideo);
    setCurrentReportSessionId(session.id);
    setReportNavSource('dashboard');
    setAppState(AppState.PRACTICE_REPORT_DETAIL);
  };

  // Handle navigating to a video's analysis page from the reports dashboard
  const handleNavigateToVideoFromDashboard = (video: { analysisId: string; youtubeId: string; title: string; thumbnailUrl: string | null; targetLang: string; nativeLang: string; level: string }) => {
    const minimalVideo: VideoHistoryItem = {
      libraryId: '',
      isFavorite: false,
      practiceCount: 0,
      lastScore: null,
      lastAccessedAt: new Date().toISOString(),
      addedAt: new Date().toISOString(),
      analysisId: video.analysisId,
      analyzedAt: new Date().toISOString(),
      level: video.level,
      targetLang: video.targetLang,
      nativeLang: video.nativeLang,
      videoId: '',
      youtubeId: video.youtubeId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      reportCount: 0,
    };
    handleLoadFromLibrary(minimalVideo);
  };

  // Handle going back from report detail
  const handleBackToReportsList = () => {
    // If came from dashboard, go back there
    if (reportNavSource === 'dashboard') {
      setCurrentReportsVideo(null);
      setCurrentReportSessionId(null);
      setReportNavSource('library');
      setAppState(AppState.REPORTS_DASHBOARD);
      return;
    }
    // Otherwise go back to library
    window.history.replaceState(null, '', '/library');
    setCurrentReportsVideo(null);
    setCurrentReportSessionId(null);
    setAppState(AppState.VIDEO_LIBRARY);
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

  const StartCallButton = () => {
    const isEasy = level.toLowerCase() === 'easy';
    const uiLang = isEasy ? nativeLang : targetLang;
    const uiText = UI_TRANSLATIONS[uiLang] || UI_TRANSLATIONS['English'];
    return (
    <button
      onClick={handleStartTutor}
      className="fixed bottom-8 right-8 z-50 group flex items-center gap-2 bg-zinc-900 text-white border border-zinc-700 p-4 rounded-full shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden max-w-[60px] hover:max-w-[220px]"
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
        {uiText.startConversation}
      </span>
    </button>
    );
  };

  // Compute the actual translation target language for the popup
  // If user has a custom setting, use that; otherwise use video's native language
  const translationPopupTargetLang = translatorTargetLang || nativeLang;

  const shouldShowHeader = appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION;
  const isScrollable = appState === AppState.LANDING || appState === AppState.DASHBOARD || appState === AppState.PRACTICE_SESSION || appState === AppState.VIDEO_LIBRARY || appState === AppState.PRACTICE_REPORT_DETAIL || appState === AppState.REPORTS_DASHBOARD || appState === AppState.SUBSCRIPTION || appState === AppState.PROFILE || appState === AppState.SETTINGS || appState === AppState.PRIVACY || appState === AppState.TERMS || appState === AppState.RESET_PASSWORD;
  const shouldShowFooter = appState === AppState.LANDING || appState === AppState.PRIVACY || appState === AppState.TERMS || appState === AppState.SUBSCRIPTION;

  return (
    <Layout
        onLogoClick={handleLogoClick}
        targetLang={shouldShowHeader ? targetLang : undefined}
        level={shouldShowHeader ? level : undefined}
        availableLevels={shouldShowHeader ? availableLevels : undefined}
        onLevelChange={shouldShowHeader ? handleLevelChange : undefined}
        isScrollable={isScrollable}
        authModalOpen={showAuthModal}
        onAuthModalClose={() => setShowAuthModal(false)}
        onOpenVideoLibrary={() => setAppState(AppState.VIDEO_LIBRARY)}
        onOpenSubscription={() => setAppState(AppState.SUBSCRIPTION)}
        onOpenProfile={() => setAppState(AppState.PROFILE)}
        onOpenSettings={() => setAppState(AppState.SETTINGS)}
        onOpenReports={() => setAppState(AppState.REPORTS_DASHBOARD)}
        onOpenPrivacy={() => setAppState(AppState.PRIVACY)}
        onOpenTerms={() => setAppState(AppState.TERMS)}
        translatorLang={shouldShowHeader && tier === 'pro' ? translationPopupTargetLang : undefined}
        onTranslatorLangChange={shouldShowHeader && tier === 'pro' ? setTranslatorTargetLang : undefined}
        showFooter={shouldShowFooter}
    >
      {/* 1. LANDING PAGE */}
      {appState === AppState.LANDING && (
        <div className="flex flex-col items-center justify-start pt-2 sm:pt-[18vh] px-4 sm:px-10 pb-16">
          <LandingFormCard
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
          />

          {/* Explore Videos Grid */}
          {exploreVideos.length > 0 && (
            <div className="w-full mt-4 sm:mt-16">
              <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4 ml-1">
                Explore
              </h3>

              <div
                key={gridKey}
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 grid-anim-${gridAnimStyle}`}
              >
                {exploreVideos.map((video) => (
                  <ExploreVideoCard
                    key={video.analysisId}
                    video={video}
                    onSelect={() => handleExploreVideoSelect(video.analysisId)}
                  />
                ))}
              </div>
            </div>
          )}
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
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-start gap-6 p-4 md:p-6 pt-2 max-w-[1600px] mx-auto min-h-screen">
           {/* Video Section - Order 1 on mobile, spans left column on desktop */}
           <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6 order-1">
               {/* Mobile-only: Language, Level, and Translator badges */}
               <div className="flex md:hidden items-center gap-2 flex-wrap">
                 <span className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm border border-white/60 text-stone-600 px-2.5 py-1 rounded-lg shadow-sm ring-1 ring-black/[0.04] text-[11px] font-medium uppercase tracking-wide">
                   <span className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-500"></span>
                   {targetLang}
                 </span>

                 {/* Mobile Level Selector */}
                 <LevelSelector
                   currentLevel={level}
                   availableLevels={availableLevels}
                   onLevelChange={handleLevelChange}
                   className="text-[11px]"
                 />
                 {tier === 'pro' && (
                   <MobileTranslatorSelector
                     translatorLang={translationPopupTargetLang}
                     onTranslatorLangChange={setTranslatorTargetLang}
                   />
                 )}
               </div>

               {/* Video Card: player + title + actions */}
               <div className="rounded-xl overflow-hidden bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-white/40">
                 <div className="w-full aspect-video shrink-0 bg-black">
                     <VideoPlayer ref={playerRef} url={videoData.url} onError={handleVideoError} onTimeUpdate={setCurrentTime} />
                 </div>

                 {/* Video Title & Actions */}
                 <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                   <h1 className="text-sm font-semibold text-stone-800 uppercase tracking-wide line-clamp-2">
                     {videoData.title}
                   </h1>
                   {user && (() => {
                     // Compute UI text based on level
                     const isEasy = level.toLowerCase() === 'easy';
                     const uiLang = isEasy ? nativeLang : targetLang;
                     const uiText = UI_TRANSLATIONS[uiLang] || UI_TRANSLATIONS['English'];
                     return (
                     <div className="flex items-center gap-2 shrink-0">
                       {libraryEntry ? (
                         <button
                           onClick={handleToggleFavorite}
                           className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                             libraryEntry.isFavorite
                               ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                               : 'bg-white/50 text-stone-600 border-white/60 backdrop-blur-sm ring-1 ring-black/[0.04] hover:border-amber-200 hover:text-amber-600'
                           }`}
                         >
                           <svg width="16" height="16" viewBox="0 0 24 24" fill={libraryEntry.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                           </svg>
                           {libraryEntry.isFavorite ? uiText.favorited : uiText.favorite}
                         </button>
                       ) : (
                         <button
                           onClick={handleSaveToLibrary}
                           className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-stone-800 text-white hover:bg-stone-900 transition-all"
                         >
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                           </svg>
                           {uiText.saveToLibrary}
                         </button>
                       )}
                     </div>
                     );
                   })()}
                 </div>
               </div>

               {/* TopicSelector - Only show here on desktop */}
               <div className="hidden lg:block">
                 <TopicSelector
                    topics={filteredDiscussionTopics}
                    selectedTopics={selectedTopics}
                    onTopicToggle={handleTopicToggle}
                    isLoading={isAnalysisLoading}
                    onStartPractice={handleStartPractice}
                    level={level}
                    nativeLang={nativeLang}
                    targetLang={targetLang}
                 />
               </div>
           </div>

           {/* ContentTabs - Order 2 on mobile (before topics), right column on desktop */}
           <div className="lg:col-span-5 h-[500px] md:h-[640px] lg:h-[640px] xl:h-[775px] order-2">
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
                  level={level}
                  layoutMode="fixed"
                  currentTime={currentTime}
                  transcriptLangMismatch={transcriptLangMismatch}
                  hasTranscriptContent={transcript && transcript.length > 0}
                  hasOutlineContent={topics && topics.length > 0}
                  hasVocabContent={vocabulary && vocabulary.length > 0}
                />
           </div>

           {/* TopicSelector - Order 3 on mobile only (after ContentTabs) */}
           <div className="lg:hidden order-3">
             <TopicSelector
                topics={filteredDiscussionTopics}
                selectedTopics={selectedTopics}
                onTopicToggle={handleTopicToggle}
                isLoading={isAnalysisLoading}
                onStartPractice={handleStartPractice}
                level={level}
                nativeLang={nativeLang}
                targetLang={targetLang}
             />
           </div>

           {/* Start Conversation Button */}
           {!showTutorWindow && <StartCallButton />}

           {/* Floating AI Tutor Window */}
           <FloatingTutorWindow
             key={videoData.id}
             isOpen={showTutorWindow}
             onClose={() => setShowTutorWindow(false)}
             isMinimized={tutorWindowMinimized}
             onMinimizeChange={setTutorWindowMinimized}
             videoTitle={videoData.title}
             summary={summary}
             vocabulary={vocabulary}
             transcript={transcript}
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
            videoTitle={videoData.title}
            videoId={videoData.id}
            onRequireAuth={async () => {
              const info = await getPracticeUsageDisplayInfo();
              setUsageInfo(info);
              setUsageLimitType('practice');
              setShowUsageLimitModal(true);
            }}
          />
      )}

      {/* 5. VIDEO LIBRARY PAGE */}
      {appState === AppState.VIDEO_LIBRARY && (
        <VideoLibraryPage
          onSelectVideo={handleLoadFromLibrary}
        />
      )}

      {/* 6. PRACTICE REPORT DETAIL PAGE (full page) */}
      {appState === AppState.PRACTICE_REPORT_DETAIL && currentReportsVideo && currentReportSessionId && (
        <PracticeReportDetailPage
          sessionId={currentReportSessionId}
          video={currentReportsVideo}
          onBack={handleBackToReportsList}
          onBackToLibrary={handleBackFromReportsToLibrary}
        />
      )}

      {/* 8. REPORTS DASHBOARD */}
      {appState === AppState.REPORTS_DASHBOARD && (
        <ReportsDashboardPage
          onViewReport={handleViewReportFromDashboard}
          onNavigateToVideo={handleNavigateToVideoFromDashboard}
        />
      )}

      {/* 9. SUBSCRIPTION PAGE */}
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

      {/* 11. PRIVACY PAGE */}
      {appState === AppState.PRIVACY && (
        <PrivacyPage />
      )}

      {/* 12. TERMS PAGE */}
      {appState === AppState.TERMS && (
        <TermsPage />
      )}

      {/* 13. RESET PASSWORD PAGE */}
      {appState === AppState.RESET_PASSWORD && (
        <ResetPasswordPage />
      )}

      {/* Translation Popup - Pro only, active on all content pages */}
      {/* Note: sourceLang is omitted so DeepL auto-detects the source language */}
      {tier === 'pro' &&
        (appState === AppState.DASHBOARD ||
        appState === AppState.PRACTICE_SESSION ||
        appState === AppState.PRACTICE_REPORT_DETAIL ||
        appState === AppState.REPORTS_DASHBOARD) && (
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
        message={upgradeFeature === 'Practice Session' ? "You've reached your daily limit. Upgrade to Pro for unlimited practice." : undefined}
        tier={tier}
        hideCreditsOption={upgradeFeature === 'Practice Session'}
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
        type={usageLimitType}
      />

      </Layout>
  );
};

export default App;