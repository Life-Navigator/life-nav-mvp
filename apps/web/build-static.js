#!/usr/bin/env node
/**
 * Simple build script that bypasses environment validation
 * for static export builds
 */

const { execSync } = require('child_process');

// Set environment variables
process.env.SKIP_ENV_VALIDATION = 'true';
process.env.DATABASE_URL = 'file:./prisma/dev.db';
process.env.NEXTAUTH_SECRET = 'build-time-secret-replace-in-production';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'production';
process.env.ENABLE_FIELD_ENCRYPTION = 'false';

console.log('🔧 Setting up build environment...');

try {
  // Generate Prisma client
  console.log('🔄 Generating Prisma client...');
  execSync('pnpm prisma generate', { stdio: 'inherit' });
  
  // Build the Next.js application
  console.log('🏗️ Building Next.js application...');
  execSync('next build', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}