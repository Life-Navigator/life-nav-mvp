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
import { 
  Roadmap, 
  Milestone, 
  MilestoneStatus, 
  MilestoneTimeline 
} from '@/types/roadmap';
import { getDomainRoadmap, updateMilestoneProgress } from '@/lib/api/roadmap';

export default function FinanceRoadmapPage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'budget' | 'goals' | 'investments'>('timeline');
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
      const updatedMilestones = roadmap.milestones.map(milestone => 
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
      const updatedMilestones = roadmap.milestones.map(milestone => 
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
      const updatedMilestones = roadmap.milestones.filter(milestone => milestone.id !== id);
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
    
    roadmap.milestones.forEach(milestone => {
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
      { timeframe: 'past', milestones: past.sort((a, b) => new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime()) },
      { timeframe: 'present', milestones: present.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()) },
      { timeframe: 'future', milestones: future.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()) }
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
        timeRemainingText: 'N/A'
      };
    }
    
    const totalMilestones = roadmap.milestones.length;
    
    // Count milestones by status
    const statusCounts: Record<MilestoneStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      delayed: 0
    };
    
    roadmap.milestones.forEach(milestone => {
      statusCounts[milestone.status]++;
    });
    
    const milestoneCounts = Object.entries(statusCounts).map(([status, count]) => ({
      status: status as MilestoneStatus,
      count
    }));
    
    // Calculate average completion
    const totalProgress = roadmap.milestones.reduce((sum, milestone) => sum + milestone.progress, 0);
    const averageCompletion = totalMilestones > 0 ? Math.round(totalProgress / totalMilestones) : 0;
    
    // Count upcoming milestones (due in the next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    const upcomingMilestones = roadmap.milestones.filter(milestone => {
      const targetDate = new Date(milestone.targetDate);
      return targetDate >= now && targetDate <= thirtyDaysFromNow && milestone.status !== 'completed';
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
      timeRemainingText
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
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
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

  // For demo purposes
  const mockRoadmap: Roadmap = {
    id: 'finance-1',
    userId: 'user-1',
    title: 'Financial Freedom Plan',
    description: 'A comprehensive plan to achieve financial independence within 5 years.',
    type: 'finance',
    startDate: '2025-01-01',
    targetDate: '2030-01-01',
    milestones: [
      {
        id: 'milestone-1',
        roadmapId: 'finance-1',
        title: 'Build Emergency Fund',
        description: 'Save 6 months of living expenses in a high-yield savings account.',
        domain: 'finance',
        startDate: '2025-01-01',
        targetDate: '2025-06-30',
        status: 'in_progress',
        progress: 50,
        priority: 'high',
        notes: 'Need to increase monthly saving rate to meet the target date.',
        createdAt: '2025-01-01',
        updatedAt: '2025-03-15',
      },
      {
        id: 'milestone-2',
        roadmapId: 'finance-1',
        title: 'Max Out 401(k) Contributions',
        description: 'Increase 401(k) contributions to reach the annual maximum.',
        domain: 'finance',
        startDate: '2025-01-01',
        targetDate: '2025-12-31',
        status: 'pending',
        progress: 20,
        priority: 'medium',
        notes: 'Need to adjust budget to accommodate increased retirement savings.',
        createdAt: '2025-01-01',
        updatedAt: '2025-02-10',
      },
      {
        id: 'milestone-3',
        roadmapId: 'finance-1',
        title: 'Pay Off Student Loans',
        description: 'Completely pay off all student loan debt.',
        domain: 'finance',
        startDate: '2025-03-01',
        targetDate: '2025-09-30',
        status: 'completed',
        progress: 100,
        priority: 'high',
        notes: 'Used tax refund and bonus to accelerate payoff.',
        createdAt: '2025-01-01',
        updatedAt: '2025-04-15',
      },
      {
        id: 'milestone-4',
        roadmapId: 'finance-1',
        title: 'Establish Investment Portfolio',
        description: 'Create a diversified investment portfolio with stocks, bonds, and index funds.',
        domain: 'finance',
        startDate: '2025-07-01',
        targetDate: '2025-12-31',
        status: 'pending',
        progress: 0,
        priority: 'medium',
        resources: [
          {
            id: 'resource-1',
            title: "Beginner's Guide to Investing",
            url: 'https://www.investopedia.com/articles/basics/06/invest1000.asp',
            type: 'article'
          },
          {
            id: 'resource-2',
            title: 'The Intelligent Investor',
            description: 'Book by Benjamin Graham',
            type: 'book'
          }
        ],
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: 'milestone-5',
        roadmapId: 'finance-1',
        title: 'Open a 529 College Savings Plan',
        description: "Set up a 529 plan for children's future education expenses.",
        domain: 'finance',
        startDate: '2025-10-01',
        targetDate: '2025-11-30',
        status: 'pending',
        progress: 0,
        priority: 'low',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: 'milestone-6',
        roadmapId: 'finance-1',
        title: 'Create Estate Plan',
        description: 'Prepare will, power of attorney, and other estate planning documents.',
        domain: 'finance',
        startDate: '2026-01-01',
        targetDate: '2026-03-31',
        status: 'pending',
        progress: 0,
        priority: 'medium',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: 'milestone-7',
        roadmapId: 'finance-1',
        title: 'Purchase Investment Property',
        description: 'Buy a rental property as an additional income stream.',
        domain: 'finance',
        startDate: '2026-06-01',
        targetDate: '2026-12-31',
        status: 'pending',
        progress: 0,
        priority: 'medium',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      },
      {
        id: 'milestone-8',
        roadmapId: 'finance-1',
        title: 'Reach $100K Net Worth',
        description: 'Milestone achievement for combined assets minus liabilities.',
        domain: 'finance',
        startDate: '2025-01-01',
        targetDate: '2027-12-31',
        status: 'pending',
        progress: 35,
        priority: 'high',
        createdAt: '2025-01-01',
        updatedAt: '2025-03-15',
      }
    ],
    createdAt: '2025-01-01',
    updatedAt: '2025-03-15',
  };

  const { 
    totalMilestones,
    milestoneCounts,
    averageCompletion,
    upcomingMilestones,
    timeRemainingPercent,
    timeRemainingText
  } = calculateStats();

  const completedMilestones = roadmap.milestones.filter(m => m.status === 'completed').length;
  
  return (
    <div className="space-y-6 p-4">
      <RoadmapHeader
        title={mockRoadmap.title}
        description={mockRoadmap.description}
        type={mockRoadmap.type}
        progress={averageCompletion}
        startDate={mockRoadmap.startDate}
        targetDate={mockRoadmap.targetDate}
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
            milestones={mockRoadmap.milestones}
            onUpdateProgress={handleUpdateProgress}
            onUpdateStatus={handleUpdateStatus}
            onEdit={handleEditMilestone}
            onDelete={handleDeleteMilestone}
          />
        )}
        
        {activeTab === 'budget' && (
          <BudgetOverview />
        )}
        
        {activeTab === 'goals' && (
          <GoalProgress />
        )}
        
        {activeTab === 'investments' && (
          <InvestmentTracker />
        )}
      </div>
    </div>
  );
}