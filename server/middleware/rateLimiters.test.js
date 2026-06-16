import { beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimitMock = vi.fn((options) => options);
const ipKeyGeneratorMock = vi.fn((req) => `ip:${req.ip}`);

vi.mock('express-rate-limit', () => ({
  default: rateLimitMock,
  ipKeyGenerator: ipKeyGeneratorMock,
}));

const { createLimiter } = await import('./rateLimiters.js');

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

describe('server/middleware/rateLimiters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures express-rate-limit with project defaults', () => {
    const limiterOptions = createLimiter(60_000, 5, 'Please slow down');

    expect(rateLimitMock).toHaveBeenCalledWith(expect.objectContaining({
      windowMs: 60_000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    }));
    expect(limiterOptions).toMatchObject({
      windowMs: 60_000,
      max: 5,
    });
  });

  it('generates rate-limit keys by user id first, then fingerprint, then IP', () => {
    const limiterOptions = createLimiter(60_000, 5);

    expect(limiterOptions.keyGenerator({ user: { id: 'user-123' }, body: { fingerprintHash: 'fp-1' } }))
      .toBe('user:user-123');
    expect(limiterOptions.keyGenerator({ body: { fingerprintHash: 'fp-1' } }))
      .toBe('fingerprint:fp-1');
    expect(limiterOptions.keyGenerator({ body: {}, ip: '127.0.0.1' }))
      .toBe('ip:127.0.0.1');
    expect(ipKeyGeneratorMock).toHaveBeenCalledWith({ body: {}, ip: '127.0.0.1' });
  });

  it('returns the standardized 429 payload from the custom handler', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limiterOptions = createLimiter(120_000, 3, 'Custom limit reached');
    const req = {
      user: { id: 'user-123' },
      body: { fingerprintHash: 'fingerprint-a' },
      path: '/api/test',
      ip: '127.0.0.1',
    };
    const res = createResponse();

    limiterOptions.handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body).toEqual({
      error: 'RATE_LIMIT',
      message: 'Custom limit reached',
      retryAfter: 120,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[RateLimit] BLOCKED | key: user:user-123 | endpoint: /api/test | window: 120000ms | max: 3'
    );

    warnSpy.mockRestore();
  });

  it('redacts anonymous fingerprint values in rate-limit logs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limiterOptions = createLimiter(60_000, 1);
    const res = createResponse();

    limiterOptions.handler({
      body: { fingerprintHash: 'abcdefghijklmnopqrstuvwxyz' },
      path: '/api/test',
      ip: '127.0.0.1',
    }, res);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('key: fingerprint:abcdefgh...')
    );

    warnSpy.mockRestore();
  });
});
