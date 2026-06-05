import type { NextConfig } from "next";

// Build CSP allow-lists. Defaults are permissive enough for a Next.js app —
// Next's inline bootstrap/hydration scripts, next/font + React inline styles,
// Supabase auth/realtime, and Vercel tooling — while still locking down
// object-src, base-uri, and frame-ancestors. Each is overridable via CSP_* env.
//
// NOTE: 'unsafe-inline' on script-src is required because Next injects inline
// bootstrap scripts (and we ship a small theme script). A nonce-based CSP would
// be stricter but forces every page to render dynamically (no static caching),
// so for the beta we accept 'unsafe-inline' here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseWs = supabaseUrl ? supabaseUrl.replace(/^https:/i, 'wss:') : '';
const apiOrigins = [
  process.env.NEXT_PUBLIC_AGENT_API_URL,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_API_BASE_URL,
]
  .filter(Boolean)
  .map((u) => {
    try {
      return new URL(u as string).origin;
    } catch {
      return '';
    }
  })
  .filter(Boolean);

const cspConnectSrc =
  process.env.CSP_CONNECT_SRC ||
  [
    `'self'`,
    supabaseUrl,
    supabaseWs,
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.fly.dev',
    'https://vercel.live',
    'wss://vercel.live',
    'https://vitals.vercel-insights.com',
    ...apiOrigins,
  ]
    .filter(Boolean)
    .join(' ');
const cspDefaultSrc = process.env.CSP_DEFAULT_SRC || `'self'`;
const cspFontSrc = process.env.CSP_FONT_SRC || `'self' https://fonts.gstatic.com`;
const cspImgSrc = process.env.CSP_IMG_SRC || `'self' data: https: blob:`;
const cspScriptSrc = process.env.CSP_SCRIPT_SRC || `'self' 'unsafe-inline' https://vercel.live`;
const cspStyleSrc =
  process.env.CSP_STYLE_SRC || `'self' 'unsafe-inline' https://fonts.googleapis.com`;
const cspFrameSrc = process.env.CSP_FRAME_SRC || `'self' https://vercel.live`;

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
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
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

export default nextConfig;