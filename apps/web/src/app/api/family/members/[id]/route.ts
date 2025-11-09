import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db } from '@/lib/db';

/**
 * GET /api/family/members/[id]
 * Get a single family member by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // userId already extracted from JWT
    const { id } = params;

    const familyMember = await db.familyMember.findUnique({
      where: {
        id,
        userId, // Ensure user owns this family member
      },
      include: {
        appointments: {
          orderBy: {
            appointmentDate: 'asc',
          },
          take: 10, // Get next 10 appointments
        },
      },
    });

    if (!familyMember) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(familyMember);

  } catch (error) {
    console.error('Error fetching family member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family member' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/family/members/[id]
 * Update a family member
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // userId already extracted from JWT
    const { id } = params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.familyMember.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    // Build update data
    const data: any = {};

    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.nickname !== undefined) data.nickname = body.nickname;
    if (body.relationship !== undefined) data.relationship = body.relationship;
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.email !== undefined) data.email = body.email;
    if (body.phoneNumber !== undefined) data.phoneNumber = body.phoneNumber;
    if (body.address !== undefined) data.address = body.address;
    if (body.city !== undefined) data.city = body.city;
    if (body.state !== undefined) data.state = body.state;
    if (body.zipCode !== undefined) data.zipCode = body.zipCode;
    if (body.country !== undefined) data.country = body.country;
    if (body.bloodType !== undefined) data.bloodType = body.bloodType;
    if (body.allergies !== undefined) data.allergies = body.allergies;
    if (body.medications !== undefined) data.medications = body.medications;
    if (body.medicalNotes !== undefined) data.medicalNotes = body.medicalNotes;
    if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact;
    if (body.emergencyPhone !== undefined) data.emergencyPhone = body.emergencyPhone;
    if (body.occupation !== undefined) data.occupation = body.occupation;
    if (body.employer !== undefined) data.employer = body.employer;
    if (body.school !== undefined) data.school = body.school;
    if (body.grade !== undefined) data.grade = body.grade;
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.favoriteThings !== undefined) data.favoriteThings = body.favoriteThings;
    if (body.isDependent !== undefined) data.isDependent = body.isDependent;
    if (body.isEmergencyContact !== undefined) data.isEmergencyContact = body.isEmergencyContact;
    if (body.isPrimary !== undefined) data.isPrimary = body.isPrimary;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.dateOfBirth !== undefined) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }

    const updatedFamilyMember = await db.familyMember.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedFamilyMember);

  } catch (error) {
    console.error('Error updating family member:', error);
    return NextResponse.json(
      { error: 'Failed to update family member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/family/members/[id]
 * Delete a family member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // userId already extracted from JWT
    const { id } = params;

    // Verify ownership
    const existing = await db.familyMember.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Family member not found' },
        { status: 404 }
      );
    }

    // Delete (cascade will delete related appointments)
    await db.familyMember.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Family member deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting family member:', error);
    return NextResponse.json(
      { error: 'Failed to delete family member' },
      { status: 500 }
    );
  }
}
