import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('./supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: supabaseMock.from,
  },
}));

const { clearCache, getExploreVideos } = await import('./exploreService.js');

function createAnalysisRow(index, overrides = {}) {
  const youtubeId = overrides.youtubeId || `vid${String(index).padStart(8, '0')}`;

  return {
    id: `analysis-${String(index).padStart(2, '0')}`,
    level: 'Medium',
    target_lang: 'English',
    native_lang: 'Chinese (Mandarin - 中文)',
    created_at: `2026-01-${String(index).padStart(2, '0')}T00:00:00.000Z`,
    global_videos: {
      id: `video-${String(index).padStart(2, '0')}`,
      youtube_id: youtubeId,
      title: `Video ${index}`,
      thumbnail_url: null,
      view_count: index,
      channel_name: null,
      ...overrides.globalVideo,
    },
    ...overrides.row,
  };
}

function mockExploreRows(rows) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async (limit) => ({ data: rows.slice(0, limit), error: null })),
  };

  supabaseMock.from.mockReturnValue(query);
  return query;
}

function youtubeIds(result) {
  return result.videos.map((video) => video.youtubeId);
}

describe('server/services/exploreService', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:05:00.000Z'));
  });

  it('returns the same deterministic order within the same rotation bucket', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => createAnalysisRow(index + 1));
    mockExploreRows(rows);

    const first = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);
    clearCache();
    const second = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);

    expect(youtubeIds(second)).toEqual(youtubeIds(first));
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(false);
  });

  it('rotates the returned order across different rotation buckets', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => createAnalysisRow(index + 1));
    mockExploreRows(rows);

    const first = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);

    clearCache();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:35:00.000Z'));
    const second = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);

    expect(youtubeIds(second)).not.toEqual(youtubeIds(first));
  });

  it('keeps earlier load-more cards as the prefix of larger requests', async () => {
    const rows = Array.from({ length: 40 }, (_, index) => createAnalysisRow(index + 1));
    mockExploreRows(rows);

    const firstBatch = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);
    const secondBatch = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 12);
    const thirdBatch = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 18);

    expect(youtubeIds(secondBatch).slice(0, 6)).toEqual(youtubeIds(firstBatch));
    expect(youtubeIds(thirdBatch).slice(0, 12)).toEqual(youtubeIds(secondBatch));
  });

  it('filters invalid videos and deduplicates by YouTube id', async () => {
    const rows = [
      createAnalysisRow(1, { youtubeId: 'duplicate01' }),
      createAnalysisRow(2, { youtubeId: 'duplicate01' }),
      createAnalysisRow(3, { youtubeId: 'bad-id' }),
      createAnalysisRow(4, { globalVideo: { title: '   ' } }),
      createAnalysisRow(5, { youtubeId: 'valid000005' }),
    ];
    mockExploreRows(rows);

    const result = await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 10);

    expect(youtubeIds(result).sort()).toEqual(['duplicate01', 'valid000005'].sort());
  });

  it('always queries a stable candidate pool for consistent load-more ordering', async () => {
    const query = mockExploreRows(Array.from({ length: 20 }, (_, index) => createAnalysisRow(index + 1)));

    await getExploreVideos('English', 'Chinese (Mandarin - 中文)', 'Medium', 6);

    expect(query.limit).toHaveBeenCalledWith(150);
  });
});
