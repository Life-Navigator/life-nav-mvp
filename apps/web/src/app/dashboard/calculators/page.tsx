'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { Search, Calculator as CalculatorIcon } from 'lucide-react';

interface CalculatorItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  available: boolean;
}

const calculators: CalculatorItem[] = [
  {
    id: 'retirement',
    name: 'Retirement Calculator',
    description: 'Plan your retirement savings',
    category: 'financial',
    icon: 'retirement-icon',
    color: 'from-blue-500 to-blue-600',
    available: true,
  },
  {
    id: 'mortgage',
    name: 'Mortgage Calculator',
    description: 'Calculate mortgage payments',
    category: 'financial',
    icon: 'mortgage-icon',
    color: 'from-green-500 to-green-600',
    available: true,
  },
  {
    id: 'loan',
    name: 'Loan Payment Calculator',
    description: 'Estimate loan payments',
    category: 'financial',
    icon: 'loan-icon',
    color: 'from-yellow-500 to-yellow-600',
    available: true,
  },
  {
    id: 'debt-payoff',
    name: 'Debt Payoff Calculator',
    description: 'Create debt elimination plan',
    category: 'financial',
    icon: 'debt-icon',
    color: 'from-red-500 to-red-600',
    available: true,
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest Calculator',
    description: 'See investment growth',
    category: 'financial',
    icon: 'compound-icon',
    color: 'from-purple-500 to-purple-600',
    available: true,
  },
  {
    id: 'rent-vs-buy',
    name: 'Rent vs Buy / Lease vs Buy',
    description: 'Compare renting vs buying (house & auto)',
    category: 'financial',
    icon: 'house-icon',
    color: 'from-cyan-500 to-blue-600',
    available: true,
  },
  {
    id: 'cash-vs-financing',
    name: 'Cash vs Financing Strategy',
    description: 'Optimize asset purchases with retirement accounts',
    category: 'financial',
    icon: 'wallet-icon',
    color: 'from-emerald-500 to-teal-600',
    available: true,
  },
];

export default function CalculatorsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCalculators = useMemo(() => {
    return calculators.filter((calc) => {
      const matchesSearch =
        searchQuery === '' ||
        calc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        calc.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Calculators Hub</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Powerful tools to help you make informed decisions
          </p>
        </div>

        <div className="mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search calculators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCalculators.length} calculators
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCalculators.map((calculator) => (
            <CalculatorCard key={calculator.id} calculator={calculator} />
          ))}
        </div>

        {filteredCalculators.length === 0 && (
          <div className="text-center py-12">
            <CalculatorIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No calculators found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalculatorCard({ calculator }: { calculator: CalculatorItem }) {
  const cardContent = (
    <Card className="h-full transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
      <div className="p-6 h-full flex flex-col">
        <div
          className={`w-16 h-16 rounded-xl bg-gradient-to-br ${calculator.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}
        >
          {calculator.icon === 'retirement-icon' && '🏖️'}
          {calculator.icon === 'mortgage-icon' && '🏠'}
          {calculator.icon === 'loan-icon' && '💰'}
          {calculator.icon === 'debt-icon' && '💳'}
          {calculator.icon === 'compound-icon' && '📈'}
          {calculator.icon === 'house-icon' && '🏘️'}
          {calculator.icon === 'wallet-icon' && '💵'}
        </div>

        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
            {calculator.name}
          </h3>
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Available
          </span>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-1">
          {calculator.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 capitalize">
            {calculator.category}
          </span>
          <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">Calculate →</span>
        </div>
      </div>
    </Card>
  );

  return <Link href={`/dashboard/calculators/${calculator.id}`}>{cardContent}</Link>;
}
