import type { NextConfig } from "next";

// Get CSP directive values from environment variables or use defaults
const cspConnectSrc = process.env.CSP_CONNECT_SRC || `'self'`;
const cspDefaultSrc = process.env.CSP_DEFAULT_SRC || `'self'`;
const cspFontSrc = process.env.CSP_FONT_SRC || `'self' https://fonts.gstatic.com`;
const cspImgSrc = process.env.CSP_IMG_SRC || `'self' data: https: blob:`;
const cspScriptSrc = process.env.CSP_SCRIPT_SRC || `'self' 'unsafe-inline' 'unsafe-eval'`;
const cspStyleSrc = process.env.CSP_STYLE_SRC || `'self' 'unsafe-inline' https://fonts.googleapis.com`;
const cspFrameSrc = process.env.CSP_FRAME_SRC || `'self'`;

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
  swcMinify: true, // Use SWC minification for better performance
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
    // During deployment to Vercel, we'll handle type checking separately
    ignoreBuildErrors: process.env.VERCEL_ENV === 'production',
  },
  eslint: {
    // During deployment to Vercel, we'll handle linting separately
    ignoreDuringBuilds: process.env.VERCEL_ENV === 'production',
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
  experimental: {
    // External packages that should be processed by webpack
    serverComponentsExternalPackages: [
      'bcrypt',
      'crypto',
      '@prisma/client'
    ]
  }
};

export default nextConfig;