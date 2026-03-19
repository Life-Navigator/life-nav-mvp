'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrchestrationEngine } from '@/lib/agents/orchestration-engine';
import {
  AgentMessage,
  UserComprehensiveProfile,
  ConversationPhase,
  PersonalizedRoadmap,
} from '@/lib/agents/types';

interface MultiAgentChatProps {
  userProfile: UserComprehensiveProfile;
  onComplete: (roadmap: PersonalizedRoadmap) => void;
}

export const MultiAgentChat: React.FC<MultiAgentChatProps> = ({ userProfile, onComplete }) => {
  const [engine, setEngine] = useState<OrchestrationEngine | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('synthesis');
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [showRoadmapPreview, setShowRoadmapPreview] = useState(false);
  const [sessionQuality, setSessionQuality] = useState({
    completeness: 0,
    consistency: 0,
    depth: 0,
    actionability: 0,
    userEngagement: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize orchestration engine
    const orchestrationEngine = new OrchestrationEngine(userProfile);
    setEngine(orchestrationEngine);

    // Start the session
    initializeSession(orchestrationEngine);
  }, [userProfile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async (orchestrationEngine: OrchestrationEngine) => {
    const initialMessage = await orchestrationEngine.startSession();
    setMessages([initialMessage]);
    updateSessionState(orchestrationEngine);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !engine || isProcessing) return;

    const userMessage = userInput;
    setUserInput('');
    setIsProcessing(true);

    try {
      // Get the last agent message ID to link response
      const lastAgentMessage = [...messages].reverse().find((m) => m.agentId);

      // Process user response
      const agentResponses = await engine.processUserResponse(
        userMessage,
        lastAgentMessage?.id || ''
      );

      // Update messages
      setMessages((prev) => [...prev, ...agentResponses]);

      // Update session state
      updateSessionState(engine);

      // Check if roadmap is ready
      const roadmap = engine.getRoadmap();
      if (roadmap && currentPhase === 'implementation') {
        setShowRoadmapPreview(true);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSessionState = (orchestrationEngine: OrchestrationEngine) => {
    const session = orchestrationEngine.getSession();
    setCurrentPhase(session.phase);
    setActiveAgents(session.activeAgents);
    setSessionQuality(session.quality);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const completeSession = () => {
    if (!engine) return;

    const roadmap = engine.getRoadmap();
    if (roadmap) {
      onComplete(roadmap);
    }
  };

  const getPhaseLabel = (phase: ConversationPhase): string => {
    const labels: Record<ConversationPhase, string> = {
      synthesis: '🔄 Synthesizing Your Data',
      clarification: '🔍 Clarifying Your Needs',
      deep_discovery: '💭 Discovering Deep Motivations',
      roadmap_creation: '🗺️ Creating Your Roadmap',
      commitment: '🤝 Securing Your Commitment',
      implementation: '🚀 Planning Implementation',
    };
    return labels[phase];
  };

  const getPhaseProgress = (): number => {
    const phases: ConversationPhase[] = [
      'synthesis',
      'clarification',
      'deep_discovery',
      'roadmap_creation',
      'commitment',
      'implementation',
    ];
    const currentIndex = phases.indexOf(currentPhase);
    return ((currentIndex + 1) / phases.length) * 100;
  };

  const getAgentColor = (agentType: string): string => {
    const colors: Record<string, string> = {
      orchestrator: 'from-purple-500 to-indigo-600',
      financial_strategist: 'from-green-500 to-emerald-600',
      career_architect: 'from-blue-500 to-cyan-600',
      health_optimizer: 'from-red-500 to-pink-600',
      risk_analyst: 'from-yellow-500 to-orange-600',
      behavioral_psychologist: 'from-indigo-500 to-purple-600',
      life_coach: 'from-pink-500 to-rose-600',
      education_advisor: 'from-violet-500 to-purple-600',
      relationship_counselor: 'from-fuchsia-500 to-pink-600',
      spiritual_guide: 'from-teal-500 to-cyan-600',
      legal_advisor: 'from-slate-600 to-gray-700',
      compliance_officer: 'from-amber-500 to-yellow-600',
      tax_strategist: 'from-lime-500 to-green-600',
      insurance_advisor: 'from-sky-500 to-blue-600',
      nutrition_specialist: 'from-emerald-500 to-teal-600',
      productivity_coach: 'from-orange-500 to-red-600',
      resume_writer: 'from-cyan-500 to-blue-600',
      degree_analyzer: 'from-violet-600 to-indigo-700',
      benefits_specialist: 'from-rose-500 to-pink-600',
    };
    return colors[agentType] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Life Roadmap Creation
              </h2>
              <p className="text-sm text-gray-600 mt-1">{getPhaseLabel(currentPhase)}</p>
            </div>

            {/* Phase Progress */}
            <div className="flex items-center gap-6">
              <div className="w-48">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(getPhaseProgress())}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${getPhaseProgress()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Quality Indicators */}
              <div className="flex gap-3">
                {Object.entries(sessionQuality)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-gray-500 capitalize mb-1">
                        {key.replace('_', ' ')}
                      </div>
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="text-gray-200"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 20}`}
                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - value / 100)}`}
                            className="text-purple-600 transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-semibold">{value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active Agents Bar */}
        <div className="bg-white/80 backdrop-blur px-6 py-3 border-b">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Active Agents:</span>
            <div className="flex gap-2">
              {activeAgents.map((agent) => (
                <motion.div
                  key={agent.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium text-white
                    bg-gradient-to-r ${getAgentColor(agent.type)}
                    flex items-center gap-1
                  `}
                >
                  <span className="text-base">{agent.avatar}</span>
                  <span>{agent.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                {/* Agent Message */}
                <div className="flex gap-4">
                  {/* Agent Avatar */}
                  <div
                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-xl
                    bg-gradient-to-r ${getAgentColor(message.agentType)}
                    shadow-lg
                  `}
                  >
                    {activeAgents.find((a) => a.id === message.agentId)?.avatar || '🤖'}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-gray-800">
                        {activeAgents.find((a) => a.id === message.agentId)?.name || 'Agent'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.agentType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border p-4">
                      <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>

                      {/* Question Options */}
                      {message.question && message.question.type === 'choice' && (
                        <div className="mt-4 space-y-2">
                          {message.question.options?.map((option, idx) => (
                            <button
                              key={idx}
                              className="w-full text-left px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
                              onClick={() => setUserInput(option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Insight Badge */}
                      {message.insight && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          <span>💡</span>
                          <span>Insight: {message.insight.type}</span>
                          <span className="text-xs opacity-70">
                            ({Math.round(message.insight.confidence * 100)}% confident)
                          </span>
                        </div>
                      )}

                      {/* Recommendation Card */}
                      {message.recommendation && (
                        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📌</span>
                            <span className="font-semibold text-blue-900">Recommendation</span>
                            <span
                              className={`
                              px-2 py-0.5 rounded text-xs font-medium
                              ${
                                message.recommendation.priority === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : message.recommendation.priority === 'high'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-green-100 text-green-700'
                              }
                            `}
                            >
                              {message.recommendation.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">
                            {message.recommendation.action}
                          </p>
                          <p className="text-xs text-gray-600 italic">
                            {message.recommendation.rationale}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* User Response */}
                    {message.userResponse && (
                      <div className="mt-3 ml-8">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
                            👤
                          </div>
                          <span className="text-sm text-gray-600">You</span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.userResponse.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-sm text-gray-800">{message.userResponse.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isProcessing && (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="flex gap-1">
                <motion.div
                  className="w-2 h-2 bg-purple-500 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-purple-500 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                />
                <motion.div
                  className="w-2 h-2 bg-purple-500 rounded-full"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
              </div>
              <span className="text-sm">Agents are thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white/90 backdrop-blur border-t px-6 py-4">
          <div className="flex gap-3">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share your thoughts, concerns, or questions..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              disabled={isProcessing}
            />
            <button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isProcessing}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Send
            </button>
          </div>

          {currentPhase === 'implementation' && (
            <button
              onClick={completeSession}
              className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold"
            >
              🎯 Finalize Your Personalized Roadmap
            </button>
          )}
        </div>
      </div>

      {/* Roadmap Preview Sidebar */}
      <AnimatePresence>
        {showRoadmapPreview && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-96 bg-white border-l shadow-xl p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">📍 Your Roadmap Preview</h3>
              <button
                onClick={() => setShowRoadmapPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Vision */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">🌟 Life Vision</h4>
                <p className="text-sm text-gray-600 italic">
                  {engine?.getSession().synthesis.lifeVision}
                </p>
              </div>

              {/* Core Objectives */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">🎯 Core Objectives</h4>
                <ul className="space-y-1">
                  {engine?.getSession().synthesis.coreObjectives.map((obj, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Immediate Actions */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">⚡ First Steps</h4>
                <div className="space-y-2">
                  {engine
                    ?.getRoadmap()
                    ?.immediateActions.slice(0, 3)
                    .map((action) => (
                      <div
                        key={action.id}
                        className="p-3 bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <p className="text-sm font-medium text-blue-900">{action.title}</p>
                        <p className="text-xs text-blue-700 mt-1">{action.description}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Success Metrics */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">📊 How We\'ll Measure Success</h4>
                <div className="space-y-1">
                  {engine
                    ?.getRoadmap()
                    ?.successMetrics.slice(0, 5)
                    .map((metric) => (
                      <div key={metric.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{metric.name}</span>
                        <span className="font-medium text-gray-800">{metric.target}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
