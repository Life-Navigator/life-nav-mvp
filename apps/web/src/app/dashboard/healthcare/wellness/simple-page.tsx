'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

export default function SimpleWellnessPage() {
  const [activeSection, setActiveSection] = useState('overview');
  
  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Wellness Tracker</h1>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Overall Wellness Score</h2>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/2">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-green-600">82</span>
                <span className="text-gray-500 ml-2">/ 100</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Your wellness score is excellent
              </p>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-xs">Activity Score</p>
                <p className="text-xl font-medium">85</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 text-xs">Sleep Score</p>
                <p className="text-xl font-medium">78</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                <p className="text-amber-800 dark:text-amber-200 text-xs">Nutrition Score</p>
                <p className="text-xl font-medium">76</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <p className="text-purple-800 dark:text-purple-200 text-xs">Stress Score</p>
                <p className="text-xl font-medium">68</p>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2">
            <h3 className="text-lg font-medium mb-2">Recommendations</h3>
            <ul className="space-y-2">
              <li className="text-sm flex items-start bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <span className="text-green-500 mr-2">•</span> 
                <span>Try to increase your step count by taking short walks during breaks</span>
              </li>
              <li className="text-sm flex items-start bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <span className="text-green-500 mr-2">•</span>
                <span>Your sleep duration is slightly below your goal - consider going to bed 30 minutes earlier</span>
              </li>
              <li className="text-sm flex items-start bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <span className="text-green-500 mr-2">•</span>
                <span>Great job meeting your protein goals - maintain this balance</span>
              </li>
              <li className="text-sm flex items-start bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <span className="text-green-500 mr-2">•</span>
                <span>Consider adding more mindfulness sessions to help manage stress levels</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
      
      <div className="border-b flex overflow-x-auto">
        <Button
          onClick={() => setActiveSection('overview')}
          variant={activeSection === 'overview' ? 'default' : 'ghost'}
          className="py-2 px-4 rounded-t-md"
        >
          Overview
        </Button>
        <Button
          onClick={() => setActiveSection('activity')}
          variant={activeSection === 'activity' ? 'default' : 'ghost'}
          className="py-2 px-4 rounded-t-md"
        >
          Activity Tracking
        </Button>
        <Button
          onClick={() => setActiveSection('nutrition')}
          variant={activeSection === 'nutrition' ? 'default' : 'ghost'}
          className="py-2 px-4 rounded-t-md"
        >
          Nutrition
        </Button>
        <Button
          onClick={() => setActiveSection('sleep')}
          variant={activeSection === 'sleep' ? 'default' : 'ghost'}
          className="py-2 px-4 rounded-t-md"
        >
          Sleep
        </Button>
      </div>
      
      <div className="mt-6">
        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">Daily Activity</h3>
                  <p className="text-sm text-gray-500">Today's summary</p>
                </div>
                <span className="text-xl">🏃</span>
              </div>
              
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Steps</span>
                    <span>8,250 / 10,000</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: '82.5%' }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Active Minutes</span>
                    <span>45 / 60</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: '75%' }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <span className="text-gray-500">Calories Burned:</span> 420
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">Nutrition</h3>
                  <p className="text-sm text-gray-500">Today's summary</p>
                </div>
                <span className="text-xl">🍎</span>
              </div>
              
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Calories</span>
                    <span>1,950 / 2,100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: '93%' }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Water Intake</span>
                    <span>1.8L / 2.5L</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: '72%' }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <div className="text-center">
                    <p className="font-medium">48%</p>
                    <p className="text-gray-500">Carbs</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">27%</p>
                    <p className="text-gray-500">Protein</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">25%</p>
                    <p className="text-gray-500">Fat</p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">Sleep</h3>
                  <p className="text-sm text-gray-500">Last night</p>
                </div>
                <span className="text-xl">😴</span>
              </div>
              
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Sleep Duration</span>
                    <span>7.2 / 8 hours</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: '90%' }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex text-sm">
                  <div className="flex-1">
                    <p className="font-medium">75</p>
                    <p className="text-gray-500">Sleep Score</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">18%</p>
                    <p className="text-gray-500">Deep Sleep</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">24%</p>
                    <p className="text-gray-500">REM Sleep</p>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">Stress Management</h3>
                  <p className="text-sm text-gray-500">Current status</p>
                </div>
                <span className="text-xl">🧘</span>
              </div>
              
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Stress Level</span>
                    <span className="capitalize">moderate</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: '68%' }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <span className="text-gray-500">Mindfulness Minutes Today:</span> 15
                </div>
                
                <Button variant="outline" size="sm">
                  Start Guided Meditation
                </Button>
              </div>
            </Card>
          </div>
        )}
        
        {activeSection === 'activity' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Activity Tracker</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Today's Activity</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Steps</span>
                      <span>8,250 / 10,000</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: '82.5%' }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Active Minutes</span>
                      <span>45 / 60</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: '75%' }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <p className="text-gray-600 text-xs">Distance</p>
                      <p className="text-lg font-semibold">6.7 km</p>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <p className="text-gray-600 text-xs">Calories</p>
                      <p className="text-lg font-semibold">420</p>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <p className="text-gray-600 text-xs">Floors</p>
                      <p className="text-lg font-semibold">12</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Weekly Progress</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-center text-gray-500 mb-2">Weekly steps</p>
                  <div className="flex justify-between items-end h-32">
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-24 w-full"></div>
                      <span className="text-xs mt-1">Mon</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-28 w-full"></div>
                      <span className="text-xs mt-1">Tue</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-22 w-full"></div>
                      <span className="text-xs mt-1">Wed</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-20 w-full"></div>
                      <span className="text-xs mt-1">Thu</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-26 w-full"></div>
                      <span className="text-xs mt-1">Fri</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-14 w-full"></div>
                      <span className="text-xs mt-1">Sat</span>
                    </div>
                    <div className="w-8 flex flex-col items-center">
                      <div className="bg-blue-200 rounded-t h-22 w-full"></div>
                      <span className="text-xs mt-1">Sun</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="outline">Adjust Goals</Button>
            </div>
          </Card>
        )}
        
        {activeSection === 'nutrition' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Nutrition Log</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Today's Meals</h3>
              
              <div className="mb-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Breakfast <span className="text-gray-500 text-sm">(07:30)</span></h4>
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
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2">Oatmeal</td>
                      <td className="text-right py-2">150</td>
                      <td className="text-right py-2">5g</td>
                      <td className="text-right py-2">27g</td>
                      <td className="text-right py-2">3g</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2">Banana</td>
                      <td className="text-right py-2">105</td>
                      <td className="text-right py-2">1g</td>
                      <td className="text-right py-2">27g</td>
                      <td className="text-right py-2">0g</td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2">Almond Milk</td>
                      <td className="text-right py-2">30</td>
                      <td className="text-right py-2">1g</td>
                      <td className="text-right py-2">1g</td>
                      <td className="text-right py-2">2g</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
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
                        <span>1,950 / 2,100 kcal</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          style={{ width: '93%' }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-orange-500"
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Protein</span>
                        <span>95 / 120g</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          style={{ width: '79%' }} 
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
                        <span>190 / 230g</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          style={{ width: '83%' }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Fat</span>
                        <span>60 / 70g</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          style={{ width: '86%' }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {activeSection === 'sleep' && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Sleep Analysis</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium mb-3">Last Night</h3>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-indigo-800 dark:text-indigo-200">Sleep Score</span>
                    <span className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">82</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Bedtime</span>
                      <span className="font-medium">23:30</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wake time</span>
                      <span className="font-medium">07:15</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Time in bed</span>
                      <span className="font-medium">7.75 hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Time asleep</span>
                      <span className="font-medium">7.1 hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Times woken up</span>
                      <span className="font-medium">2</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                    <p className="text-xs text-blue-800 dark:text-blue-200">Avg. Sleep Time</p>
                    <p className="text-lg font-semibold">7.3 hrs</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
                    <p className="text-xs text-purple-800 dark:text-purple-200">Avg. Sleep Score</p>
                    <p className="text-lg font-semibold">78</p>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-2">
                <h3 className="text-lg font-medium mb-3">Sleep Duration</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 h-64 flex items-center justify-center">
                  <p className="text-gray-500">Sleep duration chart</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="outline">View Sleep Insights</Button>
            </div>
          </Card>
        )}
      </div>
      
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-medium mb-4">Connected Health Devices</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 bg-opacity-20 flex items-center justify-center mr-3">
              <span className="text-xl">⌚</span>
            </div>
            <div>
              <p className="font-medium">Apple Watch</p>
              <p className="text-xs text-gray-500">Last synced: 35 min ago</p>
            </div>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 bg-opacity-20 flex items-center justify-center mr-3">
              <span className="text-xl">⚖️</span>
            </div>
            <div>
              <p className="font-medium">Smart Scale</p>
              <p className="text-xs text-gray-500">Last synced: 2 days ago</p>
            </div>
          </div>
          <Button variant="outline" className="mt-auto">
            Connect New Device
          </Button>
        </div>
      </Card>
    </div>
  );
}