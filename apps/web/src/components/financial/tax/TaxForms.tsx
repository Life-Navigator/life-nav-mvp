'use client';

import React, { useState } from 'react';

// Define the available tax forms 
const taxForms = [
  {
    id: 'f1040',
    name: 'Form 1040',
    description: 'U.S. Individual Income Tax Return',
    year: '2023',
    type: 'federal',
    category: 'primary',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040.pdf'
  },
  {
    id: 'f1040a',
    name: 'Schedule A',
    description: 'Itemized Deductions',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040sa.pdf'
  },
  {
    id: 'f1040b',
    name: 'Schedule B',
    description: 'Interest and Ordinary Dividends',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040sb.pdf'
  },
  {
    id: 'f1040c',
    name: 'Schedule C',
    description: 'Profit or Loss From Business',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040sc.pdf'
  },
  {
    id: 'f1040d',
    name: 'Schedule D',
    description: 'Capital Gains and Losses',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040sd.pdf'
  },
  {
    id: 'f1040e',
    name: 'Schedule E',
    description: 'Supplemental Income and Loss',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040se.pdf'
  },
  {
    id: 'f1040f',
    name: 'Schedule F',
    description: 'Profit or Loss From Farming',
    year: '2023',
    type: 'federal',
    category: 'schedule',
    url: 'https://www.irs.gov/pub/irs-pdf/f1040sf.pdf'
  },
  {
    id: 'f8949',
    name: 'Form 8949',
    description: 'Sales and Other Dispositions of Capital Assets',
    year: '2023',
    type: 'federal',
    category: 'supplemental',
    url: 'https://www.irs.gov/pub/irs-pdf/f8949.pdf'
  },
  {
    id: 'f4562',
    name: 'Form 4562',
    description: 'Depreciation and Amortization',
    year: '2023',
    type: 'federal',
    category: 'supplemental',
    url: 'https://www.irs.gov/pub/irs-pdf/f4562.pdf'
  },
  {
    id: 'f8863',
    name: 'Form 8863',
    description: 'Education Credits',
    year: '2023',
    type: 'federal',
    category: 'supplemental',
    url: 'https://www.irs.gov/pub/irs-pdf/f8863.pdf'
  },
  {
    id: 'f8962',
    name: 'Form 8962',
    description: 'Premium Tax Credit',
    year: '2023',
    type: 'federal',
    category: 'supplemental',
    url: 'https://www.irs.gov/pub/irs-pdf/f8962.pdf'
  },
  {
    id: 'f8889',
    name: 'Form 8889',
    description: 'Health Savings Accounts (HSAs)',
    year: '2023',
    type: 'federal',
    category: 'supplemental',
    url: 'https://www.irs.gov/pub/irs-pdf/f8889.pdf'
  },
  {
    id: 'i1040',
    name: 'Instructions for Form 1040',
    description: 'Complete instructions for Form 1040',
    year: '2023',
    type: 'federal',
    category: 'instructions',
    url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf'
  },
  {
    id: 'i1040a',
    name: 'Instructions for Schedule A',
    description: 'Instructions for Schedule A (Form 1040)',
    year: '2023',
    type: 'federal',
    category: 'instructions',
    url: 'https://www.irs.gov/pub/irs-pdf/i1040sa.pdf'
  },
];

// Define state tax forms (just a few examples)
const stateTaxForms = [
  {
    id: 'ca540',
    name: 'Form 540',
    description: 'California Resident Income Tax Return',
    year: '2023',
    type: 'state',
    state: 'CA',
    url: 'https://www.ftb.ca.gov/forms/2023/2023-540.pdf'
  },
  {
    id: 'ny201',
    name: 'Form IT-201',
    description: 'New York Resident Income Tax Return',
    year: '2023',
    type: 'state',
    state: 'NY',
    url: 'https://www.tax.ny.gov/pdf/current_forms/it/it201.pdf'
  },
  {
    id: 'tx05-156',
    name: 'Form 05-156',
    description: 'Texas Franchise Tax Report',
    year: '2023',
    type: 'state',
    state: 'TX',
    url: 'https://comptroller.texas.gov/taxes/franchise/forms/'
  }
];

// Combined list of all forms
const allForms = [...taxForms, ...stateTaxForms];

export function TaxForms() {
  const [searchTerm, setSearchTerm] = useState('');
  const [formType, setFormType] = useState('all'); // 'all', 'federal', 'state'
  const [category, setCategory] = useState('all'); // 'all', 'primary', 'schedule', 'supplemental', 'instructions'
  const [year, setYear] = useState('2023');
  
  // Filter forms based on criteria
  const filteredForms = allForms.filter(form => {
    const matchesSearch = 
      form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = formType === 'all' || form.type === formType;
    const matchesCategory = category === 'all' || form.category === category;
    const matchesYear = form.year === year;
    
    return matchesSearch && matchesType && matchesCategory && matchesYear;
  });
  
  // Group forms by category for display
  const groupedForms = filteredForms.reduce((acc, form) => {
    const categoryName = form.category || 'other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(form);
    return acc;
  }, {} as Record<string, typeof allForms>);
  
  // Category labels for display
  const categoryLabels: Record<string, string> = {
    primary: 'Primary Forms',
    schedule: 'Schedules',
    supplemental: 'Supplemental Forms',
    instructions: 'Instructions',
    other: 'Other Forms'
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Tax Forms & Resources</h2>
      
      <div className="mb-6">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="w-full md:w-1/2 lg:w-1/3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Forms
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or description..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tax Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
            </select>
          </div>
          
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Form Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="federal">Federal</option>
              <option value="state">State</option>
            </select>
          </div>
          
          <div className="w-full md:w-1/6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="primary">Primary Forms</option>
              <option value="schedule">Schedules</option>
              <option value="supplemental">Supplemental Forms</option>
              <option value="instructions">Instructions</option>
            </select>
          </div>
        </div>
      </div>
      
      {Object.keys(groupedForms).length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No matching forms found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedForms).map(([category, forms]) => (
            <div key={category}>
              <h3 className="text-lg font-medium mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {categoryLabels[category] || category}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms.map(form => (
                  <div 
                    key={form.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium">{form.name}</h4>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {form.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          {form.type === 'federal' ? 'Federal' : `State: ${form.state || ''}`}
                        </span>
                        <a 
                          href={form.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Need Help?</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
          Visit these official resources for more tax information and assistance:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="https://www.irs.gov/forms-instructions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium">IRS Forms & Publications</span>
          </a>
          <a 
            href="https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">IRS Free File Options</span>
          </a>
          <a 
            href="https://www.irs.gov/help/ita"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">IRS Interactive Tax Assistant</span>
          </a>
          <a 
            href="https://www.irs.gov/individuals/tax-withholding-estimator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-3 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">IRS Tax Withholding Estimator</span>
          </a>
        </div>
      </div>
    </div>
  );
}