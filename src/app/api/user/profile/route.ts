import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile
 * Fetch user profile with comprehensive details
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

    // Fetch user with profile relation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If profile doesn't exist, create a default one
    if (!user.profile) {
      const newProfile = await prisma.userProfile.create({
        data: {
          userId: user.id,
          profileCompletion: 0,
        },
      });
      user.profile = newProfile;
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/profile
 * Update user profile information
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      // Basic user fields
      name,

      // Profile fields
      dateOfBirth,
      gender,
      phoneNumber,
      address,
      city,
      state,
      zipCode,
      country,
      maritalStatus,
      dependents,

      // Professional
      occupation,
      employer,
      industry,
      yearsOfExperience,
      educationLevel,
      skills,
      linkedInUrl,
      websiteUrl,

      // Financial
      incomeRange,
      netWorthRange,
      financialGoals,
      riskTolerance,
      retirementAge,

      // Health
      healthStatus,
      fitnessLevel,
      fitnessGoals,
      dietaryPreferences,
      medicalConditions,

      // Lifestyle
      bio,
      interests,
      hobbies,
      values,
      lifeGoals,
    } = body;

    // Update user name if provided
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    // Get or create profile
    let profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId: session.user.id,
          profileCompletion: 0,
        },
      });
    }

    // Build update data object (only include fields that were provided)
    const updateData: any = {};

    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) updateData.gender = gender;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zipCode !== undefined) updateData.zipCode = zipCode;
    if (country !== undefined) updateData.country = country;
    if (maritalStatus !== undefined) updateData.maritalStatus = maritalStatus;
    if (dependents !== undefined) updateData.dependents = dependents;

    if (occupation !== undefined) updateData.occupation = occupation;
    if (employer !== undefined) updateData.employer = employer;
    if (industry !== undefined) updateData.industry = industry;
    if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
    if (educationLevel !== undefined) updateData.educationLevel = educationLevel;
    if (skills !== undefined) updateData.skills = JSON.stringify(skills);
    if (linkedInUrl !== undefined) updateData.linkedInUrl = linkedInUrl;
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;

    if (incomeRange !== undefined) updateData.incomeRange = incomeRange;
    if (netWorthRange !== undefined) updateData.netWorthRange = netWorthRange;
    if (financialGoals !== undefined) updateData.financialGoals = JSON.stringify(financialGoals);
    if (riskTolerance !== undefined) updateData.riskTolerance = riskTolerance;
    if (retirementAge !== undefined) updateData.retirementAge = retirementAge;

    if (healthStatus !== undefined) updateData.healthStatus = healthStatus;
    if (fitnessLevel !== undefined) updateData.fitnessLevel = fitnessLevel;
    if (fitnessGoals !== undefined) updateData.fitnessGoals = JSON.stringify(fitnessGoals);
    if (dietaryPreferences !== undefined) updateData.dietaryPreferences = dietaryPreferences;
    if (medicalConditions !== undefined) updateData.medicalConditions = JSON.stringify(medicalConditions);

    if (bio !== undefined) updateData.bio = bio;
    if (interests !== undefined) updateData.interests = JSON.stringify(interests);
    if (hobbies !== undefined) updateData.hobbies = JSON.stringify(hobbies);
    if (values !== undefined) updateData.values = JSON.stringify(values);
    if (lifeGoals !== undefined) updateData.lifeGoals = JSON.stringify(lifeGoals);

    // Calculate profile completion percentage
    const profileCompletion = calculateProfileCompletion({
      ...profile,
      ...updateData,
    });
    updateData.profileCompletion = profileCompletion;

    // Update profile
    const updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    // Fetch updated user with profile
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(profile: any): number {
  const fields = [
    // Demographics (10 fields = 25%)
    profile.dateOfBirth,
    profile.gender,
    profile.phoneNumber,
    profile.city,
    profile.state,
    profile.zipCode,
    profile.country,
    profile.maritalStatus,
    profile.dependents !== null && profile.dependents !== undefined,
    profile.address,

    // Professional (8 fields = 20%)
    profile.occupation,
    profile.employer,
    profile.industry,
    profile.yearsOfExperience,
    profile.educationLevel,
    profile.skills,
    profile.linkedInUrl,
    profile.websiteUrl,

    // Financial (5 fields = 15%)
    profile.incomeRange,
    profile.netWorthRange,
    profile.financialGoals,
    profile.riskTolerance,
    profile.retirementAge,

    // Health (5 fields = 15%)
    profile.healthStatus,
    profile.fitnessLevel,
    profile.fitnessGoals,
    profile.dietaryPreferences,
    profile.medicalConditions,

    // Lifestyle (5 fields = 15%)
    profile.bio,
    profile.interests,
    profile.hobbies,
    profile.values,
    profile.lifeGoals,
  ];

  const completedFields = fields.filter(field => {
    if (typeof field === 'string') return field && field.trim().length > 0;
    if (typeof field === 'number') return true;
    if (typeof field === 'boolean') return field;
    return field !== null && field !== undefined;
  }).length;

  return Math.round((completedFields / fields.length) * 100);
}
