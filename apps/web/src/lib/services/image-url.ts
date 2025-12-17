/**
 * Imgproxy URL Generation Service
 *
 * Provides secure, signed URL generation for image transformations.
 * Supports presets, custom dimensions, format conversion, and quality settings.
 */

import crypto from 'crypto';

// Configuration from environment
const IMGPROXY_KEY = process.env.IMGPROXY_KEY || '';
const IMGPROXY_SALT = process.env.IMGPROXY_SALT || '';
const IMGPROXY_BASE_URL =
  process.env.IMGPROXY_URL ||
  process.env.NEXT_PUBLIC_IMGPROXY_URL ||
  'https://images.life-navigator.app';
const GCS_BUCKET_PREFIX = 'gs://';

// Preset definitions matching Kubernetes ConfigMap
export const IMAGE_PRESETS = {
  // Avatar sizes
  avatar_thumbnail: { width: 48, height: 48, resizeType: 'fill' as const, quality: 80 },
  avatar_small: { width: 96, height: 96, resizeType: 'fill' as const, quality: 80 },
  avatar_medium: { width: 192, height: 192, resizeType: 'fill' as const, quality: 85 },
  avatar_large: { width: 384, height: 384, resizeType: 'fill' as const, quality: 90 },

  // Profile images
  profile_hero: { width: 1200, height: 400, resizeType: 'fit' as const, quality: 85 },

  // Goal images
  goal_card: { width: 400, height: 300, resizeType: 'fill' as const, quality: 80 },
  goal_detail: { width: 800, height: 600, resizeType: 'fit' as const, quality: 85 },

  // Achievement badges
  achievement_badge_sm: { width: 64, height: 64, resizeType: 'fill' as const, quality: 85 },
  achievement_badge_md: { width: 128, height: 128, resizeType: 'fill' as const, quality: 85 },
  achievement_badge_lg: { width: 256, height: 256, resizeType: 'fill' as const, quality: 90 },

  // Generic sizes
  thumbnail: { width: 150, height: 150, resizeType: 'fill' as const, quality: 75 },
  preview: { width: 600, height: 400, resizeType: 'fit' as const, quality: 80 },
  full: { width: 1920, height: 1080, resizeType: 'fit' as const, quality: 85 },

  // Social/OG images
  og_image: { width: 1200, height: 630, resizeType: 'fill' as const, quality: 85 },

  // Mobile optimized
  mobile_hero: { width: 750, height: 500, resizeType: 'fit' as const, quality: 80 },

  // Blur placeholder for lazy loading
  blur_placeholder: {
    width: 32,
    height: 32,
    resizeType: 'fit' as const,
    quality: 30,
    blur: 10,
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export type ResizeType = 'fit' | 'fill' | 'auto' | 'force';

export type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';

export interface ImageTransformOptions {
  // Dimensions
  width?: number;
  height?: number;
  resizeType?: ResizeType;

  // Quality and format
  quality?: number;
  format?: OutputFormat;

  // Effects
  blur?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;

  // Cropping
  gravity?: 'ce' | 'no' | 'so' | 'ea' | 'we' | 'nowe' | 'noea' | 'sowe' | 'soea' | 'sm' | 'fp';
  cropWidth?: number;
  cropHeight?: number;

  // Advanced
  dpr?: number;
  enlarge?: boolean;
  extend?: boolean;
  background?: string;
  stripMetadata?: boolean;
  stripColorProfile?: boolean;
  autoRotate?: boolean;

  // Cache control
  cacheBuster?: string;
  expires?: number;
}

/**
 * Convert hex key/salt to binary
 */
function hexDecode(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Generate HMAC-SHA256 signature for Imgproxy URL
 */
function sign(path: string): string {
  if (!IMGPROXY_KEY || !IMGPROXY_SALT) {
    console.warn('Imgproxy signing keys not configured');
    return 'insecure';
  }

  const key = hexDecode(IMGPROXY_KEY);
  const salt = hexDecode(IMGPROXY_SALT);

  const hmac = crypto.createHmac('sha256', key);
  hmac.update(salt);
  hmac.update(path);

  return hmac.digest('base64url');
}

/**
 * Encode source URL for Imgproxy path
 */
function encodeSourceUrl(sourceUrl: string): string {
  // For GCS URLs, use the plain format
  if (sourceUrl.startsWith(GCS_BUCKET_PREFIX)) {
    return `/plain/${sourceUrl}`;
  }

  // For other URLs, use base64 encoding
  const encoded = Buffer.from(sourceUrl).toString('base64url');
  return `/${encoded}`;
}

/**
 * Build processing options string
 */
function buildOptionsString(options: ImageTransformOptions): string {
  const parts: string[] = [];

  // Resize
  if (options.width || options.height) {
    const resizeType = options.resizeType || 'fit';
    const width = options.width || 0;
    const height = options.height || 0;
    const gravity = options.gravity || 'ce';
    const enlarge = options.enlarge ? '1' : '0';
    parts.push(`resize:${resizeType}:${width}:${height}:${gravity}:${enlarge}`);
  }

  // DPR
  if (options.dpr && options.dpr > 1) {
    parts.push(`dpr:${options.dpr}`);
  }

  // Quality
  if (options.quality) {
    parts.push(`quality:${options.quality}`);
  }

  // Format
  if (options.format && options.format !== 'auto') {
    parts.push(`format:${options.format}`);
  }

  // Effects
  if (options.blur) {
    parts.push(`blur:${options.blur}`);
  }
  if (options.sharpen) {
    parts.push(`sharpen:${options.sharpen}`);
  }
  if (options.brightness) {
    parts.push(`brightness:${options.brightness}`);
  }
  if (options.contrast) {
    parts.push(`contrast:${options.contrast}`);
  }
  if (options.saturation) {
    parts.push(`saturation:${options.saturation}`);
  }

  // Background
  if (options.background) {
    const bg = options.background.replace('#', '');
    parts.push(`background:${bg}`);
  }

  // Metadata
  if (options.stripMetadata !== false) {
    parts.push('strip_metadata:1');
  }
  if (options.autoRotate !== false) {
    parts.push('auto_rotate:1');
  }

  // Expiration
  if (options.expires) {
    parts.push(`expires:${options.expires}`);
  }

  // Cache buster (for invalidation)
  if (options.cacheBuster) {
    parts.push(`cb:${options.cacheBuster}`);
  }

  return parts.join('/');
}

/**
 * Generate a signed Imgproxy URL for an image
 *
 * @param sourceUrl - Original image URL (GCS, S3, or HTTP)
 * @param options - Transformation options
 * @returns Signed Imgproxy URL
 *
 * @example
 * // Using preset
 * getImageUrl('gs://bucket/avatar.jpg', { preset: 'avatar_medium' })
 *
 * // Custom options
 * getImageUrl('gs://bucket/photo.jpg', { width: 800, height: 600, format: 'webp' })
 */
export function getImageUrl(
  sourceUrl: string,
  options: ImageTransformOptions & { preset?: ImagePreset } = {}
): string {
  // Apply preset if specified
  let finalOptions = { ...options };
  if (options.preset && IMAGE_PRESETS[options.preset]) {
    const presetOptions = IMAGE_PRESETS[options.preset];
    finalOptions = { ...presetOptions, ...options };
  }

  // Build the processing path
  const optionsString = buildOptionsString(finalOptions);
  const encodedSource = encodeSourceUrl(sourceUrl);
  const path = optionsString ? `/${optionsString}${encodedSource}` : encodedSource;

  // Sign the path
  const signature = sign(path);

  // Construct final URL
  return `${IMGPROXY_BASE_URL}/${signature}${path}`;
}

/**
 * Generate URLs for responsive image srcset
 *
 * @param sourceUrl - Original image URL
 * @param widths - Array of widths for srcset
 * @param options - Base transformation options
 * @returns srcset string
 */
export function getImageSrcSet(
  sourceUrl: string,
  widths: number[] = [320, 640, 1024, 1280, 1920],
  options: Omit<ImageTransformOptions, 'width'> = {}
): string {
  return widths
    .map((width) => {
      const url = getImageUrl(sourceUrl, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate blur placeholder URL for lazy loading
 */
export function getBlurPlaceholder(sourceUrl: string): string {
  return getImageUrl(sourceUrl, { preset: 'blur_placeholder' });
}

/**
 * Get optimized avatar URL
 */
export function getAvatarUrl(
  sourceUrl: string,
  size: 'thumbnail' | 'small' | 'medium' | 'large' = 'medium'
): string {
  const presetMap = {
    thumbnail: 'avatar_thumbnail',
    small: 'avatar_small',
    medium: 'avatar_medium',
    large: 'avatar_large',
  } as const;

  return getImageUrl(sourceUrl, { preset: presetMap[size] });
}

/**
 * Check if a URL is already an Imgproxy URL
 */
export function isImgproxyUrl(url: string): boolean {
  return url.startsWith(IMGPROXY_BASE_URL);
}

/**
 * Convert a storage path to a full GCS URL
 */
export function toGcsUrl(bucket: string, path: string): string {
  return `gs://${bucket}/${path}`;
}

/**
 * Parse bucket and path from GCS URL
 */
export function parseGcsUrl(gcsUrl: string): { bucket: string; path: string } | null {
  const match = gcsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

/**
 * Get preset dimensions
 */
export function getPresetDimensions(preset: ImagePreset): { width: number; height: number } {
  const presetConfig = IMAGE_PRESETS[preset];
  return {
    width: presetConfig.width,
    height: presetConfig.height,
  };
}
