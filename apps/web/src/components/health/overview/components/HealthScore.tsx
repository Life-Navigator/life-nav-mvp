'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import Link from 'next/link';

interface HealthScoreData {
  overallScore: number;
  components: {
    activity: number;
    sleep: number;
    nutrition: number;
    vitals: number;
    mental: number;
  };
  trend: 'up' | 'down' | 'stable';
  weeklyScores: number[];
  insights: string[];
}

export default function HealthScore() {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealthScoreData = async () => {
      try {
        // TODO: Implement API endpoint for fetching health score data
        // const response = await fetch('/api/health/score');
        // const healthScoreData = await response.json();
        // setData(healthScoreData);

        // For now, set null - will be populated when users connect health devices
        setData(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching health score data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchHealthScoreData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Health Score</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading health score...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Health Score</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💪</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Health Data Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your health devices and apps to calculate your personalized health score based on activity, sleep, nutrition, and vitals.
          </p>
          <Link href="/dashboard/integrations">
            <Button variant="default">Connect Device</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // Determine score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Determine trend icon
  const getTrendIcon = () => {
    if (data.trend === 'up') return '↗️';
    if (data.trend === 'down') return '↘️';
    return '→';
  };

  const getTrendColor = () => {
    if (data.trend === 'up') return 'text-green-600';
    if (data.trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Health Score</h2>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className={`text-5xl font-bold ${getScoreColor(data.overallScore)}`}>
              {data.overallScore}
            </span>
            <span className={`text-2xl ${getTrendColor()}`}>
              {getTrendIcon()}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Overall Health Score</p>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Last 7 days avg</p>
          <p className="text-2xl font-semibold">
            {Math.round(data.weeklyScores.reduce((a, b) => a + b, 0) / data.weeklyScores.length)}
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium">Score Components</h3>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Activity</span>
            <span className={getScoreColor(data.components.activity)}>{data.components.activity}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${data.components.activity}%` }}
              className="h-full bg-blue-500"
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Sleep</span>
            <span className={getScoreColor(data.components.sleep)}>{data.components.sleep}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${data.components.sleep}%` }}
              className="h-full bg-indigo-500"
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Nutrition</span>
            <span className={getScoreColor(data.components.nutrition)}>{data.components.nutrition}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${data.components.nutrition}%` }}
              className="h-full bg-green-500"
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Vitals</span>
            <span className={getScoreColor(data.components.vitals)}>{data.components.vitals}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${data.components.vitals}%` }}
              className="h-full bg-red-500"
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Mental Wellness</span>
            <span className={getScoreColor(data.components.mental)}>{data.components.mental}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              style={{ width: `${data.components.mental}%` }}
              className="h-full bg-purple-500"
            ></div>
          </div>
        </div>
      </div>

      {data.insights && data.insights.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Insights</h4>
          <ul className="space-y-1">
            {data.insights.map((insight, index) => (
              <li key={index} className="text-sm text-blue-800 dark:text-blue-200">
                " {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline">View Detailed Analysis</Button>
      </div>
    </Card>
  );
}
