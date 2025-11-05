'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Brain, Target, Shield, Heart, TrendingUp } from 'lucide-react';
import { AzureOrchestrationEngine } from '@/lib/agents/azure-orchestration-engine';
import { AgentFactory } from '@/lib/agents/agent-factory';
import { Agent, AgentResponse, MultiAgentResponse, UserContext } from '@/lib/agents/types';

interface AzureMultiAgentChatProps {
  userContext: {
    name: string;
    age: number;
    location: string;
    selectedBenefits: Array<{ 
      id: string; 
      label: string; 
      category: string; 
      importance?: string;
    }>;
    goals: Array<{
      id: string;
      title: string;
      category: string;
      targetAge: number;
      priority: string;
      estimatedCost?: number;
    }>;
    riskProfile: {
      overallScore: number;
      financialRisk: number;
      healthRisk: number;
      careerRisk: number;
    };
    currentPhase?: string;
  };
  onComplete: (insights: any) => void;
}

export const AzureMultiAgentChat: React.FC<AzureMultiAgentChatProps> = ({
  userContext,
  onComplete,
}) => {
  const [orchestrationEngine, setOrchestrationEngine] = useState<AzureOrchestrationEngine | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant' | 'agent';
    content: string;
    agentName?: string;
    agentType?: string;
    timestamp: Date;
  }>>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [currentContext, setCurrentContext] = useState<any>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      const engine = new AzureOrchestrationEngine();
      await engine.initialize();
      setOrchestrationEngine(engine);

      // Select agents based on user context
      const selectedAgentTypes = selectRelevantAgents(userContext);
      
      // Create session with user context
      const newSessionId = await engine.createSession(
        userContext.name, // Using name as userId for now
        userContext as UserContext,
        selectedAgentTypes
      );
      
      setSessionId(newSessionId);

      // Get active agents from factory
      const agents = selectedAgentTypes.map(type => 
        AgentFactory.createAgent(type as any)
      ).filter(Boolean);
      setActiveAgents(agents);

      // Initial greeting from orchestrator
      const orchestrator = agents.find(a => a.type === 'orchestrator');
      if (orchestrator) {
        const greeting = AgentFactory.generateGreeting(orchestrator, userContext.name);
        addMessage({
          role: 'assistant',
          content: greeting,
          agentName: orchestrator.name,
          agentType: orchestrator.type,
        });
      }

      // Add initial synthesis message
      const synthesisMessage = await generateInitialSynthesis(userContext);
      addMessage({
        role: 'assistant',
        content: synthesisMessage,
        agentName: 'Navigator',
        agentType: 'orchestrator',
      });

    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const selectRelevantAgents = (context: typeof userContext): string[] => {
    const agents = ['orchestrator']; // Always include orchestrator

    // Add agents based on user's goals and benefits
    const goalCategories = new Set(context.goals.map(g => g.category));
    const benefitCategories = new Set(context.selectedBenefits.map(b => b.category));

    if (goalCategories.has('financial') || benefitCategories.has('financial')) {
      agents.push('financial_strategist');
    }
    if (goalCategories.has('career') || benefitCategories.has('career')) {
      agents.push('career_architect');
    }
    if (goalCategories.has('health') || benefitCategories.has('health')) {
      agents.push('health_optimizer');
    }

    // Add risk analyst if risk profile shows concerns
    if (context.riskProfile.overallScore < 5) {
      agents.push('risk_analyst');
    }

    // Add life coach for motivation
    agents.push('life_coach');

    // Add behavioral psychologist for habit formation
    if (context.goals.length > 3) {
      agents.push('behavioral_psychologist');
    }

    return agents;
  };

  const generateInitialSynthesis = async (context: typeof userContext): Promise<string> => {
    const topGoals = context.goals.slice(0, 3).map(g => g.title).join(', ');
    const topBenefits = context.selectedBenefits.slice(0, 3).map(b => b.label).join(', ');
    
    return `Based on everything you've shared, I can see you're ready to create meaningful change in your life.

Your top priorities include: ${topGoals}
What matters most to you: ${topBenefits}

I've assembled a team of specialists to help create your personalized roadmap:
${activeAgents.filter(a => a.type !== 'orchestrator').map(a => `• ${a.name} - ${a.expertise[0]}`).join('\n')}

Let's start by exploring what success looks like for you. What would achieving these goals mean for your life?`;
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !orchestrationEngine || !sessionId || isProcessing) return;

    const userMessage = userInput;
    setUserInput('');
    setIsProcessing(true);

    // Add user message
    addMessage({
      role: 'user',
      content: userMessage,
    });

    try {
      // Process message through Azure OpenAI
      const response = await orchestrationEngine.processMessage(sessionId, userMessage);

      // Add synthesized response
      addMessage({
        role: 'assistant',
        content: response.synthesizedResponse,
        agentName: 'Navigator',
        agentType: 'orchestrator',
      });

      // Update context and next steps
      setCurrentContext(response.context);
      setNextSteps(response.nextSteps || []);

      // Show individual agent insights if available
      if (response.responses.length > 1) {
        setTimeout(() => {
          response.responses.forEach((agentResponse, index) => {
            if (agentResponse.agent.type !== 'orchestrator' && agentResponse.insights.length > 0) {
              setTimeout(() => {
                addMessage({
                  role: 'agent',
                  content: `💡 ${agentResponse.insights[0]}`,
                  agentName: agentResponse.agent.name,
                  agentType: agentResponse.agent.type,
                });
              }, index * 500);
            }
          });
        }, 1000);
      }

    } catch (error) {
      console.error('Error processing message:', error);
      addMessage({
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        agentName: 'System',
        agentType: 'orchestrator',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (message: Omit<typeof messages[0], 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const completeSession = () => {
    if (!orchestrationEngine || !sessionId) return;
    
    const conversationHistory = orchestrationEngine.getConversationHistory(sessionId);
    const context = orchestrationEngine.getSessionContext(sessionId);
    
    onComplete({
      conversationHistory,
      context,
      insights: currentContext?.userProfile?.graphInsights || [],
      nextSteps,
    });

    orchestrationEngine.endSession(sessionId);
  };

  const getAgentIcon = (agentType: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      orchestrator: <Sparkles className="w-5 h-5" />,
      financial_strategist: <TrendingUp className="w-5 h-5" />,
      career_architect: <Target className="w-5 h-5" />,
      health_optimizer: <Heart className="w-5 h-5" />,
      risk_analyst: <Shield className="w-5 h-5" />,
      behavioral_psychologist: <Brain className="w-5 h-5" />,
      life_coach: <Sparkles className="w-5 h-5" />,
    };
    return icons[agentType] || <Bot className="w-5 h-5" />;
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
    };
    return colors[agentType] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              AI-Powered Life Roadmap Creation
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Powered by Azure OpenAI GPT-4 with GraphRAG
            </p>
          </div>
          
          {/* Active Agents */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Active Agents:</span>
            <div className="flex gap-2">
              {activeAgents.map((agent) => (
                <div
                  key={agent.id}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium text-white
                    bg-gradient-to-r ${getAgentColor(agent.type)}
                    flex items-center gap-1
                  `}
                  title={agent.expertise.join(', ')}
                >
                  <span className="text-sm">{agent.avatar}</span>
                  <span>{agent.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-4"
              >
                {message.role === 'user' ? (
                  // User Message
                  <div className="flex justify-end">
                    <div className="flex gap-3 max-w-2xl">
                      <div className="flex-1">
                        <div className="bg-blue-600 text-white rounded-lg px-4 py-3 shadow-md">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Agent Message
                  <div className="flex gap-3 max-w-2xl">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-white
                      bg-gradient-to-r ${getAgentColor(message.agentType || 'orchestrator')}
                    `}>
                      {getAgentIcon(message.agentType || 'orchestrator')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-gray-800">
                          {message.agentName || 'Assistant'}
                        </span>
                        {message.agentType && (
                          <span className="text-xs text-gray-500">
                            {message.agentType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <div className={`
                        rounded-lg px-4 py-3 shadow-sm
                        ${message.role === 'agent' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200' : 'bg-white border'}
                      `}>
                        <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Processing Indicator */}
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
              <span className="text-sm">AI agents are collaborating...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Next Steps Sidebar */}
      {nextSteps.length > 0 && (
        <div className="w-80 bg-white/90 backdrop-blur border-l px-4 py-3">
          <h3 className="font-semibold text-gray-800 mb-2">📋 Recommended Next Steps</h3>
          <ul className="space-y-2">
            {nextSteps.map((step, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur border-t px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Share your thoughts, ask questions, or describe your goals..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              disabled={isProcessing}
            />
            <button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isProcessing}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              Send
            </button>
          </div>
          
          {messages.length > 5 && (
            <button
              onClick={completeSession}
              className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold transition-colors"
            >
              🎯 Complete Session & Generate Roadmap
            </button>
          )}
        </div>
      </div>
    </div>
  );
};