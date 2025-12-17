/**
 * Image URL Generation API
 *
 * Generates signed Imgproxy URLs for secure image transformations.
 * Supports presets, custom dimensions, and format conversion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import {
  getImageUrl,
  getImageSrcSet,
  getBlurPlaceholder,
  IMAGE_PRESETS,
  type ImagePreset,
  type ImageTransformOptions,
} from '@/lib/services/image-url';

export const dynamic = 'force-dynamic';

/**
 * POST /api/images/url
 * Generate a signed Imgproxy URL
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      sourceUrl,
      preset,
      options = {},
      includeSrcSet = false,
      includeBlurPlaceholder = false,
      srcSetWidths,
    } = body;

    // Validate source URL
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Source URL is required' },
        { status: 400 }
      );
    }

    // Validate preset if provided
    if (preset && !IMAGE_PRESETS[preset as ImagePreset]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid preset. Available presets: ${Object.keys(IMAGE_PRESETS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate the signed URL
    const transformOptions: ImageTransformOptions & { preset?: ImagePreset } = {
      ...options,
      ...(preset && { preset: preset as ImagePreset }),
    };

    const url = getImageUrl(sourceUrl, transformOptions);

    // Build response
    const response: {
      success: boolean;
      url: string;
      srcSet?: string;
      blurPlaceholder?: string;
      dimensions?: { width: number; height: number };
    } = {
      success: true,
      url,
    };

    // Add srcSet if requested
    if (includeSrcSet) {
      const widths = srcSetWidths || [320, 640, 1024, 1280, 1920];
      response.srcSet = getImageSrcSet(sourceUrl, widths, transformOptions);
    }

    // Add blur placeholder if requested
    if (includeBlurPlaceholder) {
      response.blurPlaceholder = getBlurPlaceholder(sourceUrl);
    }

    // Add dimensions from preset if available
    if (preset && IMAGE_PRESETS[preset as ImagePreset]) {
      const presetConfig = IMAGE_PRESETS[preset as ImagePreset];
      response.dimensions = {
        width: presetConfig.width,
        height: presetConfig.height,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating image URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate image URL' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/images/url
 * Generate a signed Imgproxy URL (query parameters)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sourceUrl = searchParams.get('source');
    const preset = searchParams.get('preset');
    const width = searchParams.get('width');
    const height = searchParams.get('height');
    const quality = searchParams.get('quality');
    const format = searchParams.get('format');
    const redirect = searchParams.get('redirect') === 'true';

    // Validate source URL
    if (!sourceUrl) {
      return NextResponse.json(
        { success: false, error: 'Source URL is required' },
        { status: 400 }
      );
    }

    // Validate preset if provided
    if (preset && !IMAGE_PRESETS[preset as ImagePreset]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid preset. Available presets: ${Object.keys(IMAGE_PRESETS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Build transform options
    const transformOptions: ImageTransformOptions & { preset?: ImagePreset } = {};

    if (preset) {
      transformOptions.preset = preset as ImagePreset;
    }
    if (width) {
      transformOptions.width = parseInt(width, 10);
    }
    if (height) {
      transformOptions.height = parseInt(height, 10);
    }
    if (quality) {
      transformOptions.quality = parseInt(quality, 10);
    }
    if (format) {
      transformOptions.format = format as 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
    }

    // Generate the signed URL
    const url = getImageUrl(sourceUrl, transformOptions);

    // Redirect to the image if requested
    if (redirect) {
      return NextResponse.redirect(url);
    }

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error) {
    console.error('Error generating image URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate image URL' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/images/url
 * Return available presets and options
 */
export async function OPTIONS() {
  return NextResponse.json({
    presets: Object.entries(IMAGE_PRESETS).map(([name, config]) => ({
      name,
      ...config,
    })),
    options: {
      width: 'number - Target width in pixels',
      height: 'number - Target height in pixels',
      quality: 'number - Image quality (1-100)',
      format: 'string - Output format: webp, avif, jpeg, png, auto',
      resizeType: 'string - Resize mode: fit, fill, auto, force',
      gravity: 'string - Crop gravity: ce, no, so, ea, we, nowe, noea, sowe, soea, sm, fp',
      blur: 'number - Blur radius',
      sharpen: 'number - Sharpen amount',
      dpr: 'number - Device pixel ratio (1-3)',
    },
    methods: {
      POST: 'Generate signed URL with JSON body',
      GET: 'Generate signed URL with query parameters',
    },
  });
}
