import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Layout shell for the Arcana Provider Portal.
 *
 * Desktop-first sidebar, collapses to a horizontal tab bar on mobile.
 */
export function PortalShell({
  children,
  providerName,
}: {
  children: ReactNode;
  providerName?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside
        className="
          md:fixed md:top-0 md:left-0 md:h-screen md:w-60
          md:border-r md:border-slate-200 md:bg-white md:dark:bg-slate-900
          flex md:flex-col flex-row items-stretch
          border-b md:border-b-0 border-slate-200 dark:border-slate-800
          overflow-x-auto md:overflow-visible
        "
      >
        <div className="hidden md:block px-5 py-4">
          <div className="text-sm uppercase tracking-wide text-slate-400">Arcana</div>
          <div className="text-base font-semibold">Provider Portal</div>
          {providerName ? <div className="mt-1 text-xs text-slate-500">{providerName}</div> : null}
        </div>
        <nav className="flex md:flex-col gap-1 px-3 py-3 text-sm">
          <NavItem href="/portal/provider/dashboard" label="Dashboard" />
          <NavItem href="/portal/provider/leads" label="Leads" />
          <NavItem href="/portal/provider/clients" label="Clients" />
          <NavItem href="/portal/provider/analytics" label="Analytics" />
        </nav>
      </aside>
      <main className="md:ml-60 max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="
        whitespace-nowrap px-3 py-2 rounded-md
        text-slate-700 dark:text-slate-300
        hover:bg-slate-100 dark:hover:bg-slate-800
        focus:outline-none focus:ring-2 focus:ring-emerald-400
      "
    >
      {label}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between flex-col md:flex-row md:items-center gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        'rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 ' +
        'shadow-sm p-4 md:p-5 ' +
        className
      }
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: 'good' | 'bad' | 'neutral';
}) {
  const color =
    emphasis === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : emphasis === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </Card>
  );
}
