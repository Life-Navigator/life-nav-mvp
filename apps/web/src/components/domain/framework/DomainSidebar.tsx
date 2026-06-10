'use client';

// Generic domain sidebar — same nav pattern as Finance (the golden reference). Driven entirely by
// DomainConfig.nav so no domain writes its own navigation system.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DomainConfig } from './types';

export function DomainSidebar({ config }: { config: DomainConfig }) {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{config.label}</h2>
        {config.tagline && <p className="mt-0.5 text-xs text-gray-400">{config.tagline}</p>}
      </div>
      <nav className="space-y-0.5 px-2 pb-4">
        {config.nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== config.basePath && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                active
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Beta
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
