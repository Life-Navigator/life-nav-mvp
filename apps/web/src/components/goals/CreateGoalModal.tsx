'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { addMonths, addYears } from 'date-fns';
import {
  Goal,
  GoalCategory,
  GoalPriority,
  GOAL_TEMPLATES,
} from '@/lib/goals/types';
import { Domain, getBenefitsByDomain } from '@/lib/benefits/benefit-tags';

interface CreateGoalModalProps {
  onClose: () => void;
  onCreate: (goal: Partial<Goal>) => void;
  userBenefits?: Record<Domain, string[]>; // User's selected benefits from discovery
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  onClose,
  onCreate,
  userBenefits,
}) => {
  const [step, setStep] = useState(1); // 1: Template, 2: Details, 3: Timeline, 4: Financial
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<Goal> | null>(null);
  
  const [goalData, setGoalData] = useState<Partial<Goal>>({
    title: '',
    description: '',
    domain: 'financial',
    category: 'custom',
    priority: 'important',
    startDate: new Date(),
    targetDate: addYears(new Date(), 1),
    targetAmount: undefined,
    currentAmount: 0,
    monthlyContribution: undefined,
    estimatedReturn: 7, // Default 7% annual return
    status: 'not_started',
    progress: 0,
    primaryBenefits: [],
    alignmentScore: 0,
    icon: '🎯',
    color: '#3B82F6',
    milestones: [],
    prerequisites: [],
    dependents: [],
  });

  // Auto-select benefits based on domain
  useEffect(() => {
    if (userBenefits && goalData.domain) {
      const domainBenefits = userBenefits[goalData.domain] || [];
      setGoalData(prev => ({
        ...prev,
        primaryBenefits: domainBenefits.slice(0, 3), // Top 3 benefits
        alignmentScore: domainBenefits.length > 0 ? 85 : 50, // High score if aligned
      }));
    }
  }, [goalData.domain, userBenefits]);

  const handleTemplateSelect = (template: Partial<Goal>) => {
    setSelectedTemplate(template);
    setGoalData(prev => ({
      ...prev,
      ...template,
    }));
    setStep(2);
  };

  const handleCreate = () => {
    onCreate(goalData);
    onClose();
  };

  const calculateMonthlyNeeded = () => {
    if (!goalData.targetAmount || !goalData.currentAmount) return 0;
    
    const months = Math.max(1, Math.floor(
      (new Date(goalData.targetDate || new Date()).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    ));
    
    const remaining = goalData.targetAmount - goalData.currentAmount;
    const rate = (goalData.estimatedReturn || 0) / 100 / 12;
    
    if (rate === 0) return remaining / months;
    
    const factor = Math.pow(1 + rate, months) - 1;
    return remaining / (factor / rate);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Create New Goal</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-4">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`flex items-center gap-2 ${s <= step ? 'text-blue-600' : 'text-gray-400'}`}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200'}
                `}>
                  {s}
                </div>
                <span className="text-sm font-medium">
                  {s === 1 ? 'Template' : s === 2 ? 'Details' : s === 3 ? 'Timeline' : 'Financial'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Choose Template */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Choose a Goal Template</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {GOAL_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{template.icon}</span>
                      <h4 className="font-semibold">{template.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{template.description}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {template.domain}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {template.category}
                      </span>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setStep(2);
                  }}
                  className="p-4 border-2 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="text-center">
                    <span className="text-3xl mb-2 block">➕</span>
                    <h4 className="font-semibold">Custom Goal</h4>
                    <p className="text-sm text-gray-600 mt-1">Start from scratch</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Goal Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Goal Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={goalData.title}
                  onChange={(e) => setGoalData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Emergency Fund, Dream Home, Early Retirement"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={goalData.description}
                  onChange={(e) => setGoalData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What is this goal about? Why is it important to you?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain
                  </label>
                  <select
                    value={goalData.domain}
                    onChange={(e) => setGoalData(prev => ({ ...prev, domain: e.target.value as Domain }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="financial">Financial</option>
                    <option value="career">Career</option>
                    <option value="health">Health</option>
                    <option value="education">Education</option>
                    <option value="lifestyle">Lifestyle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={goalData.priority}
                    onChange={(e) => setGoalData(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="essential">🔴 Essential</option>
                    <option value="important">🟡 Important</option>
                    <option value="nice_to_have">🟢 Nice to Have</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon
                  </label>
                  <div className="flex gap-2">
                    {['🎯', '💰', '🏠', '🎓', '💼', '🏥', '✈️', '🚗', '💍', '👶'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setGoalData(prev => ({ ...prev, icon: emoji }))}
                        className={`w-10 h-10 rounded-lg border-2 ${
                          goalData.icon === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                      <button
                        key={color}
                        onClick={() => setGoalData(prev => ({ ...prev, color }))}
                        className={`w-10 h-10 rounded-lg border-2 ${
                          goalData.color === color ? 'border-gray-800' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!goalData.title}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Next: Timeline
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Timeline */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Timeline</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={goalData.startDate?.toISOString().split('T')[0]}
                    onChange={(e) => setGoalData(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={goalData.targetDate?.toISOString().split('T')[0]}
                    onChange={(e) => setGoalData(prev => ({ ...prev, targetDate: new Date(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quick Set Timeline
                </label>
                <div className="flex gap-2">
                  {[
                    { label: '3 months', months: 3 },
                    { label: '6 months', months: 6 },
                    { label: '1 year', months: 12 },
                    { label: '3 years', months: 36 },
                    { label: '5 years', months: 60 },
                    { label: '10 years', months: 120 },
                  ].map(option => (
                    <button
                      key={option.label}
                      onClick={() => {
                        const targetDate = addMonths(new Date(), option.months);
                        setGoalData(prev => ({ ...prev, targetDate }));
                      }}
                      className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: Financial Details
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Financial Details */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Financial Details (Optional)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    value={goalData.targetAmount || ''}
                    onChange={(e) => setGoalData(prev => ({ 
                      ...prev, 
                      targetAmount: e.target.value ? parseFloat(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="$0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Amount
                  </label>
                  <input
                    type="number"
                    value={goalData.currentAmount || ''}
                    onChange={(e) => setGoalData(prev => ({ 
                      ...prev, 
                      currentAmount: e.target.value ? parseFloat(e.target.value) : 0 
                    }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="$0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Contribution
                  </label>
                  <input
                    type="number"
                    value={goalData.monthlyContribution || ''}
                    onChange={(e) => setGoalData(prev => ({ 
                      ...prev, 
                      monthlyContribution: e.target.value ? parseFloat(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="$0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Return (Annual %)
                  </label>
                  <input
                    type="number"
                    value={goalData.estimatedReturn || ''}
                    onChange={(e) => setGoalData(prev => ({ 
                      ...prev, 
                      estimatedReturn: e.target.value ? parseFloat(e.target.value) : 0 
                    }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="7%"
                    min="0"
                    max="30"
                    step="0.1"
                  />
                </div>
              </div>

              {goalData.targetAmount && goalData.currentAmount !== undefined && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Calculation</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p>Amount needed: ${((goalData.targetAmount || 0) - (goalData.currentAmount || 0)).toLocaleString()}</p>
                    <p>Recommended monthly: ${Math.round(calculateMonthlyNeeded()).toLocaleString()}</p>
                    <p className="text-xs text-blue-600 mt-2">
                      * Based on {goalData.estimatedReturn}% annual return
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create Goal
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateGoalModal;