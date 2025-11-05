'use client';

import React, { useState, useEffect } from 'react';

interface RiskAssessmentData {
  riskTheta: number;
  responses?: any;
  financialRiskTolerance?: number;
  careerRiskTolerance?: number;
  healthRiskTolerance?: number;
  educationRiskTolerance?: number;
}

interface RiskAssessmentProps {
  data: RiskAssessmentData;
  onChange: (data: RiskAssessmentData) => void;
  onNext: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

// More accurate risk calculation with domain-specific weighting
const calculateRiskScore = (responses: number[], defaultValue: number = 0.5) => {
  if (!responses.length) return defaultValue;
  
  // Normalize to 0-1 scale from 1-5 scale
  return (responses.reduce((sum, val) => sum + val, 0) / responses.length - 1) / 4;
};

export default function RiskAssessment({ 
  data, 
  onChange, 
  onNext, 
  onBack,
  isSubmitting
}: RiskAssessmentProps) {
  const [formData, setFormData] = useState<RiskAssessmentData>(data || {
    riskTheta: 0.5, // Default to moderate risk
    responses: {},
    financialRiskTolerance: 0.5,
    careerRiskTolerance: 0.5,
    healthRiskTolerance: 0.5,
    educationRiskTolerance: 0.5,
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  
  // Pre-defined risk assessment questions
  const questions = [
    {
      id: 'investment_loss',
      text: 'How would you respond if your investment portfolio lost 20% of its value in one month?',
      options: [
        { value: 1, text: 'Sell everything immediately to prevent further losses' },
        { value: 2, text: 'Sell some investments to reduce risk' },
        { value: 3, text: 'Do nothing and wait for recovery' },
        { value: 4, text: 'Buy more at the lower prices' },
        { value: 5, text: 'Significantly increase investments to capitalize on the situation' },
      ],
      domain: 'financial'
    },
    {
      id: 'career_change',
      text: 'How comfortable would you be changing career paths, even if it meant temporarily lower income?',
      options: [
        { value: 1, text: 'Very uncomfortable - I strongly prefer career stability' },
        { value: 2, text: 'Somewhat uncomfortable - I would only change for a sure thing' },
        { value: 3, text: 'Neutral - I would consider it if the opportunity seemed good' },
        { value: 4, text: 'Comfortable - I value growth over stability' },
        { value: 5, text: 'Very comfortable - I embrace change and new opportunities' },
      ],
      domain: 'career'
    },
    {
      id: 'medical_treatment',
      text: 'When facing a medical decision with multiple treatment options, you prefer:',
      options: [
        { value: 1, text: 'The safest option with fewest side effects, even if less effective' },
        { value: 2, text: 'A low-risk approach with proven results' },
        { value: 3, text: 'A balanced approach of moderate risk and moderate reward' },
        { value: 4, text: 'A newer treatment with potentially better outcomes but less data' },
        { value: 5, text: 'The most aggressive treatment with highest potential benefit, despite risks' },
      ],
      domain: 'health'
    },
    {
      id: 'education_investment',
      text: 'When considering further education or training, you would:',
      options: [
        { value: 1, text: 'Only pursue free or low-cost options with guaranteed outcomes' },
        { value: 2, text: 'Invest minimally in established programs with clear returns' },
        { value: 3, text: 'Invest moderately in programs with good track records' },
        { value: 4, text: 'Invest significantly in promising but unproven programs' },
        { value: 5, text: 'Invest heavily in cutting-edge education regardless of risk' },
      ],
      domain: 'education'
    },
    {
      id: 'entrepreneurship',
      text: 'How do you feel about entrepreneurship versus traditional employment?',
      options: [
        { value: 1, text: 'Strong preference for stable employment with fixed salary' },
        { value: 2, text: 'Prefer employment but open to side projects with minimal risk' },
        { value: 3, text: 'Equal interest in both paths, depending on circumstances' },
        { value: 4, text: 'Prefer entrepreneurship with calculated risks' },
        { value: 5, text: 'Strongly prefer entrepreneurship despite significant uncertainties' },
      ],
      domain: 'career'
    },
    {
      id: 'retirement_savings',
      text: 'How would you allocate your retirement savings?',
      options: [
        { value: 1, text: 'Almost entirely in low-risk options (bonds, CDs, etc.)' },
        { value: 2, text: 'Mostly low-risk with some moderate-risk investments' },
        { value: 3, text: 'Balanced mix of low, moderate, and higher-risk investments' },
        { value: 4, text: 'Primarily growth-oriented investments with some stability' },
        { value: 5, text: 'Aggressive growth investments, accepting significant volatility' },
      ],
      domain: 'financial'
    },
    {
      id: 'preventive_health',
      text: 'Regarding preventive health measures (screenings, checkups, etc.), you are:',
      options: [
        { value: 1, text: 'Extremely diligent, following all recommendations and then some' },
        { value: 2, text: 'Very careful, rarely missing recommended checkups' },
        { value: 3, text: 'Moderately attentive, getting most recommended screenings' },
        { value: 4, text: 'Somewhat casual, addressing issues as they arise' },
        { value: 5, text: 'Minimal engagement, only seeking care when necessary' },
      ],
      domain: 'health'
    },
    {
      id: 'learning_approach',
      text: 'When learning something new, you prefer:',
      options: [
        { value: 1, text: 'Structured, proven learning paths with clear milestones' },
        { value: 2, text: 'Mostly structured learning with some self-direction' },
        { value: 3, text: 'A mix of structured and experimental approaches' },
        { value: 4, text: 'Mostly self-directed exploration with some guidance' },
        { value: 5, text: 'Completely self-directed, experimental learning regardless of outcome' },
      ],
      domain: 'education'
    },
    {
      id: 'general_uncertainty',
      text: 'How do you generally feel about uncertainty in life?',
      options: [
        { value: 1, text: 'Very uncomfortable - I prefer predictability whenever possible' },
        { value: 2, text: 'Somewhat uncomfortable - I tolerate some uncertainty' },
        { value: 3, text: 'Neutral - I accept that life involves both certainty and uncertainty' },
        { value: 4, text: 'Comfortable - I often enjoy not knowing what comes next' },
        { value: 5, text: 'Very comfortable - I thrive in and seek out uncertain situations' },
      ],
      domain: 'general'
    },
    {
      id: 'financial_windfall',
      text: 'If you unexpectedly received $50,000, you would most likely:',
      options: [
        { value: 1, text: 'Put it all in safe, low-return savings or pay off debt' },
        { value: 2, text: 'Put most in safe investments, small amount in higher-risk options' },
        { value: 3, text: 'Split evenly between safe, moderate, and growth investments' },
        { value: 4, text: 'Put most in growth investments with some in safer options' },
        { value: 5, text: 'Invest aggressively for maximum growth potential or start a business' },
      ],
      domain: 'financial'
    },
  ];

  // Update parent component when form data changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleOptionSelect = (questionId: string, value: number, domain: string) => {
    // Save individual response
    const newResponses = {
      ...formData.responses,
      [questionId]: value,
    };
    
    // Get responses by domain
    const financialResponses = Object.entries(newResponses)
      .filter(([qId]) => questions.find(q => q.id === qId)?.domain === 'financial')
      .map(([_, value]) => value as number);
    
    const careerResponses = Object.entries(newResponses)
      .filter(([qId]) => questions.find(q => q.id === qId)?.domain === 'career')
      .map(([_, value]) => value as number);
    
    const healthResponses = Object.entries(newResponses)
      .filter(([qId]) => questions.find(q => q.id === qId)?.domain === 'health')
      .map(([_, value]) => value as number);
    
    const educationResponses = Object.entries(newResponses)
      .filter(([qId]) => questions.find(q => q.id === qId)?.domain === 'education')
      .map(([_, value]) => value as number);
    
    const generalResponses = Object.entries(newResponses)
      .filter(([qId]) => questions.find(q => q.id === qId)?.domain === 'general')
      .map(([_, value]) => value as number);
    
    // Calculate domain-specific risk tolerances using our helper function
    const financialRiskTolerance = calculateRiskScore(financialResponses);
    const careerRiskTolerance = calculateRiskScore(careerResponses);
    const healthRiskTolerance = calculateRiskScore(healthResponses);
    const educationRiskTolerance = calculateRiskScore(educationResponses);
    
    // Calculate overall risk theta with domain weighting
    // Financial matters often have the biggest impact on risk assessment
    const domainWeights = {
      financial: 0.35, // Higher weight for financial tolerance
      career: 0.25,
      health: 0.20,
      education: 0.15,
      general: 0.05
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    if (financialResponses.length) {
      weightedSum += financialRiskTolerance * domainWeights.financial;
      totalWeight += domainWeights.financial;
    }
    
    if (careerResponses.length) {
      weightedSum += careerRiskTolerance * domainWeights.career;
      totalWeight += domainWeights.career;
    }
    
    if (healthResponses.length) {
      weightedSum += healthRiskTolerance * domainWeights.health;
      totalWeight += domainWeights.health;
    }
    
    if (educationResponses.length) {
      weightedSum += educationRiskTolerance * domainWeights.education;
      totalWeight += domainWeights.education;
    }
    
    if (generalResponses.length) {
      const generalRiskScore = calculateRiskScore(generalResponses);
      weightedSum += generalRiskScore * domainWeights.general;
      totalWeight += domainWeights.general;
    }
    
    // Calculate the weighted average, defaulting to moderate (0.5) if no responses
    const riskTheta = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    
    setFormData({
      responses: newResponses,
      riskTheta,
      financialRiskTolerance,
      careerRiskTolerance,
      healthRiskTolerance,
      educationRiskTolerance,
    });
    
    // Move to next question if not the last one
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else {
      onBack();
    }
  };

  // Get theta value as a percentage
  const thetaPercentage = Math.round(formData.riskTheta * 100);
  
  // Risk level text based on theta value
  const getRiskLevelText = (theta: number) => {
    if (theta < 0.2) return 'Very Conservative';
    if (theta < 0.4) return 'Conservative';
    if (theta < 0.6) return 'Moderate';
    if (theta < 0.8) return 'Growth-Oriented';
    return 'Aggressive';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Risk Preference Assessment
      </h2>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          This assessment helps us understand your risk tolerance across different life domains. Your answers will help us tailor recommendations to your comfort level with uncertainty and risk.
        </p>
      </div>
      
      {currentQuestion < questions.length ? (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(((currentQuestion + 1) / questions.length) * 100)}% complete
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div 
                className="h-2 bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {questions[currentQuestion].text}
            </h3>
            
            <div className="space-y-3 mt-6">
              {questions[currentQuestion].options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleOptionSelect(
                    questions[currentQuestion].id, 
                    option.value,
                    questions[currentQuestion].domain
                  )}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 
                  hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="text-gray-900 dark:text-white">{option.text}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between pt-6">
            <button
              onClick={prevQuestion}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
              text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Back
            </button>
            
            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
                text-white bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50"
                disabled
              >
                Next
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Risk Profile
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Overall Risk Tolerance: {getRiskLevelText(formData.riskTheta)} ({thetaPercentage}%)
              </label>
              <div className="h-6 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full">
                <div className="relative h-full">
                  <div 
                    className="absolute top-0 bottom-0 w-3 bg-white border-2 border-gray-800 dark:border-white rounded-full transform -translate-x-1/2"
                    style={{ left: `${thetaPercentage}%` }} 
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>Conservative</span>
                <span>Moderate</span>
                <span>Aggressive</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Financial Risk Tolerance: {getRiskLevelText(formData.financialRiskTolerance || 0)}
                </label>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 dark:bg-blue-500 rounded-full"
                    style={{ width: `${(formData.financialRiskTolerance || 0) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Career Risk Tolerance: {getRiskLevelText(formData.careerRiskTolerance || 0)}
                </label>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 dark:bg-blue-500 rounded-full"
                    style={{ width: `${(formData.careerRiskTolerance || 0) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Health Risk Tolerance: {getRiskLevelText(formData.healthRiskTolerance || 0)}
                </label>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 dark:bg-blue-500 rounded-full"
                    style={{ width: `${(formData.healthRiskTolerance || 0) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Education Risk Tolerance: {getRiskLevelText(formData.educationRiskTolerance || 0)}
                </label>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div 
                    className="h-2 bg-blue-600 dark:bg-blue-500 rounded-full"
                    style={{ width: `${(formData.educationRiskTolerance || 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-gray-700 dark:text-gray-300 text-sm">
              <p>
                Your risk profile will help us personalize recommendations across all life domains. Areas with higher risk tolerance will receive more ambitious strategies, while more conservative areas will focus on stability and security.
              </p>
            </div>
          </div>
          
          <div className="flex justify-between pt-6">
            <button
              onClick={prevQuestion}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
              text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Back
            </button>
            
            <button
              onClick={onNext}
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
              text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
              focus:ring-blue-500 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}