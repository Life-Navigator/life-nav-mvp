'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, 
  PolarGrid, PolarAngleAxis, Radar
} from 'recharts';

const CareerDashboard = () => {
  // State for career data
  const [careerData, setCareerData] = useState({
    skills: [] as { name: string; level: number; target: number }[],
    jobMatch: [] as { id: string; company: string; title: string; match: number; salary: string; location: string }[],
    networkMetrics: [] as { month: string; connections: number; messages: number }[],
    upcomingEvents: [] as { id: string; title: string; date: string; type: string }[],
    industryTrends: [] as { skill: string; growth: number }[]
  });
  const [careerSummary, setCareerSummary] = useState({
    roleReadiness: 0,
    networkStrength: 0,
    industryAlignment: 0,
    skillGrowth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch career data
  useEffect(() => {
    const fetchCareerData = async () => {
      try {
        setLoading(true);

        // Call real API endpoint
        const response = await fetch('/api/career');
        if (!response.ok) {
          throw new Error('Failed to fetch career data');
        }

        const data = await response.json();

        // Calculate Role Readiness: average of (current level / target) * 100
        const roleReadiness = data.skills?.length > 0
          ? Math.round(data.skills.reduce((sum: number, skill: any) =>
              sum + (skill.level / skill.target * 100), 0) / data.skills.length)
          : 0;

        // Calculate Network Strength: growth trend from network metrics
        const networkStrength = data.networkMetrics?.length > 0
          ? (() => {
              const recentMonths = data.networkMetrics.slice(-3);
              const earlierMonths = data.networkMetrics.slice(0, 3);

              const recentAvg = recentMonths.reduce((sum: number, m: any) =>
                sum + m.connections + m.messages, 0) / recentMonths.length;
              const earlierAvg = earlierMonths.length > 0
                ? earlierMonths.reduce((sum: number, m: any) =>
                    sum + m.connections + m.messages, 0) / earlierMonths.length
                : recentAvg * 0.7;

              return Math.min(100, Math.round((recentAvg / earlierAvg) * 70));
            })()
          : 0;

        // Calculate Industry Alignment: average of top job match scores
        const industryAlignment = data.jobMatch?.length > 0
          ? Math.round(data.jobMatch.reduce((sum: number, job: any) =>
              sum + job.match, 0) / data.jobMatch.length)
          : 0;

        // Calculate Skill Growth: average gap to target as percentage
        const skillGrowth = data.skills?.length > 0
          ? Math.round(data.skills.reduce((sum: number, skill: any) =>
              sum + ((skill.target - skill.level) / skill.target * 100), 0) / data.skills.length)
          : 0;

        setCareerData({
          skills: data.skills,
          jobMatch: data.jobMatch,
          networkMetrics: data.networkMetrics,
          upcomingEvents: data.upcomingEvents,
          industryTrends: data.industryTrends
        });

        setCareerSummary({
          roleReadiness,
          networkStrength,
          industryAlignment,
          skillGrowth
        });

        setLoading(false);
      } catch (err) {
        setError("Failed to load career data");
        setLoading(false);
      }
    };

    fetchCareerData();
  }, []);

  const hasCareerData = careerData.skills.length > 0 ||
                        careerData.jobMatch.length > 0 ||
                        careerData.upcomingEvents.length > 0;

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Career Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your professional development and opportunities</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
          Add Data
        </button>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Career Summary */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Career Summary</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <span className="font-medium text-gray-700 dark:text-gray-300">Role Readiness</span>
              <span className="font-semibold text-gray-900 dark:text-white">{careerSummary.roleReadiness}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <span className="font-medium text-gray-700 dark:text-gray-300">Network Strength</span>
              <span className="font-semibold text-gray-900 dark:text-white">{careerSummary.networkStrength}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <span className="font-medium text-gray-700 dark:text-gray-300">Industry Alignment</span>
              <span className="font-semibold text-gray-900 dark:text-white">{careerSummary.industryAlignment}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <span className="font-medium text-gray-700 dark:text-gray-300">Skill Growth Potential</span>
              <span className="font-semibold text-gray-900 dark:text-white">{careerSummary.skillGrowth}%</span>
            </div>
          </div>
        </div>
        
        {/* Skills Radar */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Skills Assessment</h2>
          {careerData.skills.length > 0 ? (
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={careerData.skills}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <Radar name="Current Level" dataKey="level" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Radar name="Target Level" dataKey="target" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 md:h-80 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Skills Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add your skills to track your professional development
              </p>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors">
                Add Skills
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Job Matches */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Top Job Matches</h2>
          {careerData.jobMatch.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Position</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Match</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Salary</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {careerData.jobMatch.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{job.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{job.company}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600 dark:text-green-400">{job.match}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{job.salary}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{job.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-center">
                <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                  View All Opportunities
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-4">💼</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Job Matches</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add your skills and preferences to see job recommendations
              </p>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors">
                Set Job Preferences
              </button>
            </div>
          )}
        </div>
        
        {/* Networking Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Networking Activity</h2>
          {careerData.networkMetrics.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={careerData.networkMetrics}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="connections" name="New Connections" fill="#8884d8" />
                  <Bar dataKey="messages" name="Messages Sent" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-6xl mb-4">🤝</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Networking Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Track your professional networking activity and connections
              </p>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors">
                Log Networking Activity
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Upcoming Events</h2>
          {careerData.upcomingEvents.length > 0 ? (
            <>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {careerData.upcomingEvents.map((event) => (
                  <div key={event.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(event.date).toLocaleDateString()}</div>
                    </div>
                    <div className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {event.type}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                  View All Events
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Upcoming Events</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add networking events, conferences, and career fairs
              </p>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors">
                Add Event
              </button>
            </div>
          )}
        </div>
        
        {/* Industry Trends */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Industry Trends</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Top growing skills in your industry for the next 12 months:
          </p>
          <div className="space-y-4">
            {careerData.industryTrends.map((trend) => (
              <div key={trend.skill} className="relative pt-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {trend.skill}
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {trend.growth}% growth
                  </div>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                  <div
                    style={{ width: `${trend.growth}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 dark:bg-blue-500"
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <span className="font-medium">Career Insight:</span> Adding skills in AI/ML could increase your job match score by up to 15%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareerDashboard;