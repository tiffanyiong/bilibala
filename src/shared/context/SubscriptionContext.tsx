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
} from '../services/subscriptionDatabase';
import { getBackendOrigin } from '../services/backend';

interface SubscriptionContextType {
  // Subscription info
  tier: SubscriptionTier;
  status: string;
  subscription: DbUserSubscription | null;

  // Usage data
  usage: MonthlyUsage;

  // Computed permissions
  canAddVideo: boolean;
  canStartPractice: boolean;
  canUseAiTutor: boolean;
  canExportPdf: boolean;

  // Usage limits for display
  videosLimit: number;
  practiceSessionsLimit: number;
  aiTutorMinutesLimit: number;

  // Actions
  recordAction: (actionType: UsageActionType, metadata?: Record<string, unknown>) => Promise<boolean>;
  refreshUsage: () => Promise<void>;
  createCheckout: (priceType?: 'monthly' | 'annual') => Promise<string | null>;
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
        const [sub, monthlyUsage] = await Promise.all([
          getOrCreateSubscription(user.id),
          getMonthlyUsage(user.id),
        ]);
        setSubscription(sub);
        setUsage(monthlyUsage);
      } catch (err) {
        console.error('Error loading subscription data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    try {
      const monthlyUsage = await getMonthlyUsage(user.id);
      setUsage(monthlyUsage);
    } catch (err) {
      console.error('Error refreshing usage:', err);
    }
  }, [user]);

  const recordAction = useCallback(async (
    actionType: UsageActionType,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> => {
    if (!user) return false;
    const success = await recordUsage(user.id, actionType, metadata);
    if (success) {
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
  }, [user]);

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

  // Computed permissions
  const canAddVideo = usage.videosUsed < limits.videosPerMonth;
  const canStartPractice = usage.practiceSessionsUsed < limits.practiceSessionsPerMonth;
  const canUseAiTutor = limits.aiTutorMinutesPerMonth > 0 && usage.aiTutorMinutesUsed < limits.aiTutorMinutesPerMonth;
  const canExportPdf = limits.pdfExport;

  return (
    <SubscriptionContext.Provider value={{
      tier,
      status: subscription?.subscription_status || 'active',
      subscription,
      usage,
      canAddVideo,
      canStartPractice,
      canUseAiTutor,
      canExportPdf,
      videosLimit: limits.videosPerMonth,
      practiceSessionsLimit: limits.practiceSessionsPerMonth,
      aiTutorMinutesLimit: limits.aiTutorMinutesPerMonth,
      recordAction,
      refreshUsage,
      createCheckout,
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
