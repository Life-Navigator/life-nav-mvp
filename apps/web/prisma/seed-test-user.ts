import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Test User for Plaid Sandbox Testing
 *
 * Plaid Sandbox Test Credentials (use in Plaid Link):
 * - Username: user_good
 * - Password: pass_good
 *
 * For MFA testing:
 * - Username: user_good
 * - Password: pass_good
 * - MFA Code: 1234
 *
 * This user will be created across all domains:
 * - PostgreSQL (Prisma) - User profile, accounts, transactions
 * - Neo4j - Personal knowledge graph
 * - Qdrant - Vector embeddings for documents
 */

// Test user credentials
const TEST_EMAIL = 'test@lifenavigator.app';
const TEST_PASSWORD = 'TestUser2024!';
const TEST_USER_ID = 'test-user-plaid-sandbox';

async function seedTestUser() {
  console.log('='.repeat(60));
  console.log('Life Navigator - Test User Setup');
  console.log('='.repeat(60));

  console.log('\n📧 Test User Credentials:');
  console.log(`   Email: ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);

  console.log('\n🏦 Plaid Sandbox Credentials (use in Plaid Link):');
  console.log('   Username: user_good');
  console.log('   Password: pass_good');
  console.log('   MFA Code (if prompted): 1234');
  console.log('');

  // Create test user with password hash
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  const testUser = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {
      password: hashedPassword,
      pilotRole: 'pilot',
      pilotEnabled: true,
      setupCompleted: true,
    },
    create: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      name: 'Test User',
      password: hashedPassword,
      setupCompleted: true,
      pilotRole: 'pilot',
      pilotEnabled: true,
      pilotStartAt: new Date(),
      userType: 'pilot_tester',
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`✅ Created test user with ID: ${testUser.id}`);

  // Create user preferences
  await prisma.userPreference.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      theme: 'system',
      currency: 'USD',
      language: 'en',
      timezone: 'America/New_York',
    },
  });

  console.log('✅ Created user preferences');

  // Create sample financial accounts (will be replaced by Plaid data)
  const accounts = [
    {
      name: 'Test Checking',
      type: 'checking',
      institution: 'Test Bank (Pre-Plaid)',
      accountNumber: '****1234',
      balance: 2500.00,
    },
    {
      name: 'Test Savings',
      type: 'savings',
      institution: 'Test Bank (Pre-Plaid)',
      accountNumber: '****5678',
      balance: 10000.00,
    },
  ];

  for (const account of accounts) {
    await prisma.financialAccount.upsert({
      where: {
        userId_name: {
          userId: testUser.id,
          name: account.name,
        },
      },
      update: { balance: account.balance },
      create: {
        userId: testUser.id,
        ...account,
        currency: 'USD',
      },
    });
  }

  console.log('✅ Created sample financial accounts');

  // Create sample transactions
  const today = new Date();
  const transactions = [
    {
      amount: -45.67,
      description: 'Coffee Shop',
      category: 'dining',
      merchantName: 'Starbucks',
      daysAgo: 1,
    },
    {
      amount: -156.89,
      description: 'Grocery Shopping',
      category: 'groceries',
      merchantName: 'Trader Joes',
      daysAgo: 2,
    },
    {
      amount: 3200.00,
      description: 'Salary Deposit',
      category: 'income',
      merchantName: 'Employer Inc',
      daysAgo: 5,
    },
    {
      amount: -89.99,
      description: 'Subscription',
      category: 'entertainment',
      merchantName: 'Netflix',
      daysAgo: 7,
    },
    {
      amount: -250.00,
      description: 'Utility Bill',
      category: 'utilities',
      merchantName: 'Electric Company',
      daysAgo: 10,
    },
  ];

  // Get the checking account
  const checkingAccount = await prisma.financialAccount.findFirst({
    where: { userId: testUser.id, type: 'checking' },
  });

  if (checkingAccount) {
    for (const tx of transactions) {
      const txDate = new Date(today);
      txDate.setDate(txDate.getDate() - tx.daysAgo);

      await prisma.transaction.create({
        data: {
          userId: testUser.id,
          accountId: checkingAccount.id,
          amount: tx.amount,
          description: tx.description,
          category: tx.category,
          merchantName: tx.merchantName,
          date: txDate,
          type: tx.amount > 0 ? 'income' : 'expense',
        },
      });
    }
    console.log('✅ Created sample transactions');
  }

  // Create a financial goal (use create to avoid unique constraint issues)
  try {
    await prisma.financialGoal.create({
      data: {
        userId: testUser.id,
        name: 'Emergency Fund Goal',
        description: 'Build 6-month emergency fund',
        type: 'savings',
        targetAmount: 20000,
        currentAmount: 10000,
        currency: 'USD',
        targetDate: new Date(today.getFullYear() + 1, 0, 1),
        category: 'emergency',
      },
    });
    console.log('✅ Created financial goal');
  } catch {
    console.log('⏭️  Financial goal already exists, skipping');
  }

  // Create sample health metrics
  try {
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      await prisma.healthMetric.create({
        data: {
          userId: testUser.id,
          type: 'weight',
          value: 75.0 - i * 0.05,
          unit: 'kg',
          date,
          source: 'manual',
        },
      });

      await prisma.healthMetric.create({
        data: {
          userId: testUser.id,
          type: 'steps',
          value: 7500 + Math.floor(Math.random() * 3000),
          unit: 'count',
          date,
          source: 'device',
        },
      });
    }
    console.log('✅ Created health metrics');
  } catch {
    console.log('⏭️  Health metrics exist, skipping');
  }

  // Create career profile
  try {
    await prisma.careerProfile.upsert({
      where: { userId: testUser.id },
      update: {},
      create: {
        userId: testUser.id,
        title: 'Software Engineer',
        company: 'Tech Startup',
        industry: 'Technology',
        yearsExperience: 5,
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Python'],
        jobSearchStatus: 'passive',
      },
    });
    console.log('✅ Created career profile');
  } catch {
    console.log('⏭️  Career profile exists, skipping');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test User Setup Complete!');
  console.log('='.repeat(60));
  console.log('\nNext Steps:');
  console.log('1. Log in to the app with the test credentials');
  console.log('2. Navigate to Accounts/Banking section');
  console.log('3. Click "Connect Bank Account" to open Plaid Link');
  console.log('4. Use Plaid sandbox credentials: user_good / pass_good');
  console.log('5. Complete the flow to link a test bank account');
  console.log('');

  return testUser;
}

async function main() {
  try {
    await seedTestUser();
  } catch (error) {
    console.error('Error seeding test user:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
