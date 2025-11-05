#!/usr/bin/env node
/**
 * Wait for backend to be ready before starting frontend
 * Checks backend health endpoint and waits until it's available
 */

const http = require('http');

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8080';
const MAX_RETRIES = 30;
const RETRY_DELAY = 2000; // 2 seconds

async function checkBackend() {
  return new Promise((resolve) => {
    const url = new URL(BACKEND_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 8080,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function waitForBackend() {
  console.log('⏳ Waiting for Maverick AI backend to be ready...');
  console.log(`   Checking ${BACKEND_URL}/health`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await checkBackend();

    if (isReady) {
      console.log('✅ Backend is ready!');
      console.log('🚀 Starting Next.js frontend...\n');
      return;
    }

    const dotsCount = (i % 3) + 1;
    const dots = '.'.repeat(dotsCount);
    process.stdout.write(`\r   Attempt ${i + 1}/${MAX_RETRIES}${dots}   `);

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }

  console.log('\n⚠️  Backend did not start in time');
  console.log('   The frontend will start anyway, but AI features may not work');
  console.log('   You can manually start the backend later\n');
}

waitForBackend().catch(err => {
  console.error('Error waiting for backend:', err);
  process.exit(1);
});
