// Database client implementation
// This file provides either a real Prisma client or a mock DB for development

import { PrismaClient } from '@prisma/client';

// Define User type based on our schema
type User = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  password?: string | null;
  setupCompleted: boolean;
};

// Mock database implementation for development environments
class MockDB {
  private users: Record<string, User> = {
    'demo-user-id': {
      id: 'demo-user-id',
      email: 'demo@example.com',
      name: 'Demo User',
      setupCompleted: true
    },
    'test-user-id': {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      setupCompleted: true
    }
  };

  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) {
        return this.users[where.id] || null;
      }
      if (where.email) {
        return Object.values(this.users).find(u => u.email === where.email) || null;
      }
      return null;
    },
    findMany: async () => {
      return Object.values(this.users);
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || `user-${Date.now()}`;
      this.users[id] = { ...data, id };
      return this.users[id];
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      if (!this.users[where.id]) return null;
      this.users[where.id] = { ...this.users[where.id], ...data };
      return this.users[where.id];
    }
  };

  // Add other model mocks as needed (this is a simplified version)
  // These are just empty implementations that won't throw errors
  securityAuditLog = {
    create: async () => ({}),
    findMany: async () => []
  };
  
  securityToken = {
    create: async () => ({}),
    findUnique: async () => null,
    findMany: async () => [],
    update: async () => ({})
  };
  
  revokedToken = {
    create: async () => ({}),
    findUnique: async () => null,
    findMany: async () => []
  };
  
  benefitRanking = {
    create: async () => ({}),
    createMany: async () => ({ count: 0 }),
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
    findUnique: async () => null,
    update: async () => ({})
  };
  
  // Mock the $queryRaw method for testing database connectivity
  $queryRaw = (async (..._args: any[]) => {
    return [{ result: 2 }];
  }) as any;
};

// Determine if we should use mock database or real Prisma
// Use environment variables to control this behavior
const useMockDb = process.env.NODE_ENV === 'development' && 
                 process.env.USE_MOCK_DB === 'true';

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
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
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

// Export the appropriate database client
export const db = useMockDb ? new MockDB() : getPrismaClient();

// Gracefully handle shutdown to clean up connections
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect();
    }
  });
}