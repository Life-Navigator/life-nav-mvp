'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import CommandCenter from '@/components/chat/CommandCenter';

// Floating Advisor launcher — opens the SAME Advisor Chat Command Center as the dashboard, in compact
// side-panel mode (advisor mode, projects/threads/agents/citations all shared). Previously this was a
// dead shell wired to a legacy agent backend; it now hosts the real command center.

interface ChatSidebarProps {
  context?: string;
}

export default function ChatSidebar(_props: ChatSidebarProps) {
  // During advisor onboarding the page IS the advisor — hide this second launcher there.
  const pathname = usePathname();
  const hiddenForOnboarding = pathname === '/dashboard/advisor';

  const [isOpen, setIsOpen] = useState(false);
  // Prefill from "Ask your advisor about this" surfaces. Bumping `seed` remounts CommandCenter so the
  // new prefill lands in its composer.
  const [prefill, setPrefill] = useState('');
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setIsOpen(true);
      const p = (e as CustomEvent).detail?.prefill;
      if (typeof p === 'string' && p) {
        setPrefill(p);
        setSeed((s) => s + 1);
      }
    };
    window.addEventListener('lifenav:open-advisor', onOpen);
    return () => window.removeEventListener('lifenav:open-advisor', onOpen);
  }, []);

  if (hiddenForOnboarding) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-indigo-600 p-4 text-white shadow-lg transition-all hover:scale-110 hover:bg-indigo-700"
        aria-label="Toggle Advisor"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      <div
        className={`fixed right-0 top-0 z-50 h-full w-96 max-w-full transform border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Mount the command center only while open so it doesn't fetch in the background on every page. */}
        {isOpen && <CommandCenter key={seed} compact initialInput={prefill} />}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
