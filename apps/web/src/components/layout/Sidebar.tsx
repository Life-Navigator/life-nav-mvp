'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { classNames } from '@/lib/utils/classNames';

// Icon components
function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}

function CurrencyDollarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );
}

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  );
}

function AcademicCapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>
  );
}

function PuzzlePieceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.734-.95.191-1.317-.241-2.287-1.187-2.358-1.562-.118-2.369 1.446-2.369 1.446l-1.473 1.473c-.03.029-.065.053-.1.073a.981.981 0 0 1-.196.114 1.092 1.092 0 0 1-.142.056 1.011 1.011 0 0 1-.171.036 1.09 1.09 0 0 1-.173.008l-4.239.001c-1.22 0-2.337-.67-2.911-1.74-.573-1.07-.52-2.368.141-3.391l.007-.012a6.931 6.931 0 0 1 .303-.483l.026-.038c.284-.413.495-.546.848-.546H8.5a2 2 0 0 0 2-2v-.836c0-.865-.68-1.583-1.545-1.607a47.46 47.46 0 0 1-1.45-.037c-.122-.016-.243-.027-.36-.035-.563-.039-1.014-.499-1.014-1.066 0-.28.11-.545.305-.742l1.943-1.943C9.603 1.578 10.899 2 12 2c1.101 0 2.137-.422 2.918-1.204.783-.783 2.043-.788 2.831 0l1.647 1.647c.78.78.786 2.041.002 2.824C18.602 6.063 19.023 6.839 19.439 7.85z" />
    </svg>
  );
}

function CogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}

function XMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

function Bars3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );
}

// Navigation items — beta launch: only fully-working features are shown.
// Hidden features: Goals, Finance sub-pages (Budget/Investments/Accounts/
// Transactions/Retirement/Tax), Career (Opportunities/Networking), Education
// (Progress), Healthcare, Email, Calendar, Roadmap, Document Vault.
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    current: false,
  },
  {
    name: 'Finance',
    href: '/dashboard/finance/overview',
    icon: CurrencyDollarIcon,
    current: false,
  },
  {
    name: 'Career',
    href: '/dashboard/career',
    icon: BriefcaseIcon,
    current: false,
    children: [{ name: 'Applications', href: '/dashboard/career/applications' }],
  },
  {
    name: 'Education',
    href: '/dashboard/education/certifications',
    icon: AcademicCapIcon,
    current: false,
  },
  {
    name: 'Integrations',
    href: '/dashboard/integrations',
    icon: PuzzlePieceIcon,
    current: false,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: CogIcon,
    current: false,
    children: [
      { name: 'Profile', href: '/dashboard/settings/profile' },
      { name: 'Security', href: '/dashboard/settings/security' },
      { name: 'Preferences', href: '/dashboard/settings/preferences' },
    ],
  },
];

// Get the parent section from a pathname
const getParentSection = (path: string): string | null => {
  if (path === '/dashboard') return null;

  // Extract the section name from paths like /dashboard/finance/budget
  const segments = path.split('/');
  if (segments.length >= 3) {
    return segments[2]; // Returns 'finance', 'career', etc.
  }

  return null;
};

// Sidebar component
interface SidebarProps {
  collapsed?: boolean;
}

