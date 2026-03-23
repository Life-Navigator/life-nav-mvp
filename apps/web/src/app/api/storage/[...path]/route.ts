/**
 * Local Storage API - Serve files from local blob storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { downloadFile, StorageBucket } from '@/lib/storage/local-storage';
import { getUserIdFromJWT } from '@/lib/auth/jwt';

const VALID_BUCKETS: StorageBucket[] = ['documents', 'avatars', 'exports', 'temp'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Parse path: /api/storage/{bucket}/{userId?}/{filename}
    const bucket = pathSegments[0] as StorageBucket;

    if (!VALID_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    }

    // Check authentication for non-public buckets
    if (bucket !== 'avatars') {
      const userId = await getUserIdFromJWT(request);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Get filename (last segment) and optional userId
    let filename: string;
    let userId: string | undefined;

    if (pathSegments.length === 2) {
      filename = pathSegments[1];
    } else {
      userId = pathSegments[1];
      filename = pathSegments.slice(2).join('/');
    }

    const result = await downloadFile(bucket, filename, userId);

    if (!result) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
