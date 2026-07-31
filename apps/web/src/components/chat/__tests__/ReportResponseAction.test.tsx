/**
 * Report action visibility and binding (R-3 / B-22, slice 3C).
 * EVIDENCE BOUNDARY: jsdom. Component evidence, not deployed-browser evidence.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { ReportResponseAction } from '../ReportResponseAction';

const TURN = 'server-issued-turn-xyz';

describe('visibility', () => {
  it('renders for a response carrying a server-issued turn id', () => {
    render(<ReportResponseAction turnId={TURN} messageIndex={0} onDiagnostic={jest.fn()} />);
    expect(screen.getByRole('button', { name: /report this response/i })).toBeInTheDocument();
  });

  it('renders NOTHING for a legacy response without a turn id', () => {
    render(<ReportResponseAction messageIndex={3} onDiagnostic={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /report this response/i })).toBeNull();
  });

  it('renders NOTHING for an empty turn id — never fabricates one', () => {
    render(<ReportResponseAction turnId="" messageIndex={1} onDiagnostic={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /report this response/i })).toBeNull();
  });
});

describe('missing-turn diagnostics', () => {
  it('emits a diagnostic when a response is not reportable', () => {
    const onDiagnostic = jest.fn();
    render(<ReportResponseAction messageIndex={7} onDiagnostic={onDiagnostic} />);
    expect(onDiagnostic).toHaveBeenCalledWith({
      event: 'advisor_response_not_reportable',
      reason: 'legacy_or_missing_turn_id',
      message_index: 7,
    });
  });

  it('diagnostic payload contains NO response content', () => {
    const onDiagnostic = jest.fn();
    render(<ReportResponseAction messageIndex={2} onDiagnostic={onDiagnostic} />);
    const payload = JSON.stringify(onDiagnostic.mock.calls[0][0]);
    // Index only. No question, answer, citation, tenant or user content may appear.
    expect(Object.keys(onDiagnostic.mock.calls[0][0]).sort()).toEqual([
      'event',
      'message_index',
      'reason',
    ]);
    for (const forbidden of ['content', 'question', 'answer', 'citation', 'tenant', 'user_id']) {
      expect(payload.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('emits no diagnostic when the response IS reportable', () => {
    const onDiagnostic = jest.fn();
    render(<ReportResponseAction turnId={TURN} messageIndex={0} onDiagnostic={onDiagnostic} />);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe('binding', () => {
  it('each action opens a dialog bound to its OWN turn id', () => {
    render(
      <>
        <ReportResponseAction turnId="turn-A" messageIndex={0} onDiagnostic={jest.fn()} />
        <ReportResponseAction turnId="turn-B" messageIndex={1} onDiagnostic={jest.fn()} />
      </>
    );
    const buttons = screen.getAllByRole('button', { name: /report this response/i });
    expect(buttons).toHaveLength(2);
    // Opening the SECOND action must open exactly one dialog — the one for turn-B. If the action
    // bound to a neighbour, the wrong conversation turn would be reported.
    fireEvent.click(buttons[1]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('does not open a dialog until the action is used', () => {
    render(<ReportResponseAction turnId={TURN} messageIndex={0} onDiagnostic={jest.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
