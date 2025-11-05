'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ChartBarIcon, 
  AcademicCapIcon,
  BookOpenIcon,
  DocumentCheckIcon,
  ClockIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";

const educationNavItems = [
  {
    title: "Overview",
    href: "/dashboard/education/overview",
    icon: <ChartBarIcon className="w-5 h-5" />,
  },
  {
    title: "Courses",
    href: "/dashboard/education/courses",
    icon: <BookOpenIcon className="w-5 h-5" />,
  },
  {
    title: "Certifications",
    href: "/dashboard/education/certifications",
    icon: <DocumentCheckIcon className="w-5 h-5" />,
  },
  {
    title: "Progress",
    href: "/dashboard/education/progress",
    icon: <ClockIcon className="w-5 h-5" />,
  },
  {
    title: "Learning Path",
    href: "/dashboard/education/path",
    icon: <AcademicCapIcon className="w-5 h-5" />,
  },
];

export function EducationSidebar() {
  const pathname = usePathname();

  // Determine if a nav link is active
  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="w-64 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Education</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track your learning journey</p>
      </div>
      
      <nav className="flex-1 space-y-1">
        {educationNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive(item.href)
                ? "bg-amber-50 text-amber-900 dark:bg-amber-600 dark:text-white font-semibold"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
            }`}
          >
            <span className={isActive(item.href) ? "text-amber-600 dark:text-amber-400" : ""}>
              {item.icon}
            </span>
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
      
      {/* Settings */}
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link 
          href="/dashboard/education/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            isActive("/dashboard/education/settings")
              ? "bg-amber-50 text-amber-900 dark:bg-amber-600 dark:text-white font-semibold"
              : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
          }`}
        >
          <span className={isActive("/dashboard/education/settings") ? "text-amber-600 dark:text-amber-400" : ""}>
            <Cog6ToothIcon className="w-5 h-5" />
          </span>
          <span>Settings</span>
        </Link>
      </div>
      
      {/* Education progress */}
      <div className="mt-6 p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-amber-900 rounded-lg border border-amber-100 dark:border-amber-800">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">Learning Progress</h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-amber-700 dark:text-amber-300">Current Course</span>
          <span className="text-xs font-medium text-amber-900 dark:text-amber-100">67%</span>
        </div>
        <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2.5">
          <div className="bg-amber-500 dark:bg-amber-400 h-2.5 rounded-full" style={{ width: '67%' }}></div>
        </div>
        <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          <p>Next Assignment Due: <span className="font-medium text-amber-900 dark:text-amber-200">2 days</span></p>
        </div>
      </div>
    </div>
  );
}