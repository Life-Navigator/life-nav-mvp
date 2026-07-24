'use client';

import React, { useState } from 'react';
import FinancialResolverPanel from '@/components/finance/FinancialResolverPanel';
import { AccountType } from '@/types/financial';
import AccountTypeFilter from '@/components/financial/accounts/AccountTypeFilter';
import NetWorthSummary from '@/components/financial/accounts/NetWorthSummary';
import InstitutionGroup from '@/components/financial/accounts/InstitutionGroup';
import AddAccountButton from '@/components/financial/accounts/AddAccountButton';
import ConnectAccountModal from '@/components/financial/accounts/ConnectAccountModal';
import { normalizeFinancePayload } from '@/lib/finance/domainViewModel';
// Removed mock data import - will fetch from database

export default function AccountsPage() {
  const [selectedType, setSelectedType] = useState<AccountType | 'all'>('all');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [canonicalSummary, setCanonicalSummary] = useState<any | null>(null);

  // Fetch accounts from the Finance aggregator (/api/financial). That endpoint is
  // a proxy that returns the Core API DomainViewModel (accounts nested), NOT a
  // top-level `accounts` array — reading `data.accounts` directly is why this page
  // rendered empty for every user. Run the response through normalizeFinancePayload,
  // which handles both the proxy shape and the legacy payload.
  React.useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/financial?timeframe=month');
        if (!response.ok) {
          console.warn('[Accounts] /api/financial returned', response.status);
          setAccounts([]);
          return;
        }
        const data = await response.json();
        const norm = normalizeFinancePayload(data);
        setAccounts(Array.isArray(norm.accounts) ? norm.accounts : []);
      } catch (error) {
        console.error('[Accounts] Error fetching accounts:', error);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  // Net worth on this page comes from the ONE canonical finance summary — never a
  // client-side sum of the account list (which would disagree with every other page).
  React.useEffect(() => {
    fetch('/api/finance/canonical-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.net_worth === 'number') setCanonicalSummary(d);
      })
      .catch(() => {});
  }, []);

  // Filter accounts based on selected type
  const filteredAccounts =
    selectedType === 'all' ? accounts : accounts.filter((acc) => acc.type === selectedType);

  // Group accounts by institution
  const accountGroups = filteredAccounts.reduce((groups: any, account: any) => {
    const institution = account.institution || 'Other';
    if (!groups[institution]) {
      groups[institution] = [];
    }
    groups[institution].push(account);
    return groups;
  }, {});

  // Handle account click
  const handleAccountClick = (accountId: string) => {
    // In a real implementation, this would navigate to the account details page
    console.log('Account clicked:', accountId);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 md:mb-0">
          Financial Accounts
        </h1>
        <div className="mb-6">
          <FinancialResolverPanel
            title="Account balances (canonical)"
            keys={['cash_balance', 'investment_balance', 'retirement_balance', 'debt_total']}
          />
        </div>
        <button
          onClick={() => setIsConnectModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add Account
        </button>
      </div>

      {/* Net Worth Summary — canonical source only */}
      <NetWorthSummary summary={canonicalSummary} />

      {/* Account Type Filter */}
      <AccountTypeFilter selectedType={selectedType} onChange={setSelectedType} />

      {/* Institution Groups */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading accounts...</p>
        </div>
      ) : Object.keys(accountGroups).length > 0 ? (
        Object.entries(accountGroups).map(([institution, accounts]: [string, any]) => (
          <InstitutionGroup
            key={institution}
            institutionName={institution}
            accounts={accounts}
            onAccountClick={handleAccountClick}
          />
        ))
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No accounts found for this filter.
          </p>
          <div className="w-1/2 mx-auto">
            <AddAccountButton onClick={() => setIsConnectModalOpen(true)} />
          </div>
        </div>
      )}

      {/* Connect Account Modal */}
      <ConnectAccountModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}
