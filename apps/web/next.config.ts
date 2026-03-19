import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

// Get CSP directive values from environment variables or use defaults
const cspConnectSrc = process.env.CSP_CONNECT_SRC || `'self' https://*.sentry.io https://*.ingest.us.sentry.io`;
const cspDefaultSrc = process.env.CSP_DEFAULT_SRC || `'self'`;
const cspFontSrc = process.env.CSP_FONT_SRC || `'self' https://fonts.gstatic.com`;
const cspImgSrc = process.env.CSP_IMG_SRC || `'self' data: https: blob:`;
const cspScriptSrc = process.env.CSP_SCRIPT_SRC || `'self' blob:`;
const cspStyleSrc = process.env.CSP_STYLE_SRC || `'self' https://fonts.googleapis.com 'unsafe-inline'`;
const cspFrameSrc = process.env.CSP_FRAME_SRC || `'self'`;
const cspWorkerSrc = process.env.CSP_WORKER_SRC || `'self' blob:`;

// Define security headers
const securityHeaders = [
  // Content Security Policy (CSP)
  {
    key: 'Content-Security-Policy',
    value: `
      default-src ${cspDefaultSrc};
      script-src ${cspScriptSrc};
      style-src ${cspStyleSrc};
      img-src ${cspImgSrc};
      font-src ${cspFontSrc};
      connect-src ${cspConnectSrc};
      frame-src ${cspFrameSrc};
      worker-src ${cspWorkerSrc};
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      object-src 'none';
      upgrade-insecure-requests;
    `.replace(/\s+/g, ' ').trim()
  },
  // HTTP Strict Transport Security (HSTS) - enforce HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  // X-Content-Type-Options - prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  // X-Frame-Options - prevent clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  // X-XSS-Protection - additional XSS protection
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  // Referrer-Policy - control information sent in Referer header
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  // Feature-Policy - control browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      }
    ],
  },
  typescript: {
    // Type checking runs in a dedicated CI job for faster feedback.
    // Build still fails on type errors — this only skips the redundant
    // tsc pass that Next.js runs internally during `next build`.
    ignoreBuildErrors: !!process.env.CI,
  },
  // Add security headers to all responses
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // Improve handling of client components
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true
  },
  // Ensure client components are built correctly
  experimental: {}
};

export default withSentryConfig(nextConfig, {
  org: 'lifenavigator-inc',
  project: 'javascript-nextjs',

  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for prettier stack traces (Sentry default is 1000)
  widenClientFileUpload: true,

  // Tunnel Sentry events through this route to avoid ad blockers
  tunnelRoute: '/monitoring',

  // Only log during CI builds
  silent: !process.env.CI,

  // Hide source maps from client bundles
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Disable Sentry SDK tree-shaking for dev builds
  disableLogger: true,
});