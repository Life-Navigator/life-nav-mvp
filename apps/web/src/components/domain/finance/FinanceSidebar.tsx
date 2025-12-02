// FILE: src/components/finance/FinanceSidebar.tsx
'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalculatorIcon,
  ArrowPathIcon,
  CreditCardIcon,
  CogIcon,
  HomeIcon,
  AcademicCapIcon
} from "@heroicons/react/24/outline";

const financeNavItems = [
  {
    title: "Overview",
    href: "/dashboard/finance/overview",
    icon: <ChartBarIcon className="w-5 h-5" />,
  },
  {
    title: "Accounts",
    href: "/dashboard/finance/accounts",
    icon: <CreditCardIcon className="w-5 h-5" />,
  },
  {
    title: "Transactions",
    href: "/dashboard/finance/transactions",
    icon: <ArrowPathIcon className="w-5 h-5" />,
  },
  {
    title: "Assets",
    href: "/dashboard/finance/assets",
    icon: <HomeIcon className="w-5 h-5" />,
  },
  {
    title: "Investments",
    href: "/dashboard/finance/investments",
    icon: <BuildingLibraryIcon className="w-5 h-5" />,
  },
  {
    title: "Retirement",
    href: "/dashboard/finance/retirement",
    icon: <BanknotesIcon className="w-5 h-5" />,
  },
  {
    title: "Tax Planning",
    href: "/dashboard/finance/tax",
    icon: <CalculatorIcon className="w-5 h-5" />,
  },
  {
    title: "Education Planning",
    href: "/dashboard/finance/education",
    icon: <AcademicCapIcon className="w-5 h-5" />,
  },
];

export function FinanceSidebar() {
  const pathname = usePathname();
  const [accountSummary, setAccountSummary] = useState<{
    count: number;
    total: number;
    loading: boolean;
  }>({ count: 0, total: 0, loading: true });

  // Fetch account summary data
  useEffect(() => {
    const fetchAccountSummary = async () => {
      try {
        const response = await fetch('/api/plaid/accounts');
        if (response.ok) {
          const data = await response.json();
          const accounts = data.accounts || [];
          const total = accounts.reduce((sum: number, acc: { currentBalance?: number }) =>
            sum + (acc.currentBalance || 0), 0);
          setAccountSummary({
            count: accounts.length,
            total,
            loading: false,
          });
        } else {
          setAccountSummary({ count: 0, total: 0, loading: false });
        }
      } catch (error) {
        console.error('Error fetching account summary:', error);
        setAccountSummary({ count: 0, total: 0, loading: false });
      }
    };

    fetchAccountSummary();
  }, []);

  // Determine if a nav link is active
  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="w-64 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Finance</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your financial life</p>
      </div>

      <nav className="flex-1 space-y-1">
        {financeNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive(item.href)
                ? "bg-blue-50 text-blue-800 dark:bg-blue-600 dark:text-white font-semibold"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
            }`}
          >
            <span className={isActive(item.href) ? "text-blue-600 dark:text-blue-400" : ""}>
              {item.icon}
            </span>
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
      
      {/* Connection and Settings section at the bottom */}
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link
          href="/dashboard/finance/connections"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            isActive("/dashboard/finance/connections")
              ? "bg-blue-50 text-blue-800 dark:bg-blue-600 dark:text-white font-semibold"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
          }`}
        >
          <span className={isActive("/dashboard/finance/connections") ? "text-blue-600 dark:text-blue-400" : ""}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A8 8 0 1 0 4 16.2" />
              <path d="M12 12v9" />
              <path d="M8 17h8" />
            </svg>
          </span>
          <span>Connect Accounts</span>
        </Link>

        <Link
          href="/dashboard/finance/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            isActive("/dashboard/finance/settings")
              ? "bg-blue-50 text-blue-800 dark:bg-blue-600 dark:text-white font-semibold"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
          }`}
        >
          <span className={isActive("/dashboard/finance/settings") ? "text-blue-600 dark:text-blue-400" : ""}>
            <CogIcon className="w-5 h-5" />
          </span>
          <span>Settings</span>
        </Link>
      </div>
      
      {/* Account summary section */}
      <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-800 dark:to-indigo-800 rounded-lg border border-blue-100 dark:border-blue-600">
        <h3 className="text-sm font-medium text-blue-800 dark:text-white mb-2">Connected Accounts</h3>
        {accountSummary.loading ? (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        ) : accountSummary.count > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-600 dark:text-blue-200">
              {accountSummary.count} account{accountSummary.count !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-medium text-blue-900 dark:text-white">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(accountSummary.total)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-blue-600 dark:text-blue-200 text-center">
            No accounts connected
          </p>
        )}
      </div>
    </div>
  );
}