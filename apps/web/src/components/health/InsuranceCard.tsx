"use client";

import React, { useState } from 'react';

export interface HealthInsurance {
  id: string;
  insuranceType: 'health' | 'dental' | 'vision' | 'life' | 'disability';
  carrierName: string;
  carrierLogo?: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  binNumber?: string;
  pcnNumber?: string;
  coverageType?: string;
  effectiveDate: string;
  terminationDate?: string;
  monthlyPremium?: number;
  deductibleIndividual?: number;
  deductibleFamily?: number;
  outOfPocketMaxIndividual?: number;
  outOfPocketMaxFamily?: number;
  copayPrimaryCare?: number;
  copaySpecialist?: number;
  copayUrgentCare?: number;
  copayEmergencyRoom?: number;
  networkType?: string;
  inNetwork: boolean;
  primaryCarePhysician?: string;
  pcpPhone?: string;
  customerServicePhone?: string;
  claimsAddress?: string;
  websiteUrl?: string;
  policyNumber?: string;
  employer?: string;
  dependents?: any[];
  frontCardImage?: string;
  backCardImage?: string;
  notes?: string;
  isActive: boolean;
}

interface InsuranceCardProps {
  insurance: HealthInsurance;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export default function InsuranceCard({
  insurance,
  onEdit,
  onDelete,
  showActions = true,
}: InsuranceCardProps) {
  const [showBack, setShowBack] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'health':
        return 'from-blue-500 to-blue-700';
      case 'dental':
        return 'from-teal-500 to-teal-700';
      case 'vision':
        return 'from-purple-500 to-purple-700';
      case 'life':
        return 'from-green-500 to-green-700';
      case 'disability':
        return 'from-orange-500 to-orange-700';
      default:
        return 'from-gray-500 to-gray-700';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Digital Insurance Card */}
      <div className="relative">
        <div
          className="relative w-full aspect-[1.586/1] max-w-[500px] mx-auto cursor-pointer perspective-1000"
          onClick={() => setShowBack(!showBack)}
        >
          <div
            className={`absolute inset-0 transition-all duration-500 transform-style-3d ${
              showBack ? 'rotate-y-180' : ''
            }`}
          >
            {/* Front of Card */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${getTypeColor(
                insurance.insuranceType
              )} rounded-xl shadow-2xl p-6 text-white backface-hidden`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold">{insurance.carrierName}</h3>
                  <p className="text-sm opacity-90">{insurance.planName}</p>
                </div>
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold">
                    {insurance.carrierName.charAt(0)}
                  </span>
                </div>
              </div>

              {/* Member Information */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs opacity-75">Member ID</p>
                  <p className="text-lg font-mono font-semibold">
                    {insurance.memberId}
                  </p>
                </div>
                {insurance.groupNumber && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs opacity-75">Group #</p>
                      <p className="text-sm font-mono">{insurance.groupNumber}</p>
                    </div>
                    {insurance.policyNumber && (
                      <div>
                        <p className="text-xs opacity-75">Policy #</p>
                        <p className="text-sm font-mono">
                          {insurance.policyNumber}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Effective Date */}
              <div className="mt-6">
                <p className="text-xs opacity-75">Effective Date</p>
                <p className="text-sm">{formatDate(insurance.effectiveDate)}</p>
              </div>

              {/* Click to Flip Indicator */}
              <div className="absolute bottom-4 right-4">
                <svg
                  className="w-6 h-6 opacity-75"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </div>

            {/* Back of Card */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${getTypeColor(
                insurance.insuranceType
              )} rounded-xl shadow-2xl p-6 text-white backface-hidden rotate-y-180`}
            >
              <h4 className="text-lg font-bold mb-4">Coverage Information</h4>

              <div className="space-y-3 text-sm">
                {/* Prescription Info */}
                {(insurance.binNumber || insurance.pcnNumber) && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-3">
                    <p className="text-xs opacity-75 mb-2">Prescription</p>
                    <div className="grid grid-cols-2 gap-2">
                      {insurance.binNumber && (
                        <div>
                          <p className="text-xs opacity-75">BIN</p>
                          <p className="font-mono">{insurance.binNumber}</p>
                        </div>
                      )}
                      {insurance.pcnNumber && (
                        <div>
                          <p className="text-xs opacity-75">PCN</p>
                          <p className="font-mono">{insurance.pcnNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                <div className="bg-white bg-opacity-10 rounded-lg p-3">
                  <p className="text-xs opacity-75 mb-2">Contact</p>
                  {insurance.customerServicePhone && (
                    <p className="mb-1">
                      Customer Service: {insurance.customerServicePhone}
                    </p>
                  )}
                  {insurance.websiteUrl && (
                    <p className="text-xs truncate opacity-90">
                      {insurance.websiteUrl}
                    </p>
                  )}
                </div>

                {/* Primary Care Physician */}
                {insurance.primaryCarePhysician && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-3">
                    <p className="text-xs opacity-75 mb-1">Primary Care</p>
                    <p>{insurance.primaryCarePhysician}</p>
                    {insurance.pcpPhone && (
                      <p className="text-xs opacity-90">{insurance.pcpPhone}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Click to Flip Indicator */}
              <div className="absolute bottom-4 right-4">
                <svg
                  className="w-6 h-6 opacity-75"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
          Click card to flip
        </p>
      </div>

      {/* Coverage Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Coverage Details
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deductibles */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deductibles
            </h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Individual:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(insurance.deductibleIndividual)}
                </span>
              </div>
              {insurance.deductibleFamily && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Family:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.deductibleFamily)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Out of Pocket Max */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Out of Pocket Max
            </h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Individual:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(insurance.outOfPocketMaxIndividual)}
                </span>
              </div>
              {insurance.outOfPocketMaxFamily && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Family:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.outOfPocketMaxFamily)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Copays */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Copays
            </h5>
            <div className="space-y-1 text-sm">
              {insurance.copayPrimaryCare && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Primary Care:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.copayPrimaryCare)}
                  </span>
                </div>
              )}
              {insurance.copaySpecialist && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Specialist:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.copaySpecialist)}
                  </span>
                </div>
              )}
              {insurance.copayUrgentCare && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Urgent Care:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.copayUrgentCare)}
                  </span>
                </div>
              )}
              {insurance.copayEmergencyRoom && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Emergency:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.copayEmergencyRoom)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Plan Details */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plan Details
            </h5>
            <div className="space-y-1 text-sm">
              {insurance.networkType && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Network:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {insurance.networkType}
                  </span>
                </div>
              )}
              {insurance.monthlyPremium && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Monthly Premium:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(insurance.monthlyPremium)}
                  </span>
                </div>
              )}
              {insurance.employer && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Employer:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {insurance.employer}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {insurance.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {insurance.notes}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit Insurance
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            Download
          </button>
        </div>
      )}
    </div>
  );
}
