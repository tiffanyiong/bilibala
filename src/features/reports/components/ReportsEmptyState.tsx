import React from 'react';

const ReportsEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4 animate-[glassDropIn_0.3s_ease-out]">
    <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-6" />
      </svg>
    </div>
    <h3 className="text-lg font-serif text-stone-700 mb-1">No practice reports yet</h3>
    <p className="text-sm text-stone-500 text-center max-w-xs">
      Start a speaking practice session from any video to see your reports here.
    </p>
  </div>
);

export default ReportsEmptyState;
