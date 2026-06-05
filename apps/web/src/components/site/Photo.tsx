import Image from 'next/image';

/**
 * Premium image treatment: rounded, bordered, with a dark gradient veil so
 * photography sits cohesively inside the dark cinematic system (and keeps any
 * overlaid text legible). Fill-based, so the parent sets the aspect ratio.
 */
export default function Photo({
  src,
  alt,
  className = '',
  rounded = 'rounded-2xl',
  veil = true,
  priority = false,
  sizes = '(max-width: 768px) 100vw, 50vw',
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
  veil?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden border border-white/10 ${rounded} ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      {veil && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(6,6,10,0.05) 0%, rgba(6,6,10,0.55) 100%)',
          }}
        />
      )}
    </div>
  );
}
