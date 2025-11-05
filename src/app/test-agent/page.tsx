'use client';

import { useState, useEffect } from 'react';
import { agentApi, Agent } from '@/lib/api/agent';
import { useAgentChat } from '@/hooks/useAgentChat';

export default function TestAgentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  const {
    agent,
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    setAgent,
    clearMessages
  } = useAgentChat();

  // Load health and agents on mount
  useEffect(() => {
    async function init() {
      try {
        // Check health
        const health = await agentApi.health();
        setHealthStatus(health);

        // Load agents
        const agentList = await agentApi.listAgents('default_user');
        setAgents(agentList);

        // Auto-select first agent
        if (agentList.length > 0) {
          setSelectedAgentId(agentList[0].id);
          await setAgent(agentList[0].id);
        }
      } catch (err) {
        console.error('Failed to initialize:', err);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    init();
  }, [setAgent]);

  const handleAgentChange = async (agentId: string) => {
    setSelectedAgentId(agentId);
    await setAgent(agentId);
    clearMessages();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedAgentId) return;

    try {
      await sendMessage(inputMessage);
      setInputMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Agent Integration Test</h1>

      {/* Health Status */}
      <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Backend Health Status</h2>
        {healthStatus ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              <span className="font-medium">Status: {healthStatus.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {Object.entries(healthStatus.databases || {}).map(([db, status]) => (
                <div key={db} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                  <span>{db}: {status as string}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-pulse">Loading...</div>
        )}
      </div>

      {/* Available Agents */}
      <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Available Agents</h2>
        {isLoadingAgents ? (
          <div className="animate-pulse">Loading agents...</div>
        ) : agents.length > 0 ? (
          <div className="space-y-3">
            {agents.map((ag) => (
              <div
                key={ag.id}
                onClick={() => handleAgentChange(ag.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedAgentId === ag.id
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                <div className="font-semibold">{ag.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{ag.description}</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">
                    {ag.agent_type}
                  </span>
                  {ag.capabilities.map((cap) => (
                    <span key={cap} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-yellow-600 dark:text-yellow-400">
            No agents found. Create one using the backend API or admin dashboard at http://localhost:8501
          </div>
        )}
      </div>

      {/* Chat Interface */}
      {selectedAgentId && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-slate-700">
            <h2 className="text-xl font-semibold">Chat with {agent?.name || 'Agent'}</h2>
            {agent && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {agent.system_prompt}
              </p>
            )}
          </div>

          {/* Messages */}
          <div className="p-4 h-96 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold mb-1 opacity-75">
                      {msg.role === 'user' ? 'You' : agent?.name || 'Agent'}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div className="text-xs opacity-75 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
              <div className="text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-4 border-t dark:border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isSending || !selectedAgentId}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isSending || !selectedAgentId || !inputMessage.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
              <button
                type="button"
                onClick={clearMessages}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600
                         rounded-lg font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold mb-2">Integration Info</h3>
        <div className="text-sm space-y-1">
          <div>Backend API: {process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8080'}</div>
          <div>Frontend: http://localhost:3000</div>
          <div>Admin Dashboard: http://localhost:8501</div>
        </div>
      </div>
    </div>
  );
}
