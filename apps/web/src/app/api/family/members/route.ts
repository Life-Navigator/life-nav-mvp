import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for family member creation
const createFamilyMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional().nullable(),
  nickname: z.string().max(100).optional().nullable(),
  relationship: z.string().min(1, 'Relationship is required'),
  gender: z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  bloodType: z.string().max(10).optional().nullable(),
  allergies: z.string().max(1000).optional().nullable(),
  medications: z.string().max(1000).optional().nullable(),
  medicalNotes: z.string().max(1000).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  employer: z.string().max(200).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  photoUrl: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  favoriteThings: z.string().max(1000).optional().nullable(),
  isDependent: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/family/members
 * Get all family members for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // userId already extracted from JWT

    // Get filter parameters
    const searchParams = request.nextUrl.searchParams;
    const relationship = searchParams.get('relationship');
    const isActive = searchParams.get('isActive');

    // Build where clause
    const where: any = {
      userId,
    };

    if (relationship) {
      where.relationship = relationship;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const familyMembers = await db.familyMember.findMany({
      where,
      orderBy: [
        { isPrimary: 'desc' },
        { relationship: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return NextResponse.json({
      familyMembers,
      count: familyMembers.length,
    });

  } catch (error) {
    console.error('Error fetching family members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/family/members
 * Create a new family member
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // userId already extracted from JWT
    const body = await request.json();

    // Validate request body with Zod schema
    const validatedData = createFamilyMemberSchema.parse(body);

    // Prepare data for database insertion
    const data: any = {
      userId,
      ...validatedData,
      dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
    };

    const familyMember = await db.familyMember.create({
      data,
    });

    return NextResponse.json(familyMember, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating family member:', error);
    return NextResponse.json(
      { error: 'Failed to create family member' },
      { status: 500 }
    );
  }
}
