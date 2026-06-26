'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from '@/components/brand/Logo';

const navLinks = [
  { href: '/product', label: 'Product' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/trust', label: 'Trust' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`absolute top-0 z-50 w-full transition-colors duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-[#06060a]/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-8">
        <Logo markClassName="h-8 w-8" size={32} />

        <div className="hidden items-center gap-8 text-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition-colors ${
                pathname === link.href ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/auth?mode=signin"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/auth?mode=create"
            className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            Request Beta Invite
          </Link>
        </div>

        <button
          className="md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#06060a]/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-white/70"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth?mode=create"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-center font-medium text-white"
            >
              Request Beta Invite
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
