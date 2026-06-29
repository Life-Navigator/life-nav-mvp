import { render, screen } from '@testing-library/react';
import AdvisorMessage from '../AdvisorMessage';

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
});
