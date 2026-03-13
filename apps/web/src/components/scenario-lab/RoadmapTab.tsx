'use client';

/**
 * Roadmap Tab Component
 * Shows generated roadmap with phases and tasks
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import PhaseCard from './PhaseCard';
import SupersedeModal from './SupersedeModal';

interface Phase {
  id: string;
  phase_number: number;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
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

interface RoadmapTabProps {
  scenarioId: string;
  versionId: string | null;
  scenarioStatus: string;
}

export default function RoadmapTab({ scenarioId, versionId, scenarioStatus }: RoadmapTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showSupersedeModal, setShowSupersedeModal] = useState(false);
  const [committedVersionId, setCommittedVersionId] = useState<string | null>(null);
  const [supersededVersions, setSupersededVersions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (versionId) {
      fetchPlan();
    } else {
      setLoading(false);
    }
  }, [versionId]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/versions/${versionId}/plan`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setHasPlan(data.has_plan);
        if (data.has_plan) {
          setPlan(data.plan);
          setPhases(data.phases || []);
          setTasks(data.tasks || []);
        }
      }

      // Fetch scenario to check for committed version
      const scenarioResponse = await fetch(`/api/scenario-lab/scenarios/${scenarioId}`, {
        headers,
      });

      if (scenarioResponse.ok) {
        const scenarioData = await scenarioResponse.json();
        setCommittedVersionId(scenarioData.scenario?.committed_version_id || null);
      }

      // Fetch superseded versions for history
      const versionsResponse = await fetch(`/api/scenario-lab/scenarios/${scenarioId}/versions`, {
        headers,
      });

      if (versionsResponse.ok) {
        const versionsData = await versionsResponse.json();
        const superseded = versionsData.versions?.filter((v: any) => v.status === 'superseded') || [];
        setSupersededVersions(superseded);
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async (supersede = false) => {
    if (!versionId) return;

    // If scenario already committed to different version, show supersede modal
    if (committedVersionId && committedVersionId !== versionId && !supersede) {
      setShowSupersedeModal(true);
      return;
    }

    // Simple confirmation for first-time commit
    if (!committedVersionId && !supersede) {
      const confirmMessage = 'Committing will lock this scenario version and generate a roadmap. This action cannot be undone. Continue?';
      if (!confirm(confirmMessage)) return;
    }

    try {
      setCommitting(true);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/scenarios/${scenarioId}/commit`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ versionId, supersede }),
      });

      if (response.ok) {
        const data = await response.json();
        const message = supersede
          ? `Roadmap superseded! Generated ${data.phaseCount} phases and ${data.taskCount} tasks.`
          : `Scenario committed! Generated ${data.phaseCount} phases and ${data.taskCount} tasks.`;
        alert(message);
        setShowSupersedeModal(false);
        fetchPlan(); // Reload plan
        router.refresh(); // Refresh page data
      } else if (response.status === 409) {
        const errorData = await response.json();
        // Show supersede modal
        setShowSupersedeModal(true);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to commit scenario');
      }
    } catch (error) {
      console.error('Error committing scenario:', error);
      alert('Failed to commit scenario');
    } finally {
      setCommitting(false);
    }
  };

  const handleFork = () => {
    // Navigate to fork creation
    router.push(`/dashboard/scenario-lab/${scenarioId}/fork`);
  };

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(
        `/api/scenario-lab/plans/${plan.id}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );

      if (response.ok) {
        fetchPlan(); // Reload plan
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  if (!versionId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p className="text-yellow-800 dark:text-yellow-200">
          No version available. Please create a version first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Roadmap Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Commit this scenario to generate a personalized roadmap with phases and tasks.
          </p>

          <button
            onClick={() => handleCommit()}
            disabled={committing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {committing ? 'Committing...' : 'Commit Scenario & Generate Roadmap'}
          </button>

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            ℹ️ Committing locks this version as the chosen path. You can fork to create alternatives.
          </p>
        </div>
      </div>
    );
  }

  // Group tasks by phase
  const tasksByPhase = phases.map(phase => ({
    phase,
    tasks: tasks.filter(t => t.phase_number === phase.phase_number),
  }));

  return (
    <div className="space-y-6">
      {/* Supersede Modal */}
      <SupersedeModal
        isOpen={showSupersedeModal}
        onClose={() => setShowSupersedeModal(false)}
        onConfirm={() => handleCommit(true)}
        onFork={handleFork}
        committedVersionName={plan?.name}
      />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {plan.name}
              </h2>
              {scenarioStatus === 'committed' && (
                <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                  Committed
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {plan.description}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-500">
              {phases.length} phases • {tasks.length} tasks
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Created {new Date(plan.created_at).toLocaleDateString()}
            </div>
            {supersededVersions.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showHistory ? 'Hide' : 'Show'} History ({supersededVersions.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Section */}
      {showHistory && supersededVersions.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4">
            📜 Superseded Roadmaps
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
            These are previous committed versions that have been superseded. They are preserved for your reference.
          </p>
          <div className="space-y-2">
            {supersededVersions.map((version: any) => (
              <div
                key={version.id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {version.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    Version {version.version_number} • Superseded on{' '}
                    {new Date(version.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/scenario-lab/${scenarioId}?version=${version.id}`)}
                  className="px-3 py-1.5 text-sm text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                >
                  View Read-Only
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-4">
        {tasksByPhase.map(({ phase, tasks: phaseTasks }) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            tasks={phaseTasks}
            planId={plan.id}
            onTaskUpdate={handleTaskUpdate}
          />
        ))}
      </div>

      {/* Info footer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          💡 <strong>Note:</strong> This roadmap was generated from your committed scenario. To change
          inputs or decisions, fork this scenario to create a new version.
        </p>
      </div>
    </div>
  );
}
