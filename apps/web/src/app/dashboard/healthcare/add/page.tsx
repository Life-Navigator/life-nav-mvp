'use client';

/**
 * Manual Healthcare Data Entry Page
 * Allows users to manually add health records, insurance, medications, etc.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getAuthHeaders } from '@/hooks/useAuth';

type DataType = 'insurance' | 'medication' | 'appointment' | 'vitals';

export default function AddHealthcareDataPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [dataType, setDataType] = useState<DataType>('insurance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Insurance form state
  const [insuranceData, setInsuranceData] = useState({
    provider: '',
    policyNumber: '',
    type: 'health',
    startDate: '',
    premium: '',
    deductible: '',
    coverage: '',
  });

  // Medication form state
  const [medicationData, setMedicationData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    prescribedBy: '',
    startDate: new Date().toISOString().split('T')[0],
    instructions: '',
  });

  // Appointment form state
  const [appointmentData, setAppointmentData] = useState({
    provider: '',
    type: '',
    date: '',
    time: '',
    location: '',
    notes: '',
  });

  // Vitals form state
  const [vitalsData, setVitalsData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    temperature: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      let endpoint = '';
      let body = {};

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      switch (dataType) {
        case 'insurance':
          endpoint = `${apiUrl}/api/v1/health/insurance`;
          body = {
            carrier_name: insuranceData.provider,
            policy_number: insuranceData.policyNumber,
            insurance_type: insuranceData.type,
            start_date: insuranceData.startDate,
            monthly_premium: parseFloat(insuranceData.premium || '0'),
            deductible: parseFloat(insuranceData.deductible || '0'),
            coverage_details: insuranceData.coverage,
            is_active: true,
          };
          break;
        case 'medication':
          endpoint = `${apiUrl}/api/v1/health/medications`;
          body = {
            name: medicationData.name,
            dosage: medicationData.dosage,
            frequency: medicationData.frequency,
            prescribed_by: medicationData.prescribedBy,
            start_date: medicationData.startDate,
            instructions: medicationData.instructions,
            is_active: true,
          };
          break;
        case 'appointment':
          endpoint = `${apiUrl}/api/v1/health/appointments`;
          body = appointmentData;
          break;
        case 'vitals':
          endpoint = `${apiUrl}/api/v1/health/vitals`;
          body = {
            ...vitalsData,
            weight: parseFloat(vitalsData.weight || '0'),
            height: parseFloat(vitalsData.height || '0'),
            bloodPressureSystolic: parseInt(vitalsData.bloodPressureSystolic || '0'),
            bloodPressureDiastolic: parseInt(vitalsData.bloodPressureDiastolic || '0'),
            heartRate: parseInt(vitalsData.heartRate || '0'),
            temperature: parseFloat(vitalsData.temperature || '0'),
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Success - redirect back to healthcare dashboard
        router.push('/dashboard/healthcare');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add healthcare data');
      }
    } catch (err) {
      console.error('Error adding healthcare data:', err);
      setError('Failed to add healthcare data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Add Health Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manually enter your health information
          </p>
        </div>

        {/* Data Type Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            What would you like to add?
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['insurance', 'medication', 'appointment', 'vitals'] as DataType[]).map((type) => (
              <button
                key={type}
                onClick={() => setDataType(type)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  dataType === type
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {dataType === 'insurance' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    required
                    value={insuranceData.provider}
                    onChange={(e) => setInsuranceData({ ...insuranceData, provider: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Blue Cross Blue Shield"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    required
                    value={insuranceData.policyNumber}
                    onChange={(e) => setInsuranceData({ ...insuranceData, policyNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Policy/Member ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Insurance Type
                  </label>
                  <select
                    value={insuranceData.type}
                    onChange={(e) => setInsuranceData({ ...insuranceData, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="health">Health</option>
                    <option value="dental">Dental</option>
                    <option value="vision">Vision</option>
                    <option value="life">Life</option>
                    <option value="disability">Disability</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Monthly Premium
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={insuranceData.premium}
                      onChange={(e) => setInsuranceData({ ...insuranceData, premium: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deductible
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={insuranceData.deductible}
                      onChange={(e) => setInsuranceData({ ...insuranceData, deductible: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Coverage Details
                  </label>
                  <textarea
                    value={insuranceData.coverage}
                    onChange={(e) => setInsuranceData({ ...insuranceData, coverage: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="Describe what's covered..."
                  />
                </div>
              </>
            )}

            {dataType === 'medication' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Medication Name
                  </label>
                  <input
                    type="text"
                    required
                    value={medicationData.name}
                    onChange={(e) => setMedicationData({ ...medicationData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Aspirin"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dosage
                    </label>
                    <input
                      type="text"
                      required
                      value={medicationData.dosage}
                      onChange={(e) => setMedicationData({ ...medicationData, dosage: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., 100mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Frequency
                    </label>
                    <input
                      type="text"
                      required
                      value={medicationData.frequency}
                      onChange={(e) => setMedicationData({ ...medicationData, frequency: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Once daily"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prescribed By
                  </label>
                  <input
                    type="text"
                    value={medicationData.prescribedBy}
                    onChange={(e) => setMedicationData({ ...medicationData, prescribedBy: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Doctor's name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instructions
                  </label>
                  <textarea
                    value={medicationData.instructions}
                    onChange={(e) => setMedicationData({ ...medicationData, instructions: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="Special instructions..."
                  />
                </div>
              </>
            )}

            {dataType === 'appointment' && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  Appointment scheduling coming soon. For now, use your healthcare provider's portal.
                </p>
              </div>
            )}

            {dataType === 'vitals' && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  Vitals tracking coming soon. For now, connect Apple Health or Google Fit for automatic tracking.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || dataType === 'appointment' || dataType === 'vitals'}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Data'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
