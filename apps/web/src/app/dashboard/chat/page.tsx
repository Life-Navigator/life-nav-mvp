/**
 * /dashboard/chat — the Advisor Chat Command Center (full layout).
 *
 * ChatGPT-style: left sidebar (new chat, projects, recent threads), agent selector, grounded cited
 * answers, per-thread context. Talks only to advisor mode via /api/chat/*. Replaces the previous
 * graphrag-only chat page so the dashboard chat and the floating launcher share ONE system.
 */
'use client';

import CommandCenter from '@/components/chat/CommandCenter';

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <CommandCenter />
    </div>
  );
}
