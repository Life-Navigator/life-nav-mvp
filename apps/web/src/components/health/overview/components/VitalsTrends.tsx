'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface VitalReading {
  date: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  temperature: number;
}

interface VitalsData {
  current: {
    heartRate: number;
    bloodPressure: string;
    oxygenSaturation: number;
    temperature: number;
    lastUpdated: string;
  };
  weeklyTrends: VitalReading[];
}

export default function VitalsTrends() {
  const [data, setData] = useState<VitalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'heartRate' | 'bloodPressure' | 'oxygen' | 'temperature'>('heartRate');

  useEffect(() => {
    const fetchVitalsData = async () => {
      try {
        // TODO: Implement API endpoint for fetching vitals data
        // const response = await fetch('/api/health/vitals');
        // const vitalsData = await response.json();
        // setData(vitalsData);

        // For now, set null - will be populated when users connect health devices
        setData(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching vitals data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchVitalsData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Vitals Trends</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading vitals data...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Vitals Trends</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">❤️</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Vitals Data Connected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your health monitoring devices to track your heart rate, blood pressure, oxygen levels, and temperature over time.
          </p>
          <Link href="/dashboard/integrations">
            <Button variant="default">Connect Device</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // Helper function to get vital status color
  const getVitalStatus = (metric: string, value: number) => {
    switch (metric) {
      case 'heartRate':
        if (value >= 60 && value <= 100) return 'text-green-600 dark:text-green-400';
        return 'text-yellow-600 dark:text-yellow-400';
      case 'oxygenSaturation':
        if (value >= 95) return 'text-green-600 dark:text-green-400';
        if (value >= 90) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
      case 'temperature':
        if (value >= 36.5 && value <= 37.5) return 'text-green-600 dark:text-green-400';
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Vitals Trends</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Heart Rate</p>
          <p className={`text-2xl font-bold ${getVitalStatus('heartRate', data.current.heartRate)}`}>
            {data.current.heartRate} <span className="text-sm font-normal">bpm</span>
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Blood Pressure</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {data.current.bloodPressure} <span className="text-sm font-normal">mmHg</span>
          </p>
        </div>

        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Oxygen Saturation</p>
          <p className={`text-2xl font-bold ${getVitalStatus('oxygenSaturation', data.current.oxygenSaturation)}`}>
            {data.current.oxygenSaturation}%
          </p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Temperature</p>
          <p className={`text-2xl font-bold ${getVitalStatus('temperature', data.current.temperature)}`}>
            {data.current.temperature}°C
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">7-Day Trends</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={selectedMetric === 'heartRate' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('heartRate')}
            >
              Heart Rate
            </Button>
            <Button
              size="sm"
              variant={selectedMetric === 'bloodPressure' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('bloodPressure')}
            >
              Blood Pressure
            </Button>
            <Button
              size="sm"
              variant={selectedMetric === 'oxygen' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('oxygen')}
            >
              Oxygen
            </Button>
            <Button
              size="sm"
              variant={selectedMetric === 'temperature' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('temperature')}
            >
              Temperature
            </Button>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.weeklyTrends}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />

              {selectedMetric === 'heartRate' && (
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Heart Rate (bpm)"
                />
              )}

              {selectedMetric === 'bloodPressure' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="bloodPressureSystolic"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Systolic"
                  />
                  <Line
                    type="monotone"
                    dataKey="bloodPressureDiastolic"
                    stroke="#60A5FA"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Diastolic"
                  />
                </>
              )}

              {selectedMetric === 'oxygen' && (
                <Line
                  type="monotone"
                  dataKey="oxygenSaturation"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Oxygen Saturation (%)"
                />
              )}

              {selectedMetric === 'temperature' && (
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Temperature (°C)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Last updated: {data.current.lastUpdated}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline">View History</Button>
        <Button variant="outline">Record Manual Reading</Button>
      </div>
    </Card>
  );
}
