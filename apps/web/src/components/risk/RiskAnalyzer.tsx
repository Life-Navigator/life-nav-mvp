'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RiskQuestion, 
  RiskOption, 
  QuestionResponse,
  RiskDomain 
} from '@/lib/risk/types';
import { getAdaptiveQuestions } from '@/lib/risk/questions';

interface RiskAnalyzerProps {
  userId: string;
  domain?: RiskDomain;
  quickAssessment?: boolean;
  onComplete: (responses: QuestionResponse[]) => void;
}

export const RiskAnalyzer: React.FC<RiskAnalyzerProps> = ({
  userId,
  domain,
  quickAssessment = false,
  onComplete,
}) => {
  const [questions, setQuestions] = useState<RiskQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showEducation, setShowEducation] = useState(false);

  useEffect(() => {
    // Load questions based on domain and assessment type
    const assessmentQuestions = getAdaptiveQuestions(domain, quickAssessment);
    setQuestions(assessmentQuestions);
  }, [domain, quickAssessment]);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleOptionSelect = (option: RiskOption) => {
    setSelectedOption(option.id);
  };

  const handleAllocationChange = (optionId: string, value: number) => {
    const newAllocation = { ...allocation };
    newAllocation[optionId] = value;
    
    // Ensure total doesn't exceed 100%
    const total = Object.values(newAllocation).reduce((sum, v) => sum + v, 0);
    if (total <= 100) {
      setAllocation(newAllocation);
    }
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    const responseTime = (Date.now() - questionStartTime) / 1000;
    
    let responseValue: any;
    if (currentQuestion.responseType === 'allocation') {
      responseValue = allocation;
    } else {
      responseValue = selectedOption;
    }

    const response: QuestionResponse = {
      questionId: currentQuestion.id,
      response: responseValue,
      responseTime,
      changed: false,
      timestamp: new Date(),
    };

    setResponses([...responses, response]);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setAllocation({});
      setQuestionStartTime(Date.now());
    } else {
      // Assessment complete
      onComplete([...responses, response]);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const previousResponse = responses[currentQuestionIndex - 1];
      if (previousResponse) {
        if (currentQuestion?.responseType === 'allocation') {
          setAllocation(previousResponse.response as Record<string, number>);
        } else {
          setSelectedOption(previousResponse.response as string);
        }
      }
    }
  };

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-700">
              Risk Assessment Progress
            </h2>
            <span className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            {/* Question Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {currentQuestion.domain.charAt(0).toUpperCase() + currentQuestion.domain.slice(1)}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {currentQuestion.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                {currentQuestion.title}
              </h3>
              
              {currentQuestion.scenario && (
                <p className="text-gray-600 leading-relaxed">
                  {currentQuestion.scenario}
                </p>
              )}
            </div>

            {/* Response Options */}
            <div className="space-y-4">
              {currentQuestion.responseType === 'single_choice' && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => (
                    <motion.button
                      key={option.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOptionSelect(option)}
                      className={`
                        w-full text-left p-4 rounded-lg border-2 transition-all
                        ${selectedOption === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center
                          ${selectedOption === option.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                          }
                        `}>
                          {selectedOption === option.id && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">
                            {option.label}
                          </div>
                          {option.description && (
                            <div className="text-sm text-gray-600 mt-1">
                              {option.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {currentQuestion.responseType === 'allocation' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Allocate 100% across these options:
                  </p>
                  {currentQuestion.options.map((option) => (
                    <div key={option.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-gray-800">
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="text-sm text-gray-600 ml-2">
                              ({option.description})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={allocation[option.id] || 0}
                            onChange={(e) => handleAllocationChange(option.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                          />
                          <span className="text-gray-600">%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          animate={{ width: `${allocation[option.id] || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Total Allocated:</span>
                      <span className={`font-bold ${
                        Object.values(allocation).reduce((sum, v) => sum + v, 0) === 100
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {Object.values(allocation).reduce((sum, v) => sum + v, 0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Education Toggle */}
            <button
              onClick={() => setShowEducation(!showEducation)}
              className="mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showEducation ? 'Hide' : 'Learn more about'} this concept →
            </button>

            {showEducation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 bg-blue-50 rounded-lg"
              >
                <h4 className="font-semibold text-blue-900 mb-2">
                  Understanding {currentQuestion.type.replace('_', ' ')}
                </h4>
                <p className="text-sm text-blue-800">
                  This question helps us understand your comfort level with uncertainty and potential losses. 
                  There are no right or wrong answers - we're learning about your personal preferences.
                </p>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <button
                onClick={handleBack}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              
              <button
                onClick={handleNext}
                disabled={
                  (currentQuestion.responseType === 'single_choice' && !selectedOption) ||
                  (currentQuestion.responseType === 'allocation' && 
                    Object.values(allocation).reduce((sum, v) => sum + v, 0) !== 100)
                }
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {currentQuestionIndex === questions.length - 1 ? 'Complete' : 'Next'} →
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Quick Navigation Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              disabled={index > responses.length}
              className={`
                w-2 h-2 rounded-full transition-all
                ${index === currentQuestionIndex
                  ? 'w-8 bg-blue-600'
                  : index < currentQuestionIndex
                  ? 'bg-green-500'
                  : index <= responses.length
                  ? 'bg-gray-400 hover:bg-gray-500'
                  : 'bg-gray-300 cursor-not-allowed'
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  );
};