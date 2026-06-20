import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatSidebar from '@/components/chat/ChatSidebar';

// Isolate the launcher: assert it mounts the shared Command Center (compact) only when open, and passes
// the prefill from the "Ask your advisor" event. CommandCenter's own behavior is covered separately.
jest.mock('@/components/chat/CommandCenter', () => ({
  __esModule: true,
  default: ({ compact, initialInput }: { compact?: boolean; initialInput?: string }) => (
    <div
      data-testid="command-center"
      data-compact={String(!!compact)}
      data-prefill={initialInput || ''}
    >
      command center
    </div>
  ),
}));

it('does not mount the command center until the launcher is opened', () => {
  render(<ChatSidebar />);
  expect(screen.queryByTestId('command-center')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Toggle Advisor'));
  const cc = screen.getByTestId('command-center');
  expect(cc).toBeInTheDocument();
  expect(cc).toHaveAttribute('data-compact', 'true');
});

it('opens with a prefilled question from the advisor event', () => {
  render(<ChatSidebar />);
  fireEvent(
    window,
    new CustomEvent('lifenav:open-advisor', { detail: { prefill: 'Can I afford a house?' } })
  );
  expect(screen.getByTestId('command-center')).toHaveAttribute(
    'data-prefill',
    'Can I afford a house?'
  );
});
