'use client';

// The domain shell — sidebar + scrollable content. Mirrors finance/layout.tsx so every domain is
// structurally identical (Rule 1: one platform). DomainHeader + DomainActionBar live here so the
// header/action pattern is shared too.
import type { ReactNode } from 'react';
import { DomainSidebar } from './DomainSidebar';
import type { DomainConfig } from './types';

export function DomainActionBar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function DomainHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <DomainActionBar>{actions}</DomainActionBar>}
    </div>
  );
}

export function DomainLayout({ config, children }: { config: DomainConfig; children: ReactNode }) {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      <DomainSidebar config={config} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
