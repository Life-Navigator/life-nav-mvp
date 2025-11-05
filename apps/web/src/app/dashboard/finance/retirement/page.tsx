'use client';

import React from 'react';
import RetirementCalculator from '@/components/domain/finance/retirement/RetirementCalculator';

export default function RetirementPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Retirement Planning</h1>
        <p className="text-slate-500 dark:text-slate-400">Plan and secure your financial future</p>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="p-6">
          <RetirementCalculator />
        </div>
      </div>
    </div>
  );
}