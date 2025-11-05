/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    styledComponents: true
  },
  webpack: (config) => {
    return config;
  },
  poweredByHeader: false,
  serverExternalPackages: [
    'bcrypt',
    'crypto',
    '@prisma/client'
  ]
};

module.exports = nextConfig;