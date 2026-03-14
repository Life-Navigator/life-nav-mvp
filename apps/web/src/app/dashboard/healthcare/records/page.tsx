'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import Link from 'next/link';

interface HealthRecord {
  id: string;
  title: string;
  provider: string;
  date: string;
  type: string;
  status: string;
  summary: string;
  files?: {
    id: string;
    name: string;
    type: string;
    size: string;
  }[];
}

export default function HealthRecordsPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'all' | 'imaging' | 'lab' | 'visit'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealthRecords = async () => {
      try {
        setLoading(true);

        // TODO: Implement API endpoint for fetching health records
        // const response = await fetch('/api/healthcare/records');
        // const data = await response.json();
        // setRecords(data);

        // For now, set empty array - will be populated when users upload/integrate records
        setRecords([]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching health records:', err);
        setError('Failed to load health records. Please try again later.');
        setLoading(false);
      }
    };

    fetchHealthRecords();
  }, []);

  // Filter records based on view, search term, and date
  const filteredRecords = records
    .filter((record) => view === 'all' || record.type === view)
    .filter(
      (record) =>
        record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.summary.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((record) => !dateFilter || record.date.includes(dateFilter))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case 'visit':
        return '👨‍⚕️';
      case 'lab':
        return '🧪';
      case 'imaging':
        return '📷';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Loading health records...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Health Records</h1>
            <p className="text-gray-600 dark:text-gray-400">View and manage your medical records</p>
          </div>
          <div className="mt-4 md:mt-0">
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-sm">
              Upload New Record
            </button>
          </div>
        </div>

        {/* Filters and search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="mb-4 md:mb-0 md:flex-grow">
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={view}
                onChange={(e) => setView(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Records</option>
                <option value="visit">Doctor Visits</option>
                <option value="lab">Lab Results</option>
                <option value="imaging">Imaging</option>
              </select>
              <input
                type="month"
                value={dateFilter || ''}
                onChange={(e) => setDateFilter(e.target.value || null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter(null)}
                  className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Records list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No health records found with the current filters.
              </p>
              <button
                className="mt-4 px-4 py-2 text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => {
                  setSearchTerm('');
                  setView('all');
                  setDateFilter(null);
                }}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex">
                      <div className="text-2xl mr-4">{getRecordTypeIcon(record.type)}</div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {record.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {record.provider} • {new Date(record.date).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {record.summary}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0">
                      <button className="px-3 py-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium">
                        View Details
                      </button>
                    </div>
                  </div>

                  {record.files && record.files.length > 0 && (
                    <div className="mt-4 pl-10">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Attached Files:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {record.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-md"
                          >
                            {file.type === 'PDF' && <span className="mr-2">📄</span>}
                            {file.type === 'Image' && <span className="mr-2">🖼️</span>}
                            {file.type === 'ZIP' && <span className="mr-2">📦</span>}
                            {file.type === 'TXT' && <span className="mr-2">📝</span>}
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {file.name}
                            </span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({file.size})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation and help */}
        <div className="mt-8 flex flex-col md:flex-row md:justify-between">
          <div className="mb-4 md:mb-0">
            <Link
              href="/dashboard/healthcare"
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
            >
              ← Back to Health Dashboard
            </Link>
          </div>
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Request Medical Records
            </button>
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Share Records
            </button>
            <button className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Help & Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
