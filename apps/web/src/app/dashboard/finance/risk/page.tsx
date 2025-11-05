'use client';

import React, { useState, useEffect } from 'react';

type TabType = 'overview' | 'insurance' | 'emergency-fund' | 'protection-gap' | 'claims' | 'optimization';

interface InsurancePolicy {
  id: string;
  type: 'life' | 'health' | 'disability' | 'property' | 'auto' | 'umbrella' | 'business';
  provider: string;
  policyNumber: string;
  coverage: number;
  premium: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  deductible: number;
  startDate: string;
  renewalDate: string;
  status: 'active' | 'pending' | 'expired';
}

interface Claim {
  id: string;
  policyId: string;
  policyType: string;
  claimDate: string;
  amount: number;
  status: 'filed' | 'processing' | 'approved' | 'paid' | 'denied';
  description: string;
}

export default function RiskManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [hasData, setHasData] = useState(false);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [emergencyFund, setEmergencyFund] = useState(0);
  const [emergencyFundTarget, setEmergencyFundTarget] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      // TODO: Implement API endpoint for fetching risk management data
      // const response = await fetch('/api/financial/risk');
      // const data = await response.json();
      // setPolicies(data.policies || []);
      // setClaims(data.claims || []);
      // setEmergencyFund(data.emergencyFund || 0);
      // setEmergencyFundTarget(data.emergencyFundTarget || 0);
      // setMonthlyExpenses(data.monthlyExpenses || 5000);
      // setHasData(data.policies?.length > 0 || data.claims?.length > 0);

      // For now, set empty data - will be populated when users add policies/claims
      setHasData(false);
      setPolicies([]);
      setClaims([]);
      setEmergencyFund(0);
      setEmergencyFundTarget(0);
      setMonthlyExpenses(5000);
    } catch (error) {
      console.error('Error loading risk data:', error);
      setHasData(false);
      setPolicies([]);
      setClaims([]);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Risk Overview', icon: '📊' },
    { id: 'insurance' as const, label: 'Insurance Policies', icon: '🛡️' },
    { id: 'emergency-fund' as const, label: 'Emergency Fund', icon: '💰' },
    { id: 'protection-gap' as const, label: 'Protection Gap Analysis', icon: '📈' },
    { id: 'claims' as const, label: 'Claims Management', icon: '📋' },
    { id: 'optimization' as const, label: 'Optimization', icon: '⚡' },
  ];

  const calculateAnnualPremiums = () => {
    return policies.reduce((sum, policy) => {
      const multiplier = policy.frequency === 'monthly' ? 12 : policy.frequency === 'quarterly' ? 4 : 1;
      return sum + (policy.premium * multiplier);
    }, 0);
  };

  const calculateTotalCoverage = () => {
    return policies.reduce((sum, policy) => sum + policy.coverage, 0);
  };

  const getEmergencyFundProgress = () => {
    if (emergencyFundTarget === 0) return 0;
    return Math.min(100, (emergencyFund / emergencyFundTarget) * 100);
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">🛡️</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        No Risk Management Data Yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
        Start protecting your financial future by adding your insurance policies, setting up your emergency fund,
        and identifying protection gaps.
      </p>
      <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
        Add Insurance Policy
      </button>
    </div>
  );

  const renderOverview = () => {
    if (!hasData) return renderEmptyState();

    const totalAnnualPremiums = calculateAnnualPremiums();
    const totalCoverage = calculateTotalCoverage();
    const emergencyFundProgress = getEmergencyFundProgress();
    const activePolicies = policies.filter(p => p.status === 'active').length;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Coverage</h3>
              <span className="text-2xl">🛡️</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalCoverage.toLocaleString()}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {activePolicies} active policies
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Annual Premiums</h3>
              <span className="text-2xl">💳</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalAnnualPremiums.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              ${(totalAnnualPremiums / 12).toLocaleString()}/month
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Emergency Fund</h3>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${emergencyFund.toLocaleString()}
            </p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>{emergencyFundProgress.toFixed(0)}% of target</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${emergencyFundProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Score</h3>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              Low
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Well protected
            </p>
          </div>
        </div>

        {/* Coverage Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coverage by Type</h3>
          <div className="space-y-4">
            {['life', 'health', 'disability', 'property', 'auto', 'umbrella'].map(type => {
              const typePolicies = policies.filter(p => p.type === type);
              const typeCoverage = typePolicies.reduce((sum, p) => sum + p.coverage, 0);
              const percentage = totalCoverage > 0 ? (typeCoverage / totalCoverage) * 100 : 0;

              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300 capitalize">{type}</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      ${typeCoverage.toLocaleString()} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Renewals</h3>
          <div className="space-y-3">
            {policies
              .filter(p => {
                const renewalDate = new Date(p.renewalDate);
                const today = new Date();
                const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return daysUntilRenewal >= 0 && daysUntilRenewal <= 90;
              })
              .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
              .slice(0, 5)
              .map(policy => {
                const renewalDate = new Date(policy.renewalDate);
                const today = new Date();
                const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={policy.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white capitalize">{policy.type} Insurance</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{policy.provider}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {daysUntilRenewal} days
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {renewalDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            {policies.filter(p => {
              const renewalDate = new Date(p.renewalDate);
              const today = new Date();
              const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return daysUntilRenewal >= 0 && daysUntilRenewal <= 90;
            }).length === 0 && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">No renewals in the next 90 days</p>
            )}
          </div>
        </div>

        {/* Recent Claims */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Claims</h3>
          {claims.length > 0 ? (
            <div className="space-y-3">
              {claims.slice(0, 5).map(claim => (
                <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">{claim.policyType}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{claim.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      ${claim.amount.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      claim.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      claim.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      claim.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      claim.status === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {claim.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-sm">No recent claims</p>
          )}
        </div>
      </div>
    );
  };

  const renderInsurance = () => {
    if (!hasData) return renderEmptyState();

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Insurance Policies</h3>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Add Policy
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {policies.map(policy => (
            <div key={policy.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {policy.type} Insurance
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{policy.provider}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  policy.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  policy.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {policy.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Policy Number</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{policy.policyNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Coverage Amount</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${policy.coverage.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Premium</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${policy.premium.toLocaleString()}/{policy.frequency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Deductible</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${policy.deductible.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Renewal Date</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(policy.renewalDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                  View Details
                </button>
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">
                  File Claim
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmergencyFund = () => {
    const progress = getEmergencyFundProgress();
    const monthsOfExpenses = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;
    const recommendedMonths = 6;
    const recommendedAmount = monthlyExpenses * recommendedMonths;

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Emergency Fund Status</h3>

          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Balance</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${emergencyFund.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Target Amount</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ${recommendedAmount.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mt-3">
              <div
                className={`h-4 rounded-full ${
                  progress >= 100 ? 'bg-green-600' :
                  progress >= 66 ? 'bg-blue-600' :
                  progress >= 33 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {monthsOfExpenses.toFixed(1)} months of expenses covered
            </p>
          </div>

          {!hasData && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                💡 <strong>Tip:</strong> Financial experts recommend keeping 3-6 months of expenses in an easily accessible emergency fund.
                Connect your bank accounts to track your progress automatically.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Emergency Fund Calculator</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monthly Expenses
              </label>
              <input
                type="number"
                value={monthlyExpenses}
                onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Months of Coverage
              </label>
              <select
                value={emergencyFundTarget / monthlyExpenses || 6}
                onChange={(e) => setEmergencyFundTarget(Number(e.target.value) * monthlyExpenses)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={3}>3 months (Minimum)</option>
                <option value={6}>6 months (Recommended)</option>
                <option value={9}>9 months (Conservative)</option>
                <option value={12}>12 months (Very Conservative)</option>
              </select>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recommended Amount</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  ${recommendedAmount.toLocaleString()}
                </span>
              </div>
              {emergencyFund < recommendedAmount && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                  You need ${(recommendedAmount - emergencyFund).toLocaleString()} more to reach your target
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Best Practices</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Keep it Accessible</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Store your emergency fund in a high-yield savings account for easy access in emergencies
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Automate Contributions</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set up automatic transfers to build your fund consistently
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Adjust for Your Situation</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Self-employed or single-income households should aim for 9-12 months
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Replenish After Use</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  If you use your emergency fund, prioritize rebuilding it quickly
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    );
  };

  const renderProtectionGap = () => {
    const humanCapitalValue = 2000000; // Estimated future earnings potential
    const lifeCoverage = policies.filter(p => p.type === 'life').reduce((sum, p) => sum + p.coverage, 0);
    const disabilityCoverage = policies.filter(p => p.type === 'disability').reduce((sum, p) => sum + p.coverage, 0);
    const lifeGap = Math.max(0, humanCapitalValue - lifeCoverage);
    const disabilityGap = Math.max(0, (humanCapitalValue * 0.6) - disabilityCoverage);

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What is Protection Gap Analysis?</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Protection gap analysis identifies the difference between your insurance coverage and your actual financial needs.
            This helps ensure you and your family are adequately protected against financial hardship.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Life Insurance Gap */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🛡️</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Life Insurance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Income replacement protection</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Estimated Need</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${humanCapitalValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Current Coverage</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${lifeCoverage.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Protection Gap</span>
                  <span className={`font-bold ${lifeGap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    ${lifeGap.toLocaleString()}
                  </span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${Math.min(100, (lifeCoverage / humanCapitalValue) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {((lifeCoverage / humanCapitalValue) * 100).toFixed(0)}% covered
                </p>
              </div>

              {lifeGap > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-900 dark:text-red-200">
                    ⚠️ Consider increasing your life insurance coverage by ${lifeGap.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Disability Insurance Gap */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🏥</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Disability Insurance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Income protection if unable to work</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Estimated Need (60%)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${(humanCapitalValue * 0.6).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Current Coverage</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${disabilityCoverage.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Protection Gap</span>
                  <span className={`font-bold ${disabilityGap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    ${disabilityGap.toLocaleString()}
                  </span>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${Math.min(100, (disabilityCoverage / (humanCapitalValue * 0.6)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {((disabilityCoverage / (humanCapitalValue * 0.6)) * 100).toFixed(0)}% covered
                </p>
              </div>

              {disabilityGap > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-900 dark:text-red-200">
                    ⚠️ Consider adding disability coverage of ${disabilityGap.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other Coverage Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coverage Recommendations</h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">🏠</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Home/Property Insurance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Coverage should equal replacement cost, not market value. Consider flood and earthquake riders if applicable.
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Current Coverage:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${policies.filter(p => p.type === 'property').reduce((sum, p) => sum + p.coverage, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">☂️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Umbrella Insurance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Provides additional liability coverage beyond home and auto policies. Recommended: $1-2M for most households.
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Current Coverage:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${policies.filter(p => p.type === 'umbrella').reduce((sum, p) => sum + p.coverage, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">🏥</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Health Insurance</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Consider your out-of-pocket maximum and ensure your emergency fund can cover it.
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Current Coverage:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${policies.filter(p => p.type === 'health').reduce((sum, p) => sum + p.coverage, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Human Capital Calculation Methodology */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">How We Calculate Your Coverage Needs</h4>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <p><strong>Life Insurance:</strong> Based on your human capital value (estimated future earnings potential)</p>
            <p><strong>Disability:</strong> Typically 60-70% of your income to age 65</p>
            <p><strong>Property:</strong> Replacement cost of your home and belongings</p>
            <p><strong>Liability:</strong> Based on your net worth and risk exposure</p>
          </div>
          <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">
            Update My Profile for Accurate Calculations
          </button>
        </div>
      </div>
    );
  };

  const renderClaims = () => {
    if (!hasData || claims.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Claims Filed
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
            When you need to file an insurance claim, you can track it here. We'll help you through the process.
          </p>
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            File New Claim
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Claims History</h3>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            File New Claim
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {claims.map(claim => (
            <div key={claim.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {claim.policyType} Claim
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Filed on {new Date(claim.claimDate).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  claim.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  claim.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  claim.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  claim.status === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {claim.status}
                </span>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-4">{claim.description}</p>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Claim Amount</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${claim.amount.toLocaleString()}
                  </p>
                </div>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOptimization = () => {
    const totalAnnualPremiums = calculateAnnualPremiums();
    const potentialSavings = totalAnnualPremiums * 0.15; // Assume 15% potential savings

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Premium Optimization</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Current Annual Premiums</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                ${totalAnnualPremiums.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">Potential Savings</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                ${potentialSavings.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Optimization Score</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {hasData ? '72/100' : 'N/A'}
              </p>
            </div>
          </div>

          {!hasData && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                💡 Add your insurance policies to see personalized optimization recommendations
              </p>
            </div>
          )}
        </div>

        {/* Optimization Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Optimization Strategies</h3>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">Bundle Policies</h4>
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  Combining your home and auto insurance with the same provider can save 15-25% on premiums.
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Potential Savings:</strong> ${(totalAnnualPremiums * 0.20).toLocaleString()}/year
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-2xl">📊</span>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">Increase Deductibles</h4>
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  Raising your deductible from $500 to $1,000 can reduce premiums by 10-15%.
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Potential Savings:</strong> ${(totalAnnualPremiums * 0.12).toLocaleString()}/year
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-2xl">🔍</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Annual Policy Review</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Shopping around annually can help you find better rates. Insurance rates change frequently.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Recommended:</strong> Compare quotes every 12 months
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="text-2xl">🏆</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Claim Discount Programs</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Many insurers offer discounts for claim-free periods, safe driving, home security systems, and more.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Check for:</strong> Good driver, multi-policy, safety device discounts
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <span className="text-2xl">⚖️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Review Coverage Limits</h4>
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                  Ensure you're not over-insured or under-insured. Adjust coverage as your life circumstances change.
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  <strong>Review triggers:</strong> New home, marriage, children, major purchases
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Efficiency Score */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coverage Efficiency Analysis</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Premium-to-Coverage Ratio</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">Good</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }} />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Your coverage costs are in line with industry standards
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Coverage Comprehensiveness</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {hasData ? 'Very Good' : 'N/A'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: hasData ? '85%' : '0%' }} />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {hasData ? 'You have most essential coverage types' : 'Add policies to see your score'}
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Emergency Preparedness</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {getEmergencyFundProgress() >= 100 ? 'Excellent' : getEmergencyFundProgress() >= 50 ? 'Fair' : 'Needs Attention'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    getEmergencyFundProgress() >= 100 ? 'bg-green-600' :
                    getEmergencyFundProgress() >= 50 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(100, getEmergencyFundProgress())}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Emergency fund at {getEmergencyFundProgress().toFixed(0)}% of target
              </p>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommended Action Items</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              Request quotes from 3-5 providers to compare rates
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              Review and update your beneficiaries on all policies
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              Consider term life insurance if you don't have adequate coverage
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              Build emergency fund to at least 3 months of expenses
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              Set calendar reminder to review all policies annually
            </li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Risk Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Protect your financial future with comprehensive insurance and emergency planning
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex space-x-8 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'insurance' && renderInsurance()}
        {activeTab === 'emergency-fund' && renderEmergencyFund()}
        {activeTab === 'protection-gap' && renderProtectionGap()}
        {activeTab === 'claims' && renderClaims()}
        {activeTab === 'optimization' && renderOptimization()}
      </div>
    </div>
  );
}
