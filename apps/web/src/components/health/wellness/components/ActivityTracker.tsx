'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import Link from 'next/link';

interface ActivityData {
  today: {
    steps: number;
    stepGoal: number;
    activeMinutes: number;
    activeMinutesGoal: number;
    distance: number;
    caloriesBurned: number;
    floors: number;
  };
  weeklySteps: number[];
  weeklyActiveMinutes: number[];
  weeklyDistance: number[];
  weeklyCalories: number[];
  weeklyFloors: number[];
}

interface ActivityGoals {
  dailyStepGoal: number;
  weeklyStepGoal: number;
  dailyActiveMinutesGoal: number;
  weeklyActiveMinutesGoal: number;
}

export default function ActivityTracker() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [goals, setGoals] = useState<ActivityGoals>({
    dailyStepGoal: 10000,
    weeklyStepGoal: 70000,
    dailyActiveMinutesGoal: 60,
    weeklyActiveMinutesGoal: 420
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        // TODO: Implement API endpoint for fetching activity data
        // const response = await fetch('/api/wellness/activity');
        // const activityData = await response.json();
        // setData(activityData);

        // For now, set null - will be populated when users connect fitness devices
        setData(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching activity data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchActivityData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Tracker</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading activity data...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Tracker</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Activity Data Connected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your fitness tracker or smartwatch to automatically track your steps, activity, and calories.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/integrations">
              <Button variant="default">Connect Device</Button>
            </Link>
            <Button variant="outline">Enter Manually</Button>
          </div>
        </div>
      </Card>
    );
  }
  
  // Calculate weekly totals
  const weeklyStepsTotal = data?.weeklySteps.reduce((sum, steps) => sum + steps, 0) || 0;
  const weeklyActiveMinutesTotal = data?.weeklyActiveMinutes.reduce((sum, minutes) => sum + minutes, 0) || 0;

  // Calculate percentages for progress bars
  const stepsPercentage = Math.min(100, ((data?.today.steps || 0) / goals.dailyStepGoal) * 100);
  const weeklyStepsPercentage = Math.min(100, (weeklyStepsTotal / goals.weeklyStepGoal) * 100);
  const activeMinutesPercentage = Math.min(100, ((data?.today.activeMinutes || 0) / goals.dailyActiveMinutesGoal) * 100);
  const weeklyActiveMinutesPercentage = Math.min(100, (weeklyActiveMinutesTotal / goals.weeklyActiveMinutesGoal) * 100);

  return (
    <div>
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Activity Tracker</h2>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Today's Activity</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Steps</span>
                  <span>{data.today.steps} / {goals.dailyStepGoal}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${stepsPercentage}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Active Minutes</span>
                  <span>{data.today.activeMinutes} / {goals.dailyActiveMinutesGoal}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${activeMinutesPercentage}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs">Distance</p>
                  <p className="text-lg font-semibold">{data.today.distance} km</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs">Calories</p>
                  <p className="text-lg font-semibold">{data.today.caloriesBurned}</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-gray-600 text-xs">Floors</p>
                  <p className="text-lg font-semibold">{data.today.floors}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Weekly Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Weekly Steps</span>
                  <span>{weeklyStepsTotal} / {goals.weeklyStepGoal}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${weeklyStepsPercentage}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Weekly Active Minutes</span>
                  <span>{weeklyActiveMinutesTotal} / {goals.weeklyActiveMinutesGoal}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${weeklyActiveMinutesPercentage}%` }} 
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button variant="outline">Adjust Goals</Button>
        </div>
      </Card>
    </div>
  );
}