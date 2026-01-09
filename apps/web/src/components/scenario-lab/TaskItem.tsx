'use client';

/**
 * Task Item Component
 * Individual task with inline editing
 */

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  estimated_hours: number | null;
  notes: string | null;
  confidence: number | null;
  rationale: string | null;
}

interface TaskItemProps {
  task: Task;
  planId: string;
  onUpdate: (taskId: string, updates: any) => void;
}

export default function TaskItem({ task, planId, onUpdate }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');

  const handleStatusChange = (newStatus: Task['status']) => {
    onUpdate(task.id, { status: newStatus });
  };

  const handleSaveNotes = () => {
    onUpdate(task.id, { notes });
    setEditingNotes(false);
  };

  const statusColors = {
    todo: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  const priorityColors = {
    P0: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    P1: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    P2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  const categoryColors = {
    education: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    career: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    finance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    health: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    ops: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        {/* Status Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <button
            onClick={() => {
              const nextStatus = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done';
              handleStatusChange(nextStatus);
            }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              task.status === 'done'
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
            }`}
          >
            {task.status === 'done' && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {/* Title & Badges */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <h4
                  className={`text-sm font-medium ${
                    task.status === 'done'
                      ? 'text-gray-500 dark:text-gray-500 line-through'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {task.title}
                </h4>
              </button>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    statusColors[task.status]
                  }`}
                >
                  {task.status.replace('_', ' ')}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    priorityColors[task.priority as keyof typeof priorityColors] || 'bg-gray-100'
                  }`}
                >
                  {task.priority}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    categoryColors[task.category as keyof typeof categoryColors] || 'bg-gray-100'
                  }`}
                >
                  {task.category}
                </span>
                {task.estimated_hours && (
                  <span className="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                    ~{task.estimated_hours}h
                  </span>
                )}
              </div>
            </div>

            {/* Due Date */}
            {task.due_date && (
              <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-500">
                Due {new Date(task.due_date).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 space-y-3">
              {/* Description */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {task.description}
              </div>

              {/* Rationale */}
              {task.rationale && (
                <div className="text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                  <span className="font-medium text-blue-900 dark:text-blue-200">Why: </span>
                  <span className="text-blue-800 dark:text-blue-300">{task.rationale}</span>
                  {task.confidence !== null && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                      (confidence: {(task.confidence * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </label>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {task.notes ? 'Edit' : 'Add note'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={3}
                      placeholder="Add notes about progress, blockers, or learnings..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotes}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setNotes(task.notes || '');
                          setEditingNotes(false);
                        }}
                        className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : task.notes ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded p-3">
                    {task.notes}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-600 italic">
                    No notes yet
                  </div>
                )}
              </div>

              {/* Status Dropdown */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Status
                </label>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
