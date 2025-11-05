import { useState } from 'react';
import { toast } from '@/components/ui/toaster';

interface TaxCalculationParams {
  annual_salary: number;
  filing_status: string;
  pay_frequency: string;
  state: string;
  allowances: {
    federal: number;
    state: number;
    additional: number;
    is_tax_exempt: boolean;
  };
  retirement_contributions: Array<{
    contribution_percentage: number;
    is_percentage_based: boolean;
    is_pretax: boolean;
    has_employer_match: boolean;
    employer_match_percentage: number;
    employer_match_limit: number;
  }>;
  bonuses?: number;
  other_income?: number;
}

interface RetirementComparisonParams {
  annual_salary: number;
  filing_status: string;
  pay_frequency: string;
  state: string;
  options: Array<{
    contribution_percentage: number;
    is_percentage_based: boolean;
    is_pretax: boolean;
    has_employer_match: boolean;
    employer_match_percentage: number;
    employer_match_limit: number;
  }>;
}

export function useTaxCalculator() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate tax withholding
  const calculateWithholding = async (params: TaxCalculationParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calculator/tax-withholding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate tax withholding');
      }
      
      const data = await response.json();
      setResults(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Calculation Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate optimal withholding
  const optimizeWithholding = async (params: TaxCalculationParams & { target_refund: number }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calculator/tax-withholding/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize tax withholding');
      }
      
      const data = await response.json();
      setResults(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Optimization Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Compare retirement options
  const compareRetirementOptions = async (params: RetirementComparisonParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calculator/tax-withholding/retirement-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to compare retirement options');
      }
      
      const data = await response.json();
      setResults({
        ...results,
        retirement_comparison: data.options.map((option: any) => ({
          contribution_percentage: option.contribution_percentage || 0,
          employee_contribution: option.employee_contribution || 0,
          employer_contribution: option.employer_contribution || 0,
          tax_savings: option.tax_savings || 0,
          net_pay_per_period: option.net_pay_per_period || 0,
          total_retirement_contribution: option.employee_contribution + option.employer_contribution,
        }))
      });
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Comparison Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate from ADP data
  const calculateFromADP = async (adpData: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/calculator/tax-withholding/adp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adpData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate from ADP data');
      }
      
      const data = await response.json();
      setResults(data);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "ADP Calculation Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Reset results
  const resetResults = () => {
    setResults(null);
    setError(null);
  };

  return {
    calculateWithholding,
    optimizeWithholding,
    compareRetirementOptions,
    calculateFromADP,
    resetResults,
    isLoading,
    results,
    error,
  };
}