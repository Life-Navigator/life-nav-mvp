import Link from 'next/link';
import Logo from '@/components/brand/Logo';

const footerLinks = {
  Product: [
    { label: 'Product', href: '/#product' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Beta Program', href: '/beta' },
  ],
  Trust: [
    { label: 'Trust Center', href: '/trust' },
    { label: 'Security', href: '/security' },
    { label: 'Privacy', href: '/legal/privacy' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: 'mailto:beta@lifenavigator.tech' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' },
    { label: 'Cookie Policy', href: '/legal/cookies' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-[var(--brand-line)] bg-[var(--brand-paper)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo markClassName="h-7 w-7" size={28} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--brand-muted)]">
              Decision Intelligence for Life. Grounded in your data, governed for trust.
            </p>
          </div>
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-[var(--brand-ink)]">{heading}</h4>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--brand-muted)] transition-colors hover:text-[var(--brand-ink)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-[var(--brand-line)] pt-6">
          <p className="text-sm text-[var(--brand-muted)]">
            &copy; {new Date().getFullYear()} LifeNavigator · Decision Intelligence for Life
          </p>
        </div>
      </div>
    </footer>
  );
}
