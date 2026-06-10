'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoadmapHeader } from '@/components/roadmap/components/RoadmapHeader';
import { MilestoneTracker } from '@/components/roadmap/components/MilestoneTracker';
import { ProgressOverview } from '@/components/roadmap/components/ProgressOverview';
import { BudgetOverview } from '@/components/roadmap/finance/components/BudgetOverview';
import { GoalProgress } from '@/components/roadmap/finance/components/GoalProgress';
import { InvestmentTracker } from '@/components/roadmap/finance/components/InvestmentTracker';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import { Roadmap, Milestone, MilestoneStatus, MilestoneTimeline } from '@/types/roadmap';
import { getDomainRoadmap, updateMilestoneProgress } from '@/lib/api/roadmap';

export default function FinanceRoadmapPage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'budget' | 'goals' | 'investments'>(
    'timeline'
  );
  const router = useRouter();

  // Load roadmap data
  useEffect(() => {
    const fetchRoadmap = async () => {
      try {
        setLoading(true);
        const data = await getDomainRoadmap('finance');
        setRoadmap(data);
      } catch (err) {
        console.error('Error fetching roadmap:', err);
        setError('Failed to load roadmap data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoadmap();
  }, []);

  // Handlers
  const handleUpdateProgress = async (id: string, progress: number) => {
    if (!roadmap) return;

    try {
      // Update locally first for UI responsiveness
      const updatedMilestones = roadmap.milestones.map((milestone) =>
        milestone.id === id ? { ...milestone, progress } : milestone
      );

      setRoadmap({ ...roadmap, milestones: updatedMilestones });

      // Update on server
      await updateMilestoneProgress(roadmap.id, id, { progress });
    } catch (err) {
      console.error('Error updating milestone progress:', err);
      // Revert to original state on error
      setRoadmap(roadmap);
    }
  };

  const handleUpdateStatus = async (id: string, status: MilestoneStatus) => {
    if (!roadmap) return;

    try {
      // Update locally first for UI responsiveness
      const updatedMilestones = roadmap.milestones.map((milestone) =>
        milestone.id === id ? { ...milestone, status } : milestone
      );

      setRoadmap({ ...roadmap, milestones: updatedMilestones });

      // Update on server
      await updateMilestoneProgress(roadmap.id, id, { status });
    } catch (err) {
      console.error('Error updating milestone status:', err);
      // Revert to original state on error
      setRoadmap(roadmap);
    }
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!roadmap) return;

    try {
      // Update locally first for UI responsiveness
      const updatedMilestones = roadmap.milestones.filter((milestone) => milestone.id !== id);
      setRoadmap({ ...roadmap, milestones: updatedMilestones });

      // Update on server
      // await deleteMilestone(roadmap.id, id);
    } catch (err) {
      console.error('Error deleting milestone:', err);
      // Revert to original state on error
      setRoadmap(roadmap);
    }
  };

  const handleAddMilestone = () => {
    // Navigate to milestone creation page or open modal
    console.log('Add milestone clicked');
  };

  // Compute milestone timeline for display
  const getMilestoneTimeline = (): MilestoneTimeline[] => {
    if (!roadmap) return [];

    const now = new Date();

    // Group milestones by timeframe (past, present, future)
    const past: Milestone[] = [];
    const present: Milestone[] = [];
    const future: Milestone[] = [];

    roadmap.milestones.forEach((milestone) => {
      const targetDate = new Date(milestone.targetDate);
      const startDate = new Date(milestone.startDate);

      if (targetDate < now && milestone.status !== 'in_progress') {
        past.push(milestone);
      } else if (startDate <= now && targetDate >= now) {
        present.push(milestone);
      } else {
        future.push(milestone);
      }
    });

    return [
      {
        timeframe: 'past',
        milestones: past.sort(
          (a, b) => new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime()
        ),
      },
      {
        timeframe: 'present',
        milestones: present.sort(
          (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
        ),
      },
      {
        timeframe: 'future',
        milestones: future.sort(
          (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
        ),
      },
    ];
  };

  // Calculate progress stats
  const calculateStats = () => {
    if (!roadmap) {
      return {
        totalMilestones: 0,
        milestoneCounts: [],
        averageCompletion: 0,
        upcomingMilestones: 0,
        timeRemainingPercent: 0,
        timeRemainingText: 'N/A',
      };
    }

    const totalMilestones = roadmap.milestones.length;

    // Count milestones by status
    const statusCounts: Record<MilestoneStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      delayed: 0,
    };

    roadmap.milestones.forEach((milestone) => {
      statusCounts[milestone.status]++;
    });

    const milestoneCounts = Object.entries(statusCounts).map(([status, count]) => ({
      status: status as MilestoneStatus,
      count,
    }));

    // Calculate average completion
    const totalProgress = roadmap.milestones.reduce(
      (sum, milestone) => sum + milestone.progress,
      0
    );
    const averageCompletion = totalMilestones > 0 ? Math.round(totalProgress / totalMilestones) : 0;

    // Count upcoming milestones (due in the next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const upcomingMilestones = roadmap.milestones.filter((milestone) => {
      const targetDate = new Date(milestone.targetDate);
      return (
        targetDate >= now && targetDate <= thirtyDaysFromNow && milestone.status !== 'completed'
      );
    }).length;

    // Calculate time remaining
    const startDate = new Date(roadmap.startDate);
    const targetDate = new Date(roadmap.targetDate);
    const totalDuration = targetDate.getTime() - startDate.getTime();
    const remainingDuration = targetDate.getTime() - now.getTime();

    let timeRemainingPercent = 0;
    let timeRemainingText = 'N/A';

    if (remainingDuration > 0) {
      timeRemainingPercent = Math.round((remainingDuration / totalDuration) * 100);

      const remainingDays = Math.ceil(remainingDuration / (1000 * 60 * 60 * 24));
      if (remainingDays > 30) {
        const remainingMonths = Math.round(remainingDays / 30);
        timeRemainingText = `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
      } else {
        timeRemainingText = `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
      }
    }

    return {
      totalMilestones,
      milestoneCounts,
      averageCompletion,
      upcomingMilestones,
      timeRemainingPercent,
      timeRemainingText,
    };
  };

  // Handle loading and error states
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="p-6 text-center text-red-500">
          <p>{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Handle no roadmap
  if (!roadmap) {
    return (
      <div className="p-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">No Financial Roadmap Yet</h2>
          <p className="text-gray-600 mb-6">
            Create a financial roadmap to track your money goals and build wealth over time.
          </p>
          <Button onClick={() => router.push('/dashboard/roadmap/generate?type=finance')}>
            Create Financial Roadmap
          </Button>
        </Card>
      </div>
    );
  }

  const {
    totalMilestones,
    milestoneCounts,
    averageCompletion,
    upcomingMilestones,
    timeRemainingPercent,
    timeRemainingText,
  } = calculateStats();

  const completedMilestones = roadmap.milestones.filter((m) => m.status === 'completed').length;

  return (
    <div className="space-y-6 p-4">
      <RoadmapHeader
        title={roadmap.title}
        description={roadmap.description}
        type={roadmap.type}
        progress={averageCompletion}
        startDate={roadmap.startDate}
        targetDate={roadmap.targetDate}
        completedMilestones={completedMilestones}
        totalMilestones={totalMilestones}
        onCreateMilestone={handleAddMilestone}
      />

      <ProgressOverview
        totalMilestones={totalMilestones}
        milestoneCounts={milestoneCounts}
        averageCompletion={averageCompletion}
        upcomingMilestones={upcomingMilestones}
        timeRemainingPercent={timeRemainingPercent}
        timeRemainingText={timeRemainingText}
      />

      <div className="mb-6">
        <div className="border-b flex overflow-x-auto">
          <Button
            onClick={() => setActiveTab('timeline')}
            variant={activeTab === 'timeline' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'timeline' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Timeline
          </Button>
          <Button
            onClick={() => setActiveTab('budget')}
            variant={activeTab === 'budget' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'budget' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Budget Planning
          </Button>
          <Button
            onClick={() => setActiveTab('goals')}
            variant={activeTab === 'goals' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'goals' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Goal Progress
          </Button>
          <Button
            onClick={() => setActiveTab('investments')}
            variant={activeTab === 'investments' ? 'default' : 'ghost'}
            className={`py-2 px-4 rounded-t-md ${
              activeTab === 'investments' ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            Investments
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'timeline' && (
          <MilestoneTracker
            milestones={roadmap.milestones}
            onUpdateProgress={handleUpdateProgress}
            onUpdateStatus={handleUpdateStatus}
            onEdit={handleEditMilestone}
            onDelete={handleDeleteMilestone}
          />
        )}

        {activeTab === 'budget' && <BudgetOverview />}

        {activeTab === 'goals' && <GoalProgress />}

        {activeTab === 'investments' && <InvestmentTracker />}
      </div>
    </div>
  );
}
