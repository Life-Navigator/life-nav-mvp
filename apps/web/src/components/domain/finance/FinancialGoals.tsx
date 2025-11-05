// src/components/domain/finance/FinancialGoals.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { 
  Target, TrendingUp, Home, GraduationCap, Car, Plane, Heart, 
  DollarSign, Plus, Edit, Trash2, CheckCircle
} from 'lucide-react';

// TypeScript interfaces
interface GoalMilestone {
  date: string;
  targetAmount: number;
  projectedAmount: number;
}

interface FinancialGoal {
  id: string;
  name: string;
  category: 'retirement' | 'home' | 'education' | 'car' | 'travel' | 'health' | 'other';
  currentAmount: number;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  milestones: GoalMilestone[];
  priority: 'high' | 'medium' | 'low';
  status: 'on_track' | 'at_risk' | 'behind';
  contributions: { monthly: number; recommended: number };
}

const FinancialGoals: React.FC = () => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingGoal, setAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState<Partial<FinancialGoal>>({
    name: '',
    category: 'other',
    targetAmount: 0,
    targetDate: ''
  });

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        // In a real app, this would be an API call to your backend
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Mock goals data
        const mockGoals: FinancialGoal[] = [
          {
            id: 'goal1',
            name: 'Retirement Fund',
            category: 'retirement',
            currentAmount: 120000,
            targetAmount: 1500000,
            startDate: '2020-01-01',
            targetDate: '2045-01-01',
            priority: 'high',
            status: 'on_track',
            contributions: { monthly: 1500, recommended: 1500 },
            milestones: Array.from({ length: 25 }, (_, i) => {
              const date = new Date('2020-01-01');
              date.setFullYear(date.getFullYear() + i);
              return {
                date: date.toISOString().split('T')[0],
                targetAmount: Math.round(1500000 * (i / 25)),
                projectedAmount: Math.round(120000 * Math.pow(1.07, i))
              };
            })
          },
          {
            id: 'goal2',
            name: 'Down Payment',
            category: 'home',
            currentAmount: 45000,
            targetAmount: 100000,
            startDate: '2022-06-01',
            targetDate: '2026-06-01',
            priority: 'high',
            status: 'at_risk',
            contributions: { monthly: 1000, recommended: 1350 },
            milestones: Array.from({ length: 4 }, (_, i) => {
              const date = new Date('2022-06-01');
              date.setFullYear(date.getFullYear() + i);
              return {
                date: date.toISOString().split('T')[0],
                targetAmount: Math.round(100000 * (i / 4)),
                projectedAmount: Math.round(45000 + (1000 * 12 * i))
              };
            })
          },
          {
            id: 'goal3',
            name: 'College Fund',
            category: 'education',
            currentAmount: 28000,
            targetAmount: 150000,
            startDate: '2021-01-01',
            targetDate: '2035-01-01',
            priority: 'medium',
            status: 'on_track',
            contributions: { monthly: 500, recommended: 450 },
            milestones: Array.from({ length: 14 }, (_, i) => {
              const date = new Date('2021-01-01');
              date.setFullYear(date.getFullYear() + i);
              return {
                date: date.toISOString().split('T')[0],
                targetAmount: Math.round(150000 * (i / 14)),
                projectedAmount: Math.round(28000 + (500 * 12 * i))
              };
            })
          },
          {
            id: 'goal4',
            name: 'Dream Vacation',
            category: 'travel',
            currentAmount: 2500,
            targetAmount: 10000,
            startDate: '2024-01-01',
            targetDate: '2025-12-31',
            priority: 'low',
            status: 'behind',
            contributions: { monthly: 250, recommended: 400 },
            milestones: Array.from({ length: 2 }, (_, i) => {
              const date = new Date('2024-01-01');
              date.setFullYear(date.getFullYear() + i);
              return {
                date: date.toISOString().split('T')[0],
                targetAmount: Math.round(10000 * (i / 2)),
                projectedAmount: Math.round(2500 + (250 * 12 * i))
              };
            })
          }
        ];
        
        setGoals(mockGoals);
        setActiveGoal(mockGoals[0].id);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchGoals();
  }, []);

  // Helper function to get category icon
  const getCategoryIcon = (category: FinancialGoal['category'], size = 20) => {
    switch (category) {
      case 'retirement':
        return <TrendingUp size={size} />;
      case 'home':
        return <Home size={size} />;
      case 'education':
        return <GraduationCap size={size} />;
      case 'car':
        return <Car size={size} />;
      case 'travel':
        return <Plane size={size} />;
      case 'health':
        return <Heart size={size} />;
      default:
        return <Target size={size} />;
    }
  };

  // Helper to calculate progress percentage
  const calculateProgress = (current: number, target: number) => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Get status color
  const getStatusColor = (status: FinancialGoal['status']): string => {
    switch (status) {
      case 'on_track':
        return 'text-green-600';
      case 'at_risk':
        return 'text-yellow-600';
      case 'behind':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get status label
  const getStatusLabel = (status: FinancialGoal['status']): string => {
    switch (status) {
      case 'on_track':
        return 'On Track';
      case 'at_risk':
        return 'At Risk';
      case 'behind':
        return 'Behind';
      default:
        return 'Unknown';
    }
  };

  // Format milestone data for charts
  const formatMilestoneData = (milestones: GoalMilestone[]) => {
    return milestones.map(milestone => ({
      date: formatDate(milestone.date),
      Target: milestone.targetAmount,
      Projected: milestone.projectedAmount
    }));
  };

  // Get active goal
  const getActiveGoalData = () => {
    return goals.find(goal => goal.id === activeGoal);
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading Financial Goals...</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }

  const activeGoalData = getActiveGoalData();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Financial Goals</h2>
        <button
          onClick={() => setAddingGoal(true)}
          className="flex items-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
        >
          <Plus size={16} className="mr-1" />
          New Goal
        </button>
      </div>

      {/* Goals list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {goals.map(goal => (
          <div
            key={goal.id}
            className={`border rounded-md p-4 cursor-pointer transition-colors ${
              activeGoal === goal.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setActiveGoal(goal.id)}
          >
            <div className="flex items-center mb-2">
              <div className={`p-2 rounded-full ${
                activeGoal === goal.id ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {getCategoryIcon(goal.category)}
              </div>
              <div className="ml-3">
                <h3 className="font-medium text-gray-900">{goal.name}</h3>
                <p className="text-xs text-gray-500">Target: {formatDate(goal.targetDate)}</p>
              </div>
            </div>
            
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{formatCurrency(goal.currentAmount)}</span>
                <span>{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div
                  className={`h-2 rounded-full progress-bar ${
                    goal.status === 'on_track' ? 'bg-green-500' : 
                    goal.status === 'at_risk' ? 'bg-yellow-500' : 'bg-red-500'
                  } w-[${calculateProgress(goal.currentAmount, goal.targetAmount)}%]`}
                  style={{ width: `${calculateProgress(goal.currentAmount, goal.targetAmount)}%` }}
                  
                  // Remove duplicate style attribute
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>{calculateProgress(goal.currentAmount, goal.targetAmount)}%</span>
                <span className={getStatusColor(goal.status)}>{getStatusLabel(goal.status)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active goal details */}
      {activeGoalData && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                {getCategoryIcon(activeGoalData.category, 24)}
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-semibold text-gray-900">{activeGoalData.name}</h3>
                <p className="text-gray-500">
                  {formatDate(activeGoalData.startDate)} — {formatDate(activeGoalData.targetDate)}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                aria-label="Edit goal"
              >
                <Edit size={18} />
              </button>
              <button 
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                aria-label="Delete goal"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Progress and status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-500 mb-1">Current Amount</p>
              <p className="text-xl font-bold">{formatCurrency(activeGoalData.currentAmount)}</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${
                    activeGoalData.status === 'on_track' ? 'bg-green-500' : 
                    activeGoalData.status === 'at_risk' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${calculateProgress(activeGoalData.currentAmount, activeGoalData.targetAmount)}%` }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{calculateProgress(activeGoalData.currentAmount, activeGoalData.targetAmount)}% complete</span>
                <span>{formatCurrency(activeGoalData.targetAmount)}</span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-500 mb-1">Monthly Contribution</p>
              <p className="text-xl font-bold">{formatCurrency(activeGoalData.contributions.monthly)}</p>
              <div className="mt-2 flex items-center">
                {activeGoalData.contributions.monthly < activeGoalData.contributions.recommended ? (
                  <>
                    <TrendingUp className="text-red-500" size={16} />
                    <span className="text-xs text-red-500 ml-1">
                      Recommended: {formatCurrency(activeGoalData.contributions.recommended)}/month
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="text-green-500" size={16} />
                    <span className="text-xs text-green-500 ml-1">
                      On target for goal date
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <p className={`text-xl font-bold ${getStatusColor(activeGoalData.status)}`}>
                {getStatusLabel(activeGoalData.status)}
              </p>
              <div className="mt-2 text-xs text-gray-500">
                {activeGoalData.status === 'on_track' && (
                  <span>You're projected to reach your goal on time.</span>
                )}
                {activeGoalData.status === 'at_risk' && (
                  <span>You may miss your target date by 3-6 months.</span>
                )}
                {activeGoalData.status === 'behind' && (
                  <span>You're projected to miss your target date by 12+ months.</span>
                )}
              </div>
            </div>
          </div>

          {/* Projection chart */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Goal Projection</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={formatMilestoneData(activeGoalData.milestones)}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip formatter={(value) => [formatCurrency(value as number), '']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Target"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Projected"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-2">Recommendations</h4>
            {activeGoalData.status === 'on_track' && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
                <div className="flex">
                  <CheckCircle className="text-green-600 mr-3 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-green-800">You're on track!</p>
                    <p className="text-sm text-green-700">
                      Keep up your current contributions and you'll reach your goal by {formatDate(activeGoalData.targetDate)}.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {activeGoalData.status === 'at_risk' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div className="flex">
                  <Target className="text-yellow-600 mr-3 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-yellow-800">Your goal is at risk</p>
                    <p className="text-sm text-yellow-700">
                      Consider increasing your monthly contribution from {formatCurrency(activeGoalData.contributions.monthly)} to {formatCurrency(activeGoalData.contributions.recommended)} to stay on track.
                    </p>
                    <button className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded-md hover:bg-yellow-700">
                      Adjust Contribution
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeGoalData.status === 'behind' && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                <div className="flex">
                  <Target className="text-red-600 mr-3 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-red-800">Your goal is behind schedule</p>
                    <p className="text-sm text-red-700">
                      To reach your goal by {formatDate(activeGoalData.targetDate)}, increase your monthly contribution from {formatCurrency(activeGoalData.contributions.monthly)} to {formatCurrency(activeGoalData.contributions.recommended)}, or consider extending your timeline.
                    </p>
                    <div className="mt-2 flex space-x-2">
                      <button className="text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700">
                        Adjust Contribution
                      </button>
                      <button className="text-sm bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700">
                        Modify Goal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {addingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Create New Goal</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Retirement Fund"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  aria-label="Goal category"
                  className="w-full p-2 border border-gray-300 rounded-md bg-white"
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({...newGoal, category: e.target.value as FinancialGoal['category']})}
                >
                  <option value="retirement">Retirement</option>
                  <option value="home">Home Purchase</option>
                  <option value="education">Education</option>
                  <option value="car">Vehicle</option>
                  <option value="travel">Travel</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign size={16} className="text-gray-400" />
                  </div>
                  <input 
                    type="number" 
                    className="w-full p-2 pl-10 border border-gray-300 rounded-md"
                    placeholder="50000"
                    value={newGoal.targetAmount || ''}
                    onChange={(e) => setNewGoal({...newGoal, targetAmount: Number(e.target.value)})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                <input
                  aria-label="Target date"
                  placeholder="Select target date" 
                  title="Target date for financial goal"
                  type="date" 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({...newGoal, targetDate: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setAddingGoal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => {
                  // In a real app, this would send a POST request to your API
                  setAddingGoal(false);
                  // Reset form
                  setNewGoal({
                    name: '',
                    category: 'other',
                    targetAmount: 0,
                    targetDate: ''
                  });
                }}
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialGoals;