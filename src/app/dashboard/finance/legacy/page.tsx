'use client';

import React, { useState, useEffect } from 'react';

type TabType = 'overview' | 'wills-trusts' | 'beneficiaries' | 'digital-assets' | 'healthcare-directives' | 'tax-planning';

interface Will {
  id: string;
  type: 'will' | 'living-will' | 'trust';
  name: string;
  dateCreated: string;
  lastUpdated: string;
  attorney: string;
  location: string;
  status: 'current' | 'needs-update' | 'draft';
}

interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  accountType: string;
  accountName: string;
  percentage: number;
  isPrimary: boolean;
  lastVerified: string;
}

interface DigitalAsset {
  id: string;
  type: 'financial' | 'social' | 'business' | 'personal' | 'crypto';
  name: string;
  platform: string;
  hasSuccessionPlan: boolean;
  value?: number;
  notes: string;
}

export default function LegacyPlanningPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [hasData, setHasData] = useState(false);
  const [wills, setWills] = useState<Will[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [digitalAssets, setDigitalAssets] = useState<DigitalAsset[]>([]);
  const [estateValue, setEstateValue] = useState(0);

  useEffect(() => {
    // In production, fetch from API
    loadLegacyData();
  }, []);

  const loadLegacyData = () => {
    // Demo mode - would fetch from /api/financial/legacy
    const demoMode = true;

    if (!demoMode) {
      setHasData(true);
      // Load real data
    } else {
      setHasData(false);
      setWills([]);
      setBeneficiaries([]);
      setDigitalAssets([]);
      setEstateValue(0);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Estate Overview', icon: '🏛️' },
    { id: 'wills-trusts' as const, label: 'Wills & Trusts', icon: '📜' },
    { id: 'beneficiaries' as const, label: 'Beneficiaries', icon: '👥' },
    { id: 'digital-assets' as const, label: 'Digital Assets', icon: '💻' },
    { id: 'healthcare-directives' as const, label: 'Healthcare Directives', icon: '🏥' },
    { id: 'tax-planning' as const, label: 'Estate Tax Planning', icon: '💰' },
  ];

  const calculateEstateCompleteness = () => {
    let score = 0;
    if (wills.some(w => w.type === 'will' && w.status === 'current')) score += 25;
    if (wills.some(w => w.type === 'living-will' && w.status === 'current')) score += 15;
    if (beneficiaries.length > 0) score += 20;
    if (digitalAssets.some(a => a.hasSuccessionPlan)) score += 20;
    if (wills.some(w => w.type === 'trust')) score += 20;
    return score;
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">🏛️</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Start Your Legacy Planning
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
        Protect your loved ones and ensure your wishes are carried out by creating a comprehensive estate plan.
        Start with a will, designate beneficiaries, and plan for your digital legacy.
      </p>
      <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
        Begin Estate Planning
      </button>
    </div>
  );

  const renderOverview = () => {
    const completeness = calculateEstateCompleteness();
    const hasWill = wills.some(w => w.type === 'will' && w.status === 'current');
    const hasLivingWill = wills.some(w => w.type === 'living-will' && w.status === 'current');
    const hasTrust = wills.some(w => w.type === 'trust');
    const beneficiariesCurrent = beneficiaries.filter(b => {
      const lastVerified = new Date(b.lastVerified);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return lastVerified > oneYearAgo;
    }).length;

    if (!hasData) return renderEmptyState();

    return (
      <div className="space-y-6">
        {/* Estate Planning Score */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-white">
          <h3 className="text-2xl font-bold mb-2">Estate Planning Completeness</h3>
          <div className="flex items-end gap-4 mb-4">
            <div className="text-6xl font-bold">{completeness}%</div>
            <div className="text-xl mb-2">
              {completeness >= 80 ? 'Excellent' : completeness >= 60 ? 'Good' : completeness >= 40 ? 'Fair' : 'Needs Attention'}
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="mt-4 text-blue-100">
            {completeness < 100 ? `Complete ${100 - completeness}% more to have a comprehensive estate plan` : 'Your estate plan is comprehensive!'}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Estimated Estate Value</h3>
              <span className="text-2xl">💎</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${estateValue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Including all assets &amp; liabilities
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents</h3>
              <span className="text-2xl">📜</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {wills.filter(w => w.status === 'current').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Current estate documents
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Beneficiaries</h3>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {beneficiaries.length}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {beneficiariesCurrent} verified recently
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Digital Assets</h3>
              <span className="text-2xl">💻</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {digitalAssets.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {digitalAssets.filter(a => a.hasSuccessionPlan).length} with succession plan
            </p>
          </div>
        </div>

        {/* Estate Planning Checklist */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Estate Planning Checklist</h3>
          <div className="space-y-3">
            {[
              { label: 'Last Will and Testament', completed: hasWill, importance: 'Critical' },
              { label: 'Living Will / Healthcare Directive', completed: hasLivingWill, importance: 'Critical' },
              { label: 'Durable Power of Attorney', completed: false, importance: 'Critical' },
              { label: 'Healthcare Power of Attorney', completed: false, importance: 'Critical' },
              { label: 'Beneficiary Designations (All Accounts)', completed: beneficiaries.length > 0, importance: 'High' },
              { label: 'Trust Documents', completed: hasTrust, importance: 'Medium' },
              { label: 'Digital Asset Inventory', completed: digitalAssets.length > 0, importance: 'Medium' },
              { label: 'Letter of Intent', completed: false, importance: 'Medium' },
              { label: 'Guardian Designations (if applicable)', completed: false, importance: 'High' },
              { label: 'Funeral/Burial Instructions', completed: false, importance: 'Low' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    item.completed
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-400'
                  }`}>
                    {item.completed && '✓'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Importance: {item.importance}</p>
                  </div>
                </div>
                {!item.completed && (
                  <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                    Start
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">⚠️ Action Required</h3>
            <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
              {!hasWill && <li>• Create a Last Will and Testament</li>}
              {!hasLivingWill && <li>• Establish a Living Will / Healthcare Directive</li>}
              {beneficiaries.length === 0 && <li>• Designate beneficiaries on all accounts</li>}
              {wills.some(w => w.status === 'needs-update') && <li>• Update outdated estate documents</li>}
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">💡 Recommendations</h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>• Review and update documents every 3-5 years</li>
              <li>• Update after major life events (marriage, divorce, children)</li>
              <li>• Keep original documents in a safe place</li>
              <li>• Inform executor and family of document locations</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderWillsTrusts = () => {
    if (!hasData || wills.length === 0) {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Estate Documents on File
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                A will is the foundation of any estate plan. It specifies how your assets should be distributed,
                who should care for minor children, and who will execute your wishes.
              </p>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Create Your Will
              </button>
            </div>
          </div>

          {/* Educational Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Last Will &amp; Testament</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Specifies asset distribution, guardianship, and executors. Essential for everyone with assets or dependents.
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>• Asset distribution instructions</li>
                <li>• Executor appointment</li>
                <li>• Guardian designation</li>
                <li>• Specific bequests</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Living Trust</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Holds assets during lifetime and distributes them after death. Avoids probate and provides privacy.
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>• Avoids probate process</li>
                <li>• Privacy protection</li>
                <li>• Disability planning</li>
                <li>• Flexible management</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Living Will</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Specifies end-of-life care preferences. Ensures your healthcare wishes are known and followed.
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>• End-of-life care wishes</li>
                <li>• Life support decisions</li>
                <li>• Pain management</li>
                <li>• Organ donation</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Estate Documents</h3>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Add Document
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {wills.map(will => (
            <div key={will.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {will.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{will.type.replace('-', ' ')}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  will.status === 'current' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  will.status === 'needs-update' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {will.status === 'needs-update' ? 'Needs Update' : will.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Date Created</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(will.dateCreated).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(will.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Attorney</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {will.attorney}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Location</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {will.location}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                  View Document
                </button>
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">
                  Update
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Planning Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Consider a Living Trust</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            A living trust can help your estate avoid probate, maintain privacy, and provide greater control over asset distribution.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Benefits:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>✓ Avoids probate process</li>
                <li>✓ Maintains privacy</li>
                <li>✓ Reduces estate settlement time</li>
                <li>✓ Flexibility for changes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Considerations:</h4>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Higher initial setup cost</li>
                <li>• Requires asset transfers</li>
                <li>• Ongoing management</li>
                <li>• State-specific rules</li>
              </ul>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
            Learn About Trusts
          </button>
        </div>
      </div>
    );
  };

  const renderBeneficiaries = () => {
    if (!hasData || beneficiaries.length === 0) {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Beneficiaries on Record
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                Designating beneficiaries ensures your assets go directly to your loved ones without probate.
                Review and update beneficiaries on all accounts regularly.
              </p>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Add Beneficiaries
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
              ⚠️ Why Beneficiary Designations Matter
            </h3>
            <div className="space-y-3 text-sm text-yellow-800 dark:text-yellow-200">
              <p>
                <strong>Supersede Your Will:</strong> Beneficiary designations on accounts like life insurance, retirement plans,
                and bank accounts override instructions in your will.
              </p>
              <p>
                <strong>Avoid Probate:</strong> Assets with designated beneficiaries transfer directly without going through probate,
                saving time and money.
              </p>
              <p>
                <strong>Regular Updates Needed:</strong> Life changes like marriage, divorce, births, and deaths require updating
                beneficiary designations.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Accounts to Review</h3>
            <div className="space-y-3">
              {[
                'Life Insurance Policies',
                'Retirement Accounts (401k, IRA)',
                'Bank Accounts (Checking, Savings)',
                'Investment Accounts',
                'Health Savings Accounts (HSA)',
                'Annuities',
                'Real Estate (TOD/POD deeds)',
              ].map((account, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-900 dark:text-white">{account}</span>
                  <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Beneficiary Designations</h3>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Add Beneficiary
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Designations</h4>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{beneficiaries.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Primary Beneficiaries</h4>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {beneficiaries.filter(b => b.isPrimary).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Needs Review</h4>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {beneficiaries.filter(b => {
                const lastVerified = new Date(b.lastVerified);
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                return lastVerified < oneYearAgo;
              }).length}
            </p>
          </div>
        </div>

        {/* Beneficiaries List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Beneficiary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Share
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Verified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {beneficiaries.map(beneficiary => {
                  const lastVerified = new Date(beneficiary.lastVerified);
                  const oneYearAgo = new Date();
                  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                  const needsReview = lastVerified < oneYearAgo;

                  return (
                    <tr key={beneficiary.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{beneficiary.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{beneficiary.relationship}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">{beneficiary.accountName}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{beneficiary.accountType}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          beneficiary.isPrimary
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {beneficiary.isPrimary ? 'Primary' : 'Contingent'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {beneficiary.percentage}%
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className={needsReview ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}>
                            {lastVerified.toLocaleDateString()}
                          </p>
                          {needsReview && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">Needs review</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDigitalAssets = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Digital Asset Planning</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your digital assets include online accounts, cryptocurrencies, digital files, and intellectual property.
            Creating a digital estate plan ensures your loved ones can access and manage these assets.
          </p>

          {(!hasData || digitalAssets.length === 0) && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💻</div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start documenting your digital assets and creating succession plans
              </p>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Create Digital Asset Inventory
              </button>
            </div>
          )}
        </div>

        {/* Categories of Digital Assets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💰</span>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Accounts</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Online banking</li>
              <li>• Investment platforms</li>
              <li>• Cryptocurrency wallets</li>
              <li>• Payment apps (PayPal, Venmo)</li>
              <li>• Digital payment services</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Assets tracked: {digitalAssets.filter(a => a.type === 'financial').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">👤</span>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Social Media</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Facebook, Instagram, Twitter</li>
              <li>• LinkedIn profiles</li>
              <li>• YouTube channels</li>
              <li>• TikTok, Snapchat</li>
              <li>• Other social platforms</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Assets tracked: {digitalAssets.filter(a => a.type === 'social').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💼</span>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Business Assets</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Domain names</li>
              <li>• Websites and blogs</li>
              <li>• Email accounts</li>
              <li>• Business software licenses</li>
              <li>• Cloud storage</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Assets tracked: {digitalAssets.filter(a => a.type === 'business').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🖼️</span>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Files</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Photos and videos</li>
              <li>• Documents and files</li>
              <li>• Music and media libraries</li>
              <li>• Cloud storage accounts</li>
              <li>• Digital subscriptions</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Assets tracked: {digitalAssets.filter(a => a.type === 'personal').length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">₿</span>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Cryptocurrency</h4>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Hardware wallets</li>
              <li>• Exchange accounts</li>
              <li>• Software wallets</li>
              <li>• NFTs and digital collectibles</li>
              <li>• DeFi positions</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Assets tracked: {digitalAssets.filter(a => a.type === 'crypto').length}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg shadow p-6 flex items-center justify-center">
            <button className="text-center">
              <div className="text-4xl mb-2">➕</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Add Category</p>
            </button>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            💡 Digital Asset Planning Best Practices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <h4 className="font-semibold mb-2">Documentation:</h4>
              <ul className="space-y-1">
                <li>✓ Create a comprehensive inventory</li>
                <li>✓ Include account usernames (not passwords)</li>
                <li>✓ Note locations of password vaults</li>
                <li>✓ Document recovery procedures</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Security:</h4>
              <ul className="space-y-1">
                <li>✓ Use a password manager</li>
                <li>✓ Enable two-factor authentication</li>
                <li>✓ Share vault access with trusted person</li>
                <li>✓ Store recovery keys securely</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Legacy Contacts:</h4>
              <ul className="space-y-1">
                <li>✓ Designate legacy contacts on platforms</li>
                <li>✓ Document memorialization preferences</li>
                <li>✓ Include in estate planning documents</li>
                <li>✓ Inform executors of digital assets</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Regular Maintenance:</h4>
              <ul className="space-y-1">
                <li>✓ Update inventory quarterly</li>
                <li>✓ Review access permissions annually</li>
                <li>✓ Remove closed accounts</li>
                <li>✓ Update after life changes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHealthcareDirectives = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Healthcare Directives</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Healthcare directives ensure your medical wishes are known and followed if you're unable to communicate them yourself.
            These critical documents give guidance to your family and healthcare providers during difficult times.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Living Will */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">📋</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Living Will</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Advance Healthcare Directive</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Specifies your wishes regarding end-of-life medical care, including life support, resuscitation, and pain management.
            </p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
                  <span className="text-gray-400">?</span>
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Not yet created</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <p className="font-medium">Should specify:</p>
              <ul className="space-y-1 pl-4">
                <li>• Life-sustaining treatment preferences</li>
                <li>• CPR and resuscitation wishes</li>
                <li>• Artificial nutrition and hydration</li>
                <li>• Pain management and palliative care</li>
                <li>• Organ donation preferences</li>
              </ul>
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Create Living Will
            </button>
          </div>

          {/* Healthcare Power of Attorney */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">👨‍⚕️</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Healthcare Power of Attorney</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Medical Proxy</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Designates someone to make medical decisions on your behalf if you're unable to do so. This person should understand
              your values and wishes.
            </p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
                  <span className="text-gray-400">?</span>
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">No healthcare agent designated</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <p className="font-medium">Your agent can:</p>
              <ul className="space-y-1 pl-4">
                <li>• Make treatment decisions</li>
                <li>• Access medical records</li>
                <li>• Communicate with healthcare providers</li>
                <li>• Choose care facilities</li>
                <li>• Consent to or refuse treatment</li>
              </ul>
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Designate Healthcare Agent
            </button>
          </div>

          {/* HIPAA Authorization */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔐</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">HIPAA Authorization</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Medical Information Release</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Authorizes specific individuals to access your protected health information. Important for family members
              who may need to coordinate your care.
            </p>

            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Authorized individuals:</p>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                No one currently authorized
              </div>
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Add HIPAA Authorization
            </button>
          </div>

          {/* DNR Order */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🚑</span>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">DNR/POLST</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Do Not Resuscitate / POLST</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Medical orders that specify treatment preferences for life-threatening situations. Particularly important
              for those with serious illnesses or advanced age.
            </p>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <p className="font-medium">Covers:</p>
              <ul className="space-y-1 pl-4">
                <li>• CPR preferences</li>
                <li>• Medical interventions</li>
                <li>• Antibiotics and hydration</li>
                <li>• Hospital transfer preferences</li>
              </ul>
            </div>

            <button className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
              Learn More
            </button>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
            📢 Important Considerations
          </h3>
          <div className="space-y-3 text-sm text-yellow-800 dark:text-yellow-200">
            <p>
              <strong>Discuss with Family:</strong> Have conversations with family members about your healthcare wishes.
              Make sure your healthcare agent understands your values and preferences.
            </p>
            <p>
              <strong>Keep Accessible:</strong> Store copies where they can be quickly accessed in an emergency. Give copies
              to your healthcare agent, family members, and primary care physician.
            </p>
            <p>
              <strong>Review Regularly:</strong> Review and update your healthcare directives every few years or after
              major life events or changes in health status.
            </p>
            <p>
              <strong>State-Specific Forms:</strong> Healthcare directive forms vary by state. Ensure you use the correct
              forms for your state of residence.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Create Your Healthcare Directives?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            We can guide you through the process step by step
          </p>
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Start Healthcare Directive Wizard
          </button>
        </div>
      </div>
    );
  };

  const renderTaxPlanning = () => {
    const estateExemption2024 = 13610000; // Federal estate tax exemption for 2024
    const estateTax = Math.max(0, (estateValue - estateExemption2024) * 0.4);

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Estate Tax Planning</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Proper estate tax planning can significantly reduce the tax burden on your beneficiaries and maximize
            the wealth transfer to your loved ones.
          </p>
        </div>

        {/* Estate Tax Calculation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Federal Estate Tax Estimate</h3>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">Gross Estate Value</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                ${estateValue.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">Federal Exemption (2024)</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                -${estateExemption2024.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <span className="font-semibold text-gray-900 dark:text-white">Taxable Estate</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${Math.max(0, estateValue - estateExemption2024).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span className="font-semibold text-red-900 dark:text-red-100">Estimated Estate Tax (40%)</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                ${estateTax.toLocaleString()}
              </span>
            </div>
          </div>

          {estateValue > estateExemption2024 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                ⚠️ Your estate may be subject to federal estate tax. Consider tax reduction strategies below.
              </p>
            </div>
          )}

          {estateValue <= estateExemption2024 && estateValue > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-900 dark:text-green-100">
                ✓ Your estate is currently below the federal exemption threshold. No federal estate tax estimated.
              </p>
            </div>
          )}
        </div>

        {/* Tax Reduction Strategies */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Reduction Strategies</h3>

          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎁</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Annual Gift Tax Exclusion</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Give up to $18,000 per person ($36,000 for married couples) annually without gift tax or reducing your lifetime exemption.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Example:</strong> A couple with 3 children can gift $108,000/year ($36k × 3) tax-free,
                      removing $1.08M from their estate in 10 years.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏦</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Irrevocable Life Insurance Trust (ILIT)</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Remove life insurance proceeds from your taxable estate by transferring ownership to an ILIT.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Benefit:</strong> A $2M policy in an ILIT could save your heirs $800,000 in estate taxes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏛️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Charitable Remainder Trust (CRT)</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Donate assets to charity while receiving income during your lifetime. Provides immediate tax deduction
                    and removes assets from estate.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Benefits:</strong> Immediate charitable deduction, income stream, estate tax reduction, capital gains avoidance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">👨‍👩‍👧‍👦</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Family Limited Partnership (FLP)</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Transfer business interests or real estate to family members at discounted values using valuation discounts.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Strategy:</strong> Valuation discounts of 25-40% can significantly reduce gift and estate taxes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎓</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">529 Education Plans &amp; Direct Payments</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Contribute to 529 plans for grandchildren or pay tuition/medical expenses directly without gift tax.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Tip:</strong> Direct payments to educational or medical institutions don't count toward annual gift limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💍</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Spousal Lifetime Access Trust (SLAT)</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Remove assets from your estate while maintaining indirect access through your spouse.
                  </p>
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                      <strong>Advantage:</strong> Uses lifetime exemption now before potential future reductions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* State Estate Tax */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">State Estate Tax Considerations</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            12 states and DC impose their own estate or inheritance taxes, often with lower exemptions than federal.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
              <strong>States with Estate Tax:</strong> Connecticut, Hawaii, Illinois, Maine, Maryland, Massachusetts,
              Minnesota, New York, Oregon, Rhode Island, Vermont, Washington, and DC.
            </p>
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>States with Inheritance Tax:</strong> Iowa, Kentucky, Maryland, Nebraska, New Jersey, Pennsylvania.
            </p>
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Next Steps</h3>
          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-left flex items-center justify-between">
              <span>Schedule Estate Planning Consultation</span>
              <span>→</span>
            </button>
            <button className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-purple-200 dark:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors text-left flex items-center justify-between">
              <span>Download Estate Tax Planning Guide</span>
              <span>↓</span>
            </button>
            <button className="w-full px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-purple-200 dark:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors text-left flex items-center justify-between">
              <span>Calculate Your Estate Tax Liability</span>
              <span>🧮</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Legacy &amp; Estate Planning</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Protect your legacy and ensure your wishes are carried out
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
        {activeTab === 'wills-trusts' && renderWillsTrusts()}
        {activeTab === 'beneficiaries' && renderBeneficiaries()}
        {activeTab === 'digital-assets' && renderDigitalAssets()}
        {activeTab === 'healthcare-directives' && renderHealthcareDirectives()}
        {activeTab === 'tax-planning' && renderTaxPlanning()}
      </div>
    </div>
  );
}
