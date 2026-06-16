import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReportsEmptyState from './ReportsEmptyState';

describe('features/reports/ReportsEmptyState', () => {
  it('communicates that reports appear after speaking practice', () => {
    render(<ReportsEmptyState />);

    expect(screen.getByRole('heading', { name: /no practice reports yet/i })).toBeInTheDocument();
    expect(
      screen.getByText(/start a speaking practice session from any video/i)
    ).toBeInTheDocument();
  });
});
