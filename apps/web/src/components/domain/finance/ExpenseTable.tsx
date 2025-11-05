// components/domain/finance/ExpenseTable.tsx
import React from 'react';

interface ExpenseTableProps {
  // Add props as needed
}

const ExpenseTable: React.FC<ExpenseTableProps> = () => {
  // Sample data - in a real app, this would come from an API or props
  const expenses = [
    { category: 'Housing', amount: 1200, percentage: 40 },
    { category: 'Transportation', amount: 450, percentage: 15 },
    { category: 'Food', amount: 600, percentage: 20 },
    { category: 'Utilities', amount: 300, percentage: 10 },
    { category: 'Entertainment', amount: 150, percentage: 5 },
    { category: 'Savings', amount: 300, percentage: 10 },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-3">Monthly Expenses</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visualization</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expense.amount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.percentage}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${expense.percentage}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseTable;