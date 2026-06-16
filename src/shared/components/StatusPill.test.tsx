import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import StatusPill from './StatusPill';

describe('shared/components/StatusPill', () => {
  it('shows errors before any connection status', () => {
    render(
      <StatusPill
        isConnected
        isAiSpeaking
        isAiThinking={false}
        realtimeInput=""
        error="Microphone permission denied"
      />
    );

    expect(screen.getByText('Microphone permission denied')).toBeInTheDocument();
    expect(screen.queryByText('Bilibala is speaking...')).not.toBeInTheDocument();
  });

  it('shows speaking status while the tutor is responding', () => {
    render(
      <StatusPill
        isConnected
        isAiSpeaking
        isAiThinking={false}
        realtimeInput=""
        error={null}
      />
    );

    expect(screen.getByText('Bilibala is speaking...')).toBeInTheDocument();
  });

  it('shows listening status while connected and waiting for user speech', () => {
    render(
      <StatusPill
        isConnected
        isAiSpeaking={false}
        isAiThinking={false}
        realtimeInput=""
        error={null}
      />
    );

    expect(screen.getByText('Listening...')).toBeInTheDocument();
  });

  it('keeps the idle pill hidden when disconnected', () => {
    const { container } = render(
      <StatusPill
        isConnected={false}
        isAiSpeaking={false}
        isAiThinking={false}
        realtimeInput=""
        error={null}
      />
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('opacity-0');
  });
});
