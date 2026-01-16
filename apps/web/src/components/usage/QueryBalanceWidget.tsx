'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle, Zap, Loader2 } from 'lucide-react';

interface QueryBalance {
  subscriptionTier: string;
  chatQueries: {
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
    purchased: number;
    total: number;
  };
  scenarioRuns: {
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
    purchased: number;
    total: number;
  };
  onboarding: {
    completed: boolean;
    queriesUsed: number;
  };
}

interface QueryBalanceWidgetProps {
  compact?: boolean;
  onUpgradeClick?: () => void;
}

export function QueryBalanceWidget({
  compact = false,
  onUpgradeClick,
}: QueryBalanceWidgetProps) {
  const [balance, setBalance] = useState<QueryBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/usage/balance');

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      setBalance(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('Failed to load balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          Loading balance...
        </span>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">
            {balance.chatQueries.total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium">
            {balance.scenarioRuns.total}
          </span>
        </div>
        {balance.subscriptionTier === 'freemium' && (
          <button
            onClick={onUpgradeClick}
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Upgrade
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Usage Balance
        </h3>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {balance.subscriptionTier.charAt(0).toUpperCase() +
            balance.subscriptionTier.slice(1)}
        </span>
      </div>

      {/* Chat Queries */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Chat Queries
            </span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {balance.chatQueries.total}
          </span>
        </div>

        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Daily: {balance.chatQueries.usedToday} / {balance.chatQueries.dailyLimit}</span>
            <span className="font-medium text-blue-600">
              {balance.chatQueries.remainingToday} remaining
            </span>
          </div>
          {balance.chatQueries.purchased > 0 && (
            <div className="flex justify-between">
              <span>Purchased credits:</span>
              <span className="font-medium text-green-600">
                {balance.chatQueries.purchased}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{
              width: `${
                (balance.chatQueries.usedToday / balance.chatQueries.dailyLimit) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Scenario Runs */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Scenario Runs
            </span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {balance.scenarioRuns.total}
          </span>
        </div>

        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Daily: {balance.scenarioRuns.usedToday} / {balance.scenarioRuns.dailyLimit}</span>
            <span className="font-medium text-purple-600">
              {balance.scenarioRuns.remainingToday} remaining
            </span>
          </div>
          {balance.scenarioRuns.purchased > 0 && (
            <div className="flex justify-between">
              <span>Purchased credits:</span>
              <span className="font-medium text-green-600">
                {balance.scenarioRuns.purchased}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{
              width: `${
                (balance.scenarioRuns.usedToday / balance.scenarioRuns.dailyLimit) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Upgrade CTA for freemium users */}
      {balance.subscriptionTier === 'freemium' && (
        <button
          onClick={onUpgradeClick}
          className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          Purchase More Credits
        </button>
      )}
    </div>
  );
}
