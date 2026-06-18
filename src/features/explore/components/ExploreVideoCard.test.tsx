import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExploreVideo } from '../../../shared/types/database';
import ExploreVideoCard from './ExploreVideoCard';

const video: ExploreVideo = {
  analysisId: 'analysis-1',
  level: 'Easy',
  targetLang: 'English',
  nativeLang: 'Chinese (Mandarin - 中文)',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  videoId: 'video-1',
  youtubeId: '23ar-2M7ckk',
  title: 'Ep. 240: EJAE | A Career Built Slowly and Heard All at Once',
  thumbnailUrl: null,
  viewCount: 0,
  channelName: null,
};

describe('features/explore/ExploreVideoCard', () => {
  it('uses one concise accessible name for the card action', () => {
    render(<ExploreVideoCard video={video} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', {
      name: `Open lesson: ${video.title}. Easy, English`,
    })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ExploreVideoCard video={video} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', {
      name: `Open lesson: ${video.title}. Easy, English`,
    }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
