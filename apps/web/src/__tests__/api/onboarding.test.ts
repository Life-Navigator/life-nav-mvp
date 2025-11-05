/**
 * @jest-environment node
 */

import { POST as riskProfileHandler } from '@/app/api/onboarding/risk-profile/route';
import { POST as completeHandler } from '@/app/api/onboarding/complete/route';
import { db as prisma } from '@/lib/db';

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    riskProfile: {
      upsert: jest.fn(),
    },
    roadmap: {
      create: jest.fn(),
    },
  },
}));

// Mock NextResponse
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn((data, options) => ({
        data,
        options,
        status: options?.status || 200,
      })),
    },
  };
});

describe('Onboarding API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Risk Profile API', () => {
    it('validates userId is provided', async () => {
      // Create a mock request with missing userId
      const request = {
        json: jest.fn().mockResolvedValue({
          riskTheta: 0.5,
        }),
      } as unknown as Request;

      const response = await riskProfileHandler(request);
      
      expect(response.status).toBe(400);
      expect(response.data.error).toBe('User ID and risk theta are required');
    });

    it('validates riskTheta is provided', async () => {
      // Create a mock request with missing riskTheta
      const request = {
        json: jest.fn().mockResolvedValue({
          userId: 'test-user-id',
        }),
      } as unknown as Request;

      const response = await riskProfileHandler(request);
      
      expect(response.status).toBe(400);
      expect(response.data.error).toBe('User ID and risk theta are required');
    });

    it('checks if user exists', async () => {
      // Mock user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      const request = {
        json: jest.fn().mockResolvedValue({
          userId: 'non-existent-user',
          riskTheta: 0.5,
        }),
      } as unknown as Request;

      const response = await riskProfileHandler(request);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-user' },
      });
      expect(response.status).toBe(404);
      expect(response.data.error).toBe('User not found');
    });

    it('successfully saves risk profile data', async () => {
      // Mock user found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-user-id',
        name: 'Test User',
      });
      
      // Mock upsert success
      (prisma.riskProfile.upsert as jest.Mock).mockResolvedValue({
        id: 'risk-profile-id',
        userId: 'test-user-id',
        riskTheta: 0.7,
      });
      
      const riskData = {
        userId: 'test-user-id',
        riskTheta: 0.7,
        financialRiskTolerance: 0.8,
        careerRiskTolerance: 0.6,
        healthRiskTolerance: 0.5,
        educationRiskTolerance: 0.7,
        assessmentResponses: { question1: 4, question2: 3 },
      };
      
      const request = {
        json: jest.fn().mockResolvedValue(riskData),
      } as unknown as Request;

      const response = await riskProfileHandler(request);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
      });
      
      expect(prisma.riskProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        create: riskData,
        update: riskData,
      });
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Risk profile saved successfully');
    });
  });

  describe('Complete Onboarding API', () => {
    it('validates userId is provided', async () => {
      // Create a mock request with missing userId
      const request = {
        json: jest.fn().mockResolvedValue({}),
      } as unknown as Request;

      const response = await completeHandler(request);
      
      expect(response.status).toBe(400);
      expect(response.data.error).toBe('User ID is required');
    });

    it('checks if user exists', async () => {
      // Mock user not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      const request = {
        json: jest.fn().mockResolvedValue({
          userId: 'non-existent-user',
        }),
      } as unknown as Request;

      const response = await completeHandler(request);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-user' },
      });
      expect(response.status).toBe(404);
      expect(response.data.error).toBe('User not found');
    });

    it('successfully completes onboarding', async () => {
      // Mock user found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-user-id',
        name: 'Test User',
      });
      
      // Mock update success
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'test-user-id',
        setupCompleted: true,
      });
      
      // Mock roadmap creation success
      (prisma.roadmap.create as jest.Mock).mockResolvedValue({
        id: 'roadmap-id',
        userId: 'test-user-id',
      });
      
      const request = {
        json: jest.fn().mockResolvedValue({
          userId: 'test-user-id',
        }),
      } as unknown as Request;

      const response = await completeHandler(request);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
      });
      
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: { setupCompleted: true },
      });
      
      // Should create 4 roadmaps (one for each domain)
      expect(prisma.roadmap.create).toHaveBeenCalledTimes(4);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Onboarding completed successfully');
    });
  });
});