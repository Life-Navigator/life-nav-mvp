'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConversationEngine } from '@/lib/conversation/conversation-engine';
import { Message, InsightDiscovery, ConversationStage } from '@/lib/conversation/types';
import { Goal } from '@/lib/goals/types';
import { getBenefitById } from '@/lib/benefits/benefit-tags';

interface DiscoveryChatProps {
  userGoals: Goal[];
  benefitSelections: {
    domain: string;
    topPriorities: string[];
    important: string[];
  }[];
  userId: string;
  onComplete: (analysis: any) => void;
}

export const DiscoveryChat: React.FC<DiscoveryChatProps> = ({
  userGoals,
  benefitSelections,
  userId,
  onComplete,
}) => {
  const [engine, setEngine] = useState<ConversationEngine | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<ConversationStage>('initial_assessment');
  const [insights, setInsights] = useState<InsightDiscovery[]>([]);
  const [scores, setScores] = useState({
    authenticity: 50,
    clarity: 30,
    readiness: 20,
  });
  const [showInsights, setShowInsights] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize conversation engine
    const newEngine = new ConversationEngine(userId, userGoals, benefitSelections);
    setEngine(newEngine);
    
    // Get first question
    initializeConversation(newEngine);
  }, [userId, userGoals, benefitSelections]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConversation = async (conversationEngine: ConversationEngine) => {
    const firstQuestion = await conversationEngine.getNextQuestion();
    setMessages([firstQuestion]);
    updateSessionState(conversationEngine);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !engine || isProcessing) return;

    const userMessage = userInput;
    setUserInput('');
    setIsProcessing(true);

    // Add user message to chat
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Process user response
      const response = await engine.processUserResponse(userMessage);
      
      // Update insights
      if (response.insights.length > 0) {
        setInsights(prev => [...prev, ...response.insights]);
      }

      // Add probe question if needed
      if (response.shouldProbe && response.probeQuestion) {
        const probeMsg: Message = {
          id: Date.now().toString() + '-probe',
          role: 'assistant',
          agent: engine.getSession().currentAgent,
          content: response.probeQuestion,
          timestamp: new Date(),
          questionType: 'probing',
          stage: engine.getSession().currentStage,
        };
        setMessages(prev => [...prev, probeMsg]);
      } else {
        // Get next question
        const nextQuestion = await engine.getNextQuestion();
        setMessages(prev => [...prev, nextQuestion]);
      }

      // Update session state
      updateSessionState(engine);
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSessionState = (conversationEngine: ConversationEngine) => {
    const session = conversationEngine.getSession();
    setCurrentStage(session.currentStage);
    setScores({
      authenticity: session.authenticityScore,
      clarity: session.clarityScore,
      readiness: session.readinessScore,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const completeConversation = () => {
    if (!engine) return;

    const analysis = engine.generateFinalAnalysis();
    onComplete({
      ...analysis,
      session: engine.getSession(),
    });
  };

  const getStageLabel = (stage: ConversationStage): string => {
    const labels: Record<ConversationStage, string> = {
      initial_assessment: '🤝 Getting to Know You',
      surface_exploration: '🔍 Exploring Your Goals',
      deeper_discovery: '💭 Understanding Your Why',
      true_motivation: '💡 Discovering True Motivations',
      action_planning: '📋 Creating Your Action Plan',
      commitment: '🎯 Securing Your Commitment',
    };
    return labels[stage];
  };

  const getAgentAvatar = (agent?: string): string => {
    const avatars: Record<string, string> = {
      financial_advisor: '💼',
      career_coach: '🎯',
      health_specialist: '🏥',
      psychologist: '🧠',
      life_strategist: '🌟',
    };
    return avatars[agent || 'life_strategist'];
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Discovery</h2>
              <p className="text-sm text-gray-600 mt-1">{getStageLabel(currentStage)}</p>
            </div>
            
            {/* Progress Indicators */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Authenticity</div>
                <div className="relative w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-green-500"
                    initial={{ width: '50%' }}
                    animate={{ width: `${scores.authenticity}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="text-xs font-medium mt-1">{scores.authenticity}%</div>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Clarity</div>
                <div className="relative w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-blue-500"
                    initial={{ width: '30%' }}
                    animate={{ width: `${scores.clarity}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="text-xs font-medium mt-1">{scores.clarity}%</div>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Readiness</div>
                <div className="relative w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-purple-500"
                    initial={{ width: '20%' }}
                    animate={{ width: `${scores.readiness}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="text-xs font-medium mt-1">{scores.readiness}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-2xl ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-lg
                    ${message.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'}
                  `}>
                    {message.role === 'user' ? '👤' : getAgentAvatar(message.agent)}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`
                    px-4 py-3 rounded-lg
                    ${message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-800'}
                  `}>
                    {message.agent && message.role === 'assistant' && (
                      <div className="text-xs opacity-70 mb-1">
                        {message.agent.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.questionType && (
                      <div className="text-xs mt-2 opacity-60">
                        {message.questionType.replace('_', ' ')} question
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isProcessing && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
              <span className="text-sm">Analyzing your response...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-6 py-4">
          <div className="flex gap-3">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share your thoughts... Press Enter to send"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={isProcessing}
            />
            <button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isProcessing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          
          {currentStage === 'commitment' && (
            <button
              onClick={completeConversation}
              className="mt-3 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Complete Discovery & Generate Analysis
            </button>
          )}
        </div>
      </div>

      {/* Insights Sidebar */}
      <div className={`
        w-96 bg-white border-l transition-transform duration-300
        ${showInsights ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">🔍 Discovered Insights</h3>
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {insight.type === 'motivation' ? '💡' :
                     insight.type === 'fear' ? '😰' :
                     insight.type === 'value' ? '💎' :
                     insight.type === 'belief' ? '🌟' : '🔍'}
                  </span>
                  <span className="text-sm font-medium text-purple-700">
                    {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {Math.round(insight.confidence * 100)}% confident
                  </span>
                </div>
                <p className="text-sm text-gray-700">{insight.content}</p>
                
                {insight.relatedGoals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {insight.relatedGoals.map(goalId => {
                      const goal = userGoals.find(g => g.id === goalId);
                      return goal ? (
                        <span
                          key={goalId}
                          className="text-xs px-2 py-1 bg-white rounded border border-gray-200"
                        >
                          {goal.icon} {goal.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            ))}
            
            {insights.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                Insights will appear here as we discover them through our conversation...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Insights Button */}
      <button
        onClick={() => setShowInsights(!showInsights)}
        className={`
          absolute right-4 top-20 p-3 bg-purple-600 text-white rounded-full shadow-lg
          hover:bg-purple-700 transition-all
          ${showInsights ? 'translate-x-0' : '-translate-x-2'}
        `}
      >
        {showInsights ? '→' : '💡'}
      </button>
    </div>
  );
};

// Backwards compatibility export
export const WhatWhatWhyChat = DiscoveryChat;