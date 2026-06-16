import { beforeEach, describe, expect, it, vi } from 'vitest';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };
}

function createSupabaseMock({ subscription, monthlyUsage, dailyUsage, fingerprint, fingerprintError }) {
  return {
    from: vi.fn((table) => {
      if (table === 'user_subscriptions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: subscription, error: null }),
        };
      }

      if (table === 'browser_fingerprints') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: fingerprint,
            error: fingerprintError ?? null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name) => {
      if (name === 'get_current_monthly_usage') {
        return Promise.resolve({ data: [{ videos_used: monthlyUsage }], error: null });
      }

      if (name === 'get_current_daily_practice_usage') {
        return Promise.resolve({ data: dailyUsage, error: null });
      }

      throw new Error(`Unexpected rpc: ${name}`);
    }),
  };
}

async function loadMiddleware({ user = null, supabaseAdmin }) {
  vi.resetModules();
  vi.doMock('../services/supabaseAdmin.js', () => ({
    getUserFromToken: vi.fn().mockResolvedValue(user),
    supabaseAdmin,
  }));

  return import('./subscriptionCheck.js');
}

describe('server/middleware/subscriptionCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects anonymous requests without a browser fingerprint', async () => {
    const { checkSubscriptionLimit } = await loadMiddleware({
      supabaseAdmin: createSupabaseMock({}),
    });
    const req = { body: {}, headers: {} };
    const res = createResponse();
    const next = vi.fn();

    await checkSubscriptionLimit('video_analysis')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: 'FINGERPRINT_REQUIRED',
      message: 'Browser fingerprint is required for anonymous users',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a new anonymous fingerprint under the monthly limit', async () => {
    const { checkSubscriptionLimit } = await loadMiddleware({
      supabaseAdmin: createSupabaseMock({
        fingerprint: null,
        fingerprintError: { code: 'PGRST116' },
      }),
    });
    const req = { body: { fingerprintHash: 'anon-fingerprint' }, headers: {} };
    const res = createResponse();
    const next = vi.fn();

    await checkSubscriptionLimit('video_analysis')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.anonymous).toEqual({
      fingerprintHash: 'anon-fingerprint',
      usage: 0,
      limit: 2,
    });
  });

  it('blocks anonymous practice sessions at the monthly practice limit', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { checkSubscriptionLimit } = await loadMiddleware({
      supabaseAdmin: createSupabaseMock({
        fingerprint: {
          monthly_usage_count: 0,
          monthly_practice_count: 2,
          usage_reset_month: currentMonth,
        },
      }),
    });
    const req = { body: { fingerprintHash: 'anon-fingerprint' }, headers: {} };
    const res = createResponse();
    const next = vi.fn();

    await checkSubscriptionLimit('practice_session')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body).toMatchObject({
      error: 'ANONYMOUS_LIMIT_EXCEEDED',
      used: 2,
      limit: 2,
      signInRequired: true,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a free authenticated user after the monthly video limit is reached', async () => {
    const { checkSubscriptionLimit } = await loadMiddleware({
      user: { id: 'user-1' },
      supabaseAdmin: createSupabaseMock({
        subscription: {
          tier: 'free',
          video_credits: 0,
          practice_session_credits: 0,
        },
        monthlyUsage: 3,
      }),
    });
    const req = { body: {}, headers: { authorization: 'Bearer token' } };
    const res = createResponse();
    const next = vi.fn();

    await checkSubscriptionLimit('video_analysis')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body).toMatchObject({
      error: 'SUBSCRIPTION_LIMIT_EXCEEDED',
      used: 3,
      limit: 3,
      tier: 'free',
      upgradeRequired: true,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an authenticated user to exceed usage limits when credits are available', async () => {
    const { checkSubscriptionLimit } = await loadMiddleware({
      user: { id: 'user-2' },
      supabaseAdmin: createSupabaseMock({
        subscription: {
          tier: 'free',
          video_credits: 2,
          practice_session_credits: 0,
        },
        monthlyUsage: 3,
      }),
    });
    const req = { body: {}, headers: { authorization: 'Bearer token' } };
    const res = createResponse();
    const next = vi.fn();

    await checkSubscriptionLimit('video_analysis')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: 'user-2' });
    expect(req.subscription).toEqual({
      tier: 'free',
      usage: 3,
      limit: 3,
      credits: 2,
    });
  });
});
