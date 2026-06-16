import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LevelSelector from './LevelSelector';

describe('shared/components/LevelSelector', () => {
  it('does not open when only one level is available', async () => {
    const user = userEvent.setup();
    const onLevelChange = vi.fn();

    render(
      <LevelSelector
        currentLevel="Easy"
        availableLevels={new Set(['Easy'])}
        onLevelChange={onLevelChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /easy/i }));

    expect(screen.queryByRole('button', { name: /medium/i })).not.toBeInTheDocument();
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('opens available levels and emits the selected level', async () => {
    const user = userEvent.setup();
    const onLevelChange = vi.fn();

    render(
      <LevelSelector
        currentLevel="Easy"
        availableLevels={new Set(['Easy', 'Medium', 'Hard'])}
        onLevelChange={onLevelChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /easy/i }));
    await user.click(screen.getByRole('button', { name: /medium/i }));

    expect(onLevelChange).toHaveBeenCalledWith('Medium');
    expect(screen.queryByRole('button', { name: /hard/i })).not.toBeInTheDocument();
  });

  it('shows unavailable levels as disabled loading options', async () => {
    const user = userEvent.setup();

    render(
      <LevelSelector
        currentLevel="Easy"
        availableLevels={new Set(['Easy', 'Hard'])}
        onLevelChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /easy/i }));

    expect(screen.getByRole('button', { name: /mediumloading/i })).toBeDisabled();
  });
});
