import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo user credentials - change in production!
const DEMO_EMAIL = 'demo@lifenavigator.app';
const DEMO_PASSWORD = 'DemoUser2024!';

/**
 * Seed database with initial data for development and testing
 */
async function main() {
  console.log('Starting database seeding...');
  console.log(`Demo login credentials:`);
  console.log(`  Email: ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);

  // Create a demo user with password hash
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      password: hashedPassword,
      pilotRole: 'pilot',
      pilotEnabled: true,
    },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      password: hashedPassword,
      setupCompleted: true,
      pilotRole: 'pilot',
      pilotEnabled: true,
      emailVerified: new Date(),
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

  // NOTE: Financial accounts and transactions are NOT seeded here.
  // Financial data should come from Plaid integration.
  // Users need to connect their bank accounts via Plaid to see financial data.
  // Only manual assets (like real estate) are seeded below.

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

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
      title: 'Annual Physical Checkup',
      providerName: 'Dr. Smith',
      date: lastWeek,
      description: 'Annual physical checkup - comprehensive wellness exam',
      notes: 'Everything looks good, follow up in 12 months',
    }
  });

  // Create sample education history
  await prisma.educationRecord.create({
    data: {
      userId: demoUser.id,
      type: 'degree',
      institution: 'Demo University',
      degree: 'Bachelor of Science',
      major: 'Computer Science',
      startDate: new Date('2016-09-01'),
      endDate: new Date('2020-05-30'),
      gpa: 3.8,
      status: 'completed',
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
      stage: 'technical',
      contactName: 'Jane Recruiter',
      contactEmail: 'jane@example.com',
      salary: 120000,
      location: 'San Francisco, CA',
      workType: 'remote',
      notes: 'Technical interview scheduled',
    }
  });

  console.log(`Created career profile and job application for demo user`);

  // Create sample financial goal (currentAmount will be calculated from Plaid accounts)
  await prisma.financialGoal.create({
    data: {
      userId: demoUser.id,
      name: 'Emergency Fund',
      description: 'Save 6 months of expenses for emergency fund',
      type: 'savings',
      targetAmount: 25000,
      currentAmount: 0, // Will be updated from Plaid account balances
      currency: 'USD',
      targetDate: new Date(today.getFullYear(), today.getMonth() + 6, 1),
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

  console.log(`Created asset and financial goal for demo user (financial accounts come from Plaid)`);

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