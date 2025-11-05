// src/components/domain/finance/InvestmentAdvice.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, BarChart3, PieChart, CheckCircle } from 'lucide-react';

// Define TypeScript interfaces
interface AllocationItem {
  name: string;
  value: number;
}

interface PortfolioData {
  currentAllocation: AllocationItem[];
  riskScore: number;
  expectedReturn: number;
  volatility: number;
}

interface Recommendation {
  id: string;
  type: 'rebalance' | 'diversify' | 'tax' | 'other';
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
}

interface InvestmentAdviceData {
  portfolio: PortfolioData;
  recommendations: Recommendation[];
  riskProfile: string;
  targetAllocation: AllocationItem[];
}

const InvestmentAdvice = () => {
  const [adviceData, setAdviceData] = useState<InvestmentAdviceData>({
    portfolio: {
      currentAllocation: [],
      riskScore: 0,
      expectedReturn: 0,
      volatility: 0
    },
    recommendations: [],
    riskProfile: '',
    targetAllocation: []
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInvestmentAdvice = async () => {
      try {
        // In a real app, this would be an API call to your backend
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock investment advice data
        const mockData: InvestmentAdviceData = {
          portfolio: {
            currentAllocation: [
              { name: 'US Stocks', value: 55 },
              { name: 'International Stocks', value: 15 },
              { name: 'Bonds', value: 20 },
              { name: 'Cash', value: 10 }
            ],
            riskScore: 7.2,
            expectedReturn: 8.5,
            volatility: 15.2
          },
          recommendations: [
            {
              id: 'rec1',
              type: 'rebalance',
              title: 'Rebalance Portfolio',
              description: 'Your current allocation is overweight in US stocks. Consider rebalancing to reduce risk.',
              impact: 'Reduces volatility by approximately 2.5%',
              priority: 'high',
              timeframe: 'Short-term (1-3 months)'
            },
            {
              id: 'rec2',
              type: 'diversify',
              title: 'Increase International Exposure',
              description: 'Adding more international stocks can improve diversification and potentially increase returns.',
              impact: 'May increase expected return by 0.5-1%',
              priority: 'medium',
              timeframe: 'Medium-term (3-6 months)'
            },
            {
              id: 'rec3',
              type: 'tax',
              title: 'Tax-Loss Harvesting Opportunity',
              description: 'Several positions are currently down and could be harvested for tax benefits.',
              impact: 'Potential tax savings of $1,200 this year',
              priority: 'medium',
              timeframe: 'Short-term (Next 30 days)'
            }
          ],
          riskProfile: 'Moderate-Aggressive',
          targetAllocation: [
            { name: 'US Stocks', value: 45 },
            { name: 'International Stocks', value: 25 },
            { name: 'Bonds', value: 25 },
            { name: 'Cash', value: 5 }
          ]
        };
        
        setAdviceData(mockData);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchInvestmentAdvice();
  }, []);
  
  // Helper to render the appropriate icon
  const renderIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'rebalance':
        return <PieChart className="text-purple-600" size={20} />;
      case 'diversify':
        return <BarChart3 className="text-blue-600" size={20} />;
      case 'tax':
        return <TrendingUp className="text-green-600" size={20} />;
      default:
        return <CheckCircle className="text-gray-600" size={20} />;
    }
  };
  
  // Helper for priority badge color
  const getPriorityBadgeColor = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading Investment Advice...</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Investment Strategy</h2>
      
      {/* Risk Profile */}
      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Risk Profile</p>
            <p className="text-lg font-semibold">{adviceData.riskProfile}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expected Return</p>
            <p className="text-lg font-semibold text-green-600">{adviceData.portfolio.expectedReturn}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Volatility</p>
            <p className="text-lg font-semibold text-yellow-600">{adviceData.portfolio.volatility}%</p>
          </div>
        </div>
      </div>
      
      {/* Allocation Comparison */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Current vs. Target Allocation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Current</h4>
            <div className="space-y-2">
              {adviceData.portfolio.currentAllocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm">{item.name}</span>
                  <span className="text-sm font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Target</h4>
            <div className="space-y-2">
              {adviceData.targetAllocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm">{item.name}</span>
                  <span className="text-sm font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Recommendations */}
      <div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">Recommended Actions</h3>
        <div className="space-y-4">
          {adviceData.recommendations.map((rec) => (
            <div key={rec.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-start">
                <div className="mr-3 mt-1">
                  {renderIcon(rec.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{rec.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityBadgeColor(rec.priority)}`}>
                      {rec.priority}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                  
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>Impact: {rec.impact}</span>
                    <span>Timeframe: {rec.timeframe}</span>
                  </div>
                  
                  <button className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center">
                    Take Action
                    <ArrowUpRight size={14} className="ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InvestmentAdvice;