export type BillingInterval = 'month' | 'year';
export type SubscriptionTier = 'free' | 'pro';

/**
 * Monthly allowance reset is independent of billing price cadence.
 * Annual Pro users get the same monthly allowances as monthly Pro users.
 * Free users get their monthly video allowance by account month.
 */
export const getMonthlyAllowanceResetDate = (
  tier: SubscriptionTier,
  billingInterval?: BillingInterval,
  periodStart?: string | null,
  periodEnd?: string | null,
  accountCreatedAt?: string | null
): Date => {
  if (tier === 'pro' && billingInterval === 'month' && periodEnd) {
    return new Date(periodEnd);
  }

  if (tier === 'pro' && billingInterval === 'year' && periodStart) {
    return getNextMonthlyAnniversary(new Date(periodStart), periodEnd ? new Date(periodEnd) : null);
  }

  if (tier === 'free' && accountCreatedAt) {
    return getNextMonthlyAnniversary(new Date(accountCreatedAt), null);
  }

  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0, 0, 0, 0
  ));
};

export const getMonthlyResetInfo = (
  tier: SubscriptionTier,
  billingInterval?: BillingInterval,
  periodStart?: string | null,
  periodEnd?: string | null,
  accountCreatedAt?: string | null
): string => {
  const resetDate = getMonthlyAllowanceResetDate(
    tier,
    billingInterval,
    periodStart,
    periodEnd,
    accountCreatedAt
  );

  const dateString = resetDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const timeString = resetDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const tzString = resetDate.toLocaleTimeString(undefined, { timeZoneName: 'short' })
    .split(' ')
    .pop() || '';

  return `Resets ${dateString} at ${timeString} ${tzString}`;
};

const getNextMonthlyAnniversary = (startDate: Date, periodEnd: Date | null): Date => {
  const now = new Date();
  let candidate = addUtcMonths(startDate, monthsBetweenUtc(startDate, now));

  if (candidate <= now) {
    candidate = addUtcMonths(candidate, 1);
  }

  if (periodEnd && candidate > periodEnd) {
    return periodEnd;
  }

  return candidate;
};

const monthsBetweenUtc = (startDate: Date, endDate: Date): number => {
  let months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth());

  const anniversary = addUtcMonths(startDate, months);
  if (anniversary > endDate) {
    months -= 1;
  }

  return Math.max(0, months);
};

const addUtcMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};
