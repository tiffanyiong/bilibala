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
  recordUsage,
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
  });
  const [isLoading, setIsLoading] = useState(true);

  const tier: SubscriptionTier = subscription?.tier as SubscriptionTier || 'free';
  const limits = TIER_LIMITS[tier];

  // Load subscription and usage data when user changes
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setUsage({ videosUsed: 0, practiceSessionsUsed: 0, aiTutorMinutesUsed: 0, pdfExportsUsed: 0 });
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch app config from server (non-blocking, uses defaults if fails)
        fetchAppConfig();

        const [sub, monthlyUsage] = await Promise.all([
          getOrCreateSubscription(user.id),
          getMonthlyUsage(user.id),
        ]);
        setSubscription(sub);
        setUsage(monthlyUsage);

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
              // Reload subscription data after sync
              const updatedSub = await getOrCreateSubscription(user.id);
              setSubscription(updatedSub);
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
      const monthlyUsage = await getMonthlyUsage(user.id);
      setUsage(monthlyUsage);
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
        // Refresh local subscription data from database
        if (user) {
          const sub = await getOrCreateSubscription(user.id);
          setSubscription(sub);
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
    const success = await recordUsage(user.id, actionType, metadata);
    if (success) {
      // Handle credit deduction for video analysis
      if (actionType === 'video_analysis') {
        const currentMonthlyRemaining = limits.videosPerMonth - usage.videosUsed;

        // If usage exceeds monthly allowance, deduct from credits
        if (currentMonthlyRemaining <= 0) {
          const deducted = await deductVideoCredits(user.id);
          if (deducted > 0) {
            // Update local subscription state to reflect credit deduction
            setSubscription(prev => prev ? {
              ...prev,
              video_credits: Math.max(0, (prev.video_credits || 0) - 1),
            } : null);
          }
        }
      }

      // Handle credit deduction for AI tutor
      if (actionType === 'ai_tutor') {
        const minutesUsed = (metadata.minutes_used as number) || 0;
        const currentMonthlyRemaining = limits.aiTutorMinutesPerMonth - usage.aiTutorMinutesUsed;

        // If usage exceeds monthly allowance, deduct the overflow from credits
        if (minutesUsed > currentMonthlyRemaining && currentMonthlyRemaining >= 0) {
          const minutesFromCredits = minutesUsed - Math.max(0, currentMonthlyRemaining);
          if (minutesFromCredits > 0) {
            const deducted = await deductAiTutorCredits(user.id, minutesFromCredits);
            if (deducted > 0) {
              // Update local subscription state to reflect credit deduction
              setSubscription(prev => prev ? {
                ...prev,
                ai_tutor_credit_minutes: Math.max(0, (prev.ai_tutor_credit_minutes || 0) - deducted),
              } : null);
            }
          }
        }
      }

      // Handle credit deduction for practice sessions (free tier only)
      if (actionType === 'practice_session' && tier === 'free') {
        const currentMonthlyRemaining = limits.practiceSessionsPerMonth - usage.practiceSessionsUsed;

        // If usage exceeds monthly allowance, deduct from credits
        if (currentMonthlyRemaining <= 0) {
          const deducted = await deductPracticeCredits(user.id);
          if (deducted > 0) {
            // Update local subscription state to reflect credit deduction
            setSubscription(prev => prev ? {
              ...prev,
              practice_session_credits: Math.max(0, (prev.practice_session_credits || 0) - 1),
            } : null);
          }
        }
      }

      // Optimistically update local usage
      setUsage(prev => {
        const updated = { ...prev };
        switch (actionType) {
          case 'video_analysis':
            updated.videosUsed += 1;
            break;
          case 'practice_session':
            updated.practiceSessionsUsed += 1;
            break;
          case 'ai_tutor':
            updated.aiTutorMinutesUsed += (metadata.minutes_used as number) || 0;
            break;
          case 'pdf_export':
            updated.pdfExportsUsed += 1;
            break;
        }
        return updated;
      });
    }
    return success;
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
  // Free users can use credits for practice; Pro users have unlimited
  const canStartPractice = usage.practiceSessionsUsed < limits.practiceSessionsPerMonth || practiceSessionCredits > 0;
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
      practiceSessionsLimit: limits.practiceSessionsPerMonth,
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
