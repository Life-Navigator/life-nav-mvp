import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - List all certifications for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get certifications from completed courses with certificates
    const courseCertifications = await prisma.educationCourse.findMany({
      where: {
        userId,
        certificateEarned: true,
      },
      select: {
        id: true,
        title: true,
        provider: true,
        platform: true,
        certificateUrl: true,
        certificateDate: true,
        skills: true,
        status: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { certificateDate: 'desc' },
    });

    // Get career profile certifications (standalone certifications)
    const careerProfile = await prisma.careerProfile.findFirst({
      where: { userId },
      select: { certifications: true },
    });

    const standaloneCertifications = (careerProfile?.certifications || []).map((cert: string, index: number) => ({
      id: `standalone-${index}`,
      title: cert,
      provider: 'Unknown',
      platform: null,
      certificateUrl: null,
      certificateDate: null,
      skills: [],
      status: 'verified',
      isStandalone: true,
    }));

    // Combine and format
    const certifications = [
      ...courseCertifications.map(cert => ({
        id: cert.id,
        title: cert.title,
        provider: cert.provider,
        platform: cert.platform,
        certificateUrl: cert.certificateUrl,
        certificateDate: cert.certificateDate?.toISOString().split('T')[0],
        skills: cert.skills,
        status: cert.status,
        completedAt: cert.completedAt?.toISOString().split('T')[0],
        isStandalone: false,
        source: 'course',
      })),
      ...standaloneCertifications.map(cert => ({
        ...cert,
        source: 'profile',
      })),
    ];

    // Calculate stats
    const stats = {
      total: certifications.length,
      thisYear: certifications.filter(c => {
        if (!c.certificateDate) return false;
        return new Date(c.certificateDate).getFullYear() === new Date().getFullYear();
      }).length,
      providers: [...new Set(certifications.map(c => c.provider))].length,
      skills: [...new Set(certifications.flatMap(c => c.skills || []))].length,
    };

    return NextResponse.json({ certifications, stats });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch certifications' },
      { status: 500 }
    );
  }
}

// POST - Add a new standalone certification
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      provider,
      platform,
      certificateUrl,
      certificateDate,
      skills,
      expirationDate,
      credentialId,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Certification title is required' },
        { status: 400 }
      );
    }

    // Create as a completed course with certificate
    const certification = await prisma.educationCourse.create({
      data: {
        userId,
        title,
        provider: provider || 'Self-Study',
        platform: platform || null,
        certificateUrl: certificateUrl || null,
        certificateDate: certificateDate ? new Date(certificateDate) : new Date(),
        skills: skills || [],
        status: 'completed',
        progress: 100,
        certificateEarned: true,
        completedAt: certificateDate ? new Date(certificateDate) : new Date(),
        notes: credentialId ? `Credential ID: ${credentialId}` : null,
      },
    });

    return NextResponse.json({ certification }, { status: 201 });
  } catch (error) {
    console.error('Error creating certification:', error);
    return NextResponse.json(
      { error: 'Failed to create certification' },
      { status: 500 }
    );
  }
}
