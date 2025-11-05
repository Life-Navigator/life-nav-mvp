import { db as prisma } from "@/lib/db";

// Career record types
export interface CreateCareerRecordInput {
  userId: string;
  currentRole?: string;
  company?: string;
  industry?: string;
  yearsExperience?: number;
  salaryRange?: string;
}

export interface UpdateCareerRecordInput {
  currentRole?: string;
  company?: string;
  industry?: string;
  yearsExperience?: number;
  salaryRange?: string;
}

// Skill types
export interface CreateSkillInput {
  careerRecordId: string;
  name: string;
  proficiency: number;
  yearsExperience?: number;
}

export interface UpdateSkillInput {
  name?: string;
  proficiency?: number;
  yearsExperience?: number;
}

// Job application types
export interface CreateJobApplicationInput {
  careerRecordId: string;
  company: string;
  role: string;
  appliedDate: Date;
  status: string;
  notes?: string;
}

export interface UpdateJobApplicationInput {
  company?: string;
  role?: string;
  appliedDate?: Date;
  status?: string;
  notes?: string;
}

// Networking event types
export interface CreateNetworkingEventInput {
  careerRecordId: string;
  name: string;
  date: Date;
  location?: string;
  description?: string;
  outcome?: string;
}

export interface UpdateNetworkingEventInput {
  name?: string;
  date?: Date;
  location?: string;
  description?: string;
  outcome?: string;
}

export const careerService = {
  // Career Records
  async getCareerRecord(userId: string) {
    const record = await prisma.careerRecord.findFirst({
      where: { userId },
      include: {
        skills: true,
        jobApplications: {
          orderBy: { appliedDate: 'desc' },
        },
        networkingEvents: {
          orderBy: { date: 'desc' },
        },
      },
    });
    
    return record;
  },
  
  async createCareerRecord(data: CreateCareerRecordInput) {
    const record = await prisma.careerRecord.create({
      data,
      include: {
        skills: true,
      },
    });
    
    return record;
  },
  
  async updateCareerRecord(id: string, data: UpdateCareerRecordInput) {
    const record = await prisma.careerRecord.update({
      where: { id },
      data,
      include: {
        skills: true,
      },
    });
    
    return record;
  },
  
  // Skills
  async getSkills(careerRecordId: string) {
    const skills = await prisma.skill.findMany({
      where: { careerRecordId },
      orderBy: { proficiency: 'desc' },
    });
    
    return skills;
  },
  
  async createSkill(data: CreateSkillInput) {
    const skill = await prisma.skill.create({
      data,
    });
    
    return skill;
  },
  
  async updateSkill(id: string, data: UpdateSkillInput) {
    const skill = await prisma.skill.update({
      where: { id },
      data,
    });
    
    return skill;
  },
  
  async deleteSkill(id: string) {
    await prisma.skill.delete({
      where: { id },
    });
    
    return true;
  },
  
  // Job Applications
  async getJobApplications(careerRecordId: string) {
    const applications = await prisma.jobApplication.findMany({
      where: { careerRecordId },
      orderBy: { appliedDate: 'desc' },
    });
    
    return applications;
  },
  
  async getJobApplicationById(id: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { id },
    });
    
    return application;
  },
  
  async createJobApplication(data: CreateJobApplicationInput) {
    const application = await prisma.jobApplication.create({
      data,
    });
    
    return application;
  },
  
  async updateJobApplication(id: string, data: UpdateJobApplicationInput) {
    const application = await prisma.jobApplication.update({
      where: { id },
      data,
    });
    
    return application;
  },
  
  async deleteJobApplication(id: string) {
    await prisma.jobApplication.delete({
      where: { id },
    });
    
    return true;
  },
  
  // Networking Events
  async getNetworkingEvents(careerRecordId: string) {
    const events = await prisma.networkingEvent.findMany({
      where: { careerRecordId },
      orderBy: { date: 'desc' },
    });
    
    return events;
  },
  
  async getNetworkingEventById(id: string) {
    const event = await prisma.networkingEvent.findUnique({
      where: { id },
    });
    
    return event;
  },
  
  async createNetworkingEvent(data: CreateNetworkingEventInput) {
    const event = await prisma.networkingEvent.create({
      data,
    });
    
    return event;
  },
  
  async updateNetworkingEvent(id: string, data: UpdateNetworkingEventInput) {
    const event = await prisma.networkingEvent.update({
      where: { id },
      data,
    });
    
    return event;
  },
  
  async deleteNetworkingEvent(id: string) {
    await prisma.networkingEvent.delete({
      where: { id },
    });
    
    return true;
  },
};