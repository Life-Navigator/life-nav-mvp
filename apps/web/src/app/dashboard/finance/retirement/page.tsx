"use client";

import { useState, useEffect, useCallback } from "react";

// Tab types for retirement planning
type TabType =
  | "overview"
  | "accounts"
  | "social-security"
  | "withdrawals"
  | "roth-conversions"
  | "health-savings"
  | "healthcare"
  | "scenarios";

// Type definitions
interface RetirementPlan {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  targetMonthlyIncome: number;
  readinessScore: number;
  successProbability: number;
  projectedBalance: number;
  projectedShortfall: number;
}

interface RetirementAccount {
  id: string;
  accountName: string;
  accountType: string;
  institution?: string;
  currentBalance: number;
  monthlyContribution: number;
  employerMatch: number;
  expectedReturn: number;
  taxStatus: string;
  projection?: {
    nominalBalance: number;
    realBalance: number;
    totalContributions: number;
    totalGrowth: number;
  };
  contributionRoom?: number;
  rmdAmount?: number;
}

interface SocialSecurityRecord {
  id: string;
  estimatedPIA: number;
  primaryClaimingAge: number;
  fullRetirementAge: number;
  calculatedBenefits?: {
    atAge62: number;
    atFRA: number;
    atAge70: number;
    breakEvenAge62vsFRA: number;
    breakEvenFRAvs70: number;
  };
  optimizedClaimingAge?: number;
  lifetimeBenefit?: number;
}

interface WithdrawalStrategy {
  strategyName: string;
  description: string;
  initialWithdrawalRate: number;
  successProbability: number;
  medianEndingBalance: number;
  averageWithdrawal: number;
  pros: string[];
  cons: string[];
  score: number;
}

interface RothConversionStrategy {
  name: string;
  description: string;
  totalConversions: number;
  totalTaxPaid: number;
  endingRothBalance: number;
  endingTraditionalBalance: number;
  score: number;
}

interface HealthcareProjection {
  phases: Array<{
    name: string;
    startAge: number;
    endAge: number;
    coverageType: string;
    annualTotal: number;
    notes: string[];
  }>;
  totalLifetimeCost: number;
  averageAnnualCost: number;
  savingsTarget: number;
  recommendations: string[];
}

interface HSAAccount {
  id: string;
  provider: string;
  balance: number;
  investedBalance: number;
  cashBalance: number;
  ytdContributions: number;
  employerContributions: number;
  catchUpEligible: boolean;
  hdhdPlanType: "individual" | "family";
  projectedBalance: Array<{
    year: number;
    age: number;
    balance: number;
    contributions: number;
    growth: number;
    medicalExpenses: number;
    taxSavings: number;
  }>;
}

interface FSAAccount {
  id: string;
  type: "healthcare" | "dependent_care" | "transit" | "parking" | "limited_purpose";
  provider: string;
  electionAmount: number;
  usedAmount: number;
  remainingBalance: number;
  carryoverFromLastYear: number;
  planYearEnd: string;
  forfeitsAt: number;
}

interface HSAOptimization {
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
}

interface HSAvsRothComparison {
  scenario: string;
  hsaValue: number;
  rothValue: number;
  difference: number;
  winner: "HSA" | "Roth" | "Tie";
  assumptions: string[];
}

interface HealthSavingsData {
  hsaAccounts: HSAAccount[];
  fsaAccounts: FSAAccount[];
  limits: {
    current: {
      hsa: { individual: number; family: number; catchUp: number };
      fsa: { healthcare: number; carryover: number; dependentCare: number };
      commuter: { transit: number; parking: number };
    };
  };
  userInfo: {
    age: number;
    catchUpEligible: boolean;
    filingStatus: string;
    estimatedMarginalRate: number;
  };
  optimizations: HSAOptimization[];
  hsaVsRothComparison: HSAvsRothComparison[];
  taxSavings: {
    federalSavings: number;
    stateSavings: number;
    ficaSavings: number;
    totalAnnualSavings: number;
    projectedLifetimeSavings: number;
    breakdown: Array<{ category: string; amount: number; description: string }>;
  };
  summary: {
    totalHSABalance: number;
    totalFSARemaining: number;
    projectedAge65HSA: number;
    annualTaxSavings: number;
    lifetimeTaxSavings: number;
  };
}

