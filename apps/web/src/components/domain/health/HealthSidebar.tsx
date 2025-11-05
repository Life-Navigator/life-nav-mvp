'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBarIcon,
  HeartIcon,
  ClipboardDocumentCheckIcon,
  CalendarIcon,
  UserIcon,
  Cog6ToothIcon,
  LockClosedIcon
} from "@heroicons/react/24/outline";

const healthNavItems = [
  {
    title: "Overview",
    href: "/dashboard/healthcare/overview",
    icon: <ChartBarIcon className="w-5 h-5" />,
  },
  {
    title: "Wellness",
    href: "/dashboard/healthcare/wellness",
    icon: <HeartIcon className="w-5 h-5" />,
  },
  {
    title: "Preventive Care",
    href: "/dashboard/healthcare/preventive",
    icon: <ClipboardDocumentCheckIcon className="w-5 h-5" />,
  },
  {
    title: "Appointments",
    href: "/dashboard/healthcare/appointments",
    icon: <CalendarIcon className="w-5 h-5" />,
  },
  {
    title: "Medical Records",
    href: "/dashboard/healthcare/records",
    icon: <UserIcon className="w-5 h-5" />,
  },
  {
    title: "Secure Documents",
    href: "/dashboard/healthcare/documents",
    icon: <LockClosedIcon className="w-5 h-5" />,
  },
];

export function HealthSidebar() {
  const pathname = usePathname();

  // Determine if a nav link is active
  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="w-64 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Healthcare</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your health and wellness</p>
      </div>
      
      <nav className="flex-1 space-y-1">
        {healthNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive(item.href)
                ? "bg-red-50 text-red-900 dark:bg-red-500 dark:text-white font-semibold"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
            }`}
          >
            <span className={isActive(item.href) ? "text-red-600 dark:text-red-400" : ""}>
              {item.icon}
            </span>
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
      
      {/* Settings */}
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link 
          href="/dashboard/healthcare/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            isActive("/dashboard/healthcare/settings")
              ? "bg-red-50 text-red-900 dark:bg-red-500 dark:text-white font-semibold"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
          }`}
        >
          <span className={isActive("/dashboard/healthcare/settings") ? "text-red-600 dark:text-red-400" : ""}>
            <Cog6ToothIcon className="w-5 h-5" />
          </span>
          <span>Settings</span>
        </Link>
      </div>
      
      {/* Health score */}
      <div className="mt-6 p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-red-900 rounded-lg border border-red-100 dark:border-red-800">
        <h3 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">Health Score</h3>
        <div className="flex justify-center">
          <div className="relative w-24 h-24">
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
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray="78, 100"
              />
              <text x="18" y="20.35" className="text-lg" textAnchor="middle" fill="#dc2626" fontWeight="bold">78</text>
            </svg>
          </div>
        </div>
        <p className="text-xs text-center text-red-700 dark:text-red-300 mt-2">Good - Improved 5% this month</p>
      </div>
    </div>
  );
}