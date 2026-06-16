import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadConfigServiceWithSupabase(supabaseAdmin) {
  vi.resetModules();
  vi.doMock('./supabaseAdmin.js', () => ({ supabaseAdmin }));

  return import('./configService.js');
}

describe('server/services/configService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads fallback defaults when Supabase is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getConfig, getConfigNumber, loadConfig } = await loadConfigServiceWithSupabase(null);

    await loadConfig();

    expect(getConfig('free_videos_per_month')).toBe('3');
    expect(getConfigNumber('practice_recording_max_seconds')).toBe(240);
    expect(warnSpy).toHaveBeenCalledWith('[ConfigService] No Supabase client — using defaults');
  });

  it('merges database config over defaults when Supabase returns values', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const supabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { key: 'free_videos_per_month', value: '8' },
            { key: 'support_email', value: 'help@example.com' },
          ],
          error: null,
        }),
      }),
    };
    const { getAllConfig, getConfig, getConfigNumber, loadConfig } =
      await loadConfigServiceWithSupabase(supabaseAdmin);

    await loadConfig();

    expect(getConfig('free_videos_per_month')).toBe('8');
    expect(getConfigNumber('free_videos_per_month')).toBe(8);
    expect(getConfig('practice_recording_max_seconds')).toBe('240');
    expect(getAllConfig()).toMatchObject({
      free_videos_per_month: 8,
      practice_recording_max_seconds: 240,
      support_email: 'help@example.com',
    });
    expect(logSpy).toHaveBeenCalledWith('[ConfigService] Config loaded: 2 values from DB');
  });

  it('uses explicit fallbacks for unknown config values', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getConfig, getConfigNumber, loadConfig } = await loadConfigServiceWithSupabase(null);

    await loadConfig();

    expect(getConfig('unknown_key', 'fallback-value')).toBe('fallback-value');
    expect(getConfigNumber('unknown_number', 42)).toBe(42);
  });
});
