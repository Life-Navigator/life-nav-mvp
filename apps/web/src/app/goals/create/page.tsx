'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MyBlocksTimeline } from '@/components/goals/MyBlocksTimeline';
import { Goal } from '@/lib/goals/types';
import { v4 as uuidv4 } from 'uuid';

function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('access_token');
}

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    // Decode JWT token to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.sub || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

export default function MyBlocksGoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userBenefits, setUserBenefits] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }

    const id = getUserId();
    setUserId(id);
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Fetch user's benefit selections
      const benefitsRes = await fetch('/api/discovery/benefits', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (benefitsRes.ok) {
        const benefitsData = await benefitsRes.json();
        setUserBenefits(benefitsData.benefits || {});
      }

      // Fetch existing goals
      const goalsRes = await fetch('/api/goals', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        setGoals(goalsData.goals || []);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoalCreate = async (goalData: Partial<Goal>) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const newGoal: Goal = {
        id: uuidv4(),
        userId: userId || '',
        title: goalData.title || 'New Goal',
        description: goalData.description || '',
        domain: goalData.domain || 'financial',
        category: goalData.category || 'custom',
        startDate: goalData.startDate || new Date(),
        targetDate: goalData.targetDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        targetAmount: goalData.targetAmount,
        currentAmount: goalData.currentAmount || 0,
        monthlyContribution: goalData.monthlyContribution,
        estimatedReturn: goalData.estimatedReturn,
        priority: goalData.priority || 'important',
        status: goalData.status || 'not_started',
        progress: 0,
        prerequisites: goalData.prerequisites || [],
        dependents: goalData.dependents || [],
        primaryBenefits: goalData.primaryBenefits || [],
        alignmentScore: goalData.alignmentScore || 50,
        color: goalData.color || '#3B82F6',
        icon: goalData.icon || '🎯',
        milestones: goalData.milestones || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newGoal),
      });

      if (response.ok) {
        const savedGoal = await response.json();
        setGoals(prev => [...prev, savedGoal.goal || newGoal]);
      }
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const handleGoalUpdate = async (updatedGoal: Goal) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`/api/goals/${updatedGoal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updatedGoal),
      });

      if (response.ok) {
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      }
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const handleGoalDelete = async (goalId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
      }
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your goals...</p>
        </div>
      </div>
    );
  }

  // Check if user has completed benefits discovery
  const hasBenefits = Object.keys(userBenefits).some(domain => userBenefits[domain]?.length > 0);

  if (!hasBenefits) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Complete Benefits Discovery First
          </h2>
          <p className="text-gray-600 mb-6">
            Before creating goals, we need to understand what truly motivates you.
            This helps us create goals that align with your authentic drivers.
          </p>
          <button
            onClick={() => router.push('/discovery/benefits')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Start Benefits Discovery
          </button>
        </div>
      </div>
    );
  }

  return (
    <MyBlocksTimeline
      goals={goals}
      onGoalCreate={handleGoalCreate}
      onGoalUpdate={handleGoalUpdate}
      onGoalDelete={handleGoalDelete}
    />
  );
}