import React, { ReactNode, useEffect, useRef, useState } from 'react';
import AuthModal from './AuthModal';
import Footer from './Footer';
import UserMenu from './UserMenu';
import { DEEPL_SUPPORTED_LANGUAGES } from '../constants';

interface LayoutProps {
  children: ReactNode;
  onLogoClick?: () => void;
  targetLang?: string;
  level?: string;
  isScrollable?: boolean;
  authModalOpen?: boolean;
  onAuthModalClose?: () => void;
  onOpenVideoLibrary?: () => void;
  onOpenSubscription?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  // Translator language selector
  translatorLang?: string; // Current effective translator language (e.g., "Chinese (Mandarin - 中文)")
  onTranslatorLangChange?: (lang: string) => void;
  showFooter?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogoClick, targetLang, level, isScrollable = false, authModalOpen, onAuthModalClose, onOpenVideoLibrary, onOpenSubscription, onOpenProfile, onOpenSettings, onOpenPrivacy, onOpenTerms, translatorLang, onTranslatorLangChange, showFooter = false }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const translatorRef = useRef<HTMLDivElement>(null);

  // Allow external control of auth modal - use OR logic so either source can open it
  const effectiveAuthModalOpen = authModalOpen || isAuthModalOpen;

  const handleAuthModalClose = () => {
    setIsAuthModalOpen(false);
    onAuthModalClose?.();
  };

  // Close translator dropdown on outside click
  useEffect(() => {
    if (!isTranslatorOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (translatorRef.current && !translatorRef.current.contains(e.target as Node)) {
        setIsTranslatorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isTranslatorOpen]);

  // Get short label for translator badge (e.g., "Chinese (Mandarin - 中文)" → "中文")
  const getShortLabel = (langName: string) => {
    // Extract the native script part if it exists (inside parentheses or after dash)
    const match = langName.match(/[-–]\s*(.+?)\)?$/);
    if (match) return match[1].replace(')', '');
    // For simple names like "English", just return as-is
    return langName.split(' ')[0];
  };

  // New "Icon1" Style Duck Logo (Flat, Profile View, Cute)
  const DuckLogo = () => (
    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
       {/* Body */}
       <path d="M25 55C25 40 35 25 55 25C70 25 80 35 80 45C80 50 85 50 90 45C95 40 98 45 95 55C92 65 85 85 55 85C35 85 25 75 25 55Z" fill="#FCD34D" />
       {/* Wing */}
       <path d="M45 60C45 60 55 50 70 60" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
       {/* Beak */}
       <path d="M25 45H15C10 45 10 55 15 55H25" fill="#F97316"/>
       {/* Eye */}
       <circle cx="45" cy="40" r="4" fill="#1F2937"/>
       {/* Head Tuft/Lock detail from icon reference usually sits on head, adding a cute hair curl instead */}
       <path d="M55 25C55 20 60 15 65 20" stroke="#FCD34D" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );

  // Fixed Layout
  const fixedClasses = {
    container: "flex flex-col h-screen relative",
    main: "flex-1 overflow-hidden relative"
  };

  // Scrollable Layout
  const scrollableClasses = {
    container: "flex flex-col min-h-screen relative",
    main: "flex-1 relative"
  };

  const classes = isScrollable ? scrollableClasses : fixedClasses;

  return (
    <div className={classes.container}>
      <header className="absolute top-0 left-0 w-full px-6 py-5 flex items-center justify-between z-[100] pointer-events-none border-b border-black/5 bg-[#FAF9F6]/80 backdrop-blur-sm">
        <div
          className="flex items-center gap-3 cursor-pointer group select-none pointer-events-auto"
          onClick={onLogoClick}
        >
          {/* Duck Logo - Clean & Framed */}
          <div className="w-10 h-10 border border-stone-200 bg-[#FAF9F6] rounded-lg flex items-center justify-center shadow-sm">
             <DuckLogo />
          </div>
          <div>
              <h1 className="text-2xl font-serif text-stone-900 tracking-tight">Bilibala</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Language, level, and translator badges */}
          {targetLang && level && (
            <nav className="hidden md:flex gap-3">
              <span className="flex items-center gap-2 bg-[#FAF9F6] border border-stone-200 text-stone-600 px-3 py-1 rounded-md shadow-sm text-xs font-medium uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 border border-yellow-600"></span>
                {targetLang}
              </span>
              <span className="flex items-center gap-2 bg-[#FAF9F6] border border-stone-200 text-stone-600 px-3 py-1 rounded-md shadow-sm text-xs font-medium uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                {level}
              </span>

              {/* Translator language selector */}
              {translatorLang && onTranslatorLangChange && (
                <div className="relative" ref={translatorRef}>
                  <button
                    onClick={() => setIsTranslatorOpen(!isTranslatorOpen)}
                    className="flex items-center gap-2 bg-[#FAF9F6] border border-stone-200 text-stone-600 px-3 py-1 rounded-md shadow-sm text-xs font-medium uppercase tracking-wide hover:border-stone-300 hover:bg-stone-50 transition-all"
                  >
                    <TranslateIcon />
                    {getShortLabel(translatorLang)}
                    <ChevronIcon open={isTranslatorOpen} />
                  </button>

                  {/* Dropdown */}
                  {isTranslatorOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg py-1 z-[300] max-h-72 overflow-y-auto">
                      {DEEPL_SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            onTranslatorLangChange(lang.name);
                            setIsTranslatorOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
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
              )}
            </nav>
          )}

          {/* User Menu (Sign in button or Avatar with dropdown) */}
          <UserMenu onOpenAuthModal={() => setIsAuthModalOpen(true)} onOpenVideoLibrary={onOpenVideoLibrary} onOpenSubscription={onOpenSubscription} onOpenProfile={onOpenProfile} onOpenSettings={onOpenSettings} />
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={effectiveAuthModalOpen} onClose={handleAuthModalClose} />
      <main className={`${classes.main} pt-20`}>
        {children}
      </main>
      {showFooter && (
        <Footer onOpenPrivacy={onOpenPrivacy} onOpenTerms={onOpenTerms} />
      )}
    </div>
  );
};

const TranslateIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8l6 6" />
    <path d="M4 14l6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="M22 22l-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default Layout;
