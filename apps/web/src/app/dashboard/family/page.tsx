'use client';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FamilyMember {
  id: string;
  firstName: string;
  lastName?: string;
  nickname?: string;
  relationship: string;
  dateOfBirth?: string;
  photoUrl?: string;
  email?: string;
  phoneNumber?: string;
  isActive: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  photoUrl?: string;
  isActive: boolean;
}

export default function FamilyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchFamilyData();
    }
  }, [session]);

  const fetchFamilyData = async () => {
    try {
      setLoading(true);
      const [membersRes, petsRes] = await Promise.all([
        fetch('/api/family/members'),
        fetch('/api/family/pets'),
      ]);

      if (!membersRes.ok || !petsRes.ok) {
        throw new Error('Failed to fetch family data');
      }

      const membersData = await membersRes.json();
      const petsData = await petsRes.json();

      setFamilyMembers(membersData.familyMembers || []);
      setPets(petsData.pets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching family data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading family information...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Family Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your family members, pets, and appointments all in one place
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Family Members</h3>
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
          </div>
          <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {familyMembers.filter((m) => m.isActive).length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active members</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pets</h3>
            <span className="text-3xl">🐾</span>
          </div>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
            {pets.filter((p) => p.isActive).length}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active pets</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-t-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Appointments</h3>
            <span className="text-3xl">📅</span>
          </div>
          <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">0</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Upcoming appointments</p>
        </div>
      </div>

      {/* Family Members Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Family Members</h2>
          <button
            onClick={() => router.push('/dashboard/family/members/new')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Member
          </button>
        </div>

        {familyMembers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <span className="text-6xl mb-4 block">👨‍👩‍👧‍👦</span>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No family members yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start by adding your family members to keep track of their information and
              appointments
            </p>
            <button
              onClick={() => router.push('/dashboard/family/members/new')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Add Your First Family Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {familyMembers.map((member) => (
              <Link
                key={member.id}
                href={`/dashboard/family/members/${member.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {member.firstName} {member.lastName}
                      {member.nickname && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          "{member.nickname}"
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {member.relationship}
                    </p>
                    {member.dateOfBirth && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Age: {getAge(member.dateOfBirth)}
                      </p>
                    )}
                    {member.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
                        {member.email}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pets Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pets</h2>
          <button
            onClick={() => router.push('/dashboard/family/pets/new')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Pet
          </button>
        </div>

        {pets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <span className="text-6xl mb-4 block">🐾</span>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No pets yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add your pets to keep track of their medical records, vet appointments, and care
              information
            </p>
            <button
              onClick={() => router.push('/dashboard/family/pets/new')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Add Your First Pet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet) => (
              <Link
                key={pet.id}
                href={`/dashboard/family/pets/${pet.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                    {pet.photoUrl ? (
                      <img
                        src={pet.photoUrl}
                        alt={pet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '🐾'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {pet.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {pet.breed || pet.species}
                    </p>
                    {pet.dateOfBirth && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Age: {getAge(pet.dateOfBirth)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Appointments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Upcoming Appointments
          </h2>
          <button
            onClick={() => router.push('/dashboard/family/appointments/new')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add Appointment
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <span className="text-6xl mb-4 block">📅</span>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No upcoming appointments
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Schedule appointments for your family members and pets to keep track of important dates
          </p>
          <button
            onClick={() => router.push('/dashboard/family/appointments/new')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Schedule First Appointment
          </button>
        </div>
      </div>
    </div>
  );
}
