import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import SubscriptionPage from './SubscriptionPage';

vi.mock('../../../shared/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../shared/context/SubscriptionContext', () => ({
  useSubscription: vi.fn(),
}));

describe('features/subscription/SubscriptionPage', () => {
  const syncWithStripe = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/subscription?portal_return=true');

    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
    } as any);

    vi.mocked(useSubscription).mockReturnValue({
      tier: 'pro',
      status: 'active',
      billingInterval: 'month',
      subscription: {
        cancel_at_period_end: true,
        current_period_start: '2026-07-16T19:47:00.000Z',
        current_period_end: '2026-08-16T19:47:00.000Z',
        created_at: '2026-07-16T19:47:00.000Z',
      },
      usage: {
        videosUsed: 0,
        practiceSessionsUsed: 0,
        practiceSessionsDailyUsed: 0,
        aiTutorMinutesUsed: 0,
        pdfExportsUsed: 0,
      },
      videosLimit: 100,
      practiceSessionsLimit: Infinity,
      aiTutorMinutesLimit: 60,
      aiTutorCreditMinutes: 0,
      practiceSessionCredits: 0,
      videoCredits: 0,
      createCheckout: vi.fn(),
      createCreditCheckout: vi.fn(),
      createPortal: vi.fn(),
      syncWithStripe,
      refreshSubscription: vi.fn(),
      isLoading: false,
    } as any);
  });

  it('syncs with Stripe after returning from the billing portal', async () => {
    render(<SubscriptionPage onOpenAuthModal={vi.fn()} />);

    await waitFor(() => expect(syncWithStripe).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('Available until August 16, 2026')).toHaveLength(2);
    expect(screen.queryByText(/Resets Aug 16/i)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/subscription');
    expect(window.location.search).toBe('');
  });
});
