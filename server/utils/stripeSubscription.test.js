import { describe, expect, it } from 'vitest';

import { getScheduledCancellation } from './stripeSubscription.js';

describe('getScheduledCancellation', () => {
  it('detects classic billing-mode cancellation at period end', () => {
    expect(getScheduledCancellation({
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: 1787443920,
    })).toEqual({ isScheduledToCancel: true, cancelAt: 1787443920 });
  });

  it('detects flexible billing-mode cancellation from cancel_at', () => {
    expect(getScheduledCancellation({
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: 1787443920,
    })).toEqual({ isScheduledToCancel: true, cancelAt: 1787443920 });
  });

  it('does not treat an ordinary active subscription as scheduled to cancel', () => {
    expect(getScheduledCancellation({
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: null,
    })).toEqual({ isScheduledToCancel: false, cancelAt: null });
  });

  it('does not keep a completed cancellation in the scheduled state', () => {
    expect(getScheduledCancellation({
      status: 'canceled',
      cancel_at_period_end: false,
      cancel_at: 1787443920,
    })).toEqual({ isScheduledToCancel: false, cancelAt: 1787443920 });
  });
});
