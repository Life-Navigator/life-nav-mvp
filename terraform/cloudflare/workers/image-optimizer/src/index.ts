/**
 * Life Navigator Image Optimization Worker
 *
 * This worker intercepts image requests and:
 * 1. Checks if the image exists in Cloudflare cache
 * 2. Applies image transformations (resize, format conversion)
 * 3. Caches the transformed image
 * 4. Serves optimized images to clients
 */

export interface Env {
  CACHE: KVNamespace;
}

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
}

const DEFAULT_OPTIONS: ImageOptions = {
  quality: 85,
  format: 'webp',
  fit: 'scale-down',
};

function parseImageOptions(url: URL): ImageOptions {
  const params = url.searchParams;
  return {
    width: params.has('w') ? parseInt(params.get('w')!) : undefined,
    height: params.has('h') ? parseInt(params.get('h')!) : undefined,
    quality: params.has('q') ? parseInt(params.get('q')!) : DEFAULT_OPTIONS.quality,
    format: (params.get('f') as ImageOptions['format']) || DEFAULT_OPTIONS.format,
    fit: (params.get('fit') as ImageOptions['fit']) || DEFAULT_OPTIONS.fit,
  };
}

function getCacheKey(url: URL, options: ImageOptions): string {
  const path = url.pathname;
  const optionsStr = JSON.stringify(options);
  return `img:${path}:${optionsStr}`;
}

function getContentType(format: string): string {
  const types: Record<string, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  return types[format] || 'image/webp';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Only process image paths
    if (!url.pathname.startsWith('/images/')) {
      return fetch(request);
    }

    // Parse transformation options
    const options = parseImageOptions(url);
    const cacheKey = getCacheKey(url, options);

    // Check KV cache first
    try {
      const cached = await env.CACHE.get(cacheKey, { type: 'arrayBuffer' });
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': getContentType(options.format || 'webp'),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'CF-Cache-Status': 'HIT',
            'X-Image-Optimized': 'true',
          },
        });
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }

    // Build origin URL (remove query params for origin fetch)
    const originUrl = new URL(url.pathname, url.origin);

    // Fetch original image with Cloudflare Image Resizing
    const imageRequest = new Request(originUrl.toString(), {
      headers: request.headers,
      cf: {
        image: {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
          fit: options.fit,
        },
      },
    });

    const response = await fetch(imageRequest);

    if (!response.ok) {
      // Return original response if transformation failed
      return fetch(originUrl.toString());
    }

    // Clone response for caching
    const responseClone = response.clone();
    const imageBuffer = await responseClone.arrayBuffer();

    // Cache in KV (async, don't block response)
    ctx.waitUntil(
      env.CACHE.put(cacheKey, imageBuffer, {
        expirationTtl: 86400 * 30, // 30 days
      }).catch((e) => console.error('Cache write error:', e))
    );

    // Return response with cache headers
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': getContentType(options.format || 'webp'),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CF-Cache-Status': 'MISS',
        'X-Image-Optimized': 'true',
        'Vary': 'Accept',
      },
    });
  },
};
