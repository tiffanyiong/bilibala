import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ReportsFilterChips from './ReportsFilterChips';

const defaultProps = {
  languages: ['English', 'Chinese'],
  levels: ['Easy', 'Hard'],
  topics: ['Travel', 'Food'],
  activeLanguage: null,
  activeLevel: null,
  activeTopic: null,
  onLanguageChange: vi.fn(),
  onLevelChange: vi.fn(),
  onTopicChange: vi.fn(),
  showFavoritesOnly: false,
  onFavoritesChange: vi.fn(),
  favoritesCount: 2,
};

describe('features/reports/ReportsFilterChips', () => {
  it('renders all filter groups and the favorites count', () => {
    render(<ReportsFilterChips {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /favorites2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travel' })).toBeInTheDocument();
  });

  it('resets every report filter from the All chip', async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onLevelChange = vi.fn();
    const onTopicChange = vi.fn();
    const onFavoritesChange = vi.fn();

    render(
      <ReportsFilterChips
        {...defaultProps}
        activeLanguage="English"
        activeLevel="Hard"
        activeTopic="Travel"
        showFavoritesOnly
        onLanguageChange={onLanguageChange}
        onLevelChange={onLevelChange}
        onTopicChange={onTopicChange}
        onFavoritesChange={onFavoritesChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(onLanguageChange).toHaveBeenCalledWith(null);
    expect(onLevelChange).toHaveBeenCalledWith(null);
    expect(onTopicChange).toHaveBeenCalledWith(null);
    expect(onFavoritesChange).toHaveBeenCalledWith(false);
  });

  it('toggles individual filters off when an active chip is clicked again', async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onLevelChange = vi.fn();
    const onTopicChange = vi.fn();

    render(
      <ReportsFilterChips
        {...defaultProps}
        activeLanguage="English"
        activeLevel="Hard"
        activeTopic="Travel"
        onLanguageChange={onLanguageChange}
        onLevelChange={onLevelChange}
        onTopicChange={onTopicChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Hard' }));
    await user.click(screen.getByRole('button', { name: 'Travel' }));

    expect(onLanguageChange).toHaveBeenCalledWith(null);
    expect(onLevelChange).toHaveBeenCalledWith(null);
    expect(onTopicChange).toHaveBeenCalledWith(null);
  });
});
