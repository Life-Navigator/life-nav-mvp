'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import Link from 'next/link';

interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  id: string;
  name: string;
  time: string;
  foods: FoodItem[];
}

interface NutritionData {
  dailyGoals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: Meal[];
}

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Calculate daily totals
const calculateDailyTotals = (meals: Meal[]): DailyTotals => {
  return meals.reduce((totals, meal) => {
    const mealTotals = meal.foods.reduce((mealAcc, food) => {
      return {
        calories: mealAcc.calories + food.calories,
        protein: mealAcc.protein + food.protein,
        carbs: mealAcc.carbs + food.carbs,
        fat: mealAcc.fat + food.fat
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      calories: totals.calories + mealTotals.calories,
      protein: totals.protein + mealTotals.protein,
      carbs: totals.carbs + mealTotals.carbs,
      fat: totals.fat + mealTotals.fat
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
};

export default function NutritionLog() {
  const [data, setData] = useState<NutritionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNutritionData = async () => {
      try {
        // TODO: Implement API endpoint for fetching nutrition data
        // const response = await fetch('/api/wellness/nutrition');
        // const nutritionData = await response.json();
        // setData(nutritionData);

        // For now, set null - will be populated when users connect nutrition tracking apps
        setData(null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching nutrition data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchNutritionData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Nutrition Log</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading nutrition data...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Nutrition Log</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🍎</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Nutrition Data Connected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your nutrition tracking app to automatically monitor your meals, calories, and macronutrients.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/integrations">
              <Button variant="default">Connect Device</Button>
            </Link>
            <Button variant="outline">Log Meal Manually</Button>
          </div>
        </div>
      </Card>
    );
  }

  const dailyTotals = calculateDailyTotals(data.meals);

  // Calculate percentages for nutrient progress bars
  const caloriesPercentage = Math.min(100, (dailyTotals.calories / data.dailyGoals.calories) * 100);
  const proteinPercentage = Math.min(100, (dailyTotals.protein / data.dailyGoals.protein) * 100);
  const carbsPercentage = Math.min(100, (dailyTotals.carbs / data.dailyGoals.carbs) * 100);
  const fatPercentage = Math.min(100, (dailyTotals.fat / data.dailyGoals.fat) * 100);

  return (
    <div>
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Nutrition Log</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Today's Meals</h3>
          
          {data.meals.map((meal) => (
            <div key={meal.id} className="mb-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{meal.name} <span className="text-gray-500 text-sm">({meal.time})</span></h4>
                <Button variant="text" size="sm">
                  Add Food
                </Button>
              </div>
              
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="text-left pb-2 font-normal">Food</th>
                    <th className="text-right pb-2 font-normal">Calories</th>
                    <th className="text-right pb-2 font-normal">Protein</th>
                    <th className="text-right pb-2 font-normal">Carbs</th>
                    <th className="text-right pb-2 font-normal">Fat</th>
                  </tr>
                </thead>
                <tbody>
                  {meal.foods.map((food, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2">{food.name}</td>
                      <td className="text-right py-2">{food.calories}</td>
                      <td className="text-right py-2">{food.protein}g</td>
                      <td className="text-right py-2">{food.carbs}g</td>
                      <td className="text-right py-2">{food.fat}g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          
          <div className="mt-4 flex justify-end">
            <Button variant="outline">Record New Meal</Button>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Daily Nutrition Summary</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Calories</span>
                    <span>{dailyTotals.calories} / {data.dailyGoals.calories} kcal</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${caloriesPercentage}%` }} 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-orange-500"
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Protein</span>
                    <span>{dailyTotals.protein} / {data.dailyGoals.protein}g</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${proteinPercentage}%` }} 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Carbs</span>
                    <span>{dailyTotals.carbs} / {data.dailyGoals.carbs}g</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${carbsPercentage}%` }} 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Fat</span>
                    <span>{dailyTotals.fat} / {data.dailyGoals.fat}g</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${fatPercentage}%` }} 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <p className="text-blue-800 dark:text-blue-200 text-xs">Daily Calorie Goal</p>
              <p className="text-lg font-medium">{data.dailyGoals.calories} kcal</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-green-800 dark:text-green-200 text-xs">Protein Goal</p>
              <p className="text-lg font-medium">{data.dailyGoals.protein}g</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-yellow-800 dark:text-yellow-200 text-xs">Carbs Goal</p>
              <p className="text-lg font-medium">{data.dailyGoals.carbs}g</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
              <p className="text-orange-800 dark:text-orange-200 text-xs">Fat Goal</p>
              <p className="text-lg font-medium">{data.dailyGoals.fat}g</p>
            </div>
          </div>
        
          <div className="mt-4 text-sm">
            <p className="text-gray-500">These goals are based on your profile information and activity level.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}