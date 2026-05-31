'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ConversationalShell from '@/components/onboarding/ConversationalShell';
import type { AgentPersona } from '@/types/discovery';

interface PersonaPreset {
  persona: AgentPersona;
  title: string;
  description: string;
  goalCategory: string;
  opening: string;
}

const PRESETS: PersonaPreset[] = [
  {
    persona: 'financial_advisor',
    title: 'Talk with the Financial Advisor',
    description:
      "I'll help you surface what you actually want financially — not just the surface goal.",
    goalCategory: 'financial',
    opening:
      "Welcome. I'm here to understand the financial change you'd most like to make. What are you trying to accomplish?",
  },
  {
    persona: 'physician_intake',
    title: 'Talk with the Physician Intake specialist',
    description: 'Body, training, sleep, and what you actually want your health to look like.',
    goalCategory: 'health',
    opening:
      'Welcome. To start, when you imagine your body or health where you want it — what does that look like for you?',
  },
  {
    persona: 'career_coach',
    title: 'Talk with the Career Coach',
    description: 'Where you are, where you want to go, and what would unlock it.',
    goalCategory: 'career',
    opening:
      "Hi — I'm here to figure out what career outcome would feel meaningful to you. Tell me what you're working on.",
  },
  {
    persona: 'education_counselor',
    title: 'Talk with the Education Counselor',
    description: 'Credentials, programs, and what they would actually do for you.',
    goalCategory: 'education',
    opening:
      "Welcome. Tell me what credential or program you're considering — and what you hope it would do for you.",
  },
  {
    persona: 'benefits_navigator',
    title: 'Talk with the Benefits Navigator',
    description: 'Coverage, HSA/FSA, employer benefits — and what you actually need.',
    goalCategory: 'benefits',
    opening:
      "Hi — let's figure out which part of your benefits or coverage you'd like to understand better.",
  },
  {
    persona: 'estate_advisor',
    title: 'Talk with the Estate & Legacy Planner',
    description: 'Will, trust, POA, guardianship — planning context only, never legal advice.',
    goalCategory: 'estate',
    opening:
      'Welcome. To begin, tell me what about your legacy or estate planning has been on your mind.',
  },
];

export default function ConversePage() {
  const [active, setActive] = useState<PersonaPreset | null>(null);

  if (!active) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="space-y-2">
            <Link href="/onboarding/hub" className="text-sm text-blue-600 hover:underline">
              ← Back to setup
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Have a real conversation
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pick the specialist you'd like to talk with. They'll listen, ask a few focused
              follow-ups, and confirm your real goal before we save anything.
            </p>
          </header>
          <ul className="space-y-2">
            {PRESETS.map((p) => (
              <li
                key={p.persona}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{p.title}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{p.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(p)}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <ConversationalShell
      agentPersona={active.persona}
      title={active.title}
      opening={active.opening}
      goalCategory={active.goalCategory}
      onFinalized={() => {
        // After saving, return to the hub and let the user pick what to do next.
        setTimeout(() => {
          window.location.href = '/onboarding/hub';
        }, 1500);
      }}
    />
  );
}
