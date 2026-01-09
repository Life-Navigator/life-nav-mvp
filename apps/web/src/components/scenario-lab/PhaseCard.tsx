'use client';

/**
 * Phase Card Component
 * Displays a phase with its tasks in an accordion
 */

import { useState } from 'react';
import TaskItem from './TaskItem';

interface Phase {
  id: string;
  phase_number: number;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

interface Task {
  id: string;
  phase_number: number;
  task_number: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  notes: string | null;
  confidence: number | null;
  rationale: string | null;
}

interface PhaseCardProps {
  phase: Phase;
  tasks: Task[];
  planId: string;
  onTaskUpdate: (taskId: string, updates: any) => void;
}

export default function PhaseCard({ phase, tasks, planId, onTaskUpdate }: PhaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Phase Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1">
          {/* Phase Number */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
            {phase.phase_number}
          </div>

          {/* Phase Info */}
          <div className="flex-1 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {phase.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {phase.description}
            </p>
            {phase.start_date && phase.end_date && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {formatDate(phase.start_date)} → {formatDate(phase.end_date)}
              </p>
            )}
          </div>

          {/* Progress */}
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {completedTasks}/{tasks.length} tasks
            </div>
            <div className="mt-1 w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Expand Icon */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Tasks List */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {tasks.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-500">
              No tasks in this phase
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  planId={planId}
                  onUpdate={onTaskUpdate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
