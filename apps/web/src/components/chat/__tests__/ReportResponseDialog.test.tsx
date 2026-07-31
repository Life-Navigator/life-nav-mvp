/**
 * Advisor-response reporting dialog — component tests (R-3 / B-22, slice 3C).
 *
 * EVIDENCE BOUNDARY: jsdom + mocked submit. Component/contract evidence, NOT deployed-browser
 * evidence. jest-axe proves no automatically detectable serious/critical violations; it is not
 * WCAG certification and does not replace manual screen-reader verification.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ReportResponseDialog } from '../ReportResponseDialog';
import { expectNoSeriousA11yViolations } from '@/test/axe';
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  type ResponseReportOutcome,
} from '@/lib/advisor/responseReport';

const TURN = 'server-issued-turn-3c';

function ok(reportId = 'rep-1'): jest.Mock {
  return jest.fn().mockResolvedValue({ kind: 'submitted', reportId } as ResponseReportOutcome);
}

function renderDialog(submit = ok(), turnId = TURN) {
  const onClose = jest.fn();
  const utils = render(
    <ReportResponseDialog turnId={turnId} open onClose={onClose} submit={submit as never} />
  );
  return { ...utils, onClose, submit };
}

async function submitWith(category: (typeof REPORT_CATEGORIES)[number], submit = ok()) {
  const r = renderDialog(submit);
  fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS[category]));
  fireEvent.click(screen.getByRole('button', { name: /send report/i }));
  return r;
}

describe('categories and submission', () => {
  it.each(REPORT_CATEGORIES)('submits category %s with the correct turn id', async (category) => {
    const submit = ok(`rep-${category}`);
    await submitWith(category, submit);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({
      turn_id: TURN,
      category,
      explanation: undefined,
    });
  });

  it('sends only the three allowed fields — no identity or execution metadata', async () => {
    const submit = ok();
    await submitWith('other', submit);
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(Object.keys(submit.mock.calls[0][0]).sort()).toEqual([
      'category',
      'explanation',
      'turn_id',
    ]);
  });

  it('includes an optional explanation', async () => {
    const submit = ok();
    renderDialog(submit);
    fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS.other));
    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: 'the number is wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].explanation).toBe('the number is wrong');
  });

  it('requires a category and does not call the API without one', async () => {
    const submit = ok();
    renderDialog(submit);
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose what went wrong/i);
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows the report reference on success and announces it', async () => {
    await submitWith('other', ok('rep-42'));
    // Both the submitting and success regions are role="status" (each must be announced), so query
    // the success text specifically rather than taking the first match.
    const status = await screen.findByText(/your report was received/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('rep-42');
  });

  it('explains a duplicate rather than reporting failure', async () => {
    const submit = jest
      .fn()
      .mockResolvedValue({ kind: 'duplicate', reportId: 'rep-1' } as ResponseReportOutcome);
    await submitWith('other', submit);
    expect(await screen.findByText(/already reported/i)).toHaveAttribute('aria-live', 'polite');
  });

  it('prevents a double submission — via the in-flight guard, not just the disabled button', async () => {
    // Submitting the FORM directly bypasses the disabled attribute on the button. Without that,
    // `disabled` masks the in-flight guard and this test passes whether or not the guard exists —
    // which is exactly what mutation M-2 exposed on the first version of this test.
    let resolve!: (v: ResponseReportOutcome) => void;
    const submit = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderDialog(submit);
    fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS.other));
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    resolve({ kind: 'submitted', reportId: 'r' });
    await waitFor(() => expect(screen.getByText(/your report was received/i)).toBeInTheDocument());
  });
});

describe('failure and recovery', () => {
  const cases: Array<[string, ResponseReportOutcome, RegExp]> = [
    ['session expiry', { kind: 'session_expired' }, /session expired/i],
    ['unavailable response', { kind: 'unavailable' }, /no longer available/i],
    ['rate limit', { kind: 'rate_limited', retryAfterSeconds: 30 }, /30 seconds/i],
    ['server error', { kind: 'server_error', status: 500 }, /something went wrong/i],
    ['network error', { kind: 'network_error' }, /couldn’t reach/i],
    ['validation', { kind: 'invalid', message: 'Choose a category.' }, /choose a category/i],
  ];

  it.each(cases)('surfaces %s as an announced alert', async (_label, outcome, pattern) => {
    const submit = jest.fn().mockResolvedValue(outcome);
    await submitWith('other', submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(pattern);
  });

  it('NEVER discards the explanation after a recoverable failure', async () => {
    const submit = jest.fn().mockResolvedValue({ kind: 'network_error' } as ResponseReportOutcome);
    renderDialog(submit);
    fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS.other));
    const box = screen.getByLabelText(/anything else/i);
    fireEvent.change(box, { target: { value: 'my careful explanation' } });
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    await screen.findByRole('alert');
    // Losing the user's typed note on a transient failure is the fastest way to lose the report.
    expect(box).toHaveValue('my careful explanation');
    expect(screen.getByLabelText(REPORT_CATEGORY_LABELS.other)).toBeChecked();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('does not update state after unmount (stale response)', async () => {
    let resolve!: (v: ResponseReportOutcome) => void;
    const submit = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderDialog(submit);
    fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS.other));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    unmount();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    resolve({ kind: 'submitted', reportId: 'late' });
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('privacy', () => {
  it('renders no internal traces, prompts, model config or raw output', () => {
    const { container } = renderDialog();
    const text = container.textContent ?? '';
    for (const forbidden of [
      'llm_response_raw',
      'prompt_version',
      'system prompt',
      'chain-of-thought',
      'gemini',
      'claude',
      'tenant_id',
      'policy',
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('does not render the turn id to the user', () => {
    const { container } = renderDialog();
    expect(container.textContent).not.toContain(TURN);
  });
});

describe('accessibility', () => {
  it('is a labelled modal dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/report this response/i);
  });

  it('the category group has an accessible label and every option is labelled', () => {
    renderDialog();
    expect(screen.getByRole('group', { name: /what went wrong/i })).toBeInTheDocument();
    for (const c of REPORT_CATEGORIES) {
      expect(screen.getByLabelText(REPORT_CATEGORY_LABELS[c])).toBeInTheDocument();
    }
  });

  it('moves focus into the dialog on open', async () => {
    renderDialog();
    await waitFor(() =>
      expect(screen.getByLabelText(REPORT_CATEGORY_LABELS.wrong_or_unsupported)).toHaveFocus()
    );
  });

  it('Escape closes the dialog', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape does NOT abandon an in-flight submission', () => {
    const submit = jest.fn().mockReturnValue(new Promise(() => {}));
    const { onClose } = renderDialog(submit);
    fireEvent.click(screen.getByLabelText(REPORT_CATEGORY_LABELS.other));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the originating control on close', async () => {
    function Harness() {
      const btn = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={btn} onClick={() => setOpen(true)}>
            Report this response
          </button>
          <ReportResponseDialog
            turnId={TURN}
            open={open}
            onClose={() => setOpen(false)}
            returnFocusRef={btn}
            submit={ok() as never}
          />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /report this response/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('has no serious/critical axe violations — initial form', async () => {
    const { container } = renderDialog();
    await expectNoSeriousA11yViolations(container);
  });

  it('has no serious/critical axe violations — validation error', async () => {
    const { container } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    await screen.findByRole('alert');
    await expectNoSeriousA11yViolations(container);
  });

  it('has no serious/critical axe violations — success', async () => {
    const { container } = await submitWith('other');
    await screen.findByText(/your report was received/i);
    await expectNoSeriousA11yViolations(container);
  });

  it('has no serious/critical axe violations — error/retry', async () => {
    const submit = jest.fn().mockResolvedValue({ kind: 'network_error' } as ResponseReportOutcome);
    const { container } = await submitWith('other', submit);
    await screen.findByRole('alert');
    await expectNoSeriousA11yViolations(container);
  });
});