export default function Sidebar({ collapsed: forceCollapsed = false }: SidebarProps = {}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const parentSection = getParentSection(pathname);

  // Override isCollapsed if forceCollapsed is true
  const effectiveCollapsed = forceCollapsed || isCollapsed;

  // Check if mobile on mount and on window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    // Initial check
    checkIfMobile();

    // Add event listener
    window.addEventListener('resize', checkIfMobile);

    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Default to open on initial load for larger screens
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(true);

      // Auto-collapse sidebar when inside a section (not on the main dashboard)
      if (pathname !== '/dashboard' && parentSection) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    }
  }, [isMobile, pathname, parentSection]);

  // Update expanded sections when pathname changes
  useEffect(() => {
    // For main dashboard, don't expand any sections
    if (pathname === '/dashboard') {
      return;
    }

    const newExpandedSections: Record<string, boolean> = {};

    navigation.forEach((item) => {
      if (item.children) {
        // Check if the pathname matches this section or any child
        const isActive = pathname.startsWith(item.href);
        if (isActive) {
          newExpandedSections[item.name] = true;
        }
      }
    });

    setExpandedSections(newExpandedSections);
  }, [pathname]);

  // Toggle a section's expanded state
  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Check if a navigation item is active
  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Toggle collapsed state
  const toggleCollapsed = () => {
    if (!forceCollapsed) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 z-20 bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={classNames(
          'fixed lg:sticky lg:top-0 top-0 left-0 z-30 h-screen transform transition-all duration-300 ease-in-out bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto overflow-x-hidden',
          isOpen || !isMobile ? 'translate-x-0' : '-translate-x-full',
          isCollapsed && !isMobile ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo and collapse button */}
        <div className="flex h-16 items-center px-4 border-b border-gray-200 dark:border-gray-700 justify-between">
          <Link
            href="/dashboard"
            className={classNames(
              'flex items-center space-x-2',
              isCollapsed && !isMobile ? 'justify-center' : ''
            )}
          >
            <img
              src="/LifeNavigator.png"
              alt="LifeNavigator Logo"
              className="w-8 h-8 flex-shrink-0"
            />
            {(!effectiveCollapsed || isMobile) && (
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                LifeNavigator
              </span>
            )}
          </Link>

          {!isMobile && !forceCollapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
              aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {effectiveCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={classNames('py-4', isCollapsed && !isMobile ? 'px-1' : 'px-2')}>
          {navigation.map((item) => {
            const isActive = isItemActive(item.href);
            const isExpanded = expandedSections[item.name];
            return (
              <div key={item.name} className="mb-1 relative">
                {/* Main navigation item */}
                <div className="flex items-center">
                  <Link
                    href={item.href}
                    className={classNames(
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50',
                      'flex items-center flex-grow rounded-md group',
                      isCollapsed && !isMobile ? 'justify-center p-2' : 'px-3 py-2'
                    )}
                    onClick={() => isMobile && !item.children && setIsOpen(false)}
                    title={isCollapsed && !isMobile ? item.name : undefined}
                  >
                    <item.icon
                      className={classNames(
                        isActive
                          ? 'text-blue-600 dark:text-blue-300'
                          : 'text-gray-500 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300',
                        isCollapsed && !isMobile ? 'w-6 h-6' : 'w-5 h-5 mr-3 flex-shrink-0'
                      )}
                      aria-hidden="true"
                    />
                    {(!effectiveCollapsed || isMobile) && (
                      <span className="flex-grow">{item.name}</span>
                    )}
                  </Link>

                  {/* Dropdown toggle button */}
                  {item.children && (!effectiveCollapsed || isMobile) && (
                    <button
                      onClick={() => toggleSection(item.name)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none"
                    >
                      <ChevronIcon
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {/* Child items */}
                {item.children && isExpanded && (!effectiveCollapsed || isMobile) && (
                  <div className="ml-8 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={classNames(
                            isChildActive
                              ? 'text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-600 hover:text-gray-800 dark:text-white dark:hover:text-gray-200',
                            'block py-1.5 px-3 text-sm rounded-md'
                          )}
                          onClick={() => isMobile && setIsOpen(false)}
                        >
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom section - only show when not collapsed or on mobile */}
        {(!effectiveCollapsed || isMobile) && (
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Premium Desktop
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Access advanced features in our desktop app
              </p>
              <a
                href="https://nexlevel-intelligence.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Download now
                <ArrowRightIcon className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Mobile toggle button */}
      {isMobile && (
        <button
          type="button"
          className="fixed z-40 bottom-4 right-4 p-2 rounded-full bg-blue-600 text-white shadow-lg"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      )}
    </>
  );
}
