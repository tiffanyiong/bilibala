import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  DbUserSubscription,
  MonthlyUsage,
  SubscriptionTier,
  TIER_LIMITS,
  UsageActionType,
} from '../types/database';
import {
  getOrCreateSubscription,
  getMonthlyUsage,
  getDailyPracticeUsage,
  recordUsage,
  incrementMonthlyUsage,
  deductAiTutorCredits,
  deductPracticeCredits,
  deductVideoCredits,
} from '../services/subscriptionDatabase';
import { getBackendOrigin } from '../services/backend';
import { fetchAppConfig } from '../config/aiTutorConfig';

interface SubscriptionContextType {
  // Subscription info
  tier: SubscriptionTier;
  status: string;
  billingInterval: 'month' | 'year';
  subscription: DbUserSubscription | null;

  // Usage data
  usage: MonthlyUsage;

  // Credit balances (purchased, never expire)
  aiTutorCreditMinutes: number;
  practiceSessionCredits: number;
  videoCredits: number;

  // Computed permissions
  canAddVideo: boolean;
  canStartPractice: boolean;
  canUseAiTutor: boolean;
  canExportPdf: boolean;

  // Usage limits for display
  videosLimit: number;
  practiceSessionsLimit: number;
  aiTutorMinutesLimit: number;
  /** Minutes remaining in the current month's AI tutor allowance (monthly + credits) */
  aiTutorRemainingMinutes: number;
  /** Monthly minutes remaining (not including credits) */
  aiTutorMonthlyRemaining: number;

  // Actions
  recordAction: (actionType: UsageActionType, metadata?: Record<string, unknown>) => Promise<boolean>;
  refreshUsage: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  syncWithStripe: () => Promise<boolean>;
  createCheckout: (priceType?: 'monthly' | 'annual') => Promise<string | null>;
  createCreditCheckout: (packType: 'starter' | 'topup') => Promise<string | null>;
  createPortal: () => Promise<string | null>;

