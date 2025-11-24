'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

interface FinancialGoal {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  contributionFrequency: string;
  contributionAmount: number;
  targetDate: string;
  priority: string;
  category: string;
  progress: number;
  status: string;
}

// Goal categories with icons and colors
const goalCategories = [
  { id: 'all', name: 'All Goals', color: 'bg-gray-500' },
  { id: 'savings', name: 'Savings', color: 'bg-blue-500' },
  { id: 'retirement', name: 'Retirement', color: 'bg-purple-500' },
  { id: 'debt', name: 'Debt Repayment', color: 'bg-red-500' },
  { id: 'lifestyle', name: 'Lifestyle', color: 'bg-green-500' },
];

export function GoalProgress() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/financial/goals');
        if (!response.ok) {
          throw new Error('Failed to fetch goals');
        }
        const data = await response.json();
        setGoals(data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching financial goals:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch goals'));
        setGoals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoals();
  }, []);

  // Filter goals by selected category
  const filteredGoals = selectedCategory === 'all'
    ? goals
    : goals.filter(goal => goal.category === selectedCategory);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Financial Goals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-full"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state - no goals
  if (goals.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Financial Goals</h2>
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No Financial Goals Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Set up financial goals to track your progress towards savings, retirement, debt payoff, and more.
            </p>
            <Button>Add New Financial Goal</Button>
          </div>
        </Card>
      </div>
    );
  }

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
      {goals.length > 0 && (
        <Card className="p-6 mt-4">
          <h3 className="text-lg font-medium mb-4">Goals Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Goal Amount</p>
              <p className="text-xl font-semibold">
                ${goals.reduce((sum, goal) => sum + goal.target, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Current Progress</p>
              <p className="text-xl font-semibold">
                ${goals.reduce((sum, goal) => sum + goal.current, 0).toLocaleString()}
                <span className="text-sm text-gray-500 ml-1">
                  ({Math.round((goals.reduce((sum, goal) => sum + goal.current, 0) / goals.reduce((sum, goal) => sum + goal.target, 0)) * 100)}%)
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Monthly Contributions</p>
              <p className="text-xl font-semibold">
                ${goals.reduce((sum, goal) => sum + goal.contributionAmount, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
