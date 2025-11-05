'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/cards/Card';
import { RoadmapType } from '@/types/roadmap';

interface RoadmapHeaderProps {
  title: string;
  description: string;
  type: RoadmapType;
  progress: number;
  startDate: string;
  targetDate: string;
  completedMilestones: number;
  totalMilestones: number;
  onCreateMilestone?: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}

export function RoadmapHeader({
  title,
  description,
  type,
  progress,
  startDate,
  targetDate,
  completedMilestones,
  totalMilestones,
  onCreateMilestone,
  onExport,
  onPrint,
  onShare
}: RoadmapHeaderProps) {
  const [showActions, setShowActions] = useState(false);

  const getDomainColor = (type: RoadmapType) => {
    switch (type) {
      case 'career':
        return 'bg-blue-500';
      case 'education':
        return 'bg-purple-500';
      case 'finance':
        return 'bg-green-500';
      case 'healthcare':
        return 'bg-red-500';
      case 'comprehensive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const calculateProgressColor = (progressValue: number) => {
    if (progressValue < 25) return 'bg-red-500';
    if (progressValue < 50) return 'bg-orange-500';
    if (progressValue < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const progressColor = calculateProgressColor(progress);
  const domainColor = getDomainColor(type);

  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <div className={`w-4 h-4 rounded-full ${domainColor} mr-2`}></div>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
          <p className="text-gray-600 mb-4">{description}</p>
          
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4">
            <div className="mb-2 sm:mb-0">
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="font-medium">{new Date(startDate).toLocaleDateString()}</p>
            </div>
            <div className="mb-2 sm:mb-0">
              <p className="text-sm text-gray-500">Target Date</p>
              <p className="font-medium">{new Date(targetDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completion</p>
              <p className="font-medium">{completedMilestones} of {totalMilestones} milestones</p>
            </div>
          </div>
          
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`${progressColor} h-4 rounded-full transition-all duration-500 ease-in-out`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          {onCreateMilestone && (
            <Button onClick={onCreateMilestone} className="whitespace-nowrap">
              Add Milestone
            </Button>
          )}
          <Button 
            onClick={() => setShowActions(!showActions)} 
            variant="outline"
            className="whitespace-nowrap"
          >
            {showActions ? 'Hide Actions' : 'More Actions'}
          </Button>
          
          {showActions && (
            <div className="flex flex-col gap-2 mt-2">
              {onExport && (
                <Button onClick={onExport} variant="outline" size="sm">
                  Export
                </Button>
              )}
              {onPrint && (
                <Button onClick={onPrint} variant="outline" size="sm">
                  Print
                </Button>
              )}
              {onShare && (
                <Button onClick={onShare} variant="outline" size="sm">
                  Share
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}