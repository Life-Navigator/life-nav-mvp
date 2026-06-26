import Link from 'next/link';
import Image from 'next/image';

/**
 * LifeNavigator brand logo — single source of truth (nav, auth, footer,
 * dashboard, emails all import this). Uses the official compass-shield asset at
 * /public/LifeNavigator.png. To swap the artwork later, change the src here once.
 */
export function Mark({ className = 'h-8 w-8', size = 32 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/LifeNavigator.png"
      alt="LifeNavigator"
      width={size}
      height={size}
      priority
      className={className}
    />
  );
}

export default function Logo({
  className = '',
  markClassName = 'h-8 w-8',
  size = 32,
  wordmark = true,
  href = '/',
}: {
  className?: string;
  markClassName?: string;
  size?: number;
  wordmark?: boolean;
  href?: string | null;
}) {
  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark className={markClassName} size={size} />
      {wordmark && (
        <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">
          LifeNavigator
        </span>
      )}
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} aria-label="LifeNavigator home" className="inline-flex">
      {inner}
    </Link>
  );
}
