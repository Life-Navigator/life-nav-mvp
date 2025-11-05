import { db as prisma } from "@/lib/db";

// Roadmap types
export interface CreateRoadmapInput {
  userId: string;
  title: string;
  description?: string;
  domain: string;
  status: string;
}

export interface UpdateRoadmapInput {
  title?: string;
  description?: string;
  domain?: string;
  status?: string;
}

// Milestone types
export interface CreateMilestoneInput {
  roadmapId: string;
  title: string;
  description?: string;
  targetDate?: Date;
  status: string;
  priority?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: Date;
  completedDate?: Date | null;
  status?: string;
  priority?: number;
}

export const roadmapService = {
  // Roadmaps
  async getRoadmaps(userId: string) {
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId },
      include: {
        milestones: {
          orderBy: [
            { priority: 'asc' },
            { targetDate: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return roadmaps;
  },
  
  async getRoadmapsByDomain(userId: string, domain: string) {
    const roadmaps = await prisma.roadmap.findMany({
      where: { 
        userId,
        domain,
      },
      include: {
        milestones: {
          orderBy: [
            { priority: 'asc' },
            { targetDate: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return roadmaps;
  },
  
  async getRoadmapById(id: string) {
    const roadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: [
            { priority: 'asc' },
            { targetDate: 'asc' },
          ],
        },
      },
    });
    
    return roadmap;
  },
  
  async createRoadmap(data: CreateRoadmapInput) {
    const roadmap = await prisma.roadmap.create({
      data,
      include: {
        milestones: true,
      },
    });
    
    return roadmap;
  },
  
  async updateRoadmap(id: string, data: UpdateRoadmapInput) {
    const roadmap = await prisma.roadmap.update({
      where: { id },
      data,
      include: {
        milestones: true,
      },
    });
    
    return roadmap;
  },
  
  async deleteRoadmap(id: string) {
    // This will also delete all associated milestones due to the cascade setting
    await prisma.roadmap.delete({
      where: { id },
    });
    
    return true;
  },
  
  // Milestones
  async getMilestones(roadmapId: string) {
    const milestones = await prisma.milestone.findMany({
      where: { roadmapId },
      orderBy: [
        { priority: 'asc' },
        { targetDate: 'asc' },
      ],
    });
    
    return milestones;
  },
  
  async getMilestoneById(id: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id },
    });
    
    return milestone;
  },
  
  async createMilestone(data: CreateMilestoneInput) {
    const milestone = await prisma.milestone.create({
      data,
    });
    
    return milestone;
  },
  
  async updateMilestone(id: string, data: UpdateMilestoneInput) {
    const milestone = await prisma.milestone.update({
      where: { id },
      data,
    });
    
    return milestone;
  },
  
  async completeMilestone(id: string) {
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        status: 'completed',
        completedDate: new Date(),
      },
    });
    
    return milestone;
  },
  
  async deleteMilestone(id: string) {
    await prisma.milestone.delete({
      where: { id },
    });
    
    return true;
  },
};