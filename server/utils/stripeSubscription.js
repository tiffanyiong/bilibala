/**
 * Normalize Stripe's two scheduled-cancellation representations.
 *
 * Classic billing mode uses cancel_at_period_end=true. Flexible billing mode
 * keeps that boolean false and supplies a future cancel_at timestamp instead.
 */
export function getScheduledCancellation(subscription) {
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const cancelAt = Number(subscription?.cancel_at) || null;

  return {
    isScheduledToCancel: Boolean(
      subscription?.cancel_at_period_end || (isActive && cancelAt)
    ),
    cancelAt,
  };
}
