import React from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onBuyCredits?: () => void;
  feature: string;
  message?: string;
  tier?: 'free' | 'pro';
  hideCreditsOption?: boolean;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  onBuyCredits,
  feature,
  message,
  tier = 'free',
  hideCreditsOption = false,
}) => {
  if (!isOpen) return null;

  const isLimitReached = feature === 'AI Tutor Limit Reached';
  const isPracticeLimit = feature === 'Practice Session';
  const isAiTutorFeature = feature === 'AI Tutor';
  const isProUser = tier === 'pro';

  const defaultMessages: Record<string, string> = {
    'Video Analysis': "You've reached your monthly video limit. Upgrade to Pro for unlimited video analyses.",
    'Practice Session': "You've used all your practice sessions this month. Upgrade to Pro for unlimited practice.",
    'AI Tutor': 'AI Tutor is a Pro feature. Upgrade to have live conversations with your AI language tutor.',
    'AI Tutor Limit Reached': "You've used all your AI Tutor minutes this month. Buy more minutes or wait until next month.",
    'PDF Export': 'PDF export is a Pro feature. Upgrade to download practice reports as PDFs.',
    'Library Storage': "Your library is full. Upgrade to Pro for unlimited storage, or remove a video from your library to make room.",
  };

  const displayMessage = message || defaultMessages[feature] || `${feature} requires a Pro subscription.`;

  // Determine which credit option to show
  // Only show Starter Pack for Practice Session limit (not for AI Tutor - users can find it on subscription page)
  const showStarterPackOption = !isProUser && isPracticeLimit && !hideCreditsOption;
  const showTopupOption = isProUser && isLimitReached && !hideCreditsOption;

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
          {isLimitReached ? 'Monthly Limit Reached' : 'Upgrade to Pro'}
        </h3>
        <p className="text-sm text-stone-500 text-center mb-5 leading-relaxed">
          {displayMessage}
        </p>

        {/* Pro benefits (only show for upgrade, not limit reached, and not for pro users) */}
        {!isLimitReached && !isProUser && (
          <div className="bg-stone-50 rounded-lg p-3 mb-5 space-y-1.5">
            <div className="text-xs font-medium text-stone-600 mb-2">Pro includes:</div>
            {[
              'Unlimited practice sessions',
              '100 analyzed videos/month',
              '60 min/month AI Tutor conversations',
              'PDF report export',
              'Full video library access',
              'Text translator (highlight to translate)',
            ].map(benefit => (
              <div key={benefit} className="flex items-center gap-2 text-xs text-stone-600">
                <span className="text-green-600">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        )}

        {/* Credit pack info for Pro user limit reached */}
        {showTopupOption && (
          <div className="bg-stone-50 rounded-lg p-3 mb-5">
            <div className="text-xs font-medium text-stone-600 mb-2">AI Tutor Top-up — $3</div>
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <span className="text-green-600">✓</span>
              +30 minutes of AI Tutor
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <span className="text-stone-400">—</span>
              Credits never expire
            </div>
          </div>
        )}

        {/* Credit pack info for free user */}
        {showStarterPackOption && (
          <div className="bg-stone-50 rounded-lg p-3 mb-3">
            <div className="text-xs font-medium text-stone-600 mb-2">Or try the Starter Pack — $5</div>
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <span className="text-green-600">✓</span>
              30 min AI Tutor + 30 practice sessions
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {/* Primary action row */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-all"
            >
              {isLimitReached && !showTopupOption ? 'Got It' : 'Not Now'}
            </button>
            {!isLimitReached && !isProUser && (
              <button
                onClick={onUpgrade}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-stone-800 hover:bg-stone-900 transition-all"
              >
                Upgrade to Pro
              </button>
            )}
            {showTopupOption && onBuyCredits && (
              <button
                onClick={onBuyCredits}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-stone-800 hover:bg-stone-900 transition-all"
              >
                Buy Top-up
              </button>
            )}
          </div>

          {/* Secondary action: Buy credits for free users */}
          {showStarterPackOption && onBuyCredits && (
            <button
              onClick={onBuyCredits}
              className="w-full py-2 rounded-lg text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 transition-all border border-stone-200"
            >
              Buy Starter Pack ($5)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
