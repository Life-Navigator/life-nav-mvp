"use client";

import React, { useState } from 'react';
import InsuranceCard, { HealthInsurance } from '@/components/health/InsuranceCard';
import { PlusIcon } from '@heroicons/react/24/outline';

// Mock data for demonstration
const mockInsuranceData: HealthInsurance[] = [
  {
    id: '1',
    insuranceType: 'health',
    carrierName: 'Blue Cross Blue Shield',
    planName: 'PPO Gold Plan',
    memberId: 'ABC123456789',
    groupNumber: 'GRP001234',
    binNumber: '610014',
    pcnNumber: 'MEDDPRIME',
    coverageType: 'family',
    effectiveDate: '2024-01-01',
    monthlyPremium: 850,
    deductibleIndividual: 2000,
    deductibleFamily: 4000,
    outOfPocketMaxIndividual: 6000,
    outOfPocketMaxFamily: 12000,
    copayPrimaryCare: 25,
    copaySpecialist: 50,
    copayUrgentCare: 75,
    copayEmergencyRoom: 250,
    networkType: 'PPO',
    inNetwork: true,
    primaryCarePhysician: 'Dr. John Smith',
    pcpPhone: '(555) 123-4567',
    customerServicePhone: '1-800-555-1234',
    websiteUrl: 'https://www.bcbs.com',
    policyNumber: 'POL987654',
    employer: 'Acme Corporation',
    notes: 'Family coverage with dental and vision riders',
    isActive: true,
  },
];

export default function InsurancePage() {
  const [insurancePolicies, setInsurancePolicies] = useState<HealthInsurance[]>(mockInsuranceData);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleEdit = (id: string) => {
    // TODO: Implement edit functionality
    console.log('Edit insurance:', id);
  };

  const handleDelete = (id: string) => {
    // TODO: Implement delete functionality
    console.log('Delete insurance:', id);
    setInsurancePolicies(insurancePolicies.filter(ins => ins.id !== id));
  };

  const handleAddNew = () => {
    setShowAddForm(true);
    // TODO: Implement add new insurance form
  };

  return (
    <div className="h-full w-full p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Health Insurance
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your insurance policies, coverage, and claims
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Insurance
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Active Policies
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {insurancePolicies.filter(p => p.isActive).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Monthly Premium
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ${insurancePolicies.reduce((sum, p) => sum + (p.monthlyPremium || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Deductible
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ${insurancePolicies.reduce((sum, p) => sum + (p.deductibleIndividual || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Open Claims
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  0
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Insurance Cards */}
        {insurancePolicies.length > 0 ? (
          <div className="space-y-8">
            {insurancePolicies.map((insurance) => (
              <InsuranceCard
                key={insurance.id}
                insurance={insurance}
                onEdit={() => handleEdit(insurance.id)}
                onDelete={() => handleDelete(insurance.id)}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Insurance Policies
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Get started by adding your first insurance policy
            </p>
            <button
              onClick={handleAddNew}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Your First Policy
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  File a Claim
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Submit a new insurance claim
                </p>
              </div>
            </div>
          </button>

          <button className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Find a Provider
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Search in-network providers
                </p>
              </div>
            </div>
          </button>

          <button className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  View Benefits
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review coverage and benefits
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
