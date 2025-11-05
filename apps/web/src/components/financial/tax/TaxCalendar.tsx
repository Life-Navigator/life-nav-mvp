'use client';

import React, { useState } from 'react';

// Define important tax dates
const taxDates = [
  {
    id: 'q1_es_2024',
    name: 'Q1 Estimated Tax Payment',
    date: new Date('2024-04-15'),
    category: 'payment',
    description: 'First quarter estimated tax payment due for the 2024 tax year.'
  },
  {
    id: 'tax_day_2023',
    name: 'Tax Filing Deadline',
    date: new Date('2024-04-15'),
    category: 'filing',
    description: 'Deadline for filing 2023 tax returns or requesting an extension.'
  },
  {
    id: 'extension_2023',
    name: 'Extended Filing Deadline',
    date: new Date('2024-10-15'),
    category: 'filing',
    description: 'Extended deadline for filing 2023 tax returns if an extension was requested.'
  },
  {
    id: 'q2_es_2024',
    name: 'Q2 Estimated Tax Payment',
    date: new Date('2024-06-17'),
    category: 'payment',
    description: 'Second quarter estimated tax payment due for the 2024 tax year.'
  },
  {
    id: 'q3_es_2024',
    name: 'Q3 Estimated Tax Payment',
    date: new Date('2024-09-16'),
    category: 'payment',
    description: 'Third quarter estimated tax payment due for the 2024 tax year.'
  },
  {
    id: 'q4_es_2024',
    name: 'Q4 Estimated Tax Payment',
    date: new Date('2025-01-15'),
    category: 'payment',
    description: 'Fourth quarter estimated tax payment due for the 2024 tax year.'
  },
  {
    id: 'w2_1099_deadline',
    name: 'W-2 & 1099 Forms Due',
    date: new Date('2024-01-31'),
    category: 'forms',
    description: 'Deadline for employers to provide W-2 forms to employees and for businesses to provide 1099 forms to contractors.'
  },
  {
    id: 'ira_contribution_2023',
    name: 'IRA Contribution Deadline',
    date: new Date('2024-04-15'),
    category: 'retirement',
    description: 'Last day to make IRA contributions for the 2023 tax year.'
  },
  {
    id: 'hsa_contribution_2023',
    name: 'HSA Contribution Deadline',
    date: new Date('2024-04-15'),
    category: 'healthcare',
    description: 'Last day to make HSA contributions for the 2023 tax year.'
  },
  {
    id: 's_corp_deadline',
    name: 'S Corporation Filing Deadline',
    date: new Date('2024-03-15'),
    category: 'business',
    description: 'Deadline for S corporations to file their 2023 tax returns or request an extension.'
  },
  {
    id: 'c_corp_deadline',
    name: 'C Corporation Filing Deadline',
    date: new Date('2024-04-15'),
    category: 'business',
    description: 'Deadline for C corporations to file their 2023 tax returns or request an extension.'
  },
  {
    id: 'partnership_deadline',
    name: 'Partnership Filing Deadline',
    date: new Date('2024-03-15'),
    category: 'business',
    description: 'Deadline for partnerships to file their 2023 tax returns or request an extension.'
  }
];

// Category styling and icons
const categoryStyles: Record<string, { bgColor: string; iconClass: string }> = {
  filing: {
    bgColor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    iconClass: 'ri-file-text-line'
  },
  payment: {
    bgColor: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
    iconClass: 'ri-money-dollar-circle-line'
  },
  forms: {
    bgColor: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
    iconClass: 'ri-file-list-3-line'
  },
  retirement: {
    bgColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
    iconClass: 'ri-bank-line'
  },
  healthcare: {
    bgColor: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
    iconClass: 'ri-heart-pulse-line'
  },
  business: {
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200',
    iconClass: 'ri-building-line'
  }
};

export function TaxCalendar() {
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'upcoming' | 'all'>('upcoming');
  
  // Format date as Month DD, YYYY
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };
  
  // Checks if date is in the future or within the last 7 days
  const isUpcoming = (date: Date) => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return date >= sevenDaysAgo;
  };
  
  // Format relative time (e.g., "in 2 days", "5 days ago")
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
    } else if (diffDays < 0) {
      return `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'} ago`;
    } else {
      return 'today';
    }
  };
  
  // Check if a date is past due
  const isPastDue = (date: Date) => {
    return date < new Date();
  };
  
  // Filter and sort dates
  const filteredDates = taxDates.filter(item => {
    if (view === 'upcoming' && !isUpcoming(item.date)) {
      return false;
    }
    
    return filter === 'all' || item.category === filter;
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Tax Calendar</h2>
      
      <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
        <div>
          <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Category
          </label>
          <select
            id="date-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="all">All Categories</option>
            <option value="filing">Filing Deadlines</option>
            <option value="payment">Payments</option>
            <option value="forms">Form Deadlines</option>
            <option value="retirement">Retirement</option>
            <option value="healthcare">Healthcare</option>
            <option value="business">Business</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="view-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            View
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <button
              type="button"
              className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                view === 'upcoming'
                  ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => setView('upcoming')}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 text-sm font-medium ${
                view === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => setView('all')}
            >
              All Dates
            </button>
          </div>
        </div>
      </div>
      
      {filteredDates.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No tax dates found matching your criteria.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Event
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Time Remaining
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDates.map((item) => {
                const categoryStyle = categoryStyles[item.category] || categoryStyles.filing;
                const pastDue = isPastDue(item.date);
                
                return (
                  <tr key={item.id} className={pastDue ? 'bg-gray-50 dark:bg-slate-900/30' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs mt-1">{item.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryStyle.bgColor}`}>
                        <i className={`${categoryStyle.iconClass} text-sm mr-1`}></i>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {pastDue ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                          {getRelativeTime(item.date)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                          {getRelativeTime(item.date)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Important Note</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Tax dates may vary based on holidays, weekends, or IRS announcements. Always verify official deadlines with the IRS or consult a tax professional.
        </p>
      </div>
    </div>
  );
}