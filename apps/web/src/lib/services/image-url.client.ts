/**
 * Client-Side Image URL Helpers
 *
 * Provides utilities for generating optimized image URLs on the client side.
 * For signed URLs (required in production), use the /api/images/url endpoint.
 */

// Re-export presets from the main module for consistency
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
  blur_placeholder: { width: 32, height: 32 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface ImageUrlOptions {
  preset?: ImagePreset;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
}

export interface SignedImageUrlResponse {
  success: boolean;
  url: string;
  srcSet?: string;
  blurPlaceholder?: string;
  dimensions?: { width: number; height: number };
  error?: string;
}

/**
 * Fetch a signed image URL from the API
 *
 * @param sourceUrl - The original image URL (GCS, S3, or HTTP)
 * @param options - Transformation options
 * @returns Signed Imgproxy URL
 */
export async function getSignedImageUrl(
  sourceUrl: string,
  options: ImageUrlOptions = {}
): Promise<SignedImageUrlResponse> {
  try {
    const response = await fetch('/api/images/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceUrl,
        preset: options.preset,
        options: {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get signed image URL:', error);
    return {
      success: false,
      url: sourceUrl, // Fallback to original URL
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch a signed image URL with srcSet and blur placeholder
 *
 * @param sourceUrl - The original image URL
 * @param options - Transformation options
 * @returns Signed URLs including srcSet and blur placeholder
 */
export async function getSignedImageUrlWithExtras(
  sourceUrl: string,
  options: ImageUrlOptions & {
    srcSetWidths?: number[];
  } = {}
): Promise<SignedImageUrlResponse> {
  try {
    const response = await fetch('/api/images/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceUrl,
        preset: options.preset,
        options: {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
        },
        includeSrcSet: true,
        includeBlurPlaceholder: true,
        srcSetWidths: options.srcSetWidths,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get signed image URL:', error);
    return {
      success: false,
      url: sourceUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get preset dimensions
 */
export function getPresetDimensions(preset: ImagePreset): { width: number; height: number } {
  return IMAGE_PRESETS[preset];
}

/**
 * Check if a URL is already optimized (Imgproxy URL)
 */
export function isOptimizedUrl(url: string): boolean {
  const imgproxyUrl = process.env.NEXT_PUBLIC_IMGPROXY_URL || 'https://images.life-navigator.app';
  return url.startsWith(imgproxyUrl);
}

/**
 * Get avatar URL using preset
 */
export async function getAvatarUrl(
  sourceUrl: string,
  size: 'xs' | 'sm' | 'md' | 'lg' = 'md'
): Promise<string> {
  const presetMap = {
    xs: 'avatar_thumbnail',
    sm: 'avatar_small',
    md: 'avatar_medium',
    lg: 'avatar_large',
  } as const;

  const result = await getSignedImageUrl(sourceUrl, {
    preset: presetMap[size],
  });

  return result.url;
}

/**
 * Cache for signed URLs to avoid repeated API calls
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a signed image URL with caching
 */
export async function getCachedSignedImageUrl(
  sourceUrl: string,
  options: ImageUrlOptions = {}
): Promise<string> {
  // Generate cache key
  const cacheKey = JSON.stringify({ sourceUrl, options });

  // Check cache
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  // Fetch new URL
  const result = await getSignedImageUrl(sourceUrl, options);

  // Cache the result
  if (result.success) {
    urlCache.set(cacheKey, {
      url: result.url,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return result.url;
}

/**
 * Clear the URL cache
 */
export function clearImageUrlCache(): void {
  urlCache.clear();
}

/**
 * React hook for getting signed image URLs
 */
export function useSignedImageUrl(
  sourceUrl: string | null | undefined,
  options: ImageUrlOptions = {}
): {
  url: string | null;
  isLoading: boolean;
  error: string | null;
} {
  // This is a placeholder - actual implementation would use React hooks
  // Import this in a React component and use useState/useEffect
  return {
    url: sourceUrl || null,
    isLoading: false,
    error: null,
  };
}
