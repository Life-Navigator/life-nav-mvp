'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, addYears, differenceInMonths, isBefore, isAfter } from 'date-fns';
import {
  Goal,
  GoalBlock,
  TimelineConfig,
  calculateGoalProgress,
  getGoalStatusColor,
  getGoalPriorityBadge,
} from '@/lib/goals/types';
import { GoalDetailPanel } from './GoalDetailPanel';
import { CreateGoalModal } from './CreateGoalModal';

interface MyBlocksTimelineProps {
  goals: Goal[];
  onGoalUpdate: (goal: Goal) => void;
  onGoalCreate: (goal: Partial<Goal>) => void;
  onGoalDelete: (goalId: string) => void;
}

export const MyBlocksTimeline: React.FC<MyBlocksTimelineProps> = ({
  goals,
  onGoalUpdate,
  onGoalCreate,
  onGoalDelete,
}) => {
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig>({
    startDate: new Date(),
    endDate: addYears(new Date(), 10),
    view: 'years',
    zoom: 1,
    rows: 5,
  });

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoveredGoal, setHoveredGoal] = useState<string | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Generate timeline markers based on view
  const generateTimelineMarkers = () => {
    const markers = [];
    let currentDate = new Date(timelineConfig.startDate);
    
    while (isBefore(currentDate, timelineConfig.endDate)) {
      markers.push(new Date(currentDate));
      
      switch (timelineConfig.view) {
        case 'months':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'quarters':
          currentDate = addMonths(currentDate, 3);
          break;
        case 'years':
          currentDate = addYears(currentDate, 1);
          break;
        case 'decades':
          currentDate = addYears(currentDate, 5);
          break;
      }
    }
    
    return markers;
  };

  // Calculate goal block position and dimensions
  const calculateGoalBlock = (goal: Goal): GoalBlock | null => {
    const startDate = new Date(goal.startDate);
    const targetDate = new Date(goal.targetDate);
    
    // Check if goal is within timeline bounds
    if (isAfter(startDate, timelineConfig.endDate) || isBefore(targetDate, timelineConfig.startDate)) {
      return null;
    }
    
    const totalMonths = differenceInMonths(timelineConfig.endDate, timelineConfig.startDate);
    const startMonths = Math.max(0, differenceInMonths(startDate, timelineConfig.startDate));
    const endMonths = Math.min(totalMonths, differenceInMonths(targetDate, timelineConfig.startDate));
    
    const x = (startMonths / totalMonths) * timelineWidth * timelineConfig.zoom;
    const width = ((endMonths - startMonths) / totalMonths) * timelineWidth * timelineConfig.zoom;
    
    // Assign row based on priority or manual positioning
    const row = goal.position?.row || (goal.priority === 'essential' ? 0 : goal.priority === 'important' ? 1 : 2);
    const y = row * 80; // 80px per row
    
    return {
      goal,
      x,
      y,
      width: Math.max(width, 100), // Minimum width of 100px
      height: 60,
      isSelected: selectedGoal?.id === goal.id,
      isDragging: false,
      isHovered: hoveredGoal === goal.id,
    };
  };

  const timelineMarkers = generateTimelineMarkers();
  const goalBlocks = goals.map(calculateGoalBlock).filter(Boolean) as GoalBlock[];

  // Handle timeline zoom
  const handleZoom = (delta: number) => {
    setTimelineConfig(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(2, prev.zoom + delta)),
    }));
  };

  // Handle view change
  const handleViewChange = (view: TimelineConfig['view']) => {
    setTimelineConfig(prev => ({ ...prev, view }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-full mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">🎯 My Life Goals Timeline</h1>
              <p className="text-slate-600 mt-2">Visualize and manage your goals like building blocks</p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
            >
              + Add Goal
            </button>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* View Selector */}
            <div className="flex gap-2">
              {(['months', 'quarters', 'years', 'decades'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timelineConfig.view === view
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleZoom(-0.1)}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                🔍−
              </button>
              <span className="text-sm text-gray-600">{Math.round(timelineConfig.zoom * 100)}%</span>
              <button
                onClick={() => handleZoom(0.1)}
                className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                🔍+
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Goals"
            value={goals.length}
            icon="🎯"
            color="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            title="In Progress"
            value={goals.filter(g => g.status === 'in_progress' || g.status === 'on_track').length}
            icon="🚀"
            color="bg-green-50 text-green-700"
          />
          <SummaryCard
            title="Total Target Value"
            value={`$${goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0).toLocaleString()}`}
            icon="💰"
            color="bg-purple-50 text-purple-700"
          />
          <SummaryCard
            title="Avg. Alignment"
            value={`${Math.round(goals.reduce((sum, g) => sum + g.alignmentScore, 0) / goals.length || 0)}%`}
            icon="🧠"
            color="bg-amber-50 text-amber-700"
          />
        </div>

        {/* Timeline Container */}
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <div 
              ref={timelineRef}
              className="relative"
              style={{ 
                width: `${100 * timelineConfig.zoom}%`,
                minWidth: '1200px',
                height: `${timelineConfig.rows * 80 + 100}px`
              }}
            >
              {/* Timeline Header with Markers */}
              <div className="absolute top-0 left-0 right-0 h-12 border-b-2 border-gray-200">
                {timelineMarkers.map((date, idx) => {
                  const x = (idx / (timelineMarkers.length - 1)) * 100;
                  return (
                    <div
                      key={idx}
                      className="absolute top-0 flex flex-col items-center"
                      style={{ left: `${x}%` }}
                    >
                      <div className="w-px h-full bg-gray-300" />
                      <div className="text-xs text-gray-600 mt-1">
                        {timelineConfig.view === 'months' && format(date, 'MMM yy')}
                        {timelineConfig.view === 'quarters' && format(date, 'QQQ yy')}
                        {timelineConfig.view === 'years' && format(date, 'yyyy')}
                        {timelineConfig.view === 'decades' && format(date, 'yyyy')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Goal Blocks */}
              <div className="absolute top-16 left-0 right-0 bottom-0">
                <AnimatePresence>
                  {goalBlocks.map((block) => (
                    <GoalBlockComponent
                      key={block.goal.id}
                      block={block}
                      onSelect={() => setSelectedGoal(block.goal)}
                      onHover={setHoveredGoal}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Row Labels */}
              <div className="absolute left-0 top-16 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10">
                {['Essential', 'Important', 'Nice to Have', 'Custom 1', 'Custom 2'].slice(0, timelineConfig.rows).map((label, idx) => (
                  <div
                    key={idx}
                    className="absolute left-0 text-xs text-gray-500 font-medium"
                    style={{ top: `${idx * 80 + 20}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span className="text-xs text-gray-600">On Track</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded" />
              <span className="text-xs text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded" />
              <span className="text-xs text-gray-600">At Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded" />
              <span className="text-xs text-gray-600">Not Started</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span className="text-xs text-gray-600">Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Detail Panel */}
      <AnimatePresence>
        {selectedGoal && (
          <GoalDetailPanel
            goal={selectedGoal}
            onClose={() => setSelectedGoal(null)}
            onUpdate={onGoalUpdate}
            onDelete={onGoalDelete}
          />
        )}
      </AnimatePresence>

      {/* Create Goal Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateGoalModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(goal) => {
              onGoalCreate(goal);
              setShowCreateModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Individual Goal Block Component
 */
const GoalBlockComponent: React.FC<{
  block: GoalBlock;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}> = ({ block, onSelect, onHover }) => {
  const { goal } = block;
  const progress = calculateGoalProgress(goal);
  const statusColor = getStatusBlockColor(goal.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      className={`absolute cursor-pointer rounded-lg shadow-lg border-2 transition-all ${
        block.isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      style={{
        left: `${block.x}px`,
        top: `${block.y}px`,
        width: `${block.width}px`,
        height: `${block.height}px`,
        backgroundColor: goal.color || '#3B82F6',
        borderColor: block.isHovered ? '#1D4ED8' : 'transparent',
      }}
      onClick={onSelect}
      onMouseEnter={() => onHover(goal.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="p-3 h-full flex flex-col justify-between text-white">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{goal.icon}</span>
            <h4 className="font-semibold text-sm truncate">{goal.title}</h4>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
            {goal.status.replace('_', ' ')}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs opacity-90">{progress}%</span>
            {goal.targetAmount && (
              <span className="text-xs opacity-90">
                ${(goal.currentAmount || 0).toLocaleString()} / ${goal.targetAmount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Summary Card Component
 */
const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  </div>
);

/**
 * Get status block color
 */
function getStatusBlockColor(status: Goal['status']): string {
  switch (status) {
    case 'completed': return 'bg-blue-100 text-blue-800';
    case 'on_track': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'at_risk': return 'bg-red-100 text-red-800';
    case 'deferred': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default MyBlocksTimeline;