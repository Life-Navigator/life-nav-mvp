/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
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
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  compiler: {
    styledComponents: true
  },
  // Empty turbopack config to silence the warning and enable Turbopack
  turbopack: {},
  poweredByHeader: false,
  serverExternalPackages: [
    'bcrypt',
    'crypto',
    '@prisma/client',
    'bull'
  ],
};

module.exports = nextConfig;