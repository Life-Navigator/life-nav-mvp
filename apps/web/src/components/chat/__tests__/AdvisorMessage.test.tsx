import { act, render, screen } from '@testing-library/react';
import AdvisorMessage, { StreamedAdvisorMessage } from '../AdvisorMessage';

describe('AdvisorMessage renderer', () => {
  it('renders an education-strategy response with no raw markdown artifacts', () => {
    const text =
      'Holding off on a graduate degree is the right move for now.\n\n' +
      '1. **Career:** Focus on certifications and one visible business problem.\n' +
      '2. **Finances:** Protect capital for the wedding and home down payment.\n' +
      '3. **Health:** Continue body recomposition and cardio.\n\n' +
      'Next question: Which certification appears most often in the role you want?';
    const { container } = render(<AdvisorMessage text={text} />);
    const txt = container.textContent || '';
    expect(txt).not.toContain('**');
    expect(txt).not.toMatch(/^\s*1\.\s/m); // numbered markdown not shown raw
    expect(screen.getByText('Career')).toBeInTheDocument();
    expect(screen.getByText(/Which certification/)).toBeInTheDocument();
    expect(screen.getByText('Your plan')).toBeInTheDocument();
  });

  it('does not execute or render injected html', () => {
    const { container } = render(<AdvisorMessage text={'<img src=x onerror=alert(1)>**hi**'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('hi');
    expect(container.textContent).not.toContain('**');
  });

  it('renders plain text safely', () => {
    render(<AdvisorMessage text={'A simple readable answer.'} />);
    expect(screen.getByText('A simple readable answer.')).toBeInTheDocument();
  });

  it('renders a verification-sources block as real links', () => {
    const text =
      'An inspection runs about $400-600.\n\n' +
      '*Check current numbers:*\n' +
      '- [CFPB — Consumer Financial Protection Bureau](https://www.consumerfinance.gov/) — closing costs';
    const { container } = render(<AdvisorMessage text={text} />);
    const a = container.querySelector('a');
    expect(a).toHaveAttribute('href', 'https://www.consumerfinance.gov/');
    expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(container.textContent).not.toContain('](');
  });
});

describe('StreamedAdvisorMessage', () => {
  // The typing pass reveals RAW text, so anything left in the typed span shows its Markdown source. A links
  // block is almost entirely syntax — typing it spells out `- [CFPB — Consu...](https://www.co` a character
  // at a time, which reads as broken output exactly where a citation should build trust.
  const WITH_SOURCES =
    'An inspection runs about $400-600.\n\n' +
    '*Check current numbers:*\n' +
    '- [CFPB](https://www.consumerfinance.gov/) — closing costs';

  it('never types raw link syntax mid-stream', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<StreamedAdvisorMessage text={WITH_SOURCES} animate />);
      // Sample the reveal as it progresses. Asserting only at t=0 would pass on an empty span and prove
      // nothing, so step through and check every intermediate frame the user could actually see.
      let sawPartialProse = false;
      let frames = 0;
      // Stop at the swap to the polished render — from there the block is SUPPOSED to be visible, styled.
      // Everything before it is the typing pass, where only prose may appear.
      while (!container.querySelector('[data-testid="advisor-rendered"]') && frames < 200) {
        act(() => {
          jest.advanceTimersByTime(16);
        });
        frames++;
        // The swap can happen DURING this tick; from that moment the block is meant to be on screen.
        if (container.querySelector('[data-testid="advisor-rendered"]')) break;
        const txt = container.textContent || '';
        expect(txt).not.toContain('](');
        expect(txt).not.toContain('https://');
        expect(txt).not.toContain('Check current numbers');
        if (txt.includes('An inspection')) sawPartialProse = true;
      }
      expect(sawPartialProse).toBe(true); // the prose really was typed — the assertions above weren't vacuous
      expect(container.querySelector('a')).not.toBeNull(); // ...and the links arrived, whole, at the end
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the finished message complete with its links', () => {
    // animate=false takes the done path immediately — the same render the typing pass swaps to.
    const { container } = render(<StreamedAdvisorMessage text={WITH_SOURCES} animate={false} />);
    expect(container.querySelector('a')).toHaveAttribute(
      'href',
      'https://www.consumerfinance.gov/'
    );
    expect(container.textContent).toContain('$400-600');
    expect(container.textContent).not.toContain('](');
  });

  it('leaves a message without sources untouched', () => {
    const { container } = render(
      <StreamedAdvisorMessage text={'Waiting a year is the stronger play.'} animate={false} />
    );
    expect(container.textContent).toContain('Waiting a year is the stronger play.');
  });
});
