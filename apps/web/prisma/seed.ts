import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed database with initial data for development and testing
 */
async function main() {
  console.log('Starting database seeding...');

  // Create a demo user with password hash
  const hashedPassword = await bcrypt.hash('password', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      setupCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`Created demo user with ID: ${demoUser.id}`);

  // Create user preferences
  await prisma.userPreference.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      theme: 'system',
      currency: 'USD',
      language: 'en',
      timezone: 'America/New_York',
    },
  });

  // Create sample financial accounts
  const checkingAccount = await prisma.financialAccount.upsert({
    where: {
      userId_name: {
        userId: demoUser.id,
        name: 'Main Checking'
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      name: 'Main Checking',
      type: 'checking',
      institution: 'Demo Bank',
      accountNumber: '****4567',
      balance: 5829.42,
      currency: 'USD',
    },
  });

  const savingsAccount = await prisma.financialAccount.upsert({
    where: {
      userId_name: {
        userId: demoUser.id,
        name: 'Emergency Savings'
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      name: 'Emergency Savings',
      type: 'savings',
      institution: 'Demo Bank',
      accountNumber: '****7890',
      balance: 15420.65,
      currency: 'USD',
    },
  });

  const investmentAccount = await prisma.financialAccount.upsert({
    where: {
      userId_name: {
        userId: demoUser.id,
        name: 'Investment Portfolio'
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      name: 'Investment Portfolio',
      type: 'investment',
      institution: 'Demo Investments',
      balance: 103642.18,
      currency: 'USD',
    },
  });

  console.log(`Created financial accounts for demo user`);

  // Create sample transactions
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  // Checking account transactions
  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: demoUser.id,
        accountId: checkingAccount.id,
        amount: -125.43,
        description: 'Grocery Store',
        category: 'groceries',
        date: yesterday,
        type: 'expense',
        merchantName: 'Whole Foods',
      },
      {
        userId: demoUser.id,
        accountId: checkingAccount.id,
        amount: -82.15,
        description: 'Restaurant',
        category: 'dining',
        date: lastWeek,
        type: 'expense',
        merchantName: 'Local Bistro',
      },
      {
        userId: demoUser.id,
        accountId: checkingAccount.id,
        amount: 2450.00,
        description: 'Paycheck',
        category: 'income',
        date: lastWeek,
        type: 'income',
        merchantName: 'Employer',
      },
    ],
  });

  // Create sample health metrics
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(oneWeekAgo);
    date.setDate(date.getDate() + i);
    
    await prisma.healthMetric.create({
      data: {
        userId: demoUser.id,
        type: 'weight',
        value: 70.5 - (i * 0.1), // Slight decrease each day
        unit: 'kg',
        date: date,
        source: 'manual',
      }
    });

    await prisma.healthMetric.create({
      data: {
        userId: demoUser.id,
        type: 'steps',
        value: 8000 + (Math.random() * 2000), // Random steps each day
        unit: 'count',
        date: date,
        source: 'device',
        deviceId: 'fitbit-123',
      }
    });
  }

  console.log(`Created health metrics for demo user`);

  // Create sample health record
  await prisma.healthRecord.create({
    data: {
      userId: demoUser.id,
      type: 'medical_visit',
      providerName: 'Dr. Smith',
      date: lastWeek,
      description: 'Annual physical checkup',
      notes: 'Everything looks good, follow up in 12 months',
    }
  });

  // Create sample education history
  await prisma.educationRecord.create({
    data: {
      userId: demoUser.id,
      institution: 'Demo University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startDate: new Date('2016-09-01'),
      endDate: new Date('2020-05-30'),
      grade: '3.8 GPA',
    }
  });

  // Create sample ongoing course
  await prisma.educationCourse.create({
    data: {
      userId: demoUser.id,
      title: 'Advanced Machine Learning',
      provider: 'Coursera',
      url: 'https://www.coursera.org/learn/machine-learning',
      startDate: lastWeek,
      status: 'in_progress',
      progress: 35.0,
    }
  });

  console.log(`Created education records for demo user`);

  // Create sample career profile
  await prisma.careerProfile.create({
    data: {
      userId: demoUser.id,
      title: 'Software Engineer',
      company: 'Tech Company Inc.',
      industry: 'Technology',
      yearsExperience: 3,
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      jobSearchStatus: 'passive',
    }
  });

  // Create sample job application
  await prisma.jobApplication.create({
    data: {
      userId: demoUser.id,
      companyName: 'Innovative Startup',
      position: 'Senior Developer',
      applicationDate: lastWeek,
      status: 'interviewing',
      contactName: 'Jane Recruiter',
      contactEmail: 'jane@example.com',
      salary: 120000,
      location: 'San Francisco, CA',
      remote: true,
      nextStep: 'Technical Interview',
      nextStepDate: today,
    }
  });

  console.log(`Created career profile and job application for demo user`);

  // Create sample financial goal
  await prisma.financialGoal.create({
    data: {
      userId: demoUser.id,
      name: 'Emergency Fund',
      description: 'Save 6 months of expenses for emergency fund',
      targetAmount: 25000,
      currentAmount: 15420.65,
      currency: 'USD',
      deadline: new Date(today.getFullYear(), today.getMonth() + 6, 1),
      category: 'emergency',
    }
  });

  // Create sample asset
  await prisma.asset.create({
    data: {
      userId: demoUser.id,
      name: 'Primary Residence',
      type: 'real_estate',
      value: 350000,
      purchasePrice: 300000,
      currentValue: 350000,
      purchaseDate: new Date(today.getFullYear() - 3, today.getMonth(), 1),
      lastValuationDate: today,
      currency: 'USD',
    }
  });

  console.log(`Created financial goal and asset for demo user`);

  console.log('Database seeding completed successfully');
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