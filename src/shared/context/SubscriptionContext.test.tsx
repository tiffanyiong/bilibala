import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDailyPracticeUsage,
  getMonthlyUsage,
  getOrCreateSubscription,
} from '../services/subscriptionDatabase';
import { useAuth } from './AuthContext';
import { SubscriptionProvider, useSubscription } from './SubscriptionContext';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../config/aiTutorConfig', () => ({
  fetchAppConfig: vi.fn().mockResolvedValue(undefined),
  FREE_VIDEO_LIBRARY_MAX: 10,
  MONTHLY_MAX_MINUTES: 60,
  PRO_VIDEOS_PER_MONTH: 100,
}));

vi.mock('../services/subscriptionDatabase', () => ({
  getOrCreateSubscription: vi.fn(),
  getMonthlyUsage: vi.fn(),
  getDailyPracticeUsage: vi.fn(),
  recordUsage: vi.fn(),
  incrementMonthlyUsage: vi.fn(),
  deductAiTutorCredits: vi.fn(),
  deductPracticeCredits: vi.fn(),
  deductVideoCredits: vi.fn(),
}));

const monthlyUsage = {
  videosUsed: 0,
  practiceSessionsUsed: 0,
  practiceSessionsDailyUsed: 0,
  aiTutorMinutesUsed: 0,
  pdfExportsUsed: 0,
};

const staleSubscription = {
  tier: 'pro',
  subscription_status: 'active',
  stripe_subscription_id: 'sub_test_123',
  cancel_at_period_end: false,
  current_period_start: '2026-07-23T00:12:00.000Z',
  current_period_end: '2026-08-23T00:12:00.000Z',
  billing_interval: 'month',
};

const reconciledSubscription = {
  ...staleSubscription,
  cancel_at_period_end: true,
};

const SubscriptionState = () => {
  const { subscription, usage, isLoading } = useSubscription();

  return (
    <div>
      <span>{isLoading ? 'loading' : 'ready'}</span>
      <span>{subscription?.cancel_at_period_end ? 'ending' : 'renewing'}</span>
      <span>daily:{usage.practiceSessionsDailyUsed}</span>
    </div>
  );
};

describe('SubscriptionProvider Stripe reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      session: { access_token: 'test-access-token' },
    } as any);

    vi.mocked(getOrCreateSubscription)
      .mockResolvedValueOnce(staleSubscription as any)
      .mockResolvedValue(reconciledSubscription as any);
    vi.mocked(getMonthlyUsage).mockResolvedValue(monthlyUsage);
    vi.mocked(getDailyPracticeUsage).mockResolvedValue(4);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ synced: true, tier: 'pro', status: 'active' }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reconciles a complete Pro record so a missed cancellation webhook is reflected', async () => {
    render(
      <SubscriptionProvider>
        <SubscriptionState />
      </SubscriptionProvider>
    );

    expect(await screen.findByText('ending')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('daily:4')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/subscriptions\/sync$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reconciles again when the app is restored after visiting Stripe', async () => {
    render(
      <SubscriptionProvider>
        <SubscriptionState />
      </SubscriptionProvider>
    );

    await screen.findByText('ending');
    vi.mocked(fetch).mockClear();

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
