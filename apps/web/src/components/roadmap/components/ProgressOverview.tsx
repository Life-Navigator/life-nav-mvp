'use client';

import { Card } from '@/components/ui/cards/Card';
import { MilestoneStatus } from '@/types/roadmap';

interface MilestoneCount {
  status: MilestoneStatus;
  count: number;
}

interface ProgressOverviewProps {
  totalMilestones: number;
  milestoneCounts: MilestoneCount[];
  averageCompletion: number;
  upcomingMilestones: number;
  timeRemainingPercent: number;
  timeRemainingText: string;
}

export function ProgressOverview({
  totalMilestones,
  milestoneCounts,
  averageCompletion,
  upcomingMilestones,
  timeRemainingPercent,
  timeRemainingText
}: ProgressOverviewProps) {
  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'in_progress':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'delayed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusFillColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'pending':
        return 'rgba(107, 114, 128, 0.2)'; // gray-500 with 0.2 opacity
      case 'in_progress':
        return 'rgba(59, 130, 246, 0.2)'; // blue-500 with 0.2 opacity
      case 'completed':
        return 'rgba(34, 197, 94, 0.2)'; // green-500 with 0.2 opacity
      case 'delayed':
        return 'rgba(239, 68, 68, 0.2)'; // red-500 with 0.2 opacity
      default:
        return 'rgba(107, 114, 128, 0.2)'; // gray-500 with 0.2 opacity
    }
  };

  const getStatusName = (status: MilestoneStatus) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Calculate the percentage of each status
  const statusPercentages = milestoneCounts.map(({ status, count }) => ({
    status,
    percentage: Math.round((count / totalMilestones) * 100)
  }));

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Progress Overview</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Milestones</h3>
          <p className="text-2xl font-semibold">{totalMilestones}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Average Completion</h3>
          <p className="text-2xl font-semibold">{averageCompletion}%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Upcoming Milestones</h3>
          <p className="text-2xl font-semibold">{upcomingMilestones}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Time Remaining</h3>
          <p className="text-2xl font-semibold">{timeRemainingText}</p>
          <div className="mt-1 bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full" 
              style={{ width: `${100 - timeRemainingPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <h3 className="text-lg font-medium mb-3">Milestone Status</h3>
      
      {/* Status Bar Chart */}
      <div className="mb-4">
        <div className="flex h-6 rounded-md overflow-hidden">
          {statusPercentages.map(({ status, percentage }) => (
            <div
              key={status}
              className="h-full transition-all duration-500"
              style={{ 
                width: `${percentage}%`, 
                backgroundColor: getStatusFillColor(status),
                borderRight: percentage > 0 ? '1px solid white' : 'none'
              }}
              title={`${getStatusName(status)}: ${percentage}%`}
            ></div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs">0%</span>
          <span className="text-xs">100%</span>
        </div>
      </div>
      
      {/* Status Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {milestoneCounts.map(({ status, count }) => (
          <div key={status} className="flex items-center">
            <div 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: getStatusFillColor(status) }}
            ></div>
            <span className={`text-sm ${getStatusColor(status)}`}>
              {getStatusName(status)}: {count} ({Math.round((count / totalMilestones) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}