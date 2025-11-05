// src/components/domain/finance/BudgetPlanner.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, DollarSign, Settings } from 'lucide-react';

// Define TypeScript interfaces for our data
interface BudgetCategory {
  name: string;
  budgeted: number;
  spent: number;
}

interface DailySpending {
  date: string;
  spent: number;
  budget: number;
}

interface BudgetData {
  categories: BudgetCategory[];
  spending: DailySpending[];
  monthlyBudget: number;
  monthlySpent: number;
}

type TimeframeType = 'week' | 'month' | 'year';

const BudgetPlanner = () => {
  const [budgetData, setBudgetData] = useState<BudgetData>({
    categories: [],
    spending: [],
    monthlyBudget: 0,
    monthlySpent: 0
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeframeType>('month');
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];
  
  useEffect(() => {
    const fetchBudgetData = async () => {
      try {
        // In a real app, this would be an API call to your backend
        await new Promise(resolve => setTimeout(resolve, 700));
        
        // Mock budget data
        const categories: BudgetCategory[] = [
          { name: 'Housing', budgeted: 2000, spent: 1950 },
          { name: 'Food', budgeted: 800, spent: 920 },
          { name: 'Transportation', budgeted: 400, spent: 385 },
          { name: 'Utilities', budgeted: 300, spent: 310 },
          { name: 'Entertainment', budgeted: 200, spent: 250 },
          { name: 'Healthcare', budgeted: 150, spent: 125 },
          { name: 'Shopping', budgeted: 300, spent: 450 },
          { name: 'Personal', budgeted: 100, spent: 85 },
          { name: 'Savings', budgeted: 500, spent: 500 }
        ];
        
        // Calculate monthly totals
        const monthlyBudget = categories.reduce((sum, cat) => sum + cat.budgeted, 0);
        const monthlySpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
        
        // Daily spending data (for the month view)
        const spending: DailySpending[] = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (30 - i));
          
          // Random daily spending between 100 and 200
          const spent = Math.round(Math.random() * 100 + 100);
          
          return {
            date: date.toISOString().split('T')[0],
            spent,
            budget: Math.round(monthlyBudget / 30)
          };
        });
        
        setBudgetData({
          categories,
          spending,
          monthlyBudget,
          monthlySpent
        });
        
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchBudgetData();
  }, [timeframe]);
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format date for charts
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Calculate the percentage of budget spent
  const getBudgetPercentage = (spent: number, budgeted: number): number => {
    return Math.round((spent / budgeted) * 100);
  };
  
  // Get color based on budget status
  const getBudgetStatusColor = (spent: number, budgeted: number): string => {
    const percentage = getBudgetPercentage(spent, budgeted);
    if (percentage < 85) return 'text-green-600';
    if (percentage < 100) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading Budget Planner...</h2>
        <div className="h-64 bg-gray-200 rounded-md mb-4"></div>
        <div className="h-24 bg-gray-200 rounded-md"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Budget Planner</h2>
        <button className="flex items-center text-sm text-blue-600 hover:text-blue-800">
          <Settings size={16} className="mr-1" />
          Adjust Budget
        </button>
      </div>
      
      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="text-sm text-gray-500 mb-1">Monthly Budget</div>
          <div className="text-xl font-bold">{formatCurrency(budgetData.monthlyBudget)}</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="text-sm text-gray-500 mb-1">Spent So Far</div>
          <div className="text-xl font-bold">{formatCurrency(budgetData.monthlySpent)}</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="text-sm text-gray-500 mb-1">Remaining</div>
          <div className={`text-xl font-bold ${getBudgetStatusColor(budgetData.monthlySpent, budgetData.monthlyBudget)}`}>
            {formatCurrency(budgetData.monthlyBudget - budgetData.monthlySpent)}
          </div>
        </div>
      </div>
      
      {/* Budget vs. Spending Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Budget vs. Actual Spending</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={budgetData.categories}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barSize={20}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => `$${value}`} />
            <Tooltip
              formatter={(value: number) => [`$${value}`, 'Amount']}
              labelFormatter={(value: string) => `Category: ${value}`}
            />
            <Legend verticalAlign="top" height={36} />
            <Bar name="Budgeted" dataKey="budgeted" fill="#8884d8" />
            <Bar name="Spent" dataKey="spent" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Daily Spending Tracker */}
      <div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">Daily Spending Tracker</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={budgetData.spending}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barSize={8}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              interval={4}
            />
            <YAxis tickFormatter={(value) => `$${value}`} />
            <Tooltip
              formatter={(value: number) => [`$${value}`, 'Amount']}
              labelFormatter={(value: string) => `Date: ${formatDate(value)}`}
            />
            <Bar name="Daily Spending" dataKey="spent" fill="#82ca9d">
              {budgetData.spending.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.spent > entry.budget ? '#ff8042' : '#82ca9d'} />
              ))}
            </Bar>
            <Bar name="Daily Budget" dataKey="budget" fill="#8884d8" opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BudgetPlanner;