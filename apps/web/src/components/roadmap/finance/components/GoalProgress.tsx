'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

// Mock data for financial goals
const mockGoals = [
  {
    id: 'goal1',
    name: 'Emergency Fund',
    description: 'Build emergency fund to cover 6 months of expenses',
    target: 30000,
    current: 18000,
    contributionFrequency: 'monthly',
    contributionAmount: 1000,
    targetDate: '2025-12-31',
    priority: 'high',
    category: 'savings',
    progress: 60,
    status: 'on-track',
  },
  {
    id: 'goal2',
    name: 'Retirement Savings',
    description: 'Max out 401(k) contributions',
    target: 22500,
    current: 12000,
    contributionFrequency: 'monthly',
    contributionAmount: 1875,
    targetDate: '2025-12-31',
    priority: 'high',
    category: 'retirement',
    progress: 53,
    status: 'on-track',
  },
  {
    id: 'goal3',
    name: 'Pay Off Student Loans',
    description: 'Completely pay off remaining student loan balance',
    target: 35000,
    current: 22000,
    contributionFrequency: 'monthly',
    contributionAmount: 1500,
    targetDate: '2026-06-30',
    priority: 'medium',
    category: 'debt',
    progress: 37,
    status: 'behind',
  },
  {
    id: 'goal4',
    name: 'Home Down Payment',
    description: 'Save for 20% down payment on a house',
    target: 80000,
    current: 25000,
    contributionFrequency: 'monthly',
    contributionAmount: 1500,
    targetDate: '2027-12-31',
    priority: 'medium',
    category: 'savings',
    progress: 31,
    status: 'on-track',
  },
  {
    id: 'goal5',
    name: 'Family Vacation',
    description: 'Save for a European family vacation',
    target: 10000,
    current: 7500,
    contributionFrequency: 'monthly',
    contributionAmount: 500,
    targetDate: '2025-06-30',
    priority: 'low',
    category: 'lifestyle',
    progress: 75,
    status: 'ahead',
  },
  {
    id: 'goal6',
    name: 'New Car',
    description: 'Save for a new car purchase',
    target: 25000,
    current: 5000,
    contributionFrequency: 'monthly',
    contributionAmount: 800,
    targetDate: '2026-12-31',
    priority: 'low',
    category: 'lifestyle',
    progress: 20,
    status: 'on-track',
  },
];

// Goal categories with icons and colors
const goalCategories = [
  { id: 'all', name: 'All Goals', color: 'bg-gray-500' },
  { id: 'savings', name: 'Savings', color: 'bg-blue-500' },
  { id: 'retirement', name: 'Retirement', color: 'bg-purple-500' },
  { id: 'debt', name: 'Debt Repayment', color: 'bg-red-500' },
  { id: 'lifestyle', name: 'Lifestyle', color: 'bg-green-500' },
];

export function GoalProgress() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  
  // Filter goals by selected category
  const filteredGoals = selectedCategory === 'all'
    ? mockGoals
    : mockGoals.filter(goal => goal.category === selectedCategory);
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ahead':
        return 'text-green-600';
      case 'on-track':
        return 'text-blue-600';
      case 'behind':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };
  
  // Calculate time remaining
  const getTimeRemaining = (targetDate: string) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Overdue';
    }
    
    if (diffDays < 30) {
      return `${diffDays} days left`;
    }
    
    const diffMonths = Math.ceil(diffDays / 30);
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} left`;
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Financial Goals</h2>
      
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {goalCategories.map(category => (
          <button
            key={category.id}
            className={`px-4 py-2 rounded-md flex items-center ${
              selectedCategory === category.id
                ? 'bg-gray-200 font-medium'
                : 'bg-white border border-gray-300'
            }`}
            onClick={() => setSelectedCategory(category.id)}
          >
            <div className={`w-3 h-3 rounded-full ${category.color} mr-2`}></div>
            {category.name}
          </button>
        ))}
      </div>
      
      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGoals.map(goal => (
          <Card
            key={goal.id}
            className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedGoal === goal.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedGoal(selectedGoal === goal.id ? null : goal.id)}
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-lg">{goal.name}</h3>
                <span className={`text-sm font-medium ${getStatusColor(goal.status)}`}>
                  {goal.status === 'ahead' ? 'Ahead of schedule' :
                   goal.status === 'on-track' ? 'On track' :
                   goal.status === 'behind' ? 'Behind schedule' : 'Unknown'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600">{goal.description}</p>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>${goal.current.toLocaleString()} of ${goal.target.toLocaleString()}</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      goal.status === 'ahead' ? 'bg-green-500' :
                      goal.status === 'on-track' ? 'bg-blue-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Goal Details */}
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-2">
                <div>
                  <span>Target Date:</span>
                  <span className="ml-1 font-medium">
                    {new Date(goal.targetDate).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span>Time Remaining:</span>
                  <span className="ml-1 font-medium">
                    {getTimeRemaining(goal.targetDate)}
                  </span>
                </div>
              </div>
              
              {/* Extra Details (when goal is selected) */}
              {selectedGoal === goal.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Monthly Contribution</p>
                      <p className="font-medium">${goal.contributionAmount}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Amount Needed</p>
                      <p className="font-medium">${(goal.target - goal.current).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Priority</p>
                      <p className="font-medium capitalize">{goal.priority}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Category</p>
                      <p className="font-medium capitalize">{goal.category}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm">Edit Goal</Button>
                    <Button variant="outline" size="sm">Adjust Contribution</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      
      {/* Add Goal Button */}
      <div className="mt-6">
        <Button>
          Add New Financial Goal
        </Button>
      </div>
      
      {/* Summary Section */}
      <Card className="p-6 mt-4">
        <h3 className="text-lg font-medium mb-4">Goals Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Total Goal Amount</p>
            <p className="text-xl font-semibold">
              ${mockGoals.reduce((sum, goal) => sum + goal.target, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Progress</p>
            <p className="text-xl font-semibold">
              ${mockGoals.reduce((sum, goal) => sum + goal.current, 0).toLocaleString()} 
              <span className="text-sm text-gray-500 ml-1">
                ({Math.round((mockGoals.reduce((sum, goal) => sum + goal.current, 0) / mockGoals.reduce((sum, goal) => sum + goal.target, 0)) * 100)}%)
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Monthly Contributions</p>
            <p className="text-xl font-semibold">
              ${mockGoals.reduce((sum, goal) => sum + goal.contributionAmount, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}