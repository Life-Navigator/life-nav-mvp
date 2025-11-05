'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  points: number;
}

interface AchievementUnlockProps {
  onContinue: () => void;
  onBack: () => void;
}

export default function AchievementUnlock({ onContinue, onBack }: AchievementUnlockProps) {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showAll, setShowAll] = useState(false);
  
  // Initial achievements for completing onboarding
  const achievements: Achievement[] = [
    {
      id: 'profile_pioneer',
      title: 'Profile Pioneer',
      description: 'Completed your personal profile setup',
      icon: '🏆',
      backgroundColor: 'bg-blue-100 dark:bg-blue-900/50',
      textColor: 'text-blue-800 dark:text-blue-200',
      borderColor: 'border-blue-200 dark:border-blue-800',
      points: 50
    },
    {
      id: 'goal_setter',
      title: 'Goal Setter',
      description: 'Defined and prioritized your life goals',
      icon: '🎯',
      backgroundColor: 'bg-green-100 dark:bg-green-900/50',
      textColor: 'text-green-800 dark:text-green-200',
      borderColor: 'border-green-200 dark:border-green-800',
      points: 75
    },
    {
      id: 'risk_navigator',
      title: 'Risk Navigator',
      description: 'Completed your personalized risk assessment',
      icon: '🧭',
      backgroundColor: 'bg-purple-100 dark:bg-purple-900/50',
      textColor: 'text-purple-800 dark:text-purple-200',
      borderColor: 'border-purple-200 dark:border-purple-800',
      points: 100
    },
    {
      id: 'roadmap_ready',
      title: 'Roadmap Ready',
      description: 'Ready to embark on your life navigation journey',
      icon: '🗺️',
      backgroundColor: 'bg-amber-100 dark:bg-amber-900/50',
      textColor: 'text-amber-800 dark:text-amber-200',
      borderColor: 'border-amber-200 dark:border-amber-800',
      points: 150
    }
  ];
  
  useEffect(() => {
    // Simulate revealing achievements one by one
    const revealNext = () => {
      if (currentIndex < achievements.length) {
        setIsRevealing(true);
        setTimeout(() => {
          setUnlockedAchievements(prev => [
            ...prev, 
            achievements[currentIndex]
          ]);
          setTotalPoints(prev => prev + achievements[currentIndex].points);
          setIsRevealing(false);
          
          // Move to next achievement
          setCurrentIndex(prev => prev + 1);
        }, 1500);
      }
    };
    
    // Start revealing if we haven't revealed all achievements yet
    if (currentIndex < achievements.length && !isRevealing) {
      const timer = setTimeout(revealNext, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, achievements, isRevealing]);
  
  // Get current achievement being revealed
  const currentAchievement = currentIndex < achievements.length ? achievements[currentIndex] : null;
  
  // Progress calculation
  const progress = Math.min(100, (unlockedAchievements.length / achievements.length) * 100);
  
  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Setup Achievements Unlocked
      </h2>
      
      <p className="text-center text-gray-600 dark:text-gray-300">
        Congratulations on completing your personalized setup!
      </p>
      
      <div className="flex justify-center mb-2">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
          bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          Total Points: {totalPoints}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-500"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="min-h-[300px] flex items-center justify-center">
        {isRevealing && currentAchievement && (
          <motion.div 
            className={`${currentAchievement.backgroundColor} ${currentAchievement.textColor} text-center py-8 px-6 rounded-lg border-2 ${currentAchievement.borderColor} max-w-md`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <motion.div 
              className="text-[72px] mb-3"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 0.8 }}
            >
              {currentAchievement.icon}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <h3 className="text-xl font-bold mb-2">Achievement Unlocked!</h3>
              <p className="text-2xl font-bold mb-2">{currentAchievement.title}</p>
              <p className="mb-3">{currentAchievement.description}</p>
              <div className="font-bold text-lg">+{currentAchievement.points} points</div>
            </motion.div>
          </motion.div>
        )}
        
        {!isRevealing && unlockedAchievements.length === achievements.length && (
          <div className="text-center py-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="pb-6"
            >
              <div className="text-[72px] mb-3">🌟</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                All Achievements Unlocked!
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                You're ready to start your journey with Life Navigator
              </p>
              
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
                text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                {showAll ? 'Hide Achievements' : 'View All Achievements'}
              </button>
            </motion.div>
          </div>
        )}
      </div>
      
      {showAll && (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {unlockedAchievements.map((achievement, index) => (
            <motion.div 
              key={achievement.id}
              className={`${achievement.backgroundColor} ${achievement.textColor} p-4 rounded-lg border ${achievement.borderColor} flex items-center`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <div className="text-3xl mr-4">{achievement.icon}</div>
              <div>
                <h4 className="font-bold">{achievement.title}</h4>
                <p className="text-sm">{achievement.description}</p>
                <div className="text-sm font-semibold mt-1">+{achievement.points} points</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
          text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
            isRevealing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isRevealing}
        >
          Back
        </button>
        
        <button
          onClick={onContinue}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
          text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
          focus:ring-blue-500 transition-colors ${
            unlockedAchievements.length < achievements.length ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={unlockedAchievements.length < achievements.length}
        >
          {unlockedAchievements.length < achievements.length 
            ? 'Please Wait...' 
            : 'Continue to Dashboard'}
        </button>
      </div>
    </motion.div>
  );
}