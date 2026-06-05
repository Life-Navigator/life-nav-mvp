'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Logo from '@/components/brand/Logo';

const navLinks = [
  { href: '/#product', label: 'Product' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/trust', label: 'Trust' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-[var(--brand-line)] bg-[var(--brand-paper)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo markClassName="h-8 w-8" size={32} />

        <div className="hidden items-center gap-8 text-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors ${
                pathname === link.href
                  ? 'text-[var(--brand-ink)]'
                  : 'text-[var(--brand-muted)] hover:text-[var(--brand-ink)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/auth/magic"
            className="text-sm text-[var(--brand-muted)] transition-colors hover:text-[var(--brand-ink)]"
          >
            Sign in
          </Link>
          <Link
            href="/beta"
            className="rounded-lg bg-[var(--brand-ink)] px-4 py-2 text-sm font-medium text-[var(--brand-paper)] transition-transform hover:-translate-y-0.5"
          >
            Request Beta Access
          </Link>
        </div>

        <button
          className="md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="block h-0.5 w-6 bg-[var(--brand-ink)]" />
          <span className="mt-1.5 block h-0.5 w-6 bg-[var(--brand-ink)]" />
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--brand-line)] bg-[var(--brand-paper)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-[var(--brand-muted)]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/beta"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-[var(--brand-ink)] px-4 py-2 text-center font-medium text-[var(--brand-paper)]"
            >
              Request Beta Access
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