interface Scenario {
  name: string;
  description: string;
  probability: number;
  impactSeverity: string;
  keyMetrics: {
    successProbability: number;
    portfolioDepletion: number | null;
    legacyAmount: number;
    retirementReadinessScore: number;
  };
  adjustmentsNeeded: string[];
  comparison: {
    baselineSuccess: number;
    scenarioSuccess: number;
    successDelta: number;
  };
}

export default function RetirementPlanningPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [plan, setPlan] = useState<RetirementPlan | null>(null);
  const [accounts, setAccounts] = useState<RetirementAccount[]>([]);
  const [socialSecurity, setSocialSecurity] = useState<SocialSecurityRecord | null>(null);
  const [withdrawalStrategies, setWithdrawalStrategies] = useState<WithdrawalStrategy[]>([]);
  const [rothStrategies, setRothStrategies] = useState<RothConversionStrategy[]>([]);
  const [healthcareProjection, setHealthcareProjection] = useState<HealthcareProjection | null>(null);
  const [healthSavingsData, setHealthSavingsData] = useState<HealthSavingsData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [accountTotals, setAccountTotals] = useState<{
    totalBalance: number;
    totalProjectedBalance: number;
    totalMonthlyContributions: number;
    byTaxStatus: { taxDeferred: number; taxFree: number; taxable: number };
  } | null>(null);

  // Fetch plan data
  const fetchPlanData = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/plans");
      if (response.ok) {
        const data = await response.json();
        if (data.plans && data.plans.length > 0) {
          setPlan(data.plans[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching retirement plan:", err);
    }
  }, []);

  // Fetch accounts data
  const fetchAccountsData = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/accounts?includeProjections=true&includeOptimization=true");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        setAccountTotals(data.totals || null);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  }, []);

  // Fetch Social Security data
  const fetchSocialSecurityData = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/social-security?includeOptimization=true");
      if (response.ok) {
        const data = await response.json();
        if (data.records && data.records.length > 0) {
          setSocialSecurity({
            ...data.records[0],
            calculatedBenefits: data.calculatedBenefits,
            optimizedClaimingAge: data.optimization?.optimalAge,
            lifetimeBenefit: data.optimization?.lifetimeBenefit,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching Social Security:", err);
    }
  }, []);

  // Fetch withdrawal strategies
  const fetchWithdrawalStrategies = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/withdrawal-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id,
          optimize: true,
          portfolioBalance: accountTotals?.totalBalance || 500000,
          annualExpenses: (plan?.targetMonthlyIncome || 5000) * 12,
          retirementYears: (plan?.lifeExpectancy || 90) - (plan?.retirementAge || 65),
          socialSecurityIncome: socialSecurity?.calculatedBenefits?.atFRA || 24000,
          riskTolerance: "moderate",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setWithdrawalStrategies(data.optimization?.strategies || []);
      }
    } catch (err) {
      console.error("Error fetching withdrawal strategies:", err);
    }
  }, [plan, accountTotals, socialSecurity]);

  // Fetch Roth conversion strategies
  const fetchRothStrategies = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/roth-conversions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id,
          optimize: true,
          currentAge: plan?.currentAge || 55,
          retirementAge: plan?.retirementAge || 65,
          lifeExpectancy: plan?.lifeExpectancy || 90,
          traditionalIRABalance: accountTotals?.byTaxStatus?.taxDeferred || 400000,
          rothIRABalance: accountTotals?.byTaxStatus?.taxFree || 100000,
          currentTaxableIncome: 100000,
          filingStatus: "married",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setRothStrategies(data.optimization?.strategies || []);
      }
    } catch (err) {
      console.error("Error fetching Roth strategies:", err);
    }
  }, [plan, accountTotals]);

  // Fetch healthcare projection
  const fetchHealthcareProjection = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/healthcare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id,
          project: true,
          currentAge: plan?.currentAge || 55,
          retirementAge: plan?.retirementAge || 65,
          lifeExpectancy: plan?.lifeExpectancy || 90,
          filingStatus: "married",
          annualIncome: 100000,
          healthStatus: "good",
          includeLTC: true,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setHealthcareProjection(data.projection || null);
      }
    } catch (err) {
      console.error("Error fetching healthcare projection:", err);
    }
  }, [plan]);

  // Fetch health savings (HSA/FSA) data
  const fetchHealthSavingsData = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/health-savings");
      if (response.ok) {
        const data = await response.json();
        setHealthSavingsData(data);
      }
    } catch (err) {
      console.error("Error fetching health savings data:", err);
    }
  }, []);

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      const response = await fetch("/api/retirement/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan?.id,
          analyzeAll: true,
          currentAge: plan?.currentAge || 55,
          retirementAge: plan?.retirementAge || 65,
          lifeExpectancy: plan?.lifeExpectancy || 90,
          currentSavings: accountTotals?.totalBalance || 500000,
          monthlyContributions: accountTotals?.totalMonthlyContributions || 2000,
          socialSecurityBenefit: socialSecurity?.calculatedBenefits?.atFRA || 24000,
          annualExpenses: (plan?.targetMonthlyIncome || 5000) * 12,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.analysis?.scenarios || []);
      }
    } catch (err) {
      console.error("Error fetching scenarios:", err);
    }
  }, [plan, accountTotals, socialSecurity]);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchPlanData(), fetchAccountsData(), fetchSocialSecurityData()]);
      } catch (err) {
        setError("Failed to load retirement data");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchPlanData, fetchAccountsData, fetchSocialSecurityData]);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === "withdrawals" && plan) {
      fetchWithdrawalStrategies();
    } else if (activeTab === "roth-conversions" && plan) {
      fetchRothStrategies();
    } else if (activeTab === "health-savings") {
      fetchHealthSavingsData();
    } else if (activeTab === "healthcare" && plan) {
      fetchHealthcareProjection();
    } else if (activeTab === "scenarios" && plan) {
      fetchScenarios();
    }
  }, [activeTab, plan, fetchWithdrawalStrategies, fetchRothStrategies, fetchHealthSavingsData, fetchHealthcareProjection, fetchScenarios]);

  const tabs = [
    { id: "overview" as TabType, label: "Overview" },
    { id: "accounts" as TabType, label: "Accounts" },
    { id: "social-security" as TabType, label: "Social Security" },
    { id: "withdrawals" as TabType, label: "Withdrawals" },
    { id: "roth-conversions" as TabType, label: "Roth Conversions" },
    { id: "health-savings" as TabType, label: "HSA/FSA" },
    { id: "healthcare" as TabType, label: "Healthcare" },
    { id: "scenarios" as TabType, label: "What-If" },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number, decimals: number = 1) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    if (score >= 40) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  // Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium opacity-90">Retirement Readiness</h2>
            <p className="text-sm opacity-75">Based on Monte Carlo simulation</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">{plan?.readinessScore || 0}</div>
            <div className="text-sm opacity-75">out of 100</div>
          </div>
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-3">
          <div className="bg-white rounded-full h-3 transition-all" style={{ width: `${plan?.readinessScore || 0}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="opacity-75">Success Probability</span>
            <div className="font-semibold text-lg">{formatPercent(plan?.successProbability || 0, 0)}</div>
          </div>
          <div>
            <span className="opacity-75">Years to Retirement</span>
            <div className="font-semibold text-lg">{(plan?.retirementAge || 65) - (plan?.currentAge || 55)} years</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Portfolio</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(accountTotals?.totalBalance || 0)}</div>
          <div className="text-xs text-green-600 mt-1">Projected: {formatCurrency(accountTotals?.totalProjectedBalance || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Monthly Contributions</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(accountTotals?.totalMonthlyContributions || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Est. SS Benefit (FRA)</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency((socialSecurity?.calculatedBenefits?.atFRA || 0) / 12)}/mo</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Healthcare Reserve</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(healthcareProjection?.savingsTarget || 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Tax Allocation</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Tax-Deferred</div>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(accountTotals?.byTaxStatus?.taxDeferred || 0)}</div>
            <div className="text-xs text-gray-500">401(k), Traditional IRA</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Tax-Free</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(accountTotals?.byTaxStatus?.taxFree || 0)}</div>
            <div className="text-xs text-gray-500">Roth IRA, Roth 401(k)</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Taxable</div>
            <div className="text-2xl font-bold text-purple-700">{formatCurrency(accountTotals?.byTaxStatus?.taxable || 0)}</div>
            <div className="text-xs text-gray-500">Brokerage, Savings</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Opportunities</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div>
              <div className="font-medium text-yellow-800">Roth Conversion Opportunity</div>
              <div className="text-sm text-yellow-600">You have room in your current tax bracket</div>
            </div>
            <button onClick={() => setActiveTab("roth-conversions")} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm">Analyze</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <div className="font-medium text-blue-800">Social Security Optimization</div>
              <div className="text-sm text-blue-600">Review optimal claiming strategy</div>
            </div>
            <button onClick={() => setActiveTab("social-security")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Review</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div>
              <div className="font-medium text-green-800">Scenario Analysis</div>
              <div className="text-sm text-green-600">Test your plan against market crashes, inflation</div>
            </div>
            <button onClick={() => setActiveTab("scenarios")} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Explore</button>
          </div>
        </div>
      </div>
    </div>
  );

  // Accounts Tab
  const renderAccounts = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Balance</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(accountTotals?.totalBalance || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Projected at Retirement</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(accountTotals?.totalProjectedBalance || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Monthly Savings</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(accountTotals?.totalMonthlyContributions || 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Retirement Accounts</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ Add Account</button>
        </div>
        <div className="divide-y divide-gray-200">
          {accounts.length > 0 ? accounts.map((account) => (
            <div key={account.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{account.accountName}</div>
                  <div className="text-sm text-gray-500">{account.accountType.replace(/_/g, " ")} {account.institution && `- ${account.institution}`}</div>
                  <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${account.taxStatus === "TAX_FREE" ? "bg-green-100 text-green-700" : account.taxStatus === "TAXABLE" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {account.taxStatus?.replace(/_/g, " ")}
                    </span>
                    {account.contributionRoom && account.contributionRoom > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">{formatCurrency(account.contributionRoom)} room</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{formatCurrency(account.currentBalance)}</div>
                  {account.projection && <div className="text-sm text-green-600">Projected: {formatCurrency(account.projection.nominalBalance)}</div>}
                  <div className="text-xs text-gray-500">+{formatCurrency(account.monthlyContribution)}/mo {account.employerMatch > 0 && `(+${formatCurrency(account.employerMatch)} match)`}</div>
                </div>
              </div>
              {account.rmdAmount && account.rmdAmount > 0 && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">RMD Required: {formatCurrency(account.rmdAmount)} this year</div>
              )}
            </div>
          )) : <div className="p-8 text-center text-gray-500">No retirement accounts found. Add your first account to get started.</div>}
        </div>
      </div>
    </div>
  );

  // Social Security Tab
  const renderSocialSecurity = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-4">Social Security Benefits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-sm opacity-75">At Age 62</div>
            <div className="text-3xl font-bold">{formatCurrency((socialSecurity?.calculatedBenefits?.atAge62 || 0) / 12)}/mo</div>
            <div className="mt-2 px-3 py-1 bg-white/20 rounded-full text-xs">Reduced 30%</div>
          </div>
          <div className="text-center border-x border-white/20">
            <div className="text-sm opacity-75">At Full Retirement ({socialSecurity?.fullRetirementAge || 67})</div>
            <div className="text-3xl font-bold">{formatCurrency((socialSecurity?.calculatedBenefits?.atFRA || 0) / 12)}/mo</div>
            <div className="mt-2 px-3 py-1 bg-white/30 rounded-full text-xs">Full Benefit</div>
          </div>
          <div className="text-center">
            <div className="text-sm opacity-75">At Age 70</div>
            <div className="text-3xl font-bold">{formatCurrency((socialSecurity?.calculatedBenefits?.atAge70 || 0) / 12)}/mo</div>
            <div className="mt-2 px-3 py-1 bg-white/20 rounded-full text-xs">+24% Delayed Credits</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Break-Even Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Age 62 vs Full Retirement</div>
            <div className="text-2xl font-bold text-blue-700">Age {Math.round(socialSecurity?.calculatedBenefits?.breakEvenAge62vsFRA || 77)}</div>
            <p className="text-sm text-gray-600 mt-2">If you live past this age, waiting until FRA provides more lifetime benefits.</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Full Retirement vs Age 70</div>
            <div className="text-2xl font-bold text-purple-700">Age {Math.round(socialSecurity?.calculatedBenefits?.breakEvenFRAvs70 || 82)}</div>
            <p className="text-sm text-gray-600 mt-2">If you live past this age, waiting until 70 provides more lifetime benefits.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Strategy</h3>
        <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{socialSecurity?.optimizedClaimingAge || 70}</div>
          <div>
            <div className="font-semibold text-green-800">Claim at Age {socialSecurity?.optimizedClaimingAge || 70}</div>
            <div className="text-sm text-green-700">Estimated Lifetime Benefit: {formatCurrency(socialSecurity?.lifetimeBenefit || 0)}</div>
            <div className="text-sm text-gray-600 mt-1">Based on life expectancy and break-even analysis</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Withdrawal Strategies Tab
  const renderWithdrawals = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Withdrawal Strategy Comparison</h3>
        <p className="text-sm text-gray-500 mb-6">Compare different withdrawal strategies to find the best fit for your retirement.</p>
        <div className="space-y-4">
          {withdrawalStrategies.length > 0 ? withdrawalStrategies.map((strategy, index) => (
            <div key={index} className={`p-4 border rounded-lg ${index === 0 ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{strategy.strategyName}</span>
                    {index === 0 && <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">Recommended</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{strategy.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{formatPercent(strategy.initialWithdrawalRate)}</div>
                  <div className="text-xs text-gray-500">Initial Rate</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                  <div className={`font-semibold ${strategy.successProbability >= 0.9 ? "text-green-600" : strategy.successProbability >= 0.8 ? "text-yellow-600" : "text-red-600"}`}>
                    {formatPercent(strategy.successProbability, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg Withdrawal</div>
                  <div className="font-semibold text-gray-900">{formatCurrency(strategy.averageWithdrawal)}/yr</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Median Legacy</div>
                  <div className="font-semibold text-gray-900">{formatCurrency(strategy.medianEndingBalance)}</div>
                </div>
              </div>
            </div>
          )) : <div className="text-center py-8 text-gray-500">Loading withdrawal strategies...</div>}
        </div>
      </div>
    </div>
  );

  // Roth Conversions Tab
  const renderRothConversions = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white">
        <h2 className="text-xl font-semibold mb-2">Roth Conversion Optimizer</h2>
        <p className="text-sm opacity-75">Optimize your tax bracket utilization through strategic Roth conversions</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm opacity-75">Traditional IRA Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(accountTotals?.byTaxStatus?.taxDeferred || 0)}</div>
          </div>
          <div>
            <div className="text-sm opacity-75">Roth Balance</div>
            <div className="text-2xl font-bold">{formatCurrency(accountTotals?.byTaxStatus?.taxFree || 0)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Conversion Strategies</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {rothStrategies.length > 0 ? rothStrategies.slice(0, 5).map((strategy, index) => (
            <div key={index} className={`p-4 ${index === 0 ? "bg-purple-50" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{strategy.name}</span>
                    {index === 0 && <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">Optimal</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{strategy.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Score</div>
                  <div className="text-xl font-bold text-gray-900">{strategy.score}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 text-sm">
                <div><div className="text-gray-500">Total Conversions</div><div className="font-semibold">{formatCurrency(strategy.totalConversions)}</div></div>
                <div><div className="text-gray-500">Total Tax Paid</div><div className="font-semibold text-red-600">{formatCurrency(strategy.totalTaxPaid)}</div></div>
                <div><div className="text-gray-500">Ending Roth</div><div className="font-semibold text-green-600">{formatCurrency(strategy.endingRothBalance)}</div></div>
                <div><div className="text-gray-500">Ending Traditional</div><div className="font-semibold">{formatCurrency(strategy.endingTraditionalBalance)}</div></div>
              </div>
            </div>
          )) : <div className="p-8 text-center text-gray-500">Loading Roth conversion strategies...</div>}
        </div>
      </div>
    </div>
  );

  // Health Savings (HSA/FSA) Tab
  const renderHealthSavings = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-4 text-white">
          <div className="text-sm opacity-75">Total HSA Balance</div>
          <div className="text-2xl font-bold">{formatCurrency(healthSavingsData?.summary?.totalHSABalance || 0)}</div>
          <div className="text-xs opacity-75 mt-1">Projected at 65: {formatCurrency(healthSavingsData?.summary?.projectedAge65HSA || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">FSA Remaining</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(healthSavingsData?.summary?.totalFSARemaining || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Use it or lose it!</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Annual Tax Savings</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(healthSavingsData?.summary?.annualTaxSavings || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">From contributions</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Lifetime Tax Savings</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(healthSavingsData?.summary?.lifetimeTaxSavings || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Projected savings</div>
        </div>
      </div>

      {/* Triple Tax Advantage Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-3">HSA Triple Tax Advantage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
            <div>
              <div className="font-medium text-gray-900">Tax-Free Contributions</div>
              <div className="text-sm text-gray-600">Reduce taxable income by contributing pre-tax</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
            <div>
              <div className="font-medium text-gray-900">Tax-Free Growth</div>
              <div className="text-sm text-gray-600">Investment gains grow without taxes</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
            <div>
              <div className="font-medium text-gray-900">Tax-Free Withdrawals</div>
              <div className="text-sm text-gray-600">No tax on qualified medical expenses</div>
            </div>
          </div>
        </div>
      </div>

      {/* HSA Accounts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">HSA Accounts</h3>
            <p className="text-sm text-gray-500">Health Savings Accounts for qualified HDHP enrollees</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">+ Add HSA</button>
        </div>
        <div className="divide-y divide-gray-200">
          {healthSavingsData?.hsaAccounts && healthSavingsData.hsaAccounts.length > 0 ? healthSavingsData.hsaAccounts.map((account) => (
            <div key={account.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{account.provider}</div>
                  <div className="text-sm text-gray-500">{account.hdhdPlanType === "family" ? "Family" : "Individual"} HDHP Coverage</div>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                      {formatCurrency(account.investedBalance)} invested
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {formatCurrency(account.cashBalance)} cash
                    </span>
                    {account.catchUpEligible && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">Catch-up eligible</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(account.balance)}</div>
                  <div className="text-sm text-gray-500">YTD: {formatCurrency(account.ytdContributions)} contributed</div>
                  {account.employerContributions > 0 && (
                    <div className="text-xs text-green-600">+{formatCurrency(account.employerContributions)} employer</div>
                  )}
                </div>
              </div>
              {/* Contribution Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">2024 Contribution Progress</span>
                  <span className="font-medium">
                    {formatCurrency(account.ytdContributions + account.employerContributions)} / {formatCurrency(account.hdhdPlanType === "family" ? (healthSavingsData?.limits?.current?.hsa?.family || 8300) : (healthSavingsData?.limits?.current?.hsa?.individual || 4150))}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((account.ytdContributions + account.employerContributions) / (account.hdhdPlanType === "family" ? (healthSavingsData?.limits?.current?.hsa?.family || 8300) : (healthSavingsData?.limits?.current?.hsa?.individual || 4150))) * 100)}%` }}
                  />
                </div>
                {account.catchUpEligible && (
                  <div className="text-xs text-yellow-600 mt-1">+{formatCurrency(healthSavingsData?.limits?.current?.hsa?.catchUp || 1000)} catch-up available (age 55+)</div>
                )}
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-lg mb-2">No HSA accounts found</div>
              <p className="text-sm">Add your HSA account to track contributions and optimize tax savings</p>
            </div>
          )}
        </div>
      </div>

      {/* FSA Accounts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Flexible Spending Accounts (FSA)</h3>
          <p className="text-sm text-gray-500">Healthcare, Dependent Care, and Commuter benefits</p>
        </div>
        <div className="divide-y divide-gray-200">
          {healthSavingsData?.fsaAccounts && healthSavingsData.fsaAccounts.length > 0 ? healthSavingsData.fsaAccounts.map((fsa) => (
            <div key={fsa.id} className={`p-4 ${fsa.forfeitsAt < 60 ? "bg-red-50" : fsa.forfeitsAt < 120 ? "bg-yellow-50" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">
                    {fsa.type === "healthcare" ? "Healthcare FSA" : fsa.type === "dependent_care" ? "Dependent Care FSA" : fsa.type === "transit" ? "Transit FSA" : "Parking FSA"}
                  </div>
                  <div className="text-sm text-gray-500">{fsa.provider}</div>
                  {fsa.forfeitsAt < 90 && (
                    <div className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full inline-block">
                      {fsa.forfeitsAt} days until forfeit!
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(fsa.remainingBalance)}</div>
                  <div className="text-sm text-gray-500">remaining of {formatCurrency(fsa.electionAmount)}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Usage</span>
                  <span>{formatCurrency(fsa.usedAmount)} used</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${(fsa.usedAmount / fsa.electionAmount) * 100}%` }}
                  />
                </div>
              </div>
              {fsa.carryoverFromLastYear > 0 && (
                <div className="mt-2 text-xs text-green-600">Includes {formatCurrency(fsa.carryoverFromLastYear)} carryover from last year</div>
              )}
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">No FSA accounts found</div>
          )}
        </div>
      </div>

      {/* IRS Limits Reference */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">2024 IRS Contribution Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">HSA Limits</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Individual</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.hsa?.individual || 4150)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Family</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.hsa?.family || 8300)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Catch-up (55+)</span><span className="font-medium">+{formatCurrency(healthSavingsData?.limits?.current?.hsa?.catchUp || 1000)}</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">FSA Limits</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Healthcare</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.fsa?.healthcare || 3200)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Carryover Max</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.fsa?.carryover || 640)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Dependent Care</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.fsa?.dependentCare || 5000)}</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Commuter Limits (Monthly)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Transit</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.commuter?.transit || 315)}/mo</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Parking</span><span className="font-medium">{formatCurrency(healthSavingsData?.limits?.current?.commuter?.parking || 315)}/mo</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Savings Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Savings Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {healthSavingsData?.taxSavings?.breakdown?.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{item.category}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
                <div className="font-semibold text-green-600">{formatCurrency(item.amount)}</div>
              </div>
            ))}
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="text-center">
              <div className="text-sm text-green-600 font-medium">Total Annual Tax Savings</div>
              <div className="text-4xl font-bold text-green-700 mt-2">{formatCurrency(healthSavingsData?.taxSavings?.totalAnnualSavings || 0)}</div>
              <div className="text-sm text-gray-600 mt-2">
                Estimated marginal rate: {formatPercent(healthSavingsData?.userInfo?.estimatedMarginalRate || 0.24, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HSA vs Roth Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">HSA vs Roth IRA Comparison</h3>
        <p className="text-sm text-gray-500 mb-4">See which account provides better value in different scenarios</p>
        <div className="space-y-4">
          {healthSavingsData?.hsaVsRothComparison?.map((comparison, index) => (
            <div key={index} className={`p-4 rounded-lg border ${comparison.winner === "HSA" ? "border-emerald-300 bg-emerald-50" : comparison.winner === "Roth" ? "border-purple-300 bg-purple-50" : "border-gray-200"}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-gray-900">{comparison.scenario}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${comparison.winner === "HSA" ? "bg-emerald-200 text-emerald-800" : "bg-purple-200 text-purple-800"}`}>
                    {comparison.winner} wins by {formatCurrency(Math.abs(comparison.difference))}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={`text-center p-3 rounded-lg ${comparison.winner === "HSA" ? "bg-emerald-100" : "bg-white"}`}>
                  <div className="text-sm text-gray-500">HSA Value</div>
                  <div className="text-xl font-bold text-emerald-700">{formatCurrency(comparison.hsaValue)}</div>
                </div>
                <div className={`text-center p-3 rounded-lg ${comparison.winner === "Roth" ? "bg-purple-100" : "bg-white"}`}>
                  <div className="text-sm text-gray-500">Roth Value</div>
                  <div className="text-xl font-bold text-purple-700">{formatCurrency(comparison.rothValue)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Assumptions: {comparison.assumptions?.join(" | ")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimization Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
        <div className="space-y-3">
          {healthSavingsData?.optimizations?.map((opt, index) => (
            <div key={index} className={`p-4 rounded-lg border ${opt.priority === "high" ? "border-red-200 bg-red-50" : opt.priority === "medium" ? "border-yellow-200 bg-yellow-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${opt.priority === "high" ? "bg-red-200 text-red-800" : opt.priority === "medium" ? "bg-yellow-200 text-yellow-800" : "bg-gray-200 text-gray-800"}`}>
                      {opt.priority}
                    </span>
                    <span className="text-xs text-gray-500">{opt.category}</span>
                  </div>
                  <div className="font-medium text-gray-900 mt-1">{opt.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{opt.description}</div>
                  {opt.action && <div className="text-sm text-blue-600 mt-2">Action: {opt.action}</div>}
                </div>
                {opt.potentialSavings && opt.potentialSavings > 0 && (
                  <div className="text-right ml-4">
                    <div className="text-xs text-gray-500">Potential Savings</div>
                    <div className="font-semibold text-green-600">{formatCurrency(opt.potentialSavings)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Healthcare Tab
  const renderHealthcare = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Lifetime Healthcare Cost</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(healthcareProjection?.totalLifetimeCost || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Average Annual Cost</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(healthcareProjection?.averageAnnualCost || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Recommended Reserve</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(healthcareProjection?.savingsTarget || 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Healthcare Coverage Timeline</h3>
        <div className="space-y-4">
          {healthcareProjection?.phases?.map((phase, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-24 text-center">
                <div className="text-sm text-gray-500">Ages</div>
                <div className="font-semibold">{phase.startAge} - {phase.endAge}</div>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{phase.name}</div>
                <div className="text-sm text-gray-500">{phase.coverageType}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{formatCurrency(phase.annualTotal)}/yr</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Healthcare Planning Tips</h3>
        <ul className="space-y-3">
          {healthcareProjection?.recommendations?.map((rec, index) => (
            <li key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-600 font-bold">*</span>
              <span className="text-sm text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // Scenarios Tab
  const renderScenarios = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">What-If Scenario Analysis</h3>
        <p className="text-sm text-gray-500 mb-6">Test your retirement plan against various life events and market conditions.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scenarios.length > 0 ? scenarios.map((scenario, index) => (
            <div key={index} className={`p-4 border rounded-lg ${scenario.impactSeverity === "critical" ? "border-red-300 bg-red-50" : scenario.impactSeverity === "high" ? "border-orange-300 bg-orange-50" : scenario.impactSeverity === "medium" ? "border-yellow-300 bg-yellow-50" : "border-green-300 bg-green-50"}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-gray-900">{scenario.name}</div>
                  <div className="text-xs text-gray-500">{scenario.description}</div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${scenario.impactSeverity === "critical" ? "bg-red-200 text-red-800" : scenario.impactSeverity === "high" ? "bg-orange-200 text-orange-800" : scenario.impactSeverity === "medium" ? "bg-yellow-200 text-yellow-800" : "bg-green-200 text-green-800"}`}>
                  {scenario.impactSeverity} impact
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-500">Success Rate</div>
                  <div className={`font-semibold ${scenario.keyMetrics.successProbability >= 0.8 ? "text-green-600" : scenario.keyMetrics.successProbability >= 0.6 ? "text-yellow-600" : "text-red-600"}`}>
                    {formatPercent(scenario.keyMetrics.successProbability, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">vs Baseline</div>
                  <div className={`font-semibold ${scenario.comparison.successDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {scenario.comparison.successDelta >= 0 ? "+" : ""}{formatPercent(scenario.comparison.successDelta, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Legacy</div>
                  <div className="font-semibold">{formatCurrency(scenario.keyMetrics.legacyAmount)}</div>
                </div>
              </div>
              {scenario.adjustmentsNeeded.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Key Actions:</div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {scenario.adjustmentsNeeded.slice(0, 2).map((adj, i) => <li key={i}>* {adj}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )) : <div className="col-span-2 text-center py-8 text-gray-500">Loading scenario analysis...</div>}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview": return renderOverview();
      case "accounts": return renderAccounts();
      case "social-security": return renderSocialSecurity();
      case "withdrawals": return renderWithdrawals();
      case "roth-conversions": return renderRothConversions();
      case "health-savings": return renderHealthSavings();
      case "healthcare": return renderHealthcare();
      case "scenarios": return renderScenarios();
      default: return renderOverview();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading retirement data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Retirement Planning</h1>
              <p className="text-sm text-gray-500 mt-1">Advanced retirement analysis and optimization</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(plan?.readinessScore || 0)}`}>Score: {plan?.readinessScore || 0}/100</span>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{renderTabContent()}</div>
    </div>
  );
}
