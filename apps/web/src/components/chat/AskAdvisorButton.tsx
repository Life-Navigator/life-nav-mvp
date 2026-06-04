'use client';

/**
 * Opens the governed advisor (ChatSidebar) and optionally pre-fills a question.
 * Used by the First Insight card so "Ask your advisor about this" reaches the
 * REAL governed chat (POST /api/agent/chat) instead of dead-ending on the
 * /conversation prerequisite wall, which persona-activated users can't pass.
 */
export const OPEN_ADVISOR_EVENT = 'lifenav:open-advisor';

export default function AskAdvisorButton({
  prefill,
  children,
  className,
}: {
  prefill?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_ADVISOR_EVENT, { detail: { prefill } }))
      }
      className={className}
    >
      {children}
    </button>
  );
}
