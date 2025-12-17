/**
 * Life Navigator Supabase Storage Proxy Worker
 *
 * This worker proxies requests to Supabase storage through Cloudflare:
 * 1. Adds caching layer for public assets
 * 2. Validates access for private buckets
 * 3. Applies security headers
 * 4. Enables image optimization for storage images
 */

export interface Env {
  CACHE: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const PUBLIC_BUCKETS = ['avatars', 'achievement-badges', 'public-assets'];
const PRIVATE_BUCKETS = ['goal-images', 'feedback-attachments'];

interface StorageRequest {
  bucket: string;
  path: string;
  isPublic: boolean;
}

function parseStorageRequest(url: URL): StorageRequest | null {
  // Expected format: /storage/{bucket}/{path}
  const match = url.pathname.match(/^\/storage\/([^\/]+)\/(.+)$/);
  if (!match) return null;

  const bucket = match[1];
  const path = match[2];
  const isPublic = PUBLIC_BUCKETS.includes(bucket);

  return { bucket, path, isPublic };
}

function getCacheKey(storageReq: StorageRequest): string {
  return `storage:${storageReq.bucket}:${storageReq.path}`;
}

async function validatePrivateAccess(
  request: Request,
  env: Env,
  storageReq: StorageRequest
): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  // Validate JWT with Supabase
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) return false;

    const user = (await response.json()) as { id: string };

    // For goal-images, check if user owns the file
    if (storageReq.bucket === 'goal-images') {
      return storageReq.path.startsWith(user.id);
    }

    return true;
  } catch {
    return false;
  }
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return types[ext || ''] || 'application/octet-stream';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Parse storage request
    const storageReq = parseStorageRequest(url);
    if (!storageReq) {
      return new Response('Invalid storage path', { status: 400 });
    }

    // Validate access for private buckets
    if (!storageReq.isPublic) {
      const hasAccess = await validatePrivateAccess(request, env, storageReq);
      if (!hasAccess) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Check cache for public assets
    if (storageReq.isPublic) {
      const cacheKey = getCacheKey(storageReq);
      try {
        const cached = await env.CACHE.get(cacheKey, { type: 'arrayBuffer' });

        if (cached) {
          const contentType = getContentType(storageReq.path);
          return new Response(cached, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'CF-Cache-Status': 'HIT',
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
            },
          });
        }
      } catch (e) {
        console.error('Cache read error:', e);
      }
    }

    // Build Supabase storage URL
    const supabaseUrl = new URL(
      `/storage/v1/object/${storageReq.isPublic ? 'public' : 'authenticated'}/${storageReq.bucket}/${storageReq.path}`,
      env.SUPABASE_URL
    );

    // Fetch from Supabase
    const supabaseRequest = new Request(supabaseUrl.toString(), {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization:
          request.headers.get('Authorization') || `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });

    const response = await fetch(supabaseRequest);

    if (!response.ok) {
      return new Response(response.statusText, { status: response.status });
    }

    // Get response body
    const buffer = await response.arrayBuffer();

    // Cache public assets
    if (storageReq.isPublic) {
      const cacheKey = getCacheKey(storageReq);
      ctx.waitUntil(
        env.CACHE.put(cacheKey, buffer, {
          expirationTtl: 86400, // 1 day
        }).catch((e) => console.error('Cache write error:', e))
      );
    }

    // Return response with security headers
    const contentType = getContentType(storageReq.path);
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': storageReq.isPublic
          ? 'public, max-age=86400'
          : 'private, no-cache',
        'CF-Cache-Status': 'MISS',
      },
    });
  },
};
