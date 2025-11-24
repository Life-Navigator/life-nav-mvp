import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - List all resumes for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumes = await prisma.resume.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        template: true,
        isDefault: true,
        targetJobTitle: true,
        targetCompany: true,
        atsScore: true,
        status: true,
        version: true,
        aiGenerated: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    );
  }
}

// POST - Create new resume
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      template = 'modern',
      fullName,
      email,
      phone,
      location,
      linkedInUrl,
      githubUrl,
      portfolioUrl,
      websiteUrl,
      summary,
      experience,
      education,
      skills,
      certifications,
      projects,
      awards,
      publications,
      languages,
      customSections,
      targetJobTitle,
      targetJobDescription,
      targetCompany,
      keywords,
      isDefault,
    } = body;

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.resume.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Auto-populate from career profile if no data provided
    let autoData = {};
    if (!fullName || !email) {
      const [user, careerProfile] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        prisma.careerProfile.findFirst({ where: { userId } }),
      ]);

      autoData = {
        fullName: fullName || user?.name,
        email: email || user?.email,
        linkedInUrl: linkedInUrl || careerProfile?.linkedInUrl,
        githubUrl: githubUrl || careerProfile?.githubUrl,
        portfolioUrl: portfolioUrl || careerProfile?.portfolioUrl,
        websiteUrl: websiteUrl || careerProfile?.websiteUrl,
      };
    }

    const resume = await prisma.resume.create({
      data: {
        userId,
        name: name || 'My Resume',
        template,
        fullName,
        email,
        phone,
        location,
        linkedInUrl,
        githubUrl,
        portfolioUrl,
        websiteUrl,
        summary,
        experience: experience || [],
        education: education || [],
        skills: skills || {},
        certifications: certifications || [],
        projects: projects || [],
        awards: awards || [],
        publications: publications || [],
        languages: languages || [],
        customSections: customSections || [],
        targetJobTitle,
        targetJobDescription,
        targetCompany,
        keywords: keywords || [],
        isDefault: isDefault || false,
        status: 'draft',
        ...autoData,
      },
    });

    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    console.error('Error creating resume:', error);
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    );
  }
}
