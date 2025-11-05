'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { Milestone, MilestoneStatus, MilestonePriority } from '@/types/roadmap';

interface MilestoneTrackerProps {
  milestones: Milestone[];
  onUpdateProgress: (id: string, progress: number) => void;
  onUpdateStatus: (id: string, status: MilestoneStatus) => void;
  onEdit?: (milestone: Milestone) => void;
  onDelete?: (id: string) => void;
}

export function MilestoneTracker({
  milestones,
  onUpdateProgress,
  onUpdateStatus,
  onEdit,
  onDelete
}: MilestoneTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-200 text-gray-700';
      case 'in_progress':
        return 'bg-blue-200 text-blue-700';
      case 'completed':
        return 'bg-green-200 text-green-700';
      case 'delayed':
        return 'bg-red-200 text-red-700';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const getPriorityColor = (priority: MilestonePriority) => {
    switch (priority) {
      case 'low':
        return 'bg-gray-200 text-gray-700';
      case 'medium':
        return 'bg-blue-200 text-blue-700';
      case 'high':
        return 'bg-orange-200 text-orange-700';
      case 'critical':
        return 'bg-red-200 text-red-700';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const formatStatusText = (status: MilestoneStatus) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const statusOptions: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'delayed'];

  // Group milestones by month
  const groupedMilestones = milestones.reduce((groups, milestone) => {
    const targetDate = new Date(milestone.targetDate);
    const monthYear = `${targetDate.toLocaleString('default', { month: 'long' })} ${targetDate.getFullYear()}`;
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    
    groups[monthYear].push(milestone);
    return groups;
  }, {} as Record<string, Milestone[]>);

  // Sort months chronologically
  const sortedMonths = Object.keys(groupedMilestones).sort((a, b) => {
    const dateA = new Date(groupedMilestones[a][0].targetDate);
    const dateB = new Date(groupedMilestones[b][0].targetDate);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="space-y-6">
      {sortedMonths.map((month) => (
        <div key={month}>
          <h2 className="text-xl font-semibold mb-3">{month}</h2>
          <div className="space-y-4">
            {groupedMilestones[month].map((milestone) => (
              <Card 
                key={milestone.id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === milestone.id ? null : milestone.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">{milestone.title}</h3>
                      <p className="text-gray-600 text-sm">{new Date(milestone.targetDate).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(milestone.status)}`}>
                        {formatStatusText(milestone.status)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(milestone.priority)}`}>
                        {milestone.priority.charAt(0).toUpperCase() + milestone.priority.slice(1)}
                      </span>
                      <div className="bg-gray-200 rounded-full h-2 w-20 hidden sm:block">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${milestone.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium hidden sm:block">{milestone.progress}%</span>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="ml-2"
                        aria-label={expandedId === milestone.id ? "Collapse" : "Expand"}
                      >
                        {expandedId === milestone.id ? '' : '+'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="sm:hidden mt-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-200 rounded-full h-2 flex-1">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${milestone.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{milestone.progress}%</span>
                    </div>
                  </div>
                </div>
                
                {expandedId === milestone.id && (
                  <div className="p-4 pt-0 border-t mt-2">
                    <p className="mb-4">{milestone.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Status</h4>
                        <div className="flex flex-wrap gap-2">
                          {statusOptions.map((status) => (
                            <button
                              key={status}
                              className={`px-3 py-1 rounded text-sm ${
                                milestone.status === status 
                                  ? getStatusColor(status) + ' font-medium' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                              onClick={() => onUpdateStatus(milestone.id, status)}
                            >
                              {formatStatusText(status)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Progress</h4>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={milestone.progress}
                            onChange={(e) => onUpdateProgress(milestone.id, parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="font-medium">{milestone.progress}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium">Start Date:</span> {new Date(milestone.startDate).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Target Date:</span> {new Date(milestone.targetDate).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {milestone.notes && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-1">Notes</h4>
                        <p className="text-sm text-gray-600">{milestone.notes}</p>
                      </div>
                    )}
                    
                    {milestone.resources && milestone.resources.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-1">Resources</h4>
                        <ul className="text-sm text-blue-600 space-y-1">
                          {milestone.resources.map((resource, index) => (
                            <li key={index}>
                              {resource.url ? (
                                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {resource.title}
                                </a>
                              ) : (
                                <span>{resource.title}</span>
                              )}
                              {resource.description && (
                                <span className="text-gray-600"> - {resource.description}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2 mt-4">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(milestone)}
                        >
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this milestone?')) {
                              onDelete(milestone.id);
                            }
                          }}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
      
      {milestones.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">No milestones found for this roadmap.</p>
          <Button>Add Your First Milestone</Button>
        </Card>
      )}
    </div>
  );
}