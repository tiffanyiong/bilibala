import React, { useEffect, useState } from 'react';
import {
  PRO_ANNUAL_PRICE,
  PRO_ANNUAL_TOTAL,
  PRO_MONTHLY_PRICE,
  STARTER_PACK_AI_TUTOR_MINUTES,
  STARTER_PACK_PRACTICE_SESSIONS,
  STARTER_PACK_PRICE,
  STARTER_PACK_VIDEO_CREDITS,
  TOPUP_AI_TUTOR_MINUTES,
  TOPUP_PRICE,
  TOPUP_VIDEO_CREDITS,
} from '../../../shared/config/aiTutorConfig';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import { TIER_LIMITS } from '../../../shared/types/database';

interface SubscriptionPageProps {
  onOpenAuthModal: () => void;
}

// Icons as components for cleaner code
const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

const WaveformIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h2" />
    <path d="M6 8v8" />
    <path d="M10 4v16" />
    <path d="M14 6v12" />
    <path d="M18 9v6" />
    <path d="M22 12h-2" />
  </svg>
);

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const InfinityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
  </svg>
);

const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const TranslateIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8l6 6" />
    <path d="M4 14l6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2v3" />
    <path d="M22 22l-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ onOpenAuthModal }) => {
  const { user } = useAuth();
  const {
    tier,
    status,
    billingInterval,
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
  const [usageTab, setUsageTab] = useState<'monthly' | 'credits'>('monthly');

  const hasAnyCredits = videoCredits > 0 || practiceSessionCredits > 0 || aiTutorCreditMinutes > 0;

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

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success banners */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Welcome to Pro! Your subscription is now active.
          </div>
        )}

        {showCreditSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {showCreditSuccess === 'topup' ? 'Top-up added!' : 'Starter Pack purchased!'} Your credits are ready to use.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-stone-800 mb-2">Plan</h1>
          <p className="text-stone-500">
            You're currently on a {tier === 'pro' ? 'Pro' : 'free'} plan. Here's what you can do right now.
          </p>
        </div>

        {/* Current usage (if logged in) */}
        {user && !isLoading && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Current Usage — {tier === 'pro' ? 'Pro' : 'Free'} Plan
              </h3>

              {/* Tabs — only show if user has any credits */}
              {hasAnyCredits && (
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
                  <button
                    onClick={() => setUsageTab('monthly')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      usageTab === 'monthly'
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Monthly Allowance
                  </button>
                  <button
                    onClick={() => setUsageTab('credits')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      usageTab === 'credits'
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Remaining Credits
                  </button>
                </div>
              )}
            </div>

            {/* Monthly Allowance tab */}
            {usageTab === 'monthly' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <UsageMeter
                  label="Video Analysis"
                  used={usage.videosUsed}
                  limit={videosLimit}
                />
                <UsageMeter
                  label="AI Report"
                  used={usage.practiceSessionsUsed}
                  limit={practiceSessionsLimit}
                />
                <UsageMeter
                  label="AI Tutor"
                  used={usage.aiTutorMinutesUsed}
                  limit={aiTutorMinutesLimit}
                  unit="min"
                />
                <UsageMeter
                  label="PDF Export"
                  used={usage.pdfExportsUsed}
                  limit={tier === 'pro' ? Infinity : 0}
                  showAsEnabled
                />
              </div>
            )}

            {/* Remaining Credits tab */}
            {usageTab === 'credits' && hasAnyCredits && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <CreditMeter label="Video Credits" remaining={videoCredits} />
                <CreditMeter label="AI Report Credits" remaining={practiceSessionCredits} />
                <CreditMeter label="AI Tutor Credits" remaining={aiTutorCreditMinutes} unit="min" />
              </div>
            )}
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

          {/* Basic/Free Plan */}
          <div className={`bg-white border rounded-2xl p-6 flex flex-col ${
            tier === 'free' ? 'border-stone-300 shadow-sm' : 'border-stone-200'
          }`}>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-stone-800 mb-4">Basic</h2>
              <div className="mb-2">
                <span className="text-4xl font-semibold text-stone-800">Free</span>
              </div>
              <p className="text-sm text-stone-500">Try Bilibala for free, no card required</p>
            </div>


            <ul className="space-y-4 flex-1">
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><VideoIcon /></span>
                <span>{freeLimits.videosPerMonth} videos / month</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><WaveformIcon /></span>
                <span>{freeLimits.practiceSessionsPerMonth} AI Reports / month</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><LayersIcon /></span>
                <span>Save up to {freeLimits.videoLibraryMax} videos</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full mt-6 bg-stone-100 text-stone-500 py-3 rounded-full text-sm font-medium cursor-not-allowed"
            >
              {tier === 'free' ? 'Current plan' : 'Downgrade'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`relative bg-white border rounded-2xl p-6 flex flex-col ${
            tier === 'pro'
              ? 'border-stone-800 ring-1 ring-stone-600 shadow-sm'
              : 'border-stone-400 shadow-sm'
          }`}>
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs font-medium px-3 py-1 rounded-full">
              {tier === 'pro' ? 'Current' : 'Recommended'}
            </div>

            {/* Toggle inside card */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <h2 className="text-lg font-medium text-stone-800">Pro</h2>
              {tier !== 'pro' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className={billingCycle === 'monthly' ? 'text-stone-800' : 'text-stone-400'}>Monthly</span>
                  <button
                    onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      billingCycle === 'annual' ? 'bg-stone-800' : 'bg-stone-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      billingCycle === 'annual' ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                  <span className={billingCycle === 'annual' ? 'text-stone-800 font-medium' : 'text-stone-400'}>Annual</span>
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-1">
                {billingCycle === 'annual' && tier !== 'pro' && (
                  <span className="text-lg text-stone-400 line-through">${PRO_MONTHLY_PRICE}</span>
                )}
                <span className="text-4xl font-semibold text-stone-800">
                  ${tier === 'pro'
                    ? (billingInterval === 'year' ? PRO_ANNUAL_PRICE : PRO_MONTHLY_PRICE)
                    : (billingCycle === 'annual' ? PRO_ANNUAL_PRICE : PRO_MONTHLY_PRICE)}
                </span>
                <span className="text-stone-500">/ month</span>
              </div>
              <p className="text-sm text-stone-500">
                {tier === 'pro'
                  ? (billingInterval === 'year'
                    ? `Your current plan — billed $${PRO_ANNUAL_TOTAL}/year`
                    : 'Your current plan — billed monthly')
                  : billingCycle === 'annual'
                    ? `Billed annually, save $${(PRO_MONTHLY_PRICE - PRO_ANNUAL_PRICE) * 12}/year`
                    : 'Billed monthly'
                }
              </p>
            </div>


            <ul className="space-y-4 flex-1">
              <li className="flex items-center gap-3 text-sm text-stone-700">
                <span className="text-stone-500"><VideoIcon /></span>
                <span>{proLimits.videosPerMonth} videos / month</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-700">
                <span className="text-stone-500"><ChatIcon /></span>
                <span>{proLimits.aiTutorMinutesPerMonth} min AI Tutor / month</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><LayersIcon /></span>
                <span>Unlimited video storage</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-700">
                <span className="text-stone-500"><WaveformIcon /></span>
                <span>Unlimited AI Reports</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-700">
                <span className="text-stone-500"><TranslateIcon /></span>
                <span>Text highlight translation</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-700">
                <span className="text-stone-500"><FileTextIcon /></span>
                <span>PDF export</span>
              </li>
            </ul>

            {tier === 'pro' ? (
              <div className="mt-6">
          
                {subscription?.current_period_end && (
                  <p className="text-xs text-stone-500 mt-2 text-center">
                    {status === 'canceled' || subscription?.cancel_at_period_end ? 'Access until: ' : 'Renews: '}
                    {formatDate(subscription.current_period_end)}
                  </p>
                )}
                <button
                  onClick={handleManageBilling}
                  className="w-full bg-white text-stone-700 py-3 rounded-full text-sm font-medium hover:bg-stone-50 transition-all border border-stone-200"
                >
                  Manage Billing
                </button>
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full mt-6 bg-stone-800 text-white py-3 rounded-full text-sm font-medium hover:bg-stone-900 transition-all disabled:opacity-50"
              >
                {checkoutLoading ? 'Loading...' : 'Upgrade'}
              </button>
            )}
          </div>

          {/* Top Up / Starter Pack */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-stone-800 mb-4">
                {tier === 'pro' ? 'Top Up' : 'Starter Pack'}
              </h2>
              <div className="mb-1">
                <span className="text-4xl font-semibold text-stone-800">
                  ${tier === 'pro' ? TOPUP_PRICE : STARTER_PACK_PRICE}
                </span>
              </div>
              <p className="text-sm text-stone-500">Pay as you go, one-time payment</p>
            </div>


            <ul className="space-y-4 flex-1">
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><VideoIcon /></span>
                <span>{tier === 'pro' ? TOPUP_VIDEO_CREDITS : STARTER_PACK_VIDEO_CREDITS} video credits</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><ChatIcon /></span>
                <span>{tier === 'pro' ? TOPUP_AI_TUTOR_MINUTES : STARTER_PACK_AI_TUTOR_MINUTES} min AI Tutor</span>
              </li>
              {tier === 'free' && (
                <li className="flex items-center gap-3 text-sm text-stone-600">
                  <span className="text-stone-400"><WaveformIcon /></span>
                  <span>{STARTER_PACK_PRACTICE_SESSIONS} AI Report credits</span>
                </li>
              )}
              <li className="flex items-center gap-3 text-sm text-stone-600">
                <span className="text-stone-400"><InfinityIcon /></span>
                <span>Credits never expire</span>
              </li>
            </ul>

            <button
              onClick={() => handleBuyCredits(tier === 'pro' ? 'topup' : 'starter')}
              disabled={creditCheckoutLoading !== null}
              className="w-full mt-6 bg-white text-stone-700 py-3 rounded-full text-sm font-medium hover:bg-stone-50 transition-all border border-stone-300 disabled:opacity-50"
            >
              {creditCheckoutLoading ? 'Loading...' : 'Buy Credits'}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
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
              a="Pro users get 60 minutes of AI Tutor conversation per month. You can buy additional credits anytime with the top-up pack."
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
}> = ({ label, used, limit, unit = '', showAsEnabled }) => {
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
  // Cap monthly usage at the limit — any overflow was consumed from credits
  const monthlyUsed = isUnlimited ? used : Math.min(used, limit);
  const remaining = Math.max(limit - monthlyUsed, 0);
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((monthlyUsed / limit) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && limit > 0 && percentage >= 80;

  return (
    <div>
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      {limit === 0 ? (
        <span className="inline-block text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
          Pro only
        </span>
      ) : isUnlimited ? (
        <div className="text-sm font-medium text-stone-700">
          {used}{unit} used
        </div>
      ) : (
        <>
          <div className={`text-sm font-medium ${isNearLimit ? 'text-amber-600' : 'text-stone-700'}`}>
            {remaining === 0
              ? 'Limit reached'
              : `${remaining}${unit} remaining`}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {monthlyUsed}{unit} / {limit}{unit} used
          </div>
        </>
      )}
      {!isUnlimited && limit > 0 && (
        <div className="mt-1.5 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-stone-400'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

const CreditMeter: React.FC<{
  label: string;
  remaining: number;
  unit?: string;
}> = ({ label, remaining, unit = '' }) => (
  <div>
    <div className="text-xs text-stone-500 mb-1">{label}</div>
    <div className="text-sm font-medium text-green-600">
      {remaining}{unit && ` ${unit}`} remaining
    </div>
    <div className="text-xs text-stone-400 mt-0.5">Never expires</div>
  </div>
);

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => (
  <div>
    <h4 className="text-sm font-medium text-stone-700">{q}</h4>
    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{a}</p>
  </div>
);

export default SubscriptionPage;
