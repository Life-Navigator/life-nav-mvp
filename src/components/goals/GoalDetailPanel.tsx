'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Goal,
  Milestone,
  calculateGoalProgress,
  calculateMonthlyContribution,
  getGoalStatusColor,
  getGoalPriorityBadge,
} from '@/lib/goals/types';
import { getBenefitById } from '@/lib/benefits/benefit-tags';

interface GoalDetailPanelProps {
  goal: Goal;
  onClose: () => void;
  onUpdate: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

export const GoalDetailPanel: React.FC<GoalDetailPanelProps> = ({
  goal,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedGoal, setEditedGoal] = useState(goal);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const progress = calculateGoalProgress(goal);
  const monthsRemaining = Math.max(0, 
    Math.floor((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
  );
  
  const recommendedMonthly = goal.targetAmount && goal.currentAmount
    ? calculateMonthlyContribution(
        goal.targetAmount,
        goal.currentAmount,
        monthsRemaining,
        goal.estimatedReturn || 0
      )
    : 0;

  const handleSave = () => {
    onUpdate(editedGoal);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(goal.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{goal.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{goal.title}</h2>
              <span className={`text-sm ${getGoalPriorityBadge(goal.priority)}`}>
                {getGoalPriorityBadge(goal.priority)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Status & Progress */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">Status</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${getGoalStatusColor(goal.status)}`}>
              {goal.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {goal.targetAmount && (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Target Amount</span>
                <span className="font-semibold">${goal.targetAmount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Current Amount</span>
                <span className="font-semibold">${(goal.currentAmount || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Monthly Contribution</span>
                <span className="font-semibold">${(goal.monthlyContribution || 0).toLocaleString()}</span>
              </div>
              
              {recommendedMonthly > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 Recommended monthly: <strong>${Math.round(recommendedMonthly).toLocaleString()}</strong>
                    {goal.estimatedReturn && ` (assuming ${goal.estimatedReturn}% annual return)`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Start Date</span>
              <span>{format(new Date(goal.startDate), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Target Date</span>
              <span>{format(new Date(goal.targetDate), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time Remaining</span>
              <span className="font-medium">
                {monthsRemaining > 0 ? `${monthsRemaining} months` : 'Past due'}
              </span>
            </div>
          </div>
        </div>

        {/* Psychological Alignment */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3 text-blue-900">🧠 Psychological Alignment</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Alignment Score</span>
              <span className="font-bold text-blue-900">{goal.alignmentScore}%</span>
            </div>
            
            {goal.primaryBenefits.length > 0 && (
              <div>
                <span className="text-sm text-blue-700 block mb-2">Primary Motivations</span>
                <div className="flex flex-wrap gap-2">
                  {goal.primaryBenefits.map(benefitId => {
                    const benefit = getBenefitById(benefitId);
                    return benefit ? (
                      <span
                        key={benefitId}
                        className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs"
                      >
                        {benefit.emoji} {benefit.title}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            {goal.motivationNotes && (
              <div className="mt-3 p-3 bg-white rounded">
                <p className="text-sm text-gray-700 italic">"{goal.motivationNotes}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Milestones */}
        {goal.milestones.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">🏁 Milestones</h3>
            <div className="space-y-2">
              {goal.milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  onToggle={() => {
                    const updatedMilestones = goal.milestones.map(m =>
                      m.id === milestone.id ? { ...m, completed: !m.completed } : m
                    );
                    onUpdate({ ...goal, milestones: updatedMilestones });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {(goal.prerequisites.length > 0 || goal.dependents.length > 0) && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">🔗 Dependencies</h3>
            
            {goal.prerequisites.length > 0 && (
              <div className="mb-3">
                <span className="text-sm text-gray-600 block mb-1">Prerequisites</span>
                <div className="space-y-1">
                  {goal.prerequisites.map(id => (
                    <div key={id} className="text-sm bg-yellow-50 px-2 py-1 rounded">
                      ⬅️ Must complete: Goal #{id}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {goal.dependents.length > 0 && (
              <div>
                <span className="text-sm text-gray-600 block mb-1">Dependent Goals</span>
                <div className="space-y-1">
                  {goal.dependents.map(id => (
                    <div key={id} className="text-sm bg-green-50 px-2 py-1 rounded">
                      ➡️ Enables: Goal #{id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Insights */}
        {(goal.aiRecommendations || goal.riskFactors) && (
          <div className="bg-purple-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3 text-purple-900">🤖 AI Insights</h3>
            
            {goal.aiRecommendations && goal.aiRecommendations.length > 0 && (
              <div className="mb-3">
                <span className="text-sm text-purple-700 font-medium block mb-2">Recommendations</span>
                <ul className="space-y-1 text-sm text-purple-800">
                  {goal.aiRecommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {goal.riskFactors && goal.riskFactors.length > 0 && (
              <div>
                <span className="text-sm text-purple-700 font-medium block mb-2">Risk Factors</span>
                <ul className="space-y-1 text-sm text-red-700">
                  {goal.riskFactors.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>⚠️</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Goal'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            Delete
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800 mb-3">
              Are you sure you want to delete this goal? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Milestone Item Component
 */
const MilestoneItem: React.FC<{
  milestone: Milestone;
  onToggle: () => void;
}> = ({ milestone, onToggle }) => (
  <div
    className={`
      flex items-center gap-3 p-3 rounded-lg border cursor-pointer
      ${milestone.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}
    `}
    onClick={onToggle}
  >
    <div className={`
      w-4 h-4 rounded-full border-2 flex items-center justify-center
      ${milestone.completed ? 'bg-green-600 border-green-600' : 'border-gray-300'}
    `}>
      {milestone.completed && <span className="text-white text-xs">✓</span>}
    </div>
    <div className="flex-1">
      <div className="font-medium text-sm">{milestone.title}</div>
      <div className="text-xs text-gray-500">
        {format(new Date(milestone.targetDate), 'MMM yyyy')}
        {milestone.targetAmount && ` • $${milestone.targetAmount.toLocaleString()}`}
      </div>
    </div>
  </div>
);

export default GoalDetailPanel;