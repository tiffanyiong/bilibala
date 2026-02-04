import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import { TIER_LIMITS } from '../../../shared/types/database';

interface SubscriptionPageProps {
  onOpenAuthModal: () => void;
}

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ onOpenAuthModal }) => {
  const { user } = useAuth();
  const {
    tier,
    status,
    subscription,
    usage,
    videosLimit,
    practiceSessionsLimit,
    aiTutorMinutesLimit,
    aiTutorCreditMinutes,
    practiceSessionCredits,
    videoCredits,
    createCheckout,
    createCreditCheckout,
    createPortal,
    syncWithStripe,
    refreshSubscription,
    isLoading,
  } = useSubscription();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [creditCheckoutLoading, setCreditCheckoutLoading] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCreditSuccess, setShowCreditSuccess] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setShowSuccess(true);
      window.history.replaceState(null, '', '/subscription');
      syncWithStripe().then((synced) => {
        if (synced) {
          console.log('[SubscriptionPage] Synced subscription with Stripe');
        }
      });
    }
    if (params.get('credit_success') === 'true') {
      const pack = params.get('pack') || 'starter';
      setShowCreditSuccess(pack);
      window.history.replaceState(null, '', '/subscription');
      refreshSubscription();
    }
  }, [syncWithStripe, refreshSubscription]);

  const handleUpgrade = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    setCheckoutLoading(true);
    try {
      const url = await createCheckout(billingCycle);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    const url = await createPortal();
    if (url) {
      window.location.href = url;
    }
  };

  const handleBuyCredits = async (packType: 'starter' | 'topup') => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    setCreditCheckoutLoading(packType);
    try {
      const url = await createCreditCheckout(packType);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setCreditCheckoutLoading(null);
    }
  };

  const freeLimits = TIER_LIMITS.free;
  const proLimits = TIER_LIMITS.pro;

  const features = [
    {
      name: 'Videos per month',
      free: `${freeLimits.videosPerMonth}`,
      pro: 'Unlimited',
    },
    {
      name: 'Practice sessions',
      free: `${freeLimits.practiceSessionsPerMonth}/month`,
      pro: 'Unlimited',
    },
    {
      name: 'AI Tutor',
      free: '—',
      pro: `${proLimits.aiTutorMinutesPerMonth} min/month`,
    },
    {
      name: 'AI feedback',
      free: `${freeLimits.practiceSessionsPerMonth} total`,
      pro: 'Unlimited',
    },
    {
      name: 'PDF export',
      free: '—',
      pro: '✓',
    },
    {
      name: 'Video library',
      free: `Up to ${freeLimits.videoLibraryMax} videos`,
      pro: 'Unlimited',
    },
    {
      name: 'Text translator',
      free: '—',
      pro: '✓',
    },
  ];

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success banner */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Welcome to Pro! Your subscription is now active.
          </div>
        )}

        {/* Credit success banner */}
        {showCreditSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {showCreditSuccess === 'topup' ? 'AI Tutor top-up added!' : 'Starter Pack purchased!'} Your credits are ready to use.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif text-stone-800 mb-2">Subscription Plan</h1>
          <p className="text-sm text-stone-500">Choose the plan that works for you</p>
        </div>

        {/* Current usage (if logged in) */}
        {user && !isLoading && (
          <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-5 mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
              Current Usage — {tier === 'pro' ? 'Pro' : 'Free'} Plan
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <UsageMeter
                label="Videos"
                used={usage.videosUsed}
                limit={videosLimit}
              />
              <UsageMeter
                label="Practice"
                used={usage.practiceSessionsUsed}
                limit={practiceSessionsLimit}
                credits={practiceSessionCredits}
                creditText={practiceSessionCredits > 0 ? `You have ${practiceSessionCredits} credits` : undefined}
              />
              <UsageMeter
                label="AI Tutor"
                used={usage.aiTutorMinutesUsed}
                limit={aiTutorMinutesLimit}
                unit="min"
                credits={aiTutorCreditMinutes}
                color="amber"
                creditText={aiTutorCreditMinutes > 0 ? `You have ${aiTutorCreditMinutes} min credits` : undefined}
              />
              <UsageMeter
                label="PDF Export"
                used={usage.pdfExportsUsed}
                limit={tier === 'pro' ? Infinity : 0}
                showAsEnabled
              />
            </div>
          </div>
        )}

        {/* Billing cycle toggle */}
        {tier === 'free' && (
          <div className="flex justify-center mb-6">
            <div className="bg-stone-100 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Annual
                <span className="ml-1 text-xs text-green-600 font-semibold">Save 22%</span>
              </button>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Free Plan */}
          <div className={`bg-[#FAF9F6] border rounded-xl p-6 relative ${
            tier === 'free' ? 'border-stone-400 ring-1 ring-stone-300' : 'border-stone-200'
          }`}>
            {tier === 'free' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                Current
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-lg font-medium text-stone-800">Free</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-stone-800">$0</span>
                <span className="text-sm text-stone-500">/month</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">Get started for free</p>
            </div>


            <ul className="mt-5 space-y-2.5">
              {features.map(f => (
                <li key={f.name} className="flex items-center gap-2 text-sm text-stone-600">
                  <span className={f.free === '—' ? 'text-stone-300' : 'text-stone-500'}>
                    {f.free === '—' ? '✗' : '✓'}
                  </span>
                  <span className={f.free === '—' ? 'text-stone-400' : ''}>
                    {f.name}: {f.free}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Plan */}
          <div className={`bg-[#FAF9F6] border rounded-xl p-6 relative ${
            tier === 'pro' ? 'border-stone-800 ring-1 ring-stone-600' : 'border-stone-300'
          }`}>
            {tier === 'pro' ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs font-medium px-3 py-1 rounded-full">
                Current
              </div>
            ) : (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs font-medium px-3 py-1 rounded-full">
                Recommended
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-lg font-medium text-stone-800">Pro</h2>
              <div className="mt-2">
                <span className="text-3xl font-bold text-stone-800">
                  ${billingCycle === 'annual' ? '7' : '9'}
                </span>
                <span className="text-sm text-stone-500">/month</span>
                {billingCycle === 'annual' && (
                  <span className="text-xs text-stone-400 block">Billed annually ($84/year)</span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">For serious language learners</p>
            </div>

            {tier === 'pro' ? (
              <>
                <button
                  onClick={handleManageBilling}
                  className="w-full bg-stone-200 text-stone-700 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-300 transition-all"
                >
                  Manage Billing
                </button>
                {subscription?.current_period_end && (
                  <p className="text-xs text-stone-500 mt-2 text-center">
                    {status === 'canceled' ? 'Access until: ' : 'Renews on: '}
                    {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full bg-stone-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-all disabled:opacity-50"
              >
                {checkoutLoading ? 'Loading...' : 'Upgrade to Pro'}
              </button>
            )}

            <ul className="mt-5 space-y-2.5">
              {features.map(f => (
                <li key={f.name} className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>{f.name}: {f.pro}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Starter Pack - only for free users */}
          {tier === 'free' && (
            <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-stone-800">Starter Pack</h2>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-stone-800">$5</span>
                  <span className="text-sm text-stone-500"> one-time</span>
                </div>
                <p className="text-xs text-stone-500 mt-1">Try premium features</p>
              </div>

              <button
                onClick={() => handleBuyCredits('starter')}
                disabled={creditCheckoutLoading === 'starter'}
                className="w-full bg-stone-100 text-stone-700 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                {creditCheckoutLoading === 'starter' ? 'Loading...' : 'Buy Starter Pack'}
              </button>

              <ul className="mt-5 space-y-2.5">
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>30 min AI Tutor</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>30 practice sessions</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>Never expires</span>
                </li>
              </ul>
            </div>
          )}

          {/* AI Tutor Top-up - only for pro users */}
          {tier === 'pro' && (
            <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-stone-800">AI Tutor Top-up</h2>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-stone-800">$3</span>
                  <span className="text-sm text-stone-500"> one-time</span>
                </div>
                <p className="text-xs text-stone-500 mt-1">Need more AI time?</p>
              </div>

              <button
                onClick={() => handleBuyCredits('topup')}
                disabled={creditCheckoutLoading === 'topup'}
                className="w-full bg-stone-100 text-stone-700 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                {creditCheckoutLoading === 'topup' ? 'Loading...' : 'Buy Top-up'}
              </button>

              <ul className="mt-5 space-y-2.5">
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>+30 min AI Tutor</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>Never expires</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-green-600">✓</span>
                  <span>Stack with monthly limit</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-stone-700 mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <FaqItem
              q="Can I cancel anytime?"
              a="Yes, you can cancel your subscription at any time. You'll keep Pro access until the end of your billing period."
            />
            <FaqItem
              q="What happens when I hit my free limit?"
              a="You'll see a prompt to upgrade or buy a credit pack. Your existing data is always accessible."
            />
            <FaqItem
              q="How does the AI Tutor limit work?"
              a="Pro users get 60 minutes of AI Tutor conversation per month. You can buy additional minutes anytime with the top-up pack."
            />
            <FaqItem
              q="Do credits expire?"
              a="No, credits never expire. Use them whenever you want."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

const UsageMeter: React.FC<{
  label: string;
  used: number;
  limit: number;
  unit?: string;
  showAsEnabled?: boolean;
  credits?: number;
  color?: 'stone' | 'amber';
  creditText?: string;
}> = ({ label, used, limit, unit = '', showAsEnabled, credits = 0, color = 'stone', creditText }) => {
  const hasCredits = credits > 0;

  if (showAsEnabled) {
    const enabled = limit > 0 || limit === Infinity;
    return (
      <div>
        <div className="text-xs text-stone-500 mb-1">{label}</div>
        {enabled ? (
          <div className="text-sm font-medium text-green-600">Enabled</div>
        ) : (
          <span className="inline-block text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            Pro only
          </span>
        )}
      </div>
    );
  }

  const isUnlimited = limit === Infinity;
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && limit > 0 && percentage >= 80;

  return (
    <div>
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      {limit === 0 && !hasCredits ? (
        <span className="inline-block text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
          Pro only
        </span>
      ) : limit === 0 && hasCredits ? (
        <div className="text-sm font-medium text-stone-700">
          {credits}{unit} <span className="text-green-600 text-xs">credits</span>
        </div>
      ) : (
        <div className={`text-sm font-medium ${color === 'amber' ? 'text-amber-600' : (isNearLimit && !hasCredits ? 'text-amber-600' : 'text-stone-700')}`}>
          {isUnlimited ? `${used}${unit} used` : `${used}${unit} / ${limit}${unit}`}
          {hasCredits && (
            <span className="text-green-600 text-xs ml-1">+{credits}</span>
          )}
        </div>
      )}
      {!isUnlimited && limit > 0 && (
        <div className="mt-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              color === 'amber' ? 'bg-amber-500' : (isNearLimit ? 'bg-amber-500' : 'bg-stone-500')
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {creditText && (
        <p className="text-xs text-green-600 mt-1">{creditText}</p>
      )}
    </div>
  );
};

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => (
  <div>
    <h4 className="text-sm font-medium text-stone-700">{q}</h4>
    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{a}</p>
  </div>
);

export default SubscriptionPage;
