const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const user = await prisma.user.findUnique({
      where: { email: 'demo@lifenavigator.app' },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    
    console.log('✅ Connection successful!');
    console.log('User found:', user);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
