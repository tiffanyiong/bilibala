import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  onLogoClick?: () => void;
  targetLang?: string;
  level?: string;
  isScrollable?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogoClick, targetLang, level, isScrollable = false }) => {
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
      {/* Absolute positioning to float logo/nav without occupying layout space */}
      <header className="absolute top-0 left-0 w-full px-6 py-4 flex items-center justify-between z-[100] pointer-events-none">
        <div 
          className="flex items-center gap-3 cursor-pointer group select-none hover:scale-105 transition-transform pointer-events-auto" 
          onClick={onLogoClick}
        >
          {/* Custom Plastic Duck Icon */}
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md ring-4 ring-white/30">
             <DuckLogo />
          </div>
          <div>
              <h1 className="text-3xl font-black text-white tracking-wide font-display drop-shadow-md" style={{ textShadow: '2px 2px 0px rgba(8, 145, 178, 1)' }}>Bilibala</h1>
          </div>
        </div>
        
        {targetLang && level && (
            <nav className="flex gap-3 pointer-events-auto">
            <span className="hidden md:flex items-center gap-2 bg-white/90 backdrop-blur border-2 border-white text-cyan-800 px-4 py-1.5 rounded-full shadow-sm font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                {targetLang}
            </span>
            <span className="hidden md:flex items-center gap-2 bg-white/90 backdrop-blur border-2 border-white text-pink-600 px-4 py-1.5 rounded-full shadow-sm font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                {level}
            </span>
            </nav>
        )}
      </header>
      <main className={classes.main}>
        {children}
      </main>
    </div>
  );
};

export default Layout;