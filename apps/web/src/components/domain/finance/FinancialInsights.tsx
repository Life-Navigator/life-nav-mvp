// src/components/domain/financial/FinancialInsights.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, Calendar } from 'lucide-react';

const FinancialInsights = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        // In a real app, this would be an API call to your backend
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock insights data
        const mockInsights = [
          {
            id: 'ins1',
            type: 'alert',
            icon: 'alert',
            title: 'Credit Card Payment Due',
            description: 'Your Chase credit card payment of $2,314.92 is due in 3 days.',
            priority: 'high',
            action: 'Pay Now',
            actionUrl: '/payment/cc123'
          },
          {
            id: 'ins2',
            type: 'insight',
            icon: 'trend',
            title: 'Spending Increase',
            description: 'You\'ve spent $543 on dining this month, 32% more than last month.',
            priority: 'medium',
            action: 'View Details',
            actionUrl: '/transactions/category/dining'
          },
          {
            id: 'ins3',
            type: 'opportunity',
            icon: 'investment',
            title: 'Investment Opportunity',
            description: 'Based on your risk profile, consider increasing your 401k contribution by 2%.',
            priority: 'medium',
            action: 'Learn More',
            actionUrl: '/advice/retirement'
          },
          {
            id: 'ins4',
            type: 'alert',
            icon: 'calendar',
            title: 'Subscription Renewal',
            description: 'Your Netflix subscription ($19.99) will renew tomorrow.',
            priority: 'low',
            action: 'Manage Subscription',
            actionUrl: '/subscriptions'
          }
        ];
        
        setInsights(mockInsights as typeof insights);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchInsights();
  }, []);
  
  // Helper to render the appropriate icon
  const renderIcon = (iconType: 'alert' | 'trend' | 'investment' | 'calendar' | string) => {
    switch (iconType) {
      case 'alert':
        return <AlertTriangle className="text-yellow-600" size={20} />;
      case 'trend':
        return <TrendingUp className="text-blue-600" size={20} />;
      case 'investment':
        return <ArrowUpRight className="text-green-600" size={20} />;
      case 'calendar':
        return <Calendar className="text-purple-600" size={20} />;
      default:
        return <PieChartIcon className="text-gray-600" size={20} />;
    }
  };
  
  // Helper to determine the appropriate background color
  const getBgColor = (type: 'alert' | 'insight' | 'opportunity', priority: string) => {
    if (type === 'alert') {
      return priority === 'high' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-orange-50 border-l-4 border-orange-400';
    } else if (type === 'insight') {
      return 'bg-blue-50 border-l-4 border-blue-400';
    } else if (type === 'opportunity') {
      return 'bg-green-50 border-l-4 border-green-400';
    }
    return 'bg-gray-50 border-l-4 border-gray-400';
  };
  
  // Helper to determine the text color
  const getTextColor = (type: 'alert' | 'insight' | 'opportunity', priority: string) => {
    if (type === 'alert') {
      return priority === 'high' ? 'text-yellow-800' : 'text-orange-800';
    } else if (type === 'insight') {
      return 'text-blue-800';
    } else if (type === 'opportunity') {
      return 'text-green-800';
    }
    return 'text-gray-800';
  };
  
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading Insights...</h2>
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
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Financial Insights</h2>
      
      <div className="space-y-4">
        {insights.map((insight) => (
          <div key={(insight as {id: string}).id} className={`${getBgColor((insight as {type: 'alert' | 'insight' | 'opportunity'}).type, (insight as {priority: string}).priority)} p-4 rounded-md`}>
            <div className="flex items-start">
              {renderIcon((insight as {icon: string}).icon as 'alert' | 'trend' | 'investment' | 'calendar')}
              
              <div className="ml-3 flex-1">
                <p className={`font-medium ${getTextColor((insight as {type: 'alert' | 'insight' | 'opportunity'}).type, (insight as {priority: string}).priority)}`}>{(insight as {title: string}).title}</p>
                <p className={`text-sm ${getTextColor((insight as {type: 'alert' | 'insight' | 'opportunity'}).type, (insight as {priority: string}).priority).replace('800', '700')}`}>
                  {(insight as {description: string}).description}
                </p>
                
                <div className="mt-2">
                  <a 
                    href={(insight as {actionUrl: string}).actionUrl}
                    className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {(insight as {action: string}).action}
                    <ArrowUpRight className="ml-1" size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FinancialInsights;