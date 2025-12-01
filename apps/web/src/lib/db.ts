// Database client implementation
// This file provides the shared Prisma client for the application

import { PrismaClient } from '@prisma/client';

// For Prisma, we want to make sure we don't create multiple instances
// during hot reloads in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient() {
  // If we already have a client, return it
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  // Otherwise, create a new client with optimized connection pool settings
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Store the client globally to prevent multiple instances
  globalForPrisma.prisma = client;

  // Add connection pool timeout handling
  client.$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
    });

  return client;
}

// Export the database client
export const db = getPrismaClient();

// Gracefully handle shutdown to clean up connections
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect();
    }
  });
}
