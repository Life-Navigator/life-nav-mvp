// src/components/domain/finance/IntegrationCards.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building, CreditCard, PiggyBank, BarChart3, ChevronDown, ChevronRight, Bitcoin, 
  Briefcase, GraduationCap, Car, Home, CheckCircle, Plus, AlertTriangle, 
  Lock, RefreshCw, Settings, ExternalLink
} from 'lucide-react';
import Image from 'next/image';

// TypeScript interfaces
interface IntegrationStatus {
  id: string;
  provider: string;
  category: 'banking' | 'investment' | 'crypto' | 'payroll' | 'health' | 'education' | 'automotive' | 'smart_home';
  connectedAccounts: number;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastUpdated: string;
  requiresAction: boolean;
  actionMessage?: string;
  logo: string;
}

interface CategoryInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  lightBgClass: string;
}

const IntegrationCards: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('banking'); // Default to banking expanded

  // Define categories
  const categories: Record<string, CategoryInfo> = {
    banking: {
      name: 'Banking & Credit Cards',
      description: 'Connect bank accounts, credit cards, and track spending',
      icon: <CreditCard size={24} />,
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-500',
      borderClass: 'border-blue-500',
      lightBgClass: 'bg-blue-50'
    },
    investment: {
      name: 'Investments & Brokerage',
      description: 'Track portfolios, stocks, ETFs and retirement accounts',
      icon: <PiggyBank size={24} />,
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-500',
      borderClass: 'border-purple-500',
      lightBgClass: 'bg-purple-50'
    },
    crypto: {
      name: 'Cryptocurrency',
      description: 'Monitor your crypto wallets and exchanges',
      icon: <Bitcoin size={24} />,
      colorClass: 'text-yellow-500',
      bgClass: 'bg-yellow-500',
      borderClass: 'border-yellow-500',
      lightBgClass: 'bg-yellow-50'
    },
    payroll: {
      name: 'Payroll & HR',
      description: 'Access paystubs, benefits and employment details',
      icon: <Briefcase size={24} />,
      colorClass: 'text-green-500',
      bgClass: 'bg-green-500',
      borderClass: 'border-green-500',
      lightBgClass: 'bg-green-50'
    },
    health: {
      name: 'Health & Insurance',
      description: 'View medical records, insurance claims and benefits',
      icon: <Building size={24} />,
      colorClass: 'text-red-500',
      bgClass: 'bg-red-500',
      borderClass: 'border-red-500',
      lightBgClass: 'bg-red-50'
    },
    education: {
      name: 'Education',
      description: 'Connect to learning platforms, view grades and courses',
      icon: <GraduationCap size={24} />,
      colorClass: 'text-indigo-500',
      bgClass: 'bg-indigo-500',
      borderClass: 'border-indigo-500',
      lightBgClass: 'bg-indigo-50'
    },
    automotive: {
      name: 'Automotive',
      description: 'Track vehicle loans, maintenance and telematics',
      icon: <Car size={24} />,
      colorClass: 'text-gray-500',
      bgClass: 'bg-gray-500',
      borderClass: 'border-gray-500',
      lightBgClass: 'bg-gray-50'
    },
    smart_home: {
      name: 'Smart Home',
      description: 'Monitor IoT devices, utilities and home automation',
      icon: <Home size={24} />,
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-500',
      borderClass: 'border-orange-500',
      lightBgClass: 'bg-orange-50'
    }
  };

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        // In a real app, this would be an API call to your backend
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Mock integrations data
        const mockIntegrations: IntegrationStatus[] = [
          {
            id: 'plaid1',
            provider: 'Chase',
            category: 'banking',
            connectedAccounts: 3,
            status: 'connected',
            lastUpdated: '2025-05-03T15:30:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'plaid2',
            provider: 'Bank of America',
            category: 'banking',
            connectedAccounts: 2,
            status: 'connected',
            lastUpdated: '2025-05-02T10:15:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'plaid3',
            provider: 'American Express',
            category: 'banking',
            connectedAccounts: 1,
            status: 'error',
            lastUpdated: '2025-04-28T09:45:00Z',
            requiresAction: true,
            actionMessage: 'Reconnection required',
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'plaid4',
            provider: 'Fidelity',
            category: 'investment',
            connectedAccounts: 2,
            status: 'connected',
            lastUpdated: '2025-05-01T08:30:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'plaid5',
            provider: 'Vanguard',
            category: 'investment',
            connectedAccounts: 1,
            status: 'connected',
            lastUpdated: '2025-04-29T14:20:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'coinbase1',
            provider: 'Coinbase',
            category: 'crypto',
            connectedAccounts: 1,
            status: 'connected',
            lastUpdated: '2025-05-02T16:45:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'adp1',
            provider: 'ADP',
            category: 'payroll',
            connectedAccounts: 1,
            status: 'connected',
            lastUpdated: '2025-04-15T11:30:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'smart1',
            provider: 'Kaiser Permanente',
            category: 'health',
            connectedAccounts: 1,
            status: 'pending',
            lastUpdated: '2025-05-03T09:10:00Z',
            requiresAction: true,
            actionMessage: 'Verification needed',
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'canvas1',
            provider: 'Canvas LMS',
            category: 'education',
            connectedAccounts: 1,
            status: 'connected',
            lastUpdated: '2025-04-20T13:15:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'smartcar1',
            provider: 'BMW Connected',
            category: 'automotive',
            connectedAccounts: 1,
            status: 'connected',
            lastUpdated: '2025-05-01T17:30:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          },
          {
            id: 'googlehome1',
            provider: 'Google Home',
            category: 'smart_home',
            connectedAccounts: 5,
            status: 'connected',
            lastUpdated: '2025-05-03T19:45:00Z',
            requiresAction: false,
            logo: '/api/placeholder/48/48'
          }
        ];
        
        setIntegrations(mockIntegrations);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchIntegrations();
  }, []);

  // Group integrations by category
  const getIntegrationsByCategory = (category: string) => {
    return integrations.filter(integration => integration.category === category);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get status classes for styling
  const getStatusClasses = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'connected':
        return {
          textClass: 'text-green-600',
          bgClass: 'bg-green-100',
          icon: <CheckCircle size={16} className="text-green-600" />
        };
      case 'disconnected':
        return {
          textClass: 'text-gray-600',
          bgClass: 'bg-gray-100',
          icon: <Lock size={16} className="text-gray-600" />
        };
      case 'error':
        return {
          textClass: 'text-red-600',
          bgClass: 'bg-red-100',
          icon: <AlertTriangle size={16} className="text-red-600" />
        };
      case 'pending':
        return {
          textClass: 'text-yellow-600',
          bgClass: 'bg-yellow-100',
          icon: <RefreshCw size={16} className="text-yellow-600" />
        };
      default:
        return {
          textClass: 'text-gray-600',
          bgClass: 'bg-gray-100',
          icon: <CheckCircle size={16} className="text-gray-600" />
        };
    }
  };

  // Toggle expanded category
  const toggleCategory = (category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading Integrations...</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Connected Services</h2>
        <button className="flex items-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md">
          <Plus size={16} className="mr-1" />
          Add Connection
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(categories).map(([categoryKey, categoryInfo]) => (
          <div key={categoryKey} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Category header */}
            <div 
              className={`flex items-center justify-between p-4 cursor-pointer ${
                expandedCategory === categoryKey ? categoryInfo.lightBgClass : 'bg-white'
              }`}
              onClick={() => toggleCategory(categoryKey)}
            >
              <div className="flex items-center">
                <div className={`p-2 rounded-full ${categoryInfo.lightBgClass}`}>
                  <div className={categoryInfo.colorClass}>{categoryInfo.icon}</div>
                </div>
                <div className="ml-3">
                  <h3 className="font-medium text-gray-900">{categoryInfo.name}</h3>
                  <p className="text-sm text-gray-500">{categoryInfo.description}</p>
                </div>
              </div>
              <div className="flex items-center">
                {/* Count of connected services */}
                <span className="text-sm text-gray-500 mr-3">
                  {getIntegrationsByCategory(categoryKey).length} connected
                </span>
                {/* Expand/collapse icon */}
                {expandedCategory === categoryKey ? (
                  <ChevronDown size={20} className="text-gray-500" />
                ) : (
                  <ChevronRight size={20} className="text-gray-500" />
                )}
              </div>
            </div>

            {/* Expanded content */}
            {expandedCategory === categoryKey && (
              <div className="p-4 border-t border-gray-200">
                {getIntegrationsByCategory(categoryKey).length > 0 ? (
                  <div className="space-y-3">
                    {getIntegrationsByCategory(categoryKey).map(integration => {
                      const statusClasses = getStatusClasses(integration.status);
                      return (
                        <div 
                          key={integration.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                              <Image 
                                src={integration.logo} 
                                alt={integration.provider}
                                width={32}
                                height={32}
                                className="object-cover"
                              />
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{integration.provider}</div>
                              <div className="flex items-center text-xs">
                                <span className={`flex items-center ${statusClasses.textClass}`}>
                                  {statusClasses.icon}
                                  <span className="ml-1">
                                    {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                                  </span>
                                </span>
                                <span className="mx-2">•</span>
                                <span className="text-gray-500">
                                  {integration.connectedAccounts} {integration.connectedAccounts === 1 ? 'account' : 'accounts'}
                                </span>
                                <span className="mx-2">•</span>
                                <span className="text-gray-500">
                                  Updated {formatDate(integration.lastUpdated)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            {integration.requiresAction && (
                              <button className={`mr-2 text-xs ${statusClasses.textClass} ${statusClasses.bgClass} px-2 py-1 rounded`}>
                                {integration.actionMessage || 'Action Required'}
                              </button>
                            )}
                            <button 
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                              title="Settings"
                              aria-label="Open settings"
                            >
                              <Settings size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Add more service button */}
                    <div className="mt-3">
                      <button className="w-full py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center">
                        <Plus size={16} className="mr-1" />
                        Add Another {categoryInfo.name} Service
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className={`inline-block p-3 rounded-full ${categoryInfo.lightBgClass} mb-2`}>
                      <div className={categoryInfo.colorClass}>{categoryInfo.icon}</div>
                    </div>
                    <h4 className="text-lg font-medium mb-1">No connected {categoryInfo.name.toLowerCase()}</h4>
                    <p className="text-sm text-gray-500 mb-4">Connect your accounts to get started</p>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center mx-auto">
                      <Plus size={16} className="mr-1" />
                      Connect {categoryInfo.name}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Information about third-party integrations */}
      <div className="mt-6 bg-gray-50 p-4 rounded-md border border-gray-200">
        <div className="flex items-start">
          <Lock className="text-gray-500 mr-3 mt-1" size={20} />
          <div>
            <h4 className="font-medium text-gray-800">Secure Third-Party Access</h4>
            <p className="text-sm text-gray-600 mt-1">
              Your security is our priority. All third-party integrations use OAuth and we never store your passwords.
              Data is encrypted with AES-256 and transmitted over TLS 1.3.
            </p>
            <a href="/security" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-flex items-center">
              Learn more about our security practices
              <ExternalLink size={14} className="ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationCards;