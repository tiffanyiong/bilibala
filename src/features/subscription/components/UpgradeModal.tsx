import React from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  feature: string;
  message?: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  feature,
  message,
}) => {
  if (!isOpen) return null;

  const defaultMessages: Record<string, string> = {
    'Video Analysis': "You've reached your monthly video limit. Upgrade to Pro for unlimited video analyses.",
    'Practice Session': "You've used all your practice sessions this month. Upgrade to Pro for unlimited practice.",
    'AI Tutor': 'AI Tutor is a Pro feature. Upgrade to have live conversations with your AI language tutor.',
    'PDF Export': 'PDF export is a Pro feature. Upgrade to download practice reports as PDFs.',
  };

  const displayMessage = message || defaultMessages[feature] || `${feature} requires a Pro subscription.`;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#FAF9F6] rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-medium text-stone-800 text-center mb-2">
          Upgrade to Pro
        </h3>
        <p className="text-sm text-stone-500 text-center mb-5 leading-relaxed">
          {displayMessage}
        </p>

        {/* Pro benefits */}
        <div className="bg-stone-50 rounded-lg p-3 mb-5 space-y-1.5">
          <div className="text-xs font-medium text-stone-600 mb-2">Pro includes:</div>
          {[
            'Unlimited videos & practice sessions',
            '60 min/month AI Tutor conversations',
            'PDF report export',
            'Full video library access',
          ].map(benefit => (
            <div key={benefit} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="text-green-600">✓</span>
              {benefit}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-all"
          >
            Not Now
          </button>
          <button
            onClick={onUpgrade}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-stone-800 hover:bg-stone-900 transition-all"
          >
            Upgrade — $9/mo
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
