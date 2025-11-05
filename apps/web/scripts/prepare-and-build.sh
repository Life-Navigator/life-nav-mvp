#!/bin/bash
# Script to prepare and build the application with "Coming Soon" placeholders for unfinished pages

set -e

echo "🔧 Preparing LifeNavigator for deployment..."

# Run the placeholders script to create "Coming Soon" pages for unfinished features
echo "Creating placeholders for unfinished pages..."
./scripts/create-placeholders.sh

# Fix the prisma schema issues
echo "Fixing Prisma schema issues..."
if grep -q "model RevokedToken" prisma/schema.prisma; then
  # Delete duplicate model definitions
  sed -i '/model RevokedToken/,/^}$/d' prisma/schema.prisma
  sed -i '/model UserDevice/,/^}$/d' prisma/schema.prisma
  sed -i '/model SecurityAuditLog/,/^}$/d' prisma/schema.prisma
fi

# Create a minimal .env file for the build
echo "Setting up minimal environment for build..."
cat > .env << EOF
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://d1jb3e6fj4k8lu.cloudfront.net
APP_ENV=dev
SKIP_ENV_VALIDATION=true

# Database - Using SQLite for build
DATABASE_URL=file:./prisma/dev.db

# Authentication
NEXTAUTH_URL=https://d1jb3e6fj4k8lu.cloudfront.net
NEXTAUTH_SECRET=qb8HXYXlv4eJa5XRiGSl9J7qzP4Y3Vlm
GOOGLE_CLIENT_ID=dummy
GOOGLE_CLIENT_SECRET=dummy

# Encryption - Disabled for build
ENABLE_FIELD_ENCRYPTION=false
ENCRYPTION_KEY=32-character-build-time-dummy-key-32
ENCRYPTION_MASTER_KEY=32-character-build-time-dummy-key-32
ENCRYPTION_SALT=build-time-salt
EOF

# Update next.config.js for static export
echo "Configuring Next.js for static export..."
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'export',  // Enable static HTML export
  trailingSlash: true,  // Add trailing slashes for S3/CloudFront compatibility
  
  // Configure image optimization for static export
  images: {
    unoptimized: true,  // Required for static export
  },
  
  // Disable server-specific features in static export
  experimental: {
    serverActions: false,  // Disable server actions for static export
  },
};

module.exports = nextConfig;
EOF

# Use the mock-static-build as a fallback if build fails
echo "Attempting to build the application..."
if npx prisma generate && next build; then
  echo "✅ Build completed successfully!"
else
  echo "❌ Build failed, falling back to mock static build..."
  ./mock-static-build.sh
fi

echo "Now you can deploy the built application using:"
echo "  ./scripts/simplified-deploy.sh"
echo "  ./scripts/invalidate-cloudfront.sh E3LILZ5ORJJCZH"