'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FilingStatus,
  TaxProfile,
  TaxEstimateResult,
  TaxIncomeItem,
  TaxOptimization,
  IncomeCategory,
} from '@/types/tax';

// Tab types
type TabType = 'overview' | 'documents' | 'strategies' | 'benefits' | 'deductions';

// Document types for tax documents
interface TaxDocument {
  id: string;
  type: string;
  year: number;
  issuerName: string;
  status: string;
  grossAmount?: number;
  taxWithheld?: number;
  receivedDate?: string;
  fileName?: string;
  typeInfo?: { name: string; description: string };
}

// Strategy type
interface TaxStrategy {
  id: string;
  strategyType: string;
  name: string;
  description: string;
  estimatedSavings: number;
  goalAlignmentScore: number;
  status: string;
  milestones?: { id: string; title: string; status: string; order: number }[];
}

// Benefits types
interface EmployerBenefits {
  id: string;
  employerName: string;
  isCurrentEmployer: boolean;
  baseSalary?: number;
  bonusTarget?: number;
  healthBenefits: HealthBenefit[];
  retirementBenefits: RetirementBenefit[];
  additionalBenefits: AdditionalBenefit[];
}

interface HealthBenefit {
  id: string;
  planType: string;
  planName?: string;
  coverageLevel?: string;
  monthlyPremium?: number;
  employerContribution?: number;
  hsaEligible?: boolean;
  hsaEmployerContribution?: number;
}

interface RetirementBenefit {
  id: string;
  planType: string;
  employerMatchPct?: number;
  employerMatchLimit?: number;
  employeeContributionPct?: number;
  vestingSchedule?: string;
  isEnrolled?: boolean;
  esppDiscount?: number;
  afterTaxContribAllowed?: boolean;
  inPlanRothConversion?: boolean;
}

interface AdditionalBenefit {
  id: string;
  category: string;
  name: string;
  description?: string;
  maxAmount?: number;
  usedAmount?: number;
  tuitionReimbursement?: number;
  isEnrolled?: boolean;
}

interface BenefitOpportunity {
  category: string;
  title: string;
  description: string;
  potentialSavings: number;
  actionRequired: string;
  priority: number;
}

