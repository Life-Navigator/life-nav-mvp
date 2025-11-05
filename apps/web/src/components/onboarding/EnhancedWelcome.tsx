'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface EnhancedWelcomeProps {
  onContinue: () => void;
  userName?: string;
}

export default function EnhancedWelcome({ onContinue, userName }: EnhancedWelcomeProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  
  // Staggered animation for feature list items
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };
  
  // Auto-show features after 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFeatures(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <motion.div 
      className="text-center space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring', stiffness: 100 }}
      >
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {userName ? `Welcome, ${userName}!` : 'Welcome to Life Navigator'}
        </h2>
        
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Your journey to a more intentional future starts here
        </p>
      </motion.div>
      
      <motion.div 
        className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/30 p-6 rounded-xl shadow-sm text-left"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4">
          Here's what you'll get:
        </h3>
        
        <motion.ul 
          className="space-y-5"
          variants={containerVariants}
          initial="hidden"
          animate={showFeatures ? "show" : "hidden"}
        >
          <motion.li variants={itemVariants} className="flex items-start">
            <span className="flex-shrink-0 p-1 bg-blue-100 dark:bg-blue-800 rounded-full mr-3 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">Personalized Life Roadmaps</span>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                Custom plans tailored to your specific goals across finances, career, health, and education
              </p>
            </div>
          </motion.li>
          
          <motion.li variants={itemVariants} className="flex items-start">
            <span className="flex-shrink-0 p-1 bg-blue-100 dark:bg-blue-800 rounded-full mr-3 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">AI-Powered Insights</span>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                Smart recommendations that adapt to your progress and changing priorities
              </p>
            </div>
          </motion.li>
          
          <motion.li variants={itemVariants} className="flex items-start">
            <span className="flex-shrink-0 p-1 bg-blue-100 dark:bg-blue-800 rounded-full mr-3 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">Integration Ecosystem</span>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                Connect your external accounts for a unified view of your life metrics
              </p>
            </div>
          </motion.li>
          
          <motion.li variants={itemVariants} className="flex items-start">
            <span className="flex-shrink-0 p-1 bg-blue-100 dark:bg-blue-800 rounded-full mr-3 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">Private & Secure</span>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                End-to-end encryption and strict privacy controls for your peace of mind
              </p>
            </div>
          </motion.li>
        </motion.ul>
      </motion.div>
      
      <motion.div
        className="space-y-4 max-w-xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        <p className="text-gray-600 dark:text-gray-300">
          Your personalized setup will take about 10 minutes, but it's worth every second.
        </p>
        
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            10 minutes
          </span>
          <span>•</span>
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            25 questions
          </span>
          <span>•</span>
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Secure & private
          </span>
        </div>
      </motion.div>
      
      <motion.div 
        className="pt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 0.5 }}
      >
        <button
          onClick={onContinue}
          className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Start Your Journey
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
}