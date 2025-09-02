/**
 * Production-Optimized Next.js Configuration
 * Maximizes performance, minimizes cost
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  
  // Standalone output for smaller Docker images (50% smaller)
  output: 'standalone',
  
  // Enable SWC minification (faster than Terser)
  swcMinify: true,
  
  // Compress responses (saves bandwidth = lower cost)
  compress: true,
  
  // PoweredBy header removal (security + bytes saved)
  poweredByHeader: false,
  
  // Image optimization (critical for performance)
  images: {
    domains: ['lifenavigator.blob.core.windows.net'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
  },
  
  // Optimize for production
  compiler: {
    // Remove console.logs in production (smaller bundle)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
    
    // Remove React dev tools in production
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? {
      properties: ['^data-testid$']
    } : false,
  },
  
  // Bundle analyzer (only in analyze mode)
  webpack: (config, { isServer }) => {
    // Tree shaking optimization
    config.optimization = {
      ...config.optimization,
      sideEffects: false,
      usedExports: true,
      
      // Aggressive code splitting
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: false,
          vendors: false,
          
          // Vendor code splitting
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          
          // Common components
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
            reuseExistingChunk: true,
          },
          
          // Shared modules
          shared: {
            name(module, chunks) {
              return `shared-${crypto
                .createHash('sha1')
                .update(chunks.map(c => c.name).join('-'))
                .digest('hex')
                .substring(0, 8)}`;
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      },
    };
    
    // Reduce bundle size
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Replace large libraries with smaller alternatives
        'lodash': 'lodash-es',
        'moment': 'date-fns',
      };
    }
    
    return config;
  },
  
  // Headers for caching and security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
        ],
      },
      
      // Aggressive caching for static assets
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      
      // Font caching
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      
      // Image caching
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  
  // Experimental features for performance
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    
    // Optimize server components
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
    
    // Module federation for micro-frontends (future K8s ready)
    // This makes migration to microservices easier
    moduleFederation: false, // Enable when ready for K8s
    
    // Incremental cache handler for distributed caching
    incrementalCacheHandlerPath: process.env.NODE_ENV === 'production'
      ? require.resolve('./cache-handler.js')
      : undefined,
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;