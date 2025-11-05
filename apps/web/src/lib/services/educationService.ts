import { db as prisma } from "@/lib/db";

// Education record types
export interface CreateEducationRecordInput {
  userId: string;
  highestDegree?: string;
  fieldOfStudy?: string;
  institution?: string;
}

export interface UpdateEducationRecordInput {
  highestDegree?: string;
  fieldOfStudy?: string;
  institution?: string;
}

// Course types
export interface CreateCourseInput {
  educationRecordId: string;
  name: string;
  provider: string;
  startDate: Date;
  endDate?: Date;
  status: string;
  grade?: string;
  credits?: number;
  notes?: string;
}

export interface UpdateCourseInput {
  name?: string;
  provider?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  grade?: string;
  credits?: number;
  notes?: string;
}

// Certification types
export interface CreateCertificationInput {
  educationRecordId: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expirationDate?: Date;
  credentialId?: string;
  credentialUrl?: string;
}

export interface UpdateCertificationInput {
  name?: string;
  issuer?: string;
  issueDate?: Date;
  expirationDate?: Date;
  credentialId?: string;
  credentialUrl?: string;
}

export const educationService = {
  // Education Records
  async getEducationRecord(userId: string) {
    const record = await prisma.educationRecord.findFirst({
      where: { userId },
      include: {
        courses: {
          orderBy: { startDate: 'desc' },
        },
        certifications: {
          orderBy: { issueDate: 'desc' },
        },
      },
    });
    
    return record;
  },
  
  async createEducationRecord(data: CreateEducationRecordInput) {
    const record = await prisma.educationRecord.create({
      data,
      include: {
        courses: true,
        certifications: true,
      },
    });
    
    return record;
  },
  
  async updateEducationRecord(id: string, data: UpdateEducationRecordInput) {
    const record = await prisma.educationRecord.update({
      where: { id },
      data,
      include: {
        courses: true,
        certifications: true,
      },
    });
    
    return record;
  },
  
  // Courses
  async getCourses(educationRecordId: string) {
    const courses = await prisma.course.findMany({
      where: { educationRecordId },
      orderBy: { startDate: 'desc' },
    });
    
    return courses;
  },
  
  async getCourseById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
    });
    
    return course;
  },
  
  async createCourse(data: CreateCourseInput) {
    const course = await prisma.course.create({
      data,
    });
    
    return course;
  },
  
  async updateCourse(id: string, data: UpdateCourseInput) {
    const course = await prisma.course.update({
      where: { id },
      data,
    });
    
    return course;
  },
  
  async deleteCourse(id: string) {
    await prisma.course.delete({
      where: { id },
    });
    
    return true;
  },
  
  // Certifications
  async getCertifications(educationRecordId: string) {
    const certifications = await prisma.certification.findMany({
      where: { educationRecordId },
      orderBy: { issueDate: 'desc' },
    });
    
    return certifications;
  },
  
  async getCertificationById(id: string) {
    const certification = await prisma.certification.findUnique({
      where: { id },
    });
    
    return certification;
  },
  
  async createCertification(data: CreateCertificationInput) {
    const certification = await prisma.certification.create({
      data,
    });
    
    return certification;
  },
  
  async updateCertification(id: string, data: UpdateCertificationInput) {
    const certification = await prisma.certification.update({
      where: { id },
      data,
    });
    
    return certification;
  },
  
  async deleteCertification(id: string) {
    await prisma.certification.delete({
      where: { id },
    });
    
    return true;
  },
};