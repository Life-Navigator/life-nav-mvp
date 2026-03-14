'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import Link from 'next/link';
import format from 'date-fns/format';
import subDays from 'date-fns/subDays';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/buttons/Button';

interface SleepData {
  weeklySleep: Array<{
    date: string;
    fullDate: string;
    total: number;
    deep: number;
    rem: number;
    light: number;
    score: number;
  }>;
  today: {
    bedtime: string;
    wakeTime: string;
    timeInBed: number;
    timeAsleep: number;
    timesWokenUp: number;
    sleepScore: number;
  };
}

export default function SleepAnalysis() {
  const [data, setData] = useState<SleepData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSleepData = async () => {
      try {
        // TODO: Implement API endpoint for fetching sleep data
        // const response = await fetch('/api/wellness/sleep');
        // const sleepData = await response.json();
        // setData(sleepData);

        // For now, set null - will be populated when users connect sleep tracking devices
        setData(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching sleep data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchSleepData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Sleep Analysis</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading sleep data...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Sleep Analysis</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">😴</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Sleep Data Connected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your sleep tracker or smartwatch to automatically monitor your sleep quality and
            patterns.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/integrations">
              <Button variant="default">Connect Device</Button>
            </Link>
            <Button variant="outline">Log Sleep Manually</Button>
          </div>
        </div>
      </Card>
    );
  }

  // Calculate averages
  const averageSleep =
    data.weeklySleep.reduce((sum, day) => sum + day.total, 0) / data.weeklySleep.length;
  const averageScore =
    data.weeklySleep.reduce((sum, day) => sum + day.score, 0) / data.weeklySleep.length;

  // Format the averages
  const formattedAvgSleep = averageSleep.toFixed(1);
  const formattedAvgScore = Math.round(averageScore);

  return (
    <div>
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Sleep Analysis</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Last night summary */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-medium mb-3">Last Night</h3>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-indigo-800 dark:text-indigo-200">Sleep Score</span>
                <span className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                  {data.today.sleepScore}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Bedtime</span>
                  <span className="font-medium">{data.today.bedtime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Wake time</span>
                  <span className="font-medium">{data.today.wakeTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Time in bed</span>
                  <span className="font-medium">{data.today.timeInBed} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Time asleep</span>
                  <span className="font-medium">{data.today.timeAsleep} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Times woken up</span>
                  <span className="font-medium">{data.today.timesWokenUp}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                <p className="text-xs text-blue-800 dark:text-blue-200">Avg. Sleep Time</p>
                <p className="text-lg font-semibold">{formattedAvgSleep} hrs</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
                <p className="text-xs text-purple-800 dark:text-purple-200">Avg. Sleep Score</p>
                <p className="text-lg font-semibold">{formattedAvgScore}</p>
              </div>
            </div>
          </div>

          {/* Sleep duration chart */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Sleep Duration</h3>
              <div className="space-x-2">
                <Button
                  size="sm"
                  variant={selectedPeriod === 'week' ? 'default' : 'outline'}
                  onClick={() => setSelectedPeriod('week')}
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={selectedPeriod === 'month' ? 'default' : 'outline'}
                  onClick={() => setSelectedPeriod('month')}
                >
                  Month
                </Button>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.weeklySleep}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fontSize: 12 }}
                    label={{
                      value: 'Hours',
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fontSize: '12px' },
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} hrs`,
                      String(name) === 'total'
                        ? 'Total Sleep'
                        : `${String(name).charAt(0).toUpperCase() + String(name).slice(1)} Sleep`,
                    ]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="deep" stackId="a" fill="#4A5568" name="Deep" />
                  <Bar dataKey="rem" stackId="a" fill="#805AD5" name="REM" />
                  <Bar dataKey="light" stackId="a" fill="#90CDF4" name="Light" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-center mt-2 space-x-5">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-300 mr-1"></div>
                <span className="text-xs">Light</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 mr-1"></div>
                <span className="text-xs">REM</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-700 mr-1"></div>
                <span className="text-xs">Deep</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sleep quality chart */}
        <div>
          <h3 className="text-lg font-medium mb-3">Sleep Quality Score</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.weeklySleep}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[50, 100]}
                  ticks={[50, 60, 70, 80, 90, 100]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${value}`, 'Sleep Score']}
                  labelFormatter={(label) => `${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6B46C1"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline">View Sleep Insights</Button>
        </div>
      </Card>
    </div>
  );
}
