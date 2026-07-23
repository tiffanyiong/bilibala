import { afterEach, describe, expect, it, vi } from 'vitest';

describe('TIER_LIMITS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses free_video_library_max loaded from app_config', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      // app_config stores values as text.
      json: async () => ({ free_video_library_max: '25' }),
    }));

    const config = await import('../config/aiTutorConfig');
    const { TIER_LIMITS } = await import('./database');

    expect(TIER_LIMITS.free.videoLibraryMax).toBe(10);

    await config.fetchAppConfig();

    expect(TIER_LIMITS.free.videoLibraryMax).toBe(25);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/config$/));
  });
});
