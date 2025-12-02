'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DiscoveryChat } from '@/components/conversation/DiscoveryChat';
import { Goal } from '@/lib/goals/types';

function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('access_token');
}

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    // Decode JWT token to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.sub || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

export default function ConversationPage() {
  const router = useRouter();
  const [userGoals, setUserGoals] = useState<Goal[]>([]);
  const [benefitSelections, setBenefitSelections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }

    const id = getUserId();
    setUserId(id);

    const fetchUserData = async () => {
      if (!id) return;

      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Fetch user's goals
        const goalsRes = await fetch('/api/goals', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setUserGoals(goalsData.goals || []);
        }

        // Fetch user's benefit selections
        const benefitsRes = await fetch('/api/discovery/benefits', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (benefitsRes.ok) {
          const benefitsData = await benefitsRes.json();
          // Transform to expected format
          const selections = Object.entries(benefitsData.benefits || {}).map(([domain, benefits]) => ({
            domain,
            topPriorities: (benefits as string[]).slice(0, 5),
            important: (benefits as string[]).slice(5),
          }));
          setBenefitSelections(selections);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleConversationComplete = async (conversationAnalysis: any) => {
    setAnalysis(conversationAnalysis);
    setAnalysisComplete(true);

    // Save analysis to database
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      await fetch('/api/conversation/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          analysis: conversationAnalysis,
        }),
      });
    } catch (error) {
      console.error('Failed to save analysis:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Preparing your discovery session...</p>
        </div>
      </div>
    );
  }

  // Check prerequisites
  const hasGoals = userGoals.length > 0;
  const hasBenefits = benefitSelections.some(s => s.topPriorities.length > 0);

  if (!hasGoals || !hasBenefits) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Complete Prerequisites First
          </h2>
          <p className="text-gray-600 mb-6">
            Before we can have our discovery conversation, you need to:
          </p>
          <ul className="text-left space-y-3 mb-6">
            <li className={`flex items-center gap-2 ${hasBenefits ? 'text-green-600' : 'text-gray-600'}`}>
              <span>{hasBenefits ? '✅' : '⭕'}</span>
              Complete Benefits Discovery
            </li>
            <li className={`flex items-center gap-2 ${hasGoals ? 'text-green-600' : 'text-gray-600'}`}>
              <span>{hasGoals ? '✅' : '⭕'}</span>
              Create at least one goal in MyBlocks
            </li>
          </ul>
          <div className="flex gap-3">
            {!hasBenefits && (
              <button
                onClick={() => router.push('/discovery/benefits')}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Benefits Discovery
              </button>
            )}
            {!hasGoals && (
              <button
                onClick={() => router.push('/goals/create')}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create Goals
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (analysisComplete && analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-6">
              🎉 Discovery Complete!
            </h2>
            
            {/* Scores */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="text-5xl font-bold text-green-600 mb-2">
                  {analysis.session.authenticityScore}%
                </div>
                <div className="text-sm text-gray-600">Authenticity Score</div>
                <p className="text-xs text-gray-500 mt-2">
                  How aligned your goals are with your true motivations
                </p>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-5xl font-bold text-blue-600 mb-2">
                  {analysis.session.clarityScore}%
                </div>
                <div className="text-sm text-gray-600">Clarity Score</div>
                <p className="text-xs text-gray-500 mt-2">
                  How clear you are about what you want to achieve
                </p>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="text-5xl font-bold text-purple-600 mb-2">
                  {analysis.session.readinessScore}%
                </div>
                <div className="text-sm text-gray-600">Readiness Score</div>
                <p className="text-xs text-gray-500 mt-2">
                  How prepared you are to take action
                </p>
              </div>
            </div>

            {/* Hidden Motivations */}
            {analysis.hiddenMotivations && analysis.hiddenMotivations.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  💡 Discovered Motivations
                </h3>
                <div className="space-y-4">
                  {analysis.hiddenMotivations.map((motivation: any, idx: number) => (
                    <div key={idx} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="font-medium text-gray-800 mb-2">
                        Goal: {motivation.statedGoal}
                      </div>
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-gray-600">Surface reason:</span>{' '}
                          <span className="text-gray-800">{motivation.surfaceReason}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Deeper reason:</span>{' '}
                          <span className="text-gray-800">{motivation.deeperReason}</span>
                        </div>
                        <div className="font-medium text-purple-700">
                          True motivation: {motivation.trueMotivation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Plan */}
            {analysis.actionPlan && analysis.actionPlan.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  📋 Your Action Plan
                </h3>
                <ul className="space-y-3">
                  {analysis.actionPlan.map((action: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-green-600 mt-1">✓</span>
                      <span className="text-gray-700">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Insights */}
            {analysis.session.insights && analysis.session.insights.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  🔍 Key Insights
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {analysis.session.insights.slice(0, 6).map((insight: any) => (
                    <div
                      key={insight.id}
                      className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">
                          {insight.type === 'motivation' ? '💡' :
                           insight.type === 'fear' ? '😰' :
                           insight.type === 'value' ? '💎' :
                           insight.type === 'belief' ? '🌟' : '🔍'}
                        </span>
                        <span className="text-xs font-medium text-purple-700">
                          {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{insight.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/goals/create')}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Refine Your Goals
              </button>
              <button
                onClick={() => router.push('/dashboard/risk-assessment')}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Take Risk Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DiscoveryChat
      userGoals={userGoals}
      benefitSelections={benefitSelections}
      userId={userId || ''}
      onComplete={handleConversationComplete}
    />
  );
}