// Deduction type
interface DeductionOpportunity {
  id: string;
  category: string;
  name: string;
  description?: string;
  estimatedAmount: number;
  potentialSavings: number;
  estimatedSavings?: number;
  status: string;
  actionRequired?: string;
  goalAlignmentScore?: number;
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-2 text-sm ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '+' : ''}
              {trend.value.toFixed(1)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

// Tax Bracket Visualization
function TaxBracketChart({
  estimate,
  filingStatus,
}: {
  estimate: TaxEstimateResult | null;
  filingStatus: FilingStatus;
}) {
  const brackets =
    filingStatus === 'married_jointly'
      ? [
          { rate: 10, max: 23200 },
          { rate: 12, max: 94300 },
          { rate: 22, max: 201050 },
          { rate: 24, max: 383900 },
          { rate: 32, max: 487450 },
          { rate: 35, max: 731200 },
          { rate: 37, max: Infinity },
        ]
      : [
          { rate: 10, max: 11600 },
          { rate: 12, max: 47150 },
          { rate: 22, max: 100525 },
          { rate: 24, max: 191950 },
          { rate: 32, max: 243725 },
          { rate: 35, max: 609350 },
          { rate: 37, max: Infinity },
        ];

  const taxableIncome = estimate?.taxableIncome || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Tax Bracket Analysis
      </h3>
      <div className="space-y-3">
        {brackets.map((bracket, index) => {
          const prevMax = index > 0 ? brackets[index - 1].max : 0;
          const inBracket =
            taxableIncome > prevMax ? Math.min(taxableIncome - prevMax, bracket.max - prevMax) : 0;
          const percentFilled =
            bracket.max === Infinity
              ? taxableIncome > prevMax
                ? 100
                : 0
              : (inBracket / (bracket.max - prevMax)) * 100;

          return (
            <div key={bracket.rate} className="relative">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {bracket.rate}%
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {bracket.max === Infinity
                    ? `$${prevMax.toLocaleString()}+`
                    : `$${prevMax.toLocaleString()} - $${bracket.max.toLocaleString()}`}
                </span>
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentFilled > 0
                      ? bracket.rate <= 12
                        ? 'bg-green-500'
                        : bracket.rate <= 24
                          ? 'bg-blue-500'
                          : bracket.rate <= 32
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      : 'bg-slate-200 dark:bg-slate-600'
                  }`}
                  style={{ width: `${Math.max(percentFilled, 0)}%` }}
                />
              </div>
              {inBracket > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ${inBracket.toLocaleString()} taxed at {bracket.rate}% = $
                  {Math.round(inBracket * (bracket.rate / 100)).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Marginal Rate:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {estimate?.marginalRate || 0}%
          </span>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-slate-600 dark:text-slate-400">Effective Rate:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {(estimate?.effectiveRate || 0).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Income Source Card
function IncomeSourceCard({
  incomes,
  onAddIncome,
}: {
  incomes: TaxIncomeItem[];
  onAddIncome: () => void;
}) {
  const categories: { key: IncomeCategory; label: string; color: string }[] = [
    { key: 'wages', label: 'Wages & Salary', color: 'bg-blue-500' },
    { key: 'self_employment', label: 'Self-Employment', color: 'bg-purple-500' },
    { key: 'business', label: 'Business Income', color: 'bg-indigo-500' },
    { key: 'dividends', label: 'Dividends', color: 'bg-green-500' },
    { key: 'interest', label: 'Interest', color: 'bg-teal-500' },
    { key: 'capital_gains', label: 'Capital Gains', color: 'bg-amber-500' },
    { key: 'rental', label: 'Rental Income', color: 'bg-orange-500' },
    { key: 'retirement', label: 'Retirement', color: 'bg-pink-500' },
    { key: 'social_security', label: 'Social Security', color: 'bg-rose-500' },
    { key: 'other', label: 'Other', color: 'bg-slate-500' },
  ];

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Income Sources</h3>
        <button
          onClick={onAddIncome}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          + Add Income
        </button>
      </div>

      {incomes.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No income sources added yet
          </p>
          <button
            onClick={onAddIncome}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Income
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {categories
              .filter((cat) => incomes.some((i) => i.category === cat.key))
              .map((cat) => {
                const categoryIncomes = incomes.filter((i) => i.category === cat.key);
                const categoryTotal = categoryIncomes.reduce((sum, i) => sum + i.amount, 0);
                const percentage = totalIncome > 0 ? (categoryTotal / totalIncome) * 100 : 0;

                return (
                  <div key={cat.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {cat.label}
                      </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        ${categoryTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">Total Income</span>
              <span className="font-bold text-xl text-slate-900 dark:text-white">
                ${totalIncome.toLocaleString()}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Optimization Card
function OptimizationCard({ optimizations }: { optimizations: TaxOptimization[] }) {
  const complexityColors = {
    simple: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    moderate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    complex: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Tax Optimization Opportunities
      </h3>

      {optimizations.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Add income data to see optimization suggestions
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {optimizations.slice(0, 5).map((opt, index) => (
            <div
              key={index}
              className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900 dark:text-white">{opt.title}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        complexityColors[opt.complexity]
                      }`}
                    >
                      {opt.complexity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {opt.description}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {opt.actionRequired}
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${opt.estimatedSavings.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">potential savings</p>
                </div>
              </div>
              {opt.deadline && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Deadline: {new Date(opt.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
          {optimizations.length > 5 && (
            <button className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              View all {optimizations.length} opportunities
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Quarterly Payments Component
function QuarterlyPayments({
  taxYear,
  estimate,
}: {
  taxYear: number;
  estimate: TaxEstimateResult | null;
}) {
  const quarters = [
    { q: 1, due: `Apr 15, ${taxYear}`, period: 'Jan 1 - Mar 31' },
    { q: 2, due: `Jun 15, ${taxYear}`, period: 'Apr 1 - May 31' },
    { q: 3, due: `Sep 15, ${taxYear}`, period: 'Jun 1 - Aug 31' },
    { q: 4, due: `Jan 15, ${taxYear + 1}`, period: 'Sep 1 - Dec 31' },
  ];

  const estimatedTax = estimate?.totalTaxLiability || 0;
  const quarterlyAmount = Math.ceil(estimatedTax / 4);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Estimated Quarterly Payments
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {quarters.map(({ q, due, period }) => {
          const isPast = new Date(due) < new Date();
          return (
            <div
              key={q}
              className={`p-4 rounded-lg border ${
                isPast
                  ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Q{q}</span>
                {isPast ? (
                  <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400 rounded-full">
                    Past
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full">
                    Upcoming
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                ${quarterlyAmount.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Due: {due}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{period}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Add Income Modal
function AddIncomeModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TaxIncomeItem>) => void;
}) {
  const [formData, setFormData] = useState({
    category: 'wages' as IncomeCategory,
    source: '',
    amount: '',
    taxWithheld: '',
    isW2: true,
    is1099: false,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      category: formData.category,
      source: formData.source,
      amount: parseFloat(formData.amount) || 0,
      taxWithheld: parseFloat(formData.taxWithheld) || 0,
      isW2: formData.isW2,
      is1099: formData.is1099,
      frequency: 'annual',
      expenses: 0,
      qbiEligible: false,
      isQualified: false,
      documentIds: [],
    });
    setFormData({
      category: 'wages',
      source: '',
      amount: '',
      taxWithheld: '',
      isW2: true,
      is1099: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Add Income Source
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Income Type
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as IncomeCategory })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="wages">Wages & Salary (W-2)</option>
              <option value="self_employment">Self-Employment</option>
              <option value="business">Business Income</option>
              <option value="dividends">Dividends</option>
              <option value="interest">Interest</option>
              <option value="capital_gains">Capital Gains</option>
              <option value="rental">Rental Income</option>
              <option value="retirement">Retirement Distributions</option>
              <option value="social_security">Social Security</option>
              <option value="other">Other Income</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Source / Employer
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="e.g., Acme Corporation"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Annual Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                min="0"
                step="100"
                className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tax Withheld (YTD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                value={formData.taxWithheld}
                onChange={(e) => setFormData({ ...formData, taxWithheld: e.target.value })}
                placeholder="0"
                min="0"
                step="100"
                className="w-full pl-7 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isW2}
                onChange={(e) =>
                  setFormData({ ...formData, isW2: e.target.checked, is1099: false })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">W-2 Income</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is1099}
                onChange={(e) =>
                  setFormData({ ...formData, is1099: e.target.checked, isW2: false })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">1099 Income</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Income
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ taxYear }: { taxYear: number }) {
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    total: number;
    pending: number;
    received: number;
    missingTypes: string[];
  }>({ total: 0, pending: 0, received: 0, missingTypes: [] });

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`/api/tax/documents?year=${taxYear}`);
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
          setSummary(data.summary || { total: 0, pending: 0, received: 0, missingTypes: [] });
        }
      } catch (error) {
        console.warn('Failed to fetch documents:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [taxYear]);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    reviewed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    entered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Total Documents</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Received</p>
          <p className="text-2xl font-bold text-green-600">{summary.received || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{summary.pending || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Missing</p>
          <p className="text-2xl font-bold text-red-600">{summary.missingTypes?.length || 0}</p>
        </div>
      </div>

      {/* Missing Documents Alert */}
      {summary.missingTypes && summary.missingTypes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-2">Missing Documents</h4>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Based on your income sources, you may need:{' '}
            {summary.missingTypes.map((t) => t.toUpperCase().replace('_', '-')).join(', ')}
          </p>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tax Documents</h3>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Upload Document
          </button>
        </div>
        {documents.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No documents uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload W-2s, 1099s, and other tax documents
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <svg
                      className="w-6 h-6 text-slate-600 dark:text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {doc.typeInfo?.name || doc.type}
                    </p>
                    <p className="text-sm text-slate-500">{doc.issuerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {doc.grossAmount && (
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      ${doc.grossAmount.toLocaleString()}
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[doc.status] || statusColors.pending}`}
                  >
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Strategies Tab Component
function StrategiesTab({ taxYear }: { taxYear: number }) {
  const [strategies, setStrategies] = useState<TaxStrategy[]>([]);
  const [recommendations, setRecommendations] = useState<TaxStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const res = await fetch(`/api/tax/strategies?year=${taxYear}`);
        if (res.ok) {
          const data = await res.json();
          setStrategies(data.strategies || []);
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.warn('Failed to fetch strategies:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, [taxYear]);

  const statusColors: Record<string, string> = {
    recommended: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
    paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recommended Strategies */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Recommended Strategies
          </h3>
          <p className="text-sm text-slate-500">Goal-aligned tax optimization opportunities</p>
        </div>
        {recommendations.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">
              Add income data to see personalized recommendations
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {recommendations.slice(0, 5).map((strategy) => (
              <div
                key={strategy.strategyType}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {strategy.name}
                      </h4>
                      {strategy.goalAlignmentScore > 70 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          {strategy.goalAlignmentScore}% aligned
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {strategy.description}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${strategy.estimatedSavings.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">potential savings</p>
                  </div>
                </div>
                <button className="mt-3 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                  Start Strategy
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Strategies */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Your Active Strategies
          </h3>
        </div>
        {strategies.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">No active strategies yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Start a recommended strategy above to begin tracking
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{strategy.name}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[strategy.status]}`}
                    >
                      {strategy.status}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    ${strategy.estimatedSavings.toLocaleString()}
                  </p>
                </div>
                {strategy.milestones && strategy.milestones.length > 0 && (
                  <div className="space-y-2">
                    {strategy.milestones
                      .sort((a, b) => a.order - b.order)
                      .map((milestone) => (
                        <div key={milestone.id} className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              milestone.status === 'completed'
                                ? 'bg-green-500'
                                : milestone.status === 'in_progress'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            {milestone.status === 'completed' && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm ${milestone.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            {milestone.title}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Benefits Tab Component
function BenefitsTab() {
  const [benefits, setBenefits] = useState<EmployerBenefits[]>([]);
  const [opportunities, setOpportunities] = useState<BenefitOpportunity[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBenefits = async () => {
      try {
        const res = await fetch('/api/tax/benefits?current=true');
        if (res.ok) {
          const data = await res.json();
          setBenefits(data.benefits || []);
          setOpportunities(data.opportunities || []);
          setTotalSavings(data.totalPotentialSavings || 0);
        }
      } catch (error) {
        console.warn('Failed to fetch benefits:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBenefits();
  }, []);

  const priorityColors: Record<number, string> = {
    10: 'border-l-4 border-l-green-500',
    9: 'border-l-4 border-l-green-400',
    8: 'border-l-4 border-l-blue-500',
    7: 'border-l-4 border-l-blue-400',
    6: 'border-l-4 border-l-amber-500',
    5: 'border-l-4 border-l-amber-400',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentEmployer = benefits.find((b) => b.isCurrentEmployer);

  return (
    <div className="space-y-6">
      {/* Savings Summary */}
      {totalSavings > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
          <h3 className="text-lg font-medium opacity-90">Potential Annual Savings</h3>
          <p className="text-4xl font-bold mt-2">${totalSavings.toLocaleString()}</p>
          <p className="text-sm opacity-80 mt-1">
            {opportunities.length} optimization opportunities found
          </p>
        </div>
      )}

      {/* Employer Benefits */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Employer Benefits
            </h3>
            {currentEmployer && (
              <p className="text-sm text-slate-500">{currentEmployer.employerName}</p>
            )}
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Add Employer
          </button>
        </div>
        {!currentEmployer ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No employer benefits configured</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload your offer letter or benefits summary to get started
            </p>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Upload Offer Letter
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Compensation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500">Base Salary</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  ${currentEmployer.baseSalary?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500">Bonus Target</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {currentEmployer.bonusTarget ? `${currentEmployer.bonusTarget}%` : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500">Health Plans</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {currentEmployer.healthBenefits.length}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500">Retirement Plans</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {currentEmployer.retirementBenefits.length}
                </p>
              </div>
            </div>

            {/* Retirement Benefits */}
            {currentEmployer.retirementBenefits.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Retirement Benefits
                </h4>
                <div className="space-y-2">
                  {currentEmployer.retirementBenefits.map((rb) => (
                    <div
                      key={rb.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {rb.planType.toUpperCase().replace('_', ' ')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {rb.employerMatchPct}% match up to {rb.employerMatchLimit}% of salary
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${rb.isEnrolled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                      >
                        {rb.isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optimization Opportunities */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Optimization Opportunities
          </h3>
          <p className="text-sm text-slate-500">Actions to maximize your benefits</p>
        </div>
        {opportunities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              Add employer benefits to see optimization opportunities
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {opportunities.map((opp, index) => (
              <div key={index} className={`p-4 ${priorityColors[opp.priority] || ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900 dark:text-white">{opp.title}</h4>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full">
                        {opp.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {opp.description}
                    </p>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      {opp.actionRequired}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${opp.potentialSavings.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">potential savings</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Deductions Tab Component
function DeductionsTab({ taxYear }: { taxYear: number }) {
  const [deductions, setDeductions] = useState<DeductionOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeductions = async () => {
      try {
        const res = await fetch(`/api/tax/optimizations?year=${taxYear}`);
        if (res.ok) {
          const data = await res.json();
          // Filter to deduction-type optimizations
          setDeductions(
            data.optimizations?.filter((o: TaxOptimization) =>
              ['housing', 'healthcare', 'charitable', 'education', 'business'].includes(o.category)
            ) || []
          );
        }
      } catch (error) {
        console.warn('Failed to fetch deductions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeductions();
  }, [taxYear]);

  const categoryIcons: Record<string, React.ReactNode> = {
    housing: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    healthcare: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
    charitable: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    education: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
        />
      </svg>
    ),
    business: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  };

  const statusColors: Record<string, string> = {
    identified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    considering: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    planned: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    claimed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalPotentialSavings = deductions.reduce(
    (sum, d) => sum + (d.potentialSavings || d.estimatedSavings),
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Identified Deductions</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{deductions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Potential Tax Savings</p>
          <p className="text-2xl font-bold text-green-600">
            ${totalPotentialSavings.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">Categories</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {new Set(deductions.map((d) => d.category)).size}
          </p>
        </div>
      </div>

      {/* Deductions List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Potential Deductions
          </h3>
          <p className="text-sm text-slate-500">Track and claim eligible tax deductions</p>
        </div>
        {deductions.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="mt-2 text-sm text-slate-500">No deductions identified yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add income and expense data to identify eligible deductions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {deductions.map((deduction) => (
              <div key={deduction.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
                    {categoryIcons[deduction.category] || categoryIcons.business}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {deduction.name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[deduction.status] || statusColors.identified}`}
                      >
                        {deduction.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {deduction.description}
                    </p>
                    {deduction.actionRequired && (
                      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        {deduction.actionRequired}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ${(deduction.potentialSavings || deduction.estimatedSavings).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">savings</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Common Deduction Categories */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Common Deduction Categories
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['housing', 'healthcare', 'charitable', 'education', 'business'].map((cat) => (
            <div key={cat} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
              <div className="flex justify-center text-slate-600 dark:text-slate-400 mb-2">
                {categoryIcons[cat]}
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                {cat}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Tax Planning Page
export default function TaxPlanningPage() {
  const [taxYear] = useState(new Date().getFullYear());
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [estimate, setEstimate] = useState<TaxEstimateResult | null>(null);
  const [incomes, setIncomes] = useState<TaxIncomeItem[]>([]);
  const [optimizations, setOptimizations] = useState<TaxOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 'deductions',
      label: 'Deductions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      id: 'strategies',
      label: 'Strategies',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
    {
      id: 'benefits',
      label: 'Benefits',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, incomeRes, optimizationsRes] = await Promise.all([
        fetch(`/api/tax/profile?year=${taxYear}`),
        fetch(`/api/tax/income?year=${taxYear}`),
        fetch(`/api/tax/optimizations?year=${taxYear}`),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile);
        setEstimate(data.latestEstimate || null);
        if (data.profile?.filingStatus) {
          setFilingStatus(data.profile.filingStatus);
        }
      }

      if (incomeRes.ok) {
        const data = await incomeRes.json();
        setIncomes(data.incomes || []);
      }

      if (optimizationsRes.ok) {
        const data = await optimizationsRes.json();
        setOptimizations(data.optimizations || []);
      }
    } catch (error) {
      console.warn('Failed to fetch tax data:', error);
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddIncome = async (data: Partial<TaxIncomeItem>) => {
    try {
      const res = await fetch('/api/tax/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, taxYear }),
      });

      if (res.ok) {
        // Refetch data and recalculate
        await fetchData();
        await fetch('/api/tax/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taxYear }),
        });
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to add income:', error);
    }
  };

  const handleCreateProfile = async () => {
    try {
      const res = await fetch('/api/tax/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxYear, filingStatus }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalWithholding = incomes.reduce((sum, i) => sum + i.taxWithheld, 0);
  const totalOptimizationSavings = optimizations.reduce((sum, o) => sum + o.estimatedSavings, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tax Planning</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {taxYear} Tax Year - Comprehensive Analysis & Optimization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filingStatus}
            onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          >
            <option value="single">Single</option>
            <option value="married_jointly">Married Filing Jointly</option>
            <option value="married_separately">Married Filing Separately</option>
            <option value="head_of_household">Head of Household</option>
          </select>
          {!profile && (
            <button
              onClick={handleCreateProfile}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Tax Planning
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' && <DocumentsTab taxYear={taxYear} />}
      {activeTab === 'strategies' && <StrategiesTab taxYear={taxYear} />}
      {activeTab === 'benefits' && <BenefitsTab />}
      {activeTab === 'deductions' && <DeductionsTab taxYear={taxYear} />}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Gross Income"
              value={`$${totalIncome.toLocaleString()}`}
              subtitle="Total annual income"
              color="blue"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
            <SummaryCard
              title="Estimated Tax"
              value={`$${(estimate?.totalTaxLiability || 0).toLocaleString()}`}
              subtitle={`${(estimate?.effectiveRate || 0).toFixed(1)}% effective rate`}
              color="amber"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              }
            />
            <SummaryCard
              title={estimate && estimate.refundOrOwed >= 0 ? 'Refund' : 'Amount Owed'}
              value={`$${Math.abs(estimate?.refundOrOwed || 0).toLocaleString()}`}
              subtitle={`$${totalWithholding.toLocaleString()} withheld YTD`}
              color={estimate && estimate.refundOrOwed >= 0 ? 'green' : 'red'}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      estimate && estimate.refundOrOwed >= 0
                        ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                        : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    }
                  />
                </svg>
              }
            />
            <SummaryCard
              title="Optimization Potential"
              value={`$${totalOptimizationSavings.toLocaleString()}`}
              subtitle={`${optimizations.length} opportunities found`}
              color="purple"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              }
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IncomeSourceCard incomes={incomes} onAddIncome={() => setShowAddIncome(true)} />
            <TaxBracketChart estimate={estimate} filingStatus={filingStatus} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OptimizationCard optimizations={optimizations} />
            <QuarterlyPayments taxYear={taxYear} estimate={estimate} />
          </div>

          {/* Tax Breakdown */}
          {estimate && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Tax Calculation Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Income</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Gross Income</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.grossIncome.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Above-line Deductions
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        -${estimate.aboveLineDeductions.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span className="text-slate-700 dark:text-slate-300">AGI</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.adjustedGrossIncome.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Deductions
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Standard</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.standardDeduction.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Itemized</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.itemizedDeductions.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span className="text-slate-700 dark:text-slate-300">
                        Using {estimate.deductionUsed}
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.totalDeductions.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Taxes</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Federal Income Tax</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.ordinaryIncomeTax.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        Self-Employment Tax
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.selfEmploymentTax.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">NIIT</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.netInvestmentIncomeTax.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span className="text-slate-700 dark:text-slate-300">
                        Total Before Credits
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.totalTaxBeforeCredits.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Credits & Payments
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tax Credits</span>
                      <span className="text-green-600 dark:text-green-400">
                        -${estimate.totalCredits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Withholding</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.totalWithholding.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Est. Payments</span>
                      <span className="text-slate-900 dark:text-white">
                        ${estimate.estimatedPayments.toLocaleString()}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between font-medium border-t border-slate-200 dark:border-slate-700 pt-2 ${
                        estimate.refundOrOwed >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      <span>{estimate.refundOrOwed >= 0 ? 'Refund' : 'Owed'}</span>
                      <span>${Math.abs(estimate.refundOrOwed).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Income Modal */}
      <AddIncomeModal
        isOpen={showAddIncome}
        onClose={() => setShowAddIncome(false)}
        onSave={handleAddIncome}
      />
    </div>
  );
}
