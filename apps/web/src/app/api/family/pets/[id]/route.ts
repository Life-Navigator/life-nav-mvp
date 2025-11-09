import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db } from '@/lib/db';

/**
 * GET /api/family/pets/[id]
 * Get a single pet by ID
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

    const pet = await db.pet.findUnique({
      where: {
        id,
        userId,
      },
      include: {
        appointments: {
          orderBy: {
            appointmentDate: 'asc',
          },
          take: 10,
        },
      },
    });

    if (!pet) {
      return NextResponse.json(
        { error: 'Pet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(pet);

  } catch (error) {
    console.error('Error fetching pet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pet' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/family/pets/[id]
 * Update a pet
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
    const existing = await db.pet.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pet not found' },
        { status: 404 }
      );
    }

    // Build update data
    const data: any = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.species !== undefined) data.species = body.species;
    if (body.breed !== undefined) data.breed = body.breed;
    if (body.color !== undefined) data.color = body.color;
    if (body.gender !== undefined) data.gender = body.gender;
    if (body.age !== undefined) data.age = body.age;
    if (body.weight !== undefined) data.weight = body.weight;
    if (body.weightUnit !== undefined) data.weightUnit = body.weightUnit;
    if (body.microchipNumber !== undefined) data.microchipNumber = body.microchipNumber;
    if (body.vetName !== undefined) data.vetName = body.vetName;
    if (body.vetPhone !== undefined) data.vetPhone = body.vetPhone;
    if (body.vetEmail !== undefined) data.vetEmail = body.vetEmail;
    if (body.vetAddress !== undefined) data.vetAddress = body.vetAddress;
    if (body.allergies !== undefined) data.allergies = body.allergies;
    if (body.medications !== undefined) data.medications = body.medications;
    if (body.medicalConditions !== undefined) data.medicalConditions = body.medicalConditions;
    if (body.medicalNotes !== undefined) data.medicalNotes = body.medicalNotes;
    if (body.feedingSchedule !== undefined) data.feedingSchedule = body.feedingSchedule;
    if (body.exerciseNeeds !== undefined) data.exerciseNeeds = body.exerciseNeeds;
    if (body.specialNeeds !== undefined) data.specialNeeds = body.specialNeeds;
    if (body.behaviorNotes !== undefined) data.behaviorNotes = body.behaviorNotes;
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl;
    if (body.photos !== undefined) data.photos = body.photos;
    if (body.insuranceProvider !== undefined) data.insuranceProvider = body.insuranceProvider;
    if (body.insurancePolicyNumber !== undefined) data.insurancePolicyNumber = body.insurancePolicyNumber;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.isServiceAnimal !== undefined) data.isServiceAnimal = body.isServiceAnimal;

    if (body.dateOfBirth !== undefined) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }

    if (body.adoptionDate !== undefined) {
      data.adoptionDate = body.adoptionDate ? new Date(body.adoptionDate) : null;
    }

    const updatedPet = await db.pet.update({
      where: { id },
      data,
    });

    return NextResponse.json(updatedPet);

  } catch (error) {
    console.error('Error updating pet:', error);
    return NextResponse.json(
      { error: 'Failed to update pet' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/family/pets/[id]
 * Delete a pet
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
    const existing = await db.pet.findUnique({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pet not found' },
        { status: 404 }
      );
    }

    await db.pet.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Pet deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting pet:', error);
    return NextResponse.json(
      { error: 'Failed to delete pet' },
      { status: 500 }
    );
  }
}
