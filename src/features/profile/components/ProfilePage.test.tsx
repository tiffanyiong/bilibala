import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';
import ProfilePage from './ProfilePage';

vi.mock('../../../shared/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../shared/context/SubscriptionContext', () => ({
  useSubscription: vi.fn(),
}));

describe('features/profile/ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      userProfile: {
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        email: 'test@example.com',
        initials: 'TU',
        avatarUrl: null,
      },
      updatePassword: vi.fn(),
      updateName: vi.fn(),
      isOAuthOnly: false,
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
      createPortal: vi.fn(),
      isLoading: false,
    } as any);
  });

  it('presents a scheduled cancellation as ending access', () => {
    render(<ProfilePage onOpenSubscription={vi.fn()} />);

    expect(screen.getByText('Ending')).toBeInTheDocument();
    expect(screen.getByText('Access until')).toBeInTheDocument();
    expect(screen.queryByText('Renews')).not.toBeInTheDocument();
    expect(screen.getByText('Monthly allowance available until August 16, 2026')).toBeInTheDocument();

  });
});