  // Loading state
  isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<DbUserSubscription | null>(null);
  const [usage, setUsage] = useState<MonthlyUsage>({
    videosUsed: 0,
    practiceSessionsUsed: 0,
    aiTutorMinutesUsed: 0,
    pdfExportsUsed: 0,
    practiceSessionsDailyUsed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const tier: SubscriptionTier = subscription?.tier as SubscriptionTier || 'free';
  const limits = TIER_LIMITS[tier];

  // Load subscription and usage data when user changes
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setUsage({ videosUsed: 0, practiceSessionsUsed: 0, aiTutorMinutesUsed: 0, pdfExportsUsed: 0, practiceSessionsDailyUsed: 0 });
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch app config from server (non-blocking, uses defaults if fails)
        fetchAppConfig();

        const [sub, monthlyUsage, dailyPracticeUsage] = await Promise.all([
          getOrCreateSubscription(user.id),
          getMonthlyUsage(user.id),
          getDailyPracticeUsage(user.id),
        ]);
        setSubscription(sub);
        setUsage({ ...monthlyUsage, practiceSessionsDailyUsed: dailyPracticeUsage });

        // Smart sync: Sync with Stripe if there's a potential mismatch:
        // 1. User has active subscription but tier is free (missed webhook)
        // 2. User is pro but missing period dates or billing_interval (incomplete webhook data)
        const hasMissingData = sub?.stripe_subscription_id &&
                              sub?.subscription_status === 'active' &&
                              sub?.tier === 'pro' &&
                              (!sub.current_period_start || !sub.current_period_end || !sub.billing_interval);
        const hasTierMismatch = sub?.stripe_subscription_id &&
                          sub?.subscription_status === 'active' &&
                          sub?.tier === 'free';
        const shouldSync = (hasTierMismatch || hasMissingData) && session?.access_token;
        if (shouldSync) {
          console.log('[SubscriptionContext] Sync needed:', hasTierMismatch ? 'tier mismatch' : 'missing period/billing data');
          try {
            const res = await fetch(`${getBackendOrigin()}/api/subscriptions/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
            });
            const data = await res.json();
            if (data.synced) {
              // Reload subscription AND usage data after sync (monthly usage may have been reset)
              const [updatedSub, updatedUsage] = await Promise.all([
                getOrCreateSubscription(user.id),
                getMonthlyUsage(user.id),
              ]);
              setSubscription(updatedSub);
              setUsage(updatedUsage);
              console.log('[SubscriptionContext] Synced successfully:', { tier: data.tier, status: data.status });
            }
          } catch (syncErr) {
            console.error('Error during smart sync:', syncErr);
          }
        }
      } catch (err) {
        console.error('Error loading subscription data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, session]);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    try {
      const [monthlyUsage, dailyPracticeUsage] = await Promise.all([
        getMonthlyUsage(user.id),
        getDailyPracticeUsage(user.id),
      ]);
      setUsage({ ...monthlyUsage, practiceSessionsDailyUsed: dailyPracticeUsage });
    } catch (err) {
      console.error('Error refreshing usage:', err);
    }
  }, [user]);

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const sub = await getOrCreateSubscription(user.id);
      setSubscription(sub);
    } catch (err) {
      console.error('Error refreshing subscription:', err);
    }
  }, [user]);

  // Sync subscription status directly with Stripe (fallback for missed webhooks)
  const syncWithStripe = useCallback(async (): Promise<boolean> => {
    if (!session?.access_token) return false;
    try {
      const res = await fetch(`${getBackendOrigin()}/api/subscriptions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.synced) {
        // Refresh local subscription AND usage data from database
        if (user) {
          const [sub, updatedUsage] = await Promise.all([
            getOrCreateSubscription(user.id),
            getMonthlyUsage(user.id),
          ]);
          setSubscription(sub);
          setUsage(updatedUsage);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error syncing with Stripe:', err);
      return false;
    }
  }, [session, user]);

  const recordAction = useCallback(async (
    actionType: UsageActionType,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> => {
    if (!user) return false;

    // 1. Audit log — always insert into usage_history
    const success = await recordUsage(user.id, actionType, metadata);
    if (!success) return false;

    // 2. Split between monthly allowance and credits
    //    Monthly column only tracks usage covered by the monthly allowance.
    //    Anything beyond the monthly limit is deducted from purchased credits.

    if (actionType === 'video_analysis') {
      const monthlyRemaining = limits.videosPerMonth - usage.videosUsed;
      if (monthlyRemaining > 0) {
        // Covered by monthly allowance — increment monthly column
        await incrementMonthlyUsage(user.id, actionType, 1);
        setUsage(prev => ({ ...prev, videosUsed: prev.videosUsed + 1 }));
      } else {
        // Monthly exhausted — deduct from credits
        const deducted = await deductVideoCredits(user.id);
        if (deducted > 0) {
          setSubscription(prev => prev ? {
            ...prev,
            video_credits: Math.max(0, (prev.video_credits || 0) - 1),
          } : null);
        }
      }
    }

    if (actionType === 'ai_tutor') {
      const minutesUsed = (metadata.minutes_used as number) || 0;
      const monthlyRemaining = Math.max(0, limits.aiTutorMinutesPerMonth - usage.aiTutorMinutesUsed);
      const monthlyPortion = Math.min(minutesUsed, monthlyRemaining);
      const creditPortion = minutesUsed - monthlyPortion;

      console.log('[AI Tutor] minutesUsed:', minutesUsed, 'monthlyRemaining:', monthlyRemaining, 'monthlyPortion:', monthlyPortion, 'creditPortion:', creditPortion);

      // Increment monthly column only for the portion covered by monthly allowance
      if (monthlyPortion > 0) {
        await incrementMonthlyUsage(user.id, actionType, monthlyPortion);
        setUsage(prev => ({ ...prev, aiTutorMinutesUsed: prev.aiTutorMinutesUsed + monthlyPortion }));
      }

      // Deduct the rest from credits
      if (creditPortion > 0) {
        const deducted = await deductAiTutorCredits(user.id, creditPortion);
        console.log('[AI Tutor] Deducted', deducted, 'credit minutes');
        if (deducted > 0) {
          setSubscription(prev => prev ? {
            ...prev,
            ai_tutor_credit_minutes: Math.max(0, (prev.ai_tutor_credit_minutes || 0) - deducted),
          } : null);
        }
      }
    }

    if (actionType === 'practice_session') {
      // Free tier: Check daily limit (5/day), Pro tier: unlimited
      if (tier === 'free') {
        const dailyRemaining = limits.practiceSessionsPerDay - usage.practiceSessionsDailyUsed;
        if (dailyRemaining > 0) {
          // Within daily allowance — increment both monthly and daily counters
          await incrementMonthlyUsage(user.id, actionType, 1);
          setUsage(prev => ({
            ...prev,
            practiceSessionsUsed: prev.practiceSessionsUsed + 1,
            practiceSessionsDailyUsed: prev.practiceSessionsDailyUsed + 1,
          }));
        } else {
          // Daily limit exhausted — deduct from credits
          const deducted = await deductPracticeCredits(user.id);
          if (deducted > 0) {
            setSubscription(prev => prev ? {
              ...prev,
              practice_session_credits: Math.max(0, (prev.practice_session_credits || 0) - 1),
            } : null);
          }
        }
      } else {
        // Pro tier: unlimited, just track in monthly counter
        await incrementMonthlyUsage(user.id, actionType, 1);
        setUsage(prev => ({ ...prev, practiceSessionsUsed: prev.practiceSessionsUsed + 1 }));
      }
    }

    if (actionType === 'pdf_export') {
      // PDF is permission-based, no counting needed
    }

    return true;
  }, [user, tier, limits, usage]);

  const createCheckout = useCallback(async (priceType: 'monthly' | 'annual' = 'monthly'): Promise<string | null> => {
    if (!session?.access_token) return null;
    try {
      const res = await fetch(`${getBackendOrigin()}/api/subscriptions/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceType, origin: window.location.origin }),
      });
      const data = await res.json();
      return data.url || null;
    } catch (err) {
      console.error('Error creating checkout:', err);
      return null;
    }
  }, [session]);

  const createPortal = useCallback(async (): Promise<string | null> => {
    if (!session?.access_token) return null;
    try {
      const res = await fetch(`${getBackendOrigin()}/api/subscriptions/create-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      return data.url || null;
    } catch (err) {
      console.error('Error creating portal:', err);
      return null;
    }
  }, [session]);

  const createCreditCheckout = useCallback(async (packType: 'starter' | 'topup'): Promise<string | null> => {
    if (!session?.access_token) return null;
    try {
      const res = await fetch(`${getBackendOrigin()}/api/subscriptions/create-credit-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packType, origin: window.location.origin }),
      });
      const data = await res.json();
      return data.url || null;
    } catch (err) {
      console.error('Error creating credit checkout:', err);
      return null;
    }
  }, [session]);

  // Credit balances from subscription
  const aiTutorCreditMinutes = subscription?.ai_tutor_credit_minutes || 0;
  const practiceSessionCredits = subscription?.practice_session_credits || 0;
  const videoCredits = subscription?.video_credits || 0;

  // Computed permissions (now credit-aware)
  const canAddVideo = usage.videosUsed < limits.videosPerMonth || videoCredits > 0;
  // Free users: check daily limit (5/day), can use credits if daily exhausted; Pro users: unlimited
  const canStartPractice = tier === 'free'
    ? (usage.practiceSessionsDailyUsed < limits.practiceSessionsPerDay || practiceSessionCredits > 0)
    : true; // Pro has unlimited
  // Users can use AI tutor if they have monthly allowance remaining OR have credits
  const aiTutorMonthlyRemaining = Math.max(0, limits.aiTutorMinutesPerMonth - usage.aiTutorMinutesUsed);
  const canUseAiTutor = aiTutorMonthlyRemaining > 0 || aiTutorCreditMinutes > 0;
  const canExportPdf = limits.pdfExport;
  // Total remaining = monthly remaining + credits
  const aiTutorRemainingMinutes = aiTutorMonthlyRemaining + aiTutorCreditMinutes;

  return (
    <SubscriptionContext.Provider value={{
      tier,
      status: subscription?.subscription_status || 'active',
      billingInterval: subscription?.billing_interval || 'month',
      subscription,
      usage,
      aiTutorCreditMinutes,
      practiceSessionCredits,
      videoCredits,
      canAddVideo,
      canStartPractice,
      canUseAiTutor,
      canExportPdf,
      videosLimit: limits.videosPerMonth,
      practiceSessionsLimit: limits.practiceSessionsPerDay,
      aiTutorMinutesLimit: limits.aiTutorMinutesPerMonth,
      aiTutorRemainingMinutes,
      aiTutorMonthlyRemaining,
      recordAction,
      refreshUsage,
      refreshSubscription,
      syncWithStripe,
      createCheckout,
      createCreditCheckout,
      createPortal,
      isLoading,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
