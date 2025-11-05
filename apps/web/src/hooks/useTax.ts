import { useState, useEffect } from 'react';
import { taxApi } from '@/lib/api/tax';
import type { 
  TaxProfile,
  WithholdingResult,
  TaxEstimate,
  W4FormData,
  IncomeDetails,
  DeductionDetails,
  CreditDetails,
  FilingStatus
} from '@/types/tax';

/**
 * Hook for working with tax profiles
 */
export function useTaxProfile(taxYear: number = new Date().getFullYear()) {
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch the profile on mount or when taxYear changes
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const data = await taxApi.getTaxProfile(taxYear);
        setProfile(data);
        setError(null);
      } catch (err) {
        if ((err as any).status === 404) {
          // No profile found for this year is not an error
          setProfile(null);
        } else {
          console.error('Error fetching tax profile:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch tax profile'));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [taxYear]);
  
  // Save a new profile
  const saveProfile = async (profileData: Omit<TaxProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsLoading(true);
      const data = await taxApi.saveTaxProfile(profileData);
      setProfile(data);
      setError(null);
      return { success: true, data };
    } catch (err) {
      console.error('Error saving tax profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to save tax profile'));
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update an existing profile
  const updateProfile = async (id: string, profileData: Partial<TaxProfile>) => {
    try {
      setIsLoading(true);
      const data = await taxApi.updateTaxProfile(id, profileData);
      setProfile(data);
      setError(null);
      return { success: true, data };
    } catch (err) {
      console.error('Error updating tax profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to update tax profile'));
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };
  
  return { profile, isLoading, error, saveProfile, updateProfile };
}

/**
 * Hook for tax withholding calculations
 */
export function useTaxWithholding() {
  const [result, setResult] = useState<WithholdingResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const calculateWithholding = async (w4Data: W4FormData, incomeDetails: IncomeDetails) => {
    try {
      setIsCalculating(true);
      const data = await taxApi.calculateWithholding(w4Data, incomeDetails);
      setResult(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Error calculating withholding:', err);
      setError(err instanceof Error ? err : new Error('Failed to calculate withholding'));
      return null;
    } finally {
      setIsCalculating(false);
    }
  };
  
  return { result, isCalculating, error, calculateWithholding };
}

/**
 * Hook for comprehensive tax estimates
 */
export function useTaxEstimate() {
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const calculateEstimate = async (params: {
    income: IncomeDetails;
    deductions: DeductionDetails;
    credits: CreditDetails;
    filingStatus: FilingStatus;
    taxYear?: number;
    withholdingToDate?: number;
  }) => {
    try {
      setIsCalculating(true);
      const data = await taxApi.calculateTaxEstimate(params);
      setEstimate(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Error calculating tax estimate:', err);
      setError(err instanceof Error ? err : new Error('Failed to calculate tax estimate'));
      return null;
    } finally {
      setIsCalculating(false);
    }
  };
  
  return { estimate, isCalculating, error, calculateEstimate };
}