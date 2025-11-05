'use client';

import React, { useState, useEffect } from 'react';
import SliderInput from '@/components/ui/forms/SliderInput';
import AssetAllocationSlider from '@/components/ui/forms/AssetAllocationSlider';

interface FinancialGoals {
  incomeRange?: string;
  savingsAmount?: string;
  debtAmount?: string;
  expenses?: {
    housing?: number;
    transportation?: number;
    food?: number;
    utilities?: number;
    healthcare?: number;
    entertainment?: number;
    other?: number;
  };
  shortTermGoals?: string[];
  longTermGoals?: string[];
  investmentPreferences?: string[];
  assetAllocation?: Array<{name: string, value: number, color: string}>;
  retirementAge?: string;
  financialChallenges?: string[];
  riskTolerance?: number;
}

interface FinancialQuestionnaireProps {
  data: FinancialGoals;
  onChange: (data: FinancialGoals) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function FinancialQuestionnaire({ 
  data, 
  onChange, 
  onNext, 
  onBack 
}: FinancialQuestionnaireProps) {
  // Default asset allocation
  const defaultAssetAllocation = [
    { name: 'Stocks', value: 50, color: '#4f46e5' },
    { name: 'Bonds', value: 30, color: '#10b981' },
    { name: 'Cash', value: 10, color: '#f59e0b' },
    { name: 'Real Estate', value: 5, color: '#ef4444' },
    { name: 'Alternatives', value: 5, color: '#8b5cf6' }
  ];

  const [formData, setFormData] = useState<FinancialGoals>(data || {
    expenses: {
      housing: 30,
      transportation: 15,
      food: 15,
      utilities: 10,
      healthcare: 10,
      entertainment: 10,
      other: 10
    },
    assetAllocation: defaultAssetAllocation,
    riskTolerance: 50
  });
  const [currentStep, setCurrentStep] = useState(0);

  // Update parent component when form data changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSliderChange = (name: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      expenses: {
        ...prev.expenses,
        [name]: value,
      },
    }));
  };
  
  const handleRiskToleranceChange = (name: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      riskTolerance: value
    }));
  };
  
  const handleAssetAllocationChange = (newAllocation: Array<{name: string, value: number, color: string}>) => {
    setFormData(prev => ({
      ...prev,
      assetAllocation: newAllocation
    }));
  };

  const handleMultiSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const currentValues = prev[name] || [];
      if (Array.isArray(currentValues)) {
        // Toggle selection
        if (currentValues.includes(value)) {
          return {
            ...prev,
            [name]: currentValues.filter(v => v !== value),
          };
        } else {
          return {
            ...prev,
            [name]: [...currentValues, value],
          };
        }
      }
      return prev;
    });
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      onNext();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  // Option lists for multi-select fields
  const shortTermGoalOptions = [
    'Build emergency fund',
    'Pay off high-interest debt',
    'Save for vacation',
    'Save for a major purchase',
    'Increase income',
    'Reduce expenses',
    'Start investing',
    'Improve credit score'
  ];

  const longTermGoalOptions = [
    'Save for retirement',
    'Pay off mortgage',
    'Save for children\'s education',
    'Achieve financial independence',
    'Buy a home',
    'Start a business',
    'Generate passive income',
    'Leave financial legacy'
  ];

  const investmentPreferenceOptions = [
    'Stocks/Equities',
    'Bonds/Fixed Income',
    'Real Estate',
    'Mutual Funds/ETFs',
    'Retirement Accounts (401k, IRA)',
    'Cryptocurrencies',
    'Cash/Money Market',
    'Commodities/Precious Metals',
    'ESG/Socially Responsible Investing',
    'Not interested in investing'
  ];

  const financialChallengeOptions = [
    'High debt',
    'Insufficient income',
    'High expenses',
    'Irregular income',
    'Poor spending habits',
    'Lack of financial knowledge',
    'No emergency fund',
    'Market volatility concerns',
    'Family financial obligations'
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Current Financial Status
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monthly net income range (after taxes)
                </label>
                <select
                  name="incomeRange"
                  value={formData.incomeRange || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select income range</option>
                  <option value="0-2k">$0 - $2,000</option>
                  <option value="2k-4k">$2,000 - $4,000</option>
                  <option value="4k-6k">$4,000 - $6,000</option>
                  <option value="6k-8k">$6,000 - $8,000</option>
                  <option value="8k-10k">$8,000 - $10,000</option>
                  <option value="10k-15k">$10,000 - $15,000</option>
                  <option value="15k+">$15,000+</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total savings/emergency fund
                </label>
                <select
                  name="savingsAmount"
                  value={formData.savingsAmount || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select savings amount</option>
                  <option value="0">$0 (No savings)</option>
                  <option value="0-1k">$0 - $1,000</option>
                  <option value="1k-5k">$1,000 - $5,000</option>
                  <option value="5k-10k">$5,000 - $10,000</option>
                  <option value="10k-25k">$10,000 - $25,000</option>
                  <option value="25k-50k">$25,000 - $50,000</option>
                  <option value="50k-100k">$50,000 - $100,000</option>
                  <option value="100k+">$100,000+</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total debt (excluding mortgage)
                </label>
                <select
                  name="debtAmount"
                  value={formData.debtAmount || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select debt amount</option>
                  <option value="0">$0 (No debt)</option>
                  <option value="0-1k">$0 - $1,000</option>
                  <option value="1k-5k">$1,000 - $5,000</option>
                  <option value="5k-10k">$5,000 - $10,000</option>
                  <option value="10k-25k">$10,000 - $25,000</option>
                  <option value="25k-50k">$25,000 - $50,000</option>
                  <option value="50k-100k">$50,000 - $100,000</option>
                  <option value="100k+">$100,000+</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </>
        );
      
      case 1:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Monthly Expenses & Financial Goals
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                  Monthly Expenses (drag to set percentage of income)
                </h4>
                
                <div className="mb-5">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Expense Distribution</span>
                    <span>
                      Total: {Object.values(formData.expenses || {}).reduce((sum, val) => sum + (val || 0), 0)}%
                    </span>
                  </div>
                  
                  {/* Visual representation of allocation */}
                  <div className="h-6 flex rounded-lg overflow-hidden mb-4">
                    <div style={{ width: `${formData.expenses?.housing || 0}%`, backgroundColor: '#4f46e5' }} className="h-full" title={`Housing: ${formData.expenses?.housing || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.transportation || 0}%`, backgroundColor: '#10b981' }} className="h-full" title={`Transportation: ${formData.expenses?.transportation || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.food || 0}%`, backgroundColor: '#f59e0b' }} className="h-full" title={`Food: ${formData.expenses?.food || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.utilities || 0}%`, backgroundColor: '#ec4899' }} className="h-full" title={`Utilities: ${formData.expenses?.utilities || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.healthcare || 0}%`, backgroundColor: '#ef4444' }} className="h-full" title={`Healthcare: ${formData.expenses?.healthcare || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.entertainment || 0}%`, backgroundColor: '#8b5cf6' }} className="h-full" title={`Entertainment: ${formData.expenses?.entertainment || 0}%`}></div>
                    <div style={{ width: `${formData.expenses?.other || 0}%`, backgroundColor: '#6b7280' }} className="h-full" title={`Other: ${formData.expenses?.other || 0}%`}></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SliderInput
                    name="housing"
                    label="Housing"
                    value={formData.expenses?.housing || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={60}
                  />
                  
                  <SliderInput
                    name="transportation"
                    label="Transportation"
                    value={formData.expenses?.transportation || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={30}
                  />
                  
                  <SliderInput
                    name="food"
                    label="Food"
                    value={formData.expenses?.food || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={30}
                  />
                  
                  <SliderInput
                    name="utilities"
                    label="Utilities"
                    value={formData.expenses?.utilities || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={20}
                  />
                  
                  <SliderInput
                    name="healthcare"
                    label="Healthcare"
                    value={formData.expenses?.healthcare || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={20}
                  />
                  
                  <SliderInput
                    name="entertainment"
                    label="Entertainment"
                    value={formData.expenses?.entertainment || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={20}
                  />
                  
                  <SliderInput
                    name="other"
                    label="Other"
                    value={formData.expenses?.other || 0}
                    onChange={handleSliderChange}
                    min={0}
                    max={30}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Short-term financial goals (next 1-2 years)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {shortTermGoalOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`short-term-${option}`}
                        checked={(formData.shortTermGoals || []).includes(option)}
                        onChange={() => handleMultiSelectChange('shortTermGoals', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`short-term-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Long-term financial goals (next 3-5+ years)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {longTermGoalOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`long-term-${option}`}
                        checked={(formData.longTermGoals || []).includes(option)}
                        onChange={() => handleMultiSelectChange('longTermGoals', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`long-term-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      
      case 2:
        return (
          <>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Investment Preferences and Challenges
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Investment preferences (select all that apply)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {investmentPreferenceOptions.map(option => (
                      <div key={option} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`investment-${option}`}
                          checked={(formData.investmentPreferences || []).includes(option)}
                          onChange={() => handleMultiSelectChange('investmentPreferences', option)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`investment-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-4">
                    Portfolio Allocation
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Drag to adjust your preferred investment allocation across different asset classes:
                  </p>
                  
                  <AssetAllocationSlider 
                    options={formData.assetAllocation || []}
                    onChange={handleAssetAllocationChange}
                  />
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                    Investment Risk Tolerance
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Drag to adjust your comfort level with investment risk:
                  </p>
                  
                  <SliderInput 
                    name="riskTolerance"
                    label="Risk Tolerance" 
                    value={formData.riskTolerance || 50}
                    onChange={handleRiskToleranceChange}
                    min={0}
                    max={100}
                    formatValue={(val) => {
                      if (val < 25) return `Conservative (${val}%)`;
                      if (val < 50) return `Moderate-Conservative (${val}%)`;
                      if (val < 75) return `Moderate-Aggressive (${val}%)`;
                      return `Aggressive (${val}%)`;
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target retirement age
                </label>
                <select
                  name="retirementAge"
                  value={formData.retirementAge || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select target age</option>
                  <option value="before-50">Before 50</option>
                  <option value="50-55">50-55</option>
                  <option value="55-60">55-60</option>
                  <option value="60-65">60-65</option>
                  <option value="65-70">65-70</option>
                  <option value="after-70">After 70</option>
                  <option value="not_sure">Not sure</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Current financial challenges
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {financialChallengeOptions.map(option => (
                    <div key={option} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`challenge-${option}`}
                        checked={(formData.financialChallenges || []).includes(option)}
                        onChange={() => handleMultiSelectChange('financialChallenges', option)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`challenge-${option}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Financial Goals
      </h2>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Tell us about your financial situation and goals to help create a personalized financial roadmap.
        </p>
      </div>
      
      <div className="space-y-6">
        {renderStep()}
      </div>
      
      <div className="flex justify-between pt-6">
        <button
          onClick={prevStep}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
          text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={nextStep}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
          text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
          focus:ring-blue-500 transition-colors"
        >
          {currentStep < 2 ? 'Continue' : 'Next: Health Goals'}
        </button>
      </div>
    </div>
  );
}