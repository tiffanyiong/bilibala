import React, { useEffect } from 'react';

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  usageInfo: {
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
  } | null;
}

const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  usageInfo,
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !usageInfo) return null;

  const usagePercentage = Math.min(100, (usageInfo.used / usageInfo.limit) * 100);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg p-6 md:p-8 max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 className="text-2xl font-serif text-stone-900">
            Free Limit Reached
          </h2>

          <p className="text-stone-600">
            You've used all {usageInfo.limit} free analyses this month.
            Sign in for more access!
          </p>

          {/* Usage indicator */}
          <div className="bg-stone-100 rounded-lg p-4">
            <div className="flex justify-between text-sm text-stone-600 mb-2">
              <span>Monthly usage</span>
              <span>{usageInfo.used}/{usageInfo.limit}</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Resets on {usageInfo.resetDate}
            </p>
          </div>

          {/* Benefits list */}
          <div className="text-left bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 mb-2">With a free account, you get:</p>
            <ul className="text-sm text-green-700 space-y-1">
              <li className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                3 video analyses per month
              </li>
              <li className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Save videos to your library
              </li>
              <li className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Track your learning progress
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLogin();
              }}
              className="w-full bg-stone-800 text-white font-medium py-3 text-sm rounded-lg hover:bg-stone-900 transition-all cursor-pointer"
            >
              Sign in for More Access
            </button>
            <button
              onClick={onClose}
              className="w-full text-stone-500 hover:text-stone-800 text-sm transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageLimitModal;
