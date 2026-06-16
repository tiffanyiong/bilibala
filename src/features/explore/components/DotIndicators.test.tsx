import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DotIndicators from './DotIndicators';

describe('features/explore/DotIndicators', () => {
  it('renders one accessible button per carousel item and marks the active item', () => {
    render(<DotIndicators total={3} currentIndex={1} onChange={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Go to card 2' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Go to card 1' })).toHaveAttribute('aria-current', 'false');
  });

  it('calls onChange with the clicked card index', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DotIndicators total={4} currentIndex={0} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Go to card 4' }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables navigation while the carousel is rotating', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DotIndicators total={2} currentIndex={0} onChange={onChange} isRotating />);
    await user.click(screen.getByRole('button', { name: 'Go to card 2' }));

    expect(screen.getByRole('button', { name: 'Go to card 2' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
