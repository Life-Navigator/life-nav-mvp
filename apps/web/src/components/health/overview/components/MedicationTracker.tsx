'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import Link from 'next/link';
import { useMedications, type Medication as APIMedication } from '@/lib/hooks/useHealthData';

interface MedicationDisplay {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string[];
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  refillRemaining: number;
}

interface DoseLog {
  medicationId: string;
  time: string;
  taken: boolean;
  scheduled: string;
}

interface MedicationData {
  activeMedications: MedicationDisplay[];
  todaysDoses: DoseLog[];
  upcomingRefills: Array<{
    medicationName: string;
    daysRemaining: number;
  }>;
  adherenceRate: number;
}

export default function MedicationTracker() {
  // Fetch real medication data using React Query
  const { data: medications, isLoading: loading } = useMedications({
    status: 'active',
  });

  // Transform API data to component format
  const data = useMemo<MedicationData | null>(() => {
    if (!medications || medications.length === 0) {
      return null;
    }

    const activeMedications: MedicationDisplay[] = medications.map((med) => ({
      id: med.id,
      name: med.medication_name,
      dosage: med.dosage || 'N/A',
      frequency: med.frequency || 'As directed',
      timeOfDay: med.reminder_times?.map(t => t.toString()) || ['Morning'],
      prescribedBy: med.prescribed_by || 'Unknown',
      startDate: med.start_date,
      endDate: med.end_date || undefined,
      notes: med.notes || undefined,
      refillRemaining: med.next_refill_date
        ? Math.max(0, Math.ceil((new Date(med.next_refill_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 30,
    }));

    // Calculate upcoming refills (medications needing refill in 14 days)
    const upcomingRefills = activeMedications
      .filter(med => med.refillRemaining <= 14)
      .map(med => ({
        medicationName: med.name,
        daysRemaining: med.refillRemaining,
      }));

    // For now, todaysDoses is empty - would need a separate dose tracking system
    const todaysDoses: DoseLog[] = [];

    // Adherence rate - placeholder calculation (would need dose log data)
    const adherenceRate = 95;

    return {
      activeMedications,
      todaysDoses,
      upcomingRefills,
      adherenceRate,
    };
  }, [medications]);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Medication Tracker</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading medication data...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Medication Tracker</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💊</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Medications Tracked
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add your medications to track dosages, set reminders, and manage refills all in one place.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/integrations">
              <Button variant="default">Connect Device</Button>
            </Link>
            <Button variant="outline">Add Medication</Button>
          </div>
        </div>
      </Card>
    );
  }

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 dark:text-green-400';
    if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Medication Tracker</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Medications</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {data.activeMedications.length}
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Adherence Rate</p>
          <p className={`text-3xl font-bold ${getAdherenceColor(data.adherenceRate)}`}>
            {data.adherenceRate}%
          </p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Upcoming Refills</p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {data.upcomingRefills.length}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Today's Doses</h3>
        <div className="space-y-3">
          {data.todaysDoses.map((dose, index) => {
            const medication = data.activeMedications.find(m => m.id === dose.medicationId);
            return (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  dose.taken
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    dose.taken ? 'bg-green-200 dark:bg-green-800' : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    {dose.taken ? '✓' : '💊'}
                  </div>
                  <div>
                    <p className="font-medium">{medication?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {medication?.dosage} " Scheduled: {dose.scheduled}
                    </p>
                  </div>
                </div>
                {!dose.taken && (
                  <Button size="sm" variant="outline">
                    Mark Taken
                  </Button>
                )}
                {dose.taken && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Taken at {dose.time}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Active Medications</h3>
        <div className="space-y-3">
          {data.activeMedications.map((med) => (
            <div
              key={med.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-lg">{med.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{med.dosage}</p>
                </div>
                {med.refillRemaining <= 7 && (
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded">
                    Refill Soon
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Frequency</p>
                  <p className="font-medium">{med.frequency}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Times</p>
                  <p className="font-medium">{med.timeOfDay.join(', ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Prescribed By</p>
                  <p className="font-medium">{med.prescribedBy}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Refills Remaining</p>
                  <p className="font-medium">{med.refillRemaining}</p>
                </div>
              </div>

              {med.notes && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                  <p className="text-blue-900 dark:text-blue-100">{med.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.upcomingRefills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Refill Reminders</h3>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            {data.upcomingRefills.map((refill, index) => (
              <div key={index} className="flex justify-between items-center py-2">
                <span className="font-medium text-orange-900 dark:text-orange-100">
                  {refill.medicationName}
                </span>
                <span className="text-sm text-orange-700 dark:text-orange-300">
                  {refill.daysRemaining} days remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline">Add Medication</Button>
        <Button variant="outline">View History</Button>
      </div>
    </Card>
  );
}
