'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface Persona {
  id: string;
  name: string;
  description: string;
  imageSrc: string;
  traits: string[];
  fit: string;
}

interface PersonaSelectionProps {
  onSelect: (personaId: string) => void;
  onBack: () => void;
}

export default function PersonaSelection({ onSelect, onBack }: PersonaSelectionProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  
  const personas: Persona[] = [
    {
      id: 'professional',
      name: 'Career Professional',
      description: 'Focused on career advancement and professional growth',
      imageSrc: '/images/personas/professional.svg',
      traits: ['Career-oriented', 'Growth-minded', 'Achievement-focused'],
      fit: 'Ideal if you prioritize career advancement and want to maximize earnings and professional growth.'
    },
    {
      id: 'learner',
      name: 'Lifelong Learner',
      description: 'Dedicated to continuous education and knowledge acquisition',
      imageSrc: '/images/personas/learner.svg',
      traits: ['Curious', 'Academic', 'Knowledge-seeking'],
      fit: 'Perfect if you value education and continuous learning as a primary life focus.'
    },
    {
      id: 'balanced',
      name: 'Balance Seeker',
      description: 'Looking for harmony across career, health, and personal fulfillment',
      imageSrc: '/images/personas/balanced.svg',
      traits: ['Well-rounded', 'Adaptable', 'Harmony-focused'],
      fit: 'Great if you want an equal balance between all aspects of life without strong preferences.'
    },
    {
      id: 'investor',
      name: 'Financial Optimizer',
      description: 'Prioritizing financial independence and wealth building',
      imageSrc: '/images/personas/investor.svg',
      traits: ['Value-conscious', 'Long-term planner', 'Financially-focused'],
      fit: 'Ideal if financial goals and achieving security or independence are your top priorities.'
    },
    {
      id: 'wellness',
      name: 'Wellness Enthusiast',
      description: 'Focused on health, well-being, and longevity',
      imageSrc: '/images/personas/wellness.svg',
      traits: ['Health-conscious', 'Active', 'Preventive'],
      fit: 'Perfect if your health and overall wellness are your primary concerns.'
    }
  ];

  const handleContinue = () => {
    if (selectedPersona) {
      onSelect(selectedPersona);
    }
  };

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        Which path best describes you?
      </h2>
      
      <p className="text-center text-gray-600 dark:text-gray-300">
        Select the option that best matches your current priorities and life goals.
        This helps us personalize your experience.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => (
          <motion.div
            key={persona.id}
            className={`relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all 
              ${selectedPersona === persona.id 
                ? 'ring-4 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                : 'hover:shadow-lg bg-white dark:bg-gray-800'}`}
            onClick={() => setSelectedPersona(persona.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="p-5">
              <div className="flex justify-center mb-4">
                <div className="relative w-16 h-16">
                  <Image 
                    src={persona.imageSrc}
                    alt={persona.name}
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                {persona.name}
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                {persona.description}
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {persona.traits.map((trait) => (
                  <span 
                    key={trait}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300"
                  >
                    {trait}
                  </span>
                ))}
              </div>
              
              {selectedPersona === persona.id && (
                <motion.div 
                  className="mt-3 text-sm text-blue-600 dark:text-blue-300 font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p>{persona.fit}</p>
                </motion.div>
              )}
            </div>
            
            {selectedPersona === persona.id && (
              <motion.div 
                className="absolute bottom-3 right-3 bg-blue-500 text-white rounded-full p-1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
      
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium 
          text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={handleContinue}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium 
          text-white focus:outline-none focus:ring-2 focus:ring-offset-2 
          focus:ring-blue-500 transition-colors
          ${selectedPersona 
            ? 'bg-blue-600 hover:bg-blue-700' 
            : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
          disabled={!selectedPersona}
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}