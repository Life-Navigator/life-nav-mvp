'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface BreadcrumbStructure {
  [key: string]: {
    label: string;
    icon?: string;
    parent?: string;
  };
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  
  // Skip rendering breadcrumbs on the main dashboard
  if (pathname === '/dashboard') {
    return null;
  }

  // Define breadcrumb structure with labels and parent relationships
  const breadcrumbMap: BreadcrumbStructure = {
    'dashboard': {
      label: 'Dashboard',
      icon: '🏠',
    },
    'finance': {
      label: 'Finance',
      icon: '💰',
      parent: 'dashboard',
    },
    'budget': {
      label: 'Budget',
      parent: 'finance',
    },
    'investments': {
      label: 'Investments',
      parent: 'finance',
    },
    'retirement': {
      label: 'Retirement',
      parent: 'finance',
    },
    'transactions': {
      label: 'Transactions',
      parent: 'finance',
    },
    'accounts': {
      label: 'Accounts',
      parent: 'finance',
    },
    'tax': {
      label: 'Tax',
      parent: 'finance',
    },
    'career': {
      label: 'Career',
      icon: '💼',
      parent: 'dashboard',
    },
    'networking': {
      label: 'Networking',
      parent: 'career',
    },
    'opportunities': {
      label: 'Opportunities',
      parent: 'career',
    },
    'education': {
      label: 'Education',
      icon: '🎓',
      parent: 'dashboard',
    },
    'certifications': {
      label: 'Certifications',
      parent: 'education',
    },
    'progress': {
      label: 'Progress',
      parent: 'education',
    },
    'healthcare': {
      label: 'Healthcare',
      icon: '❤️',
      parent: 'dashboard',
    },
    'wellness': {
      label: 'Wellness',
      parent: 'healthcare',
    },
    'preventive': {
      label: 'Preventive Care',
      parent: 'healthcare',
    },
    'records': {
      label: 'Medical Records',
      parent: 'healthcare',
    },
    'settings': {
      label: 'Settings',
      icon: '⚙️',
      parent: 'dashboard',
    },
    'profile': {
      label: 'Profile',
      parent: 'settings',
    },
    'security': {
      label: 'Security',
      parent: 'settings',
    },
    'preferences': {
      label: 'Preferences',
      parent: 'settings',
    },
    'notifications': {
      label: 'Notifications',
      parent: 'settings',
    },
    'integrations': {
      label: 'Integrations',
      parent: 'dashboard',
    },
    'roadmap': {
      label: 'Roadmap',
      parent: 'dashboard',
    },
    'insights': {
      label: 'Insights',
      parent: 'dashboard',
    },
  };

  // Build the breadcrumb trail
  const buildBreadcrumbs = (path: string) => {
    // Remove leading slash and split path into segments
    const segments = path.split('/').filter(segment => segment);
    
    if (segments.length === 0 || segments[0] !== 'dashboard') {
      return [];
    }
    
    const breadcrumbs = [];
    let currentPath = '';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      
      // Skip if segment isn't in our map
      if (!breadcrumbMap[segment]) {
        continue;
      }
      
      breadcrumbs.push({
        label: breadcrumbMap[segment].label,
        href: currentPath,
        icon: breadcrumbMap[segment].icon,
        isLast: i === segments.length - 1
      });
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs(pathname);
  
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.href} className="inline-flex items-center">
            {index > 0 && (
              <svg className="w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
            )}
            
            {breadcrumb.isLast ? (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {breadcrumb.icon && <span className="mr-1">{breadcrumb.icon}</span>}
                {breadcrumb.label}
              </span>
            ) : (
              <Link
                href={breadcrumb.href}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {breadcrumb.icon && <span className="mr-1">{breadcrumb.icon}</span>}
                {breadcrumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}