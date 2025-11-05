import { useState } from 'react';
import { toast } from '@/components/ui/toaster';

interface QuickCalculationParams {
  current_age: number;
  retirement_age: number;
  current_savings: number;
  monthly_contribution: number;
  current_annual_income: number;
}

interface CalculationParams extends Record<string, any> {
  current_age: number;
  retirement_age: number;
  current_savings: number;
  current_annual_income: number;
  contribution_strategies: Array<{
    name: string;
    initial_amount: number;
    frequency: string;
    increase_type: string;
    annual_increase_amount?: number;
    annual_increase_percentage?: number;
    max_contribution_limit?: number;
    start_age?: number;
    end_age?: number;
  }>;
}

export function useRetirementCalculator() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to calculate retirement with detailed parameters
  const calculateRetirement = async (params: CalculationParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/financial/retirement-calculator/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to calculate retirement projections');
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
  
  // Function for quick calculation with simplified parameters
  const calculateQuickRetirement = async (params: QuickCalculationParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/financial/retirement-calculator/quick-calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to calculate retirement projections');
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
  
  // Function to get default growth scenarios
  const getDefaultScenarios = async () => {
    try {
      const response = await fetch('/api/financial/retirement-calculator/growth-scenarios');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get growth scenarios');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error fetching growth scenarios:', errorMessage);
      return null;
    }
  };
  
  // Function to reset results
  const resetCalculation = () => {
    setResults(null);
    setError(null);
  };

  return {
    calculateRetirement,
    calculateQuickRetirement,
    getDefaultScenarios,
    resetCalculation,
    isLoading,
    results,
    error,
  };
}