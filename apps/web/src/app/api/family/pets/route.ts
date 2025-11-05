import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

/**
 * GET /api/family/pets
 * Get all pets for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get filter parameters
    const searchParams = request.nextUrl.searchParams;
    const species = searchParams.get('species');
    const isActive = searchParams.get('isActive');

    // Build where clause
    const where: any = {
      userId,
    };

    if (species) {
      where.species = species;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const pets = await db.pet.findMany({
      where,
      orderBy: [
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      pets,
      count: pets.length,
    });

  } catch (error) {
    console.error('Error fetching pets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/family/pets
 * Create a new pet
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Pet name is required' },
        { status: 400 }
      );
    }

    if (!body.species) {
      return NextResponse.json(
        { error: 'Species is required' },
        { status: 400 }
      );
    }

    // Build data object
    const data: any = {
      userId,
      name: body.name,
      species: body.species,
      breed: body.breed,
      color: body.color,
      gender: body.gender,
      age: body.age,
      weight: body.weight,
      weightUnit: body.weightUnit || 'lbs',
      microchipNumber: body.microchipNumber,
      vetName: body.vetName,
      vetPhone: body.vetPhone,
      vetEmail: body.vetEmail,
      vetAddress: body.vetAddress,
      allergies: body.allergies,
      medications: body.medications,
      medicalConditions: body.medicalConditions,
      medicalNotes: body.medicalNotes,
      feedingSchedule: body.feedingSchedule,
      exerciseNeeds: body.exerciseNeeds,
      specialNeeds: body.specialNeeds,
      behaviorNotes: body.behaviorNotes,
      photoUrl: body.photoUrl,
      photos: body.photos || [],
      insuranceProvider: body.insuranceProvider,
      insurancePolicyNumber: body.insurancePolicyNumber,
      notes: body.notes,
      isActive: body.isActive !== false,
      isServiceAnimal: body.isServiceAnimal || false,
    };

    if (body.dateOfBirth) {
      data.dateOfBirth = new Date(body.dateOfBirth);
    }

    if (body.adoptionDate) {
      data.adoptionDate = new Date(body.adoptionDate);
    }

    const pet = await db.pet.create({
      data,
    });

    return NextResponse.json(pet, { status: 201 });

  } catch (error) {
    console.error('Error creating pet:', error);
    return NextResponse.json(
      { error: 'Failed to create pet' },
      { status: 500 }
    );
  }
}
