// lib/integrations/providers.ts
import { Provider } from '@/types/integration';

export const PROVIDER_CONFIG: Provider[] = [
  // Financial providers
  {
    id: 'plaid',
    name: 'Plaid',
    description: 'Connect bank accounts, credit cards, and investments',
    category: 'finance',
    logo: '/images/integrations/plaid.png',
    connected: false,
    permissions: [
      'View your financial account information',
      'View your transactions and balances',
      'View your investment holdings and returns'
    ],
    modalDescription: 'Plaid lets you securely connect your financial accounts to Life Navigator. We never store your bank credentials.'
  },
  {
    id: 'ynab',
    name: 'YNAB',
    description: 'Import budgets from You Need A Budget',
    category: 'finance',
    logo: '/images/integrations/ynab.png',
    connected: false,
    permissions: [
      'View your budget categories and allocations',
      'View your transaction history',
      'Read-only access to your budget goals'
    ],
    modalDescription: 'You Need A Budget (YNAB) is a personal budgeting app that helps you track your spending and allocate money. This integration lets you sync your YNAB budgets with Life Navigator.'
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Import budgets and financial goals',
    category: 'finance',
    logo: '/images/integrations/mint.png',
    connected: false,
    permissions: [
      'View your budget information',
      'View your spending categories',
      'View your financial goals'
    ],
    modalDescription: 'Mint helps you track your spending, create budgets, and set financial goals. This integration lets you sync your Mint data with Life Navigator.'
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Connect your cryptocurrency accounts',
    category: 'finance',
    logo: '/images/integrations/coinbase.png',
    connected: false,
    permissions: [
      'View your cryptocurrency balances',
      'View your transaction history',
      'Read-only access to your wallet information'
    ]
  },
  // Education providers
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Connect your educational courses and assignments',
    category: 'education',
    logo: '/images/integrations/canvas.png',
    connected: false,
    permissions: [
      'View your courses and assignments',
      'View your grades and progress',
      'Access your academic calendar'
    ]
  },
  {
    id: 'google_classroom',
    name: 'Google Classroom',
    description: 'Connect your Google Classroom courses',
    category: 'education',
    logo: '/images/integrations/google_classroom.png',
    connected: false,
    permissions: [
      'View your enrolled courses',
      'View your assignments and due dates',
      'Access your class materials'
    ]
  },
  // Healthcare providers
  {
    id: 'epic_mychart',
    name: 'Epic MyChart',
    description: 'Connect your health records and appointments',
    category: 'healthcare',
    logo: '/images/integrations/epic.png',
    connected: false,
    permissions: [
      'View your medical history',
      'View your upcoming appointments',
      'Access your lab results and medications'
    ],
    modalDescription: 'MyChart provides secure access to your health information. Life Navigator follows HIPAA guidelines for health data.'
  },
  {
    id: 'docuscan',
    name: 'DocuScan',
    description: 'Document scanning and secure storage',
    category: 'healthcare',
    logo: '/images/integrations/docuscan.png',
    connected: false,
    permissions: [
      'Scan documents using your device camera',
      'Convert photos to PDF documents',
      'Securely store and organize documents'
    ],
    modalDescription: 'DocuScan provides advanced document scanning with text recognition (OCR), PDF conversion, and secure cloud storage. All documents are encrypted with AES-256 encryption for maximum security.'
  },
  // Career providers
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Connect your professional network',
    category: 'career',
    logo: '/images/integrations/linkedin.png',
    connected: false,
    permissions: [
      'View your profile information',
      'View your connections',
      'Access your job history and skills'
    ]
  },
  // Automotive providers
  {
    id: 'smartcar',
    name: 'Smartcar',
    description: 'Connect your vehicle data',
    category: 'automotive',
    logo: '/images/integrations/smartcar.png',
    connected: false,
    permissions: [
      'View your vehicle information',
      'View your vehicle location',
      'Access your vehicle maintenance status'
    ]
  },
  // Smart home providers
  {
    id: 'google_home',
    name: 'Google Home',
    description: 'Connect your smart home devices',
    category: 'smarthome',
    logo: '/images/integrations/google_home.png',
    connected: false,
    permissions: [
      'View your device list',
      'View device status',
      'Access device history'
    ]
  }
];