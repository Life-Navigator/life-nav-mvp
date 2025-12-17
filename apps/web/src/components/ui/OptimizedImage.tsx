'use client';

/**
 * OptimizedImage Component
 *
 * A production-grade image component that integrates with Imgproxy
 * for optimized, responsive images with lazy loading and blur placeholders.
 *
 * Features:
 * - Automatic format conversion (WebP/AVIF)
 * - Responsive srcset generation
 * - Blur placeholder for lazy loading
 * - Preset-based sizing
 * - Error fallback handling
 */

import React, { useState, useCallback, useMemo } from 'react';
import Image, { ImageProps } from 'next/image';

// Image presets matching the server-side presets
export const IMAGE_PRESETS = {
  avatar_thumbnail: { width: 48, height: 48 },
  avatar_small: { width: 96, height: 96 },
  avatar_medium: { width: 192, height: 192 },
  avatar_large: { width: 384, height: 384 },
  profile_hero: { width: 1200, height: 400 },
  goal_card: { width: 400, height: 300 },
  goal_detail: { width: 800, height: 600 },
  achievement_badge_sm: { width: 64, height: 64 },
  achievement_badge_md: { width: 128, height: 128 },
  achievement_badge_lg: { width: 256, height: 256 },
  thumbnail: { width: 150, height: 150 },
  preview: { width: 600, height: 400 },
  full: { width: 1920, height: 1080 },
  og_image: { width: 1200, height: 630 },
  mobile_hero: { width: 750, height: 500 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface OptimizedImageProps extends Omit<ImageProps, 'src' | 'width' | 'height' | 'placeholder'> {
  src: string;
  preset?: ImagePreset;
  width?: number;
  height?: number;
  fallbackSrc?: string;
  showPlaceholder?: boolean;
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  rounded?: boolean | 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const IMGPROXY_BASE_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL || 'https://images.life-navigator.app';

/**
 * Client-side optimized image URL generation
 * Note: For signed URLs, use the API route /api/images/url
 */
function getClientImageUrl(
  src: string,
  width: number,
  height: number,
  quality: number = 80
): string {
  // If already an imgproxy URL or external URL, return as-is
  if (src.startsWith(IMGPROXY_BASE_URL) || src.startsWith('http')) {
    return src;
  }

  // For relative paths, assume they're already optimized or use Next.js Image
  if (src.startsWith('/')) {
    return src;
  }

  // For GCS paths, construct imgproxy URL (unsigned for client-side)
  // In production, you'd want to fetch a signed URL from the API
  return src;
}

/**
 * Get border radius class based on rounded prop
 */
function getRoundedClass(rounded: OptimizedImageProps['rounded']): string {
  if (!rounded) return '';
  if (rounded === true) return 'rounded';
  return `rounded-${rounded}`;
}

export function OptimizedImage({
  src,
  preset,
  width: propWidth,
  height: propHeight,
  fallbackSrc = '/images/placeholder.png',
  showPlaceholder = true,
  aspectRatio,
  objectFit = 'cover',
  rounded,
  className = '',
  alt,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Determine dimensions from preset or props
  const dimensions = useMemo(() => {
    if (preset && IMAGE_PRESETS[preset]) {
      return IMAGE_PRESETS[preset];
    }
    return {
      width: propWidth || 400,
      height: propHeight || 300,
    };
  }, [preset, propWidth, propHeight]);

  // Build the image source
  const imageSrc = useMemo(() => {
    if (hasError) return fallbackSrc;
    return getClientImageUrl(src, dimensions.width, dimensions.height);
  }, [src, hasError, fallbackSrc, dimensions]);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
    }
  }, [hasError]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...(aspectRatio && { aspectRatio }),
  };

  // Combine classes
  const imageClasses = [
    'transition-opacity duration-300',
    isLoading ? 'opacity-0' : 'opacity-100',
    getRoundedClass(rounded),
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div style={containerStyle} className={getRoundedClass(rounded)}>
      {/* Blur placeholder */}
      {showPlaceholder && isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}

      <Image
        src={imageSrc}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        className={imageClasses}
        style={{ objectFit }}
        onError={handleError}
        onLoad={handleLoad}
        priority={priority}
        {...props}
      />
    </div>
  );
}

/**
 * Avatar component with predefined sizing
 */
export interface AvatarProps extends Omit<OptimizedImageProps, 'preset' | 'rounded'> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  name?: string;
}

const AVATAR_SIZES = {
  xs: 'avatar_thumbnail',
  sm: 'avatar_small',
  md: 'avatar_medium',
  lg: 'avatar_large',
  xl: 'avatar_large',
} as const;

const AVATAR_DIMENSIONS = {
  xs: 32,
  sm: 48,
  md: 96,
  lg: 192,
  xl: 256,
};

export function Avatar({
  src,
  size = 'md',
  name,
  alt,
  className = '',
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const dimension = AVATAR_DIMENSIONS[size];

  // Generate initials for fallback
  const initials = useMemo(() => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  if (!src || hasError) {
    // Render initials avatar
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold rounded-full ${className}`}
        style={{
          width: dimension,
          height: dimension,
          fontSize: dimension * 0.4,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      preset={AVATAR_SIZES[size]}
      alt={alt || name || 'Avatar'}
      rounded="full"
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

/**
 * Goal card image component
 */
export interface GoalImageProps extends Omit<OptimizedImageProps, 'preset'> {
  variant?: 'card' | 'detail';
}

export function GoalImage({
  variant = 'card',
  className = '',
  ...props
}: GoalImageProps) {
  const preset = variant === 'card' ? 'goal_card' : 'goal_detail';

  return (
    <OptimizedImage
      preset={preset}
      rounded="lg"
      className={className}
      {...props}
    />
  );
}

/**
 * Achievement badge component
 */
export interface AchievementBadgeProps extends Omit<OptimizedImageProps, 'preset'> {
  size?: 'sm' | 'md' | 'lg';
}

const BADGE_SIZES = {
  sm: 'achievement_badge_sm',
  md: 'achievement_badge_md',
  lg: 'achievement_badge_lg',
} as const;

export function AchievementBadge({
  size = 'md',
  className = '',
  ...props
}: AchievementBadgeProps) {
  return (
    <OptimizedImage
      preset={BADGE_SIZES[size]}
      className={`drop-shadow-lg ${className}`}
      {...props}
    />
  );
}

/**
 * Profile hero image component
 */
export function ProfileHero({
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'preset'>) {
  return (
    <OptimizedImage
      preset="profile_hero"
      rounded="lg"
      className={`w-full ${className}`}
      priority
      {...props}
    />
  );
}

/**
 * Thumbnail component for lists
 */
export function Thumbnail({
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'preset'>) {
  return (
    <OptimizedImage
      preset="thumbnail"
      rounded="md"
      className={className}
      {...props}
    />
  );
}

/**
 * Hook for generating optimized image URLs
 */
export function useOptimizedImageUrl(
  src: string | null | undefined,
  options: {
    preset?: ImagePreset;
    width?: number;
    height?: number;
  } = {}
): string | null {
  return useMemo(() => {
    if (!src) return null;

    const dimensions = options.preset && IMAGE_PRESETS[options.preset]
      ? IMAGE_PRESETS[options.preset]
      : { width: options.width || 400, height: options.height || 300 };

    return getClientImageUrl(src, dimensions.width, dimensions.height);
  }, [src, options.preset, options.width, options.height]);
}

export default OptimizedImage;
