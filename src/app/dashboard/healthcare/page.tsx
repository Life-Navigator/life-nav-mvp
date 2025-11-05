'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { LockClosedIcon, DocumentIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

const HealthcareDashboard = () => {
  // State for health data
  const [healthData, setHealthData] = useState({
    healthScoreHistory: [] as { date: string; score: number }[],
    vitalSigns: {
      bloodPressure: { systolic: 0, diastolic: 0, date: '' },
      heartRate: { value: 0, date: '' },
      weight: { value: 0, date: '' }
    },
    activityData: [] as { day: string; steps: number; activeMinutes: number }[],
    sleepData: [] as { day: string; hours: number; quality: number }[],
    upcomingAppointments: [] as { id: string; doctor: string; specialty: string; date: string; time: string }[],
    medicationAdherence: { adherence: 0, medications: [] as { name: string; adherence: number }[] }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Colors for charts
  const COLORS = ['#ef4444', '#f97316', '#14b8a6', '#3b82f6', '#8b5cf6'];

  // Fetch health data
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setLoading(true);

        // Call real API endpoint
        const response = await fetch('/api/healthcare');
        if (!response.ok) {
          throw new Error('Failed to fetch healthcare data');
        }

        const data = await response.json();

        setHealthData({
          healthScoreHistory: data.healthScoreHistory,
          vitalSigns: data.vitalSigns,
          activityData: data.activityData,
          sleepData: data.sleepData,
          upcomingAppointments: data.upcomingAppointments,
          medicationAdherence: data.medicationAdherence
        });
        setLoading(false);
      } catch (err) {
        setError("Failed to load health data");
        setLoading(false);
      }
    };

    fetchHealthData();
  }, []);

  const hasHealthData = healthData.healthScoreHistory.length > 0 ||
                        healthData.upcomingAppointments.length > 0 ||
                        healthData.activityData.length > 0;

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Health Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Your personal health monitoring platform</p>
      </header>
      
      {/* Health summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Health Score</h2>
          <div className="flex items-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                  strokeDasharray="100, 100"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray={`${healthData.healthScoreHistory.length > 0 ? healthData.healthScoreHistory[healthData.healthScoreHistory.length - 1].score : 0}, 100`}
                />
                <text x="18" y="20.35" className="text-xs" textAnchor="middle" fill="#ef4444" fontWeight="bold">
                  {healthData.healthScoreHistory.length > 0 ? healthData.healthScoreHistory[healthData.healthScoreHistory.length - 1].score : 0}
                </text>
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-3xl font-bold text-red-600 dark:text-red-500">
                {healthData.healthScoreHistory.length > 0 ? healthData.healthScoreHistory[healthData.healthScoreHistory.length - 1].score : 0}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  const score = healthData.healthScoreHistory.length > 0 ? healthData.healthScoreHistory[healthData.healthScoreHistory.length - 1].score : 0;
                  if (score >= 80) return 'Excellent';
                  if (score >= 70) return 'Good';
                  if (score >= 60) return 'Fair';
                  return 'Needs Attention';
                })()}
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm text-green-600 dark:text-green-400">
            {(() => {
              if (healthData.healthScoreHistory.length < 2) return 'Add more data to track progress';
              const currentScore = healthData.healthScoreHistory[healthData.healthScoreHistory.length - 1].score;
              const previousScore = healthData.healthScoreHistory[Math.max(0, healthData.healthScoreHistory.length - 8)].score;
              const change = currentScore - previousScore;
              const percentChange = previousScore > 0 ? Math.round((change / previousScore) * 100) : 0;

              if (change > 0) {
                return `↑ ${percentChange}% improvement this month`;
              } else if (change < 0) {
                return `↓ ${Math.abs(percentChange)}% decrease this month`;
              }
              return 'No change this month';
            })()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Vital Signs</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Blood Pressure</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {healthData.vitalSigns.bloodPressure.systolic}/{healthData.vitalSigns.bloodPressure.diastolic} mmHg
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Resting Heart Rate</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {healthData.vitalSigns.heartRate.value} bpm
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Weight</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {healthData.vitalSigns.weight.value} lbs
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(healthData.vitalSigns.bloodPressure.date).toLocaleDateString()}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Medication Adherence</h2>
          <div className="flex items-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="3"
                  strokeDasharray="100, 100"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth="3"
                  strokeDasharray={`${healthData.medicationAdherence.adherence}, 100`}
                />
                <text x="18" y="20.35" className="text-xs" textAnchor="middle" fill="#84cc16" fontWeight="bold">
                  {healthData.medicationAdherence.adherence}%
                </text>
              </svg>
            </div>
            <div className="ml-4 space-y-1">
              {healthData.medicationAdherence.medications.map((med, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{med.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{med.adherence}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Health score trend */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Health Score Trend</h2>
          {healthData.healthScoreHistory.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={healthData.healthScoreHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(dateStr) => {
                      const date = new Date(dateStr);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    interval={6}
                  />
                  <YAxis domain={[60, 90]} />
                  <Tooltip
                    formatter={(value) => [`${value}`, 'Health Score']}
                    labelFormatter={(dateStr) => {
                      const date = new Date(dateStr);
                      return date.toLocaleDateString();
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center">
              <div className="text-6xl mb-4">📈</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Health Score Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Start tracking your health metrics to see your score trend over time
              </p>
              <button className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors">
                Add Health Data
              </button>
            </div>
          )}
        </div>
        
        {/* Activity data */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Weekly Activity</h2>
          {healthData.activityData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={healthData.activityData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" orientation="left" stroke="#ef4444" />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="steps" name="Steps" fill="#ef4444" />
                  <Bar yAxisId="right" dataKey="activeMinutes" name="Active Minutes" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center">
              <div className="text-6xl mb-4">🏃</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Activity Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Connect a fitness tracker or manually log your activity
              </p>
              <button className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors">
                Connect Device
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sleep data */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Sleep Quality</h2>
          {healthData.sleepData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={healthData.sleepData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8b5cf6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#14b8a6" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="hours" name="Sleep Hours" stroke="#8b5cf6" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="quality" name="Sleep Quality %" stroke="#14b8a6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-6xl mb-4">😴</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Sleep Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Track your sleep patterns for better health insights
              </p>
              <button className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors">
                Log Sleep Data
              </button>
            </div>
          )}
        </div>
        
        {/* Upcoming appointments */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Upcoming Appointments</h2>
          {healthData.upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {healthData.upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{appointment.doctor}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(appointment.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-4 text-center">
                <button className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium">
                  Schedule New Appointment
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-4">🏥</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Upcoming Appointments</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Schedule your health checkups and specialist visits
              </p>
              <button className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors">
                Schedule Appointment
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Document Vault Feature */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Secure Document Vault</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Store and manage your sensitive medical documents with end-to-end encryption
            </p>
          </div>
          <Link
            href="/dashboard/healthcare/documents"
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Access Vault
          </Link>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-4">
              <LockClosedIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Ultra Secure Document Vault</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Your insurance cards, medical records, and important documents - securely encrypted and available when you need them.
              </p>
              <div className="mt-3 flex space-x-4">
                <Link
                  href="/dashboard/healthcare/documents/scan"
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                >
                  Scan Documents
                </Link>
                <Link
                  href="/dashboard/healthcare/documents"
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                >
                  View Documents
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <DocumentIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">-</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Stored Documents</div>
            </div>
          </div>
          <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <LockClosedIcon className="h-8 w-8 text-green-500 dark:text-green-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">AES-256</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Encryption</div>
            </div>
          </div>
          <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <CloudArrowUpIcon className="h-8 w-8 text-blue-500 dark:text-blue-400 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Mobile</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Scan & Upload</div>
            </div>
          </div>
        </div>
      </div>

      {/* Health insights and recommendations */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Health Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(() => {
            const insights = [];

            // Activity consistency insight
            if (healthData.activityData.length > 0) {
              const avgSteps = healthData.activityData.reduce((sum, day) => sum + day.steps, 0) / healthData.activityData.length;
              const variance = healthData.activityData.reduce((sum, day) => sum + Math.abs(day.steps - avgSteps), 0) / healthData.activityData.length;
              const isConsistent = variance < avgSteps * 0.3;

              if (isConsistent && avgSteps > 5000) {
                insights.push(
                  <div key="activity" className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-4">
                    <div className="flex">
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">Activity Consistency</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Your daily step count is consistent at {Math.round(avgSteps).toLocaleString()} steps. Keep up the good work!
                        </p>
                      </div>
                    </div>
                  </div>
                );
              } else if (avgSteps < 5000) {
                insights.push(
                  <div key="activity" className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Recommendation</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Try to increase your daily steps to at least 5,000. Small walks throughout the day can make a big difference!
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
            }

            // Sleep quality insight
            if (healthData.sleepData.length > 0) {
              const avgSleep = healthData.sleepData.reduce((sum, night) => sum + night.hours, 0) / healthData.sleepData.length;
              const avgQuality = healthData.sleepData.reduce((sum, night) => sum + night.quality, 0) / healthData.sleepData.length;

              if (avgSleep < 7) {
                insights.push(
                  <div key="sleep" className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Sleep Recommendation</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          You're averaging {avgSleep.toFixed(1)} hours of sleep. Aim for 7-9 hours for optimal health.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              } else if (avgQuality < 70) {
                insights.push(
                  <div key="sleep" className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Sleep Quality</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Consider improving your sleep quality with a consistent bedtime routine or reducing screen time before bed.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
            }

            // Appointments reminder
            if (healthData.upcomingAppointments.length > 0) {
              const nextAppt = healthData.upcomingAppointments[0];
              const daysUntil = Math.ceil((new Date(nextAppt.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              if (daysUntil <= 7) {
                insights.push(
                  <div key="appointment" className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div>
                        <p className="font-medium text-blue-800 dark:text-blue-200">Upcoming Appointment</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          You have an appointment with {nextAppt.doctor} in {daysUntil} day{daysUntil !== 1 ? 's' : ''}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
            } else {
              insights.push(
                <div key="appointment" className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-200">Schedule Check-up</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Don't forget to schedule your regular health check-up if it's been a while.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Fill with placeholder if we don't have enough insights
            while (insights.length < 3) {
              insights.push(
                <div key={`placeholder-${insights.length}`} className="bg-gray-50 dark:bg-gray-700/50 border-l-4 border-gray-300 dark:border-gray-600 p-4">
                  <div className="flex">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">Add More Data</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        Track more health metrics to receive personalized insights and recommendations.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return insights.slice(0, 3);
          })()}
        </div>
      </div>
    </div>
  );
};

export default HealthcareDashboard;