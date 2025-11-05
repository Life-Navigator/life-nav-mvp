// components/domain/finance/FinanceAdviceCard.tsx
import React from 'react';

const FinanceAdviceCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Your Financial Insights</h2>
      
      <div className="space-y-4">
        <div className="p-4 border border-blue-100 bg-blue-50 rounded-md">
          <h3 className="font-medium text-blue-800">Budget Analysis</h3>
          <p className="text-blue-700 mt-1">
            You're currently spending 35% of your income on housing, which is slightly above the recommended 30%.
            Consider reviewing your housing situation in the next 6-12 months.
          </p>
        </div>
        
        <div className="p-4 border border-green-100 bg-green-50 rounded-md">
          <h3 className="font-medium text-green-800">Savings Opportunity</h3>
          <p className="text-green-700 mt-1">
            Based on your spending patterns, you could increase your monthly savings by 
            $325 by reducing discretionary spending on subscription services.
          </p>
        </div>
        
        <div className="p-4 border border-purple-100 bg-purple-50 rounded-md">
          <h3 className="font-medium text-purple-800">Investment Suggestion</h3>
          <p className="text-purple-700 mt-1">
            Your risk tolerance profile suggests a portfolio with 70% stocks and 30% bonds 
            would align with your financial goals.
          </p>
        </div>
      </div>
      
      <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
        See Detailed Analysis
      </button>
    </div>
  );
};

export default FinanceAdviceCard;