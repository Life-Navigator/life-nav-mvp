/**
 * Tax domain API client
 */
import { apiClient } from './client';
import type { 
  TaxProfile,
  W4FormData,
  IncomeDetails,
  DeductionDetails,
  CreditDetails,
  WithholdingResult,
  TaxEstimate,
  FilingStatus,
  PayFrequency
} from '@/types/tax';

export const taxApi = {
  /**
   * Get tax profile for the current user
   */
  getTaxProfile: (taxYear: number = new Date().getFullYear()) => 
    apiClient.get<TaxProfile>(`/financial/tax/profile/${taxYear}`),
  
  /**
   * Save tax profile
   */
  saveTaxProfile: (data: Omit<TaxProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<TaxProfile>('/financial/tax/profile', data),
  
  /**
   * Update existing tax profile
   */
  updateTaxProfile: (id: string, data: Partial<TaxProfile>) =>
    apiClient.patch<TaxProfile>(`/financial/tax/profile/${id}`, data),
  
  /**
   * Calculate tax withholding based on W-4 and income details
   */
  calculateWithholding: (w4Data: W4FormData, incomeDetails: IncomeDetails) =>
    apiClient.post<WithholdingResult>('/financial/tax/withholding', { w4Data, incomeDetails }),
  
  /**
   * Calculate a comprehensive tax estimate
   */
  calculateTaxEstimate: (params: {
    income: IncomeDetails;
    deductions: DeductionDetails;
    credits: CreditDetails;
    filingStatus: FilingStatus;
    taxYear?: number;
    withholdingToDate?: number;
  }) =>
    apiClient.post<TaxEstimate>('/financial/tax/estimate', params),
  
  /**
   * Get tax forms available for download
   */
  getAvailableForms: (taxYear: number = new Date().getFullYear()) =>
    apiClient.get<string[]>(`/financial/tax/forms/${taxYear}`),
};