/**
 * Discovery Conversation Engine
 * Orchestrates multi-agent conversations to discover true motivations
 */

import {
  ConversationSession,
  ConversationStage,
  Message,
  AgentRole,
  QuestionType,
  InsightDiscovery,
  HiddenMotivation,
  Contradiction,
  GoalRefinement,
  QUESTION_TEMPLATES,
  AGENT_EXPERTISE,
  CONVERSATION_STAGES,
} from './types';
import { Goal } from '@/lib/goals/types';
import { BenefitTag, getBenefitById } from '@/lib/benefits/benefit-tags';
import { v4 as uuidv4 } from 'uuid';

export class ConversationEngine {
  private session: ConversationSession;
  private currentAgent: AgentRole;
  private messageCount: number = 0;
  private stageMessageCounts: Map<ConversationStage, number> = new Map();

  constructor(
    userId: string,
    userGoals: Goal[],
    benefitSelections: { domain: string; topPriorities: string[]; important: string[] }[]
  ) {
    this.session = {
      id: uuidv4(),
      userId,
      startedAt: new Date(),
      userGoals,
      benefitSelections,
      currentStage: 'initial_assessment',
      currentAgent: 'life_strategist',
      messageHistory: [],
      insights: [],
      hiddenMotivations: [],
      contradictions: [],
      goalRefinements: [],
      newGoalSuggestions: [],
      actionItems: [],
      authenticityScore: 50,
      clarityScore: 30,
      readinessScore: 20,
    };
    
    this.currentAgent = 'life_strategist';
    this.initializeStageMessageCounts();
  }

  private initializeStageMessageCounts() {
    Object.keys(CONVERSATION_STAGES).forEach(stage => {
      this.stageMessageCounts.set(stage as ConversationStage, 0);
    });
  }

  /**
   * Get the next question based on conversation state
   */
  public async getNextQuestion(): Promise<Message> {
    const stage = this.session.currentStage;
    const agent = this.selectAgent(stage);
    const questionType = this.selectQuestionType(stage);
    const question = this.generateQuestion(stage, questionType);

    const message: Message = {
      id: uuidv4(),
      role: 'assistant',
      agent,
      content: question,
      timestamp: new Date(),
      questionType,
      stage,
      confidence: this.calculateConfidence(),
    };

    this.session.messageHistory.push(message);
    this.messageCount++;
    this.incrementStageMessageCount(stage);

    // Check if we should advance to next stage
    if (this.shouldAdvanceStage()) {
      this.advanceStage();
    }

    return message;
  }

  /**
   * Process user's response and extract insights
   */
  public async processUserResponse(userMessage: string): Promise<{
    insights: InsightDiscovery[];
    shouldProbe: boolean;
    probeQuestion?: string;
  }> {
    const message: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      sentiment: this.analyzeSentiment(userMessage),
    };

    this.session.messageHistory.push(message);

    // Extract information from the response
    const extracted = this.extractInformation(userMessage);
    message.extractedGoals = extracted.goals;
    message.extractedBenefits = extracted.benefits;
    message.extractedConcerns = extracted.concerns;
    message.extractedValues = extracted.values;

    // Discover insights
    const insights = this.discoverInsights(userMessage, extracted);
    this.session.insights.push(...insights);

    // Check for contradictions
    const contradictions = this.detectContradictions(userMessage);
    this.session.contradictions.push(...contradictions);

    // Determine if we should probe deeper
    const shouldProbe = this.shouldProbeDeeper(userMessage, insights);
    let probeQuestion: string | undefined;

    if (shouldProbe) {
      probeQuestion = this.generateProbeQuestion(userMessage, insights);
    }

    // Update scores
    this.updateScores(insights, contradictions);

    return {
      insights,
      shouldProbe,
      probeQuestion,
    };
  }

  /**
   * Select the appropriate agent for the current stage
   */
  private selectAgent(stage: ConversationStage): AgentRole {
    const stageConfig = CONVERSATION_STAGES[stage];
    const availableAgents = stageConfig.agents;

    // Select agent based on the topics being discussed
    const recentTopics = this.analyzeRecentTopics();
    
    for (const agent of availableAgents) {
      const expertise = AGENT_EXPERTISE[agent as AgentRole];
      if (expertise.topics.some(topic => recentTopics.includes(topic))) {
        return agent as AgentRole;
      }
    }

    return availableAgents[0] as AgentRole;
  }

  /**
   * Select question type based on stage and conversation flow
   */
  private selectQuestionType(stage: ConversationStage): QuestionType {
    const stageQuestionTypes: Record<ConversationStage, QuestionType[]> = {
      initial_assessment: ['open_ended', 'clarifying'],
      surface_exploration: ['probing', 'clarifying'],
      deeper_discovery: ['probing', 'reflective'],
      true_motivation: ['challenging', 'reflective', 'hypothetical'],
      action_planning: ['clarifying', 'open_ended'],
      commitment: ['challenging', 'clarifying'],
    };

    const types = stageQuestionTypes[stage];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Generate a contextual question
   */
  private generateQuestion(stage: ConversationStage, type: QuestionType): string {
    const templates = this.getQuestionTemplates(stage);
    const recentContext = this.getRecentContext();
    const focusGoal = this.selectFocusGoal();
    const focusBenefit = this.selectFocusBenefit();

    // Select a template
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Replace placeholders
    let question = template
      .replace('{goal}', focusGoal?.title || 'your main goal')
      .replace('{benefit}', focusBenefit?.title || 'what matters most to you')
      .replace('{reason}', recentContext.lastReason || 'what you mentioned')
      .replace('{statement}', recentContext.lastStatement || 'that');

    // Add agent personality
    question = this.addAgentPersonality(question, this.currentAgent);

    return question;
  }

  /**
   * Get question templates for the current stage
   */
  private getQuestionTemplates(stage: ConversationStage): string[] {
    const stageTemplateMap: Record<ConversationStage, keyof typeof QUESTION_TEMPLATES> = {
      initial_assessment: 'surface',
      surface_exploration: 'surface',
      deeper_discovery: 'deeper',
      true_motivation: 'motivation',
      action_planning: 'commitment',
      commitment: 'commitment',
    };

    const templateKey = stageTemplateMap[stage];
    return QUESTION_TEMPLATES[templateKey];
  }

  /**
   * Extract information from user's response
   */
  private extractInformation(text: string): {
    goals: string[];
    benefits: string[];
    concerns: string[];
    values: string[];
  } {
    // This would use NLP in production
    // For now, use keyword matching
    const goals: string[] = [];
    const benefits: string[] = [];
    const concerns: string[] = [];
    const values: string[] = [];

    // Match against user's actual goals
    this.session.userGoals.forEach(goal => {
      if (text.toLowerCase().includes(goal.title.toLowerCase())) {
        goals.push(goal.id);
      }
    });

    // Match against benefit tags
    this.session.benefitSelections.forEach(selection => {
      [...selection.topPriorities, ...selection.important].forEach(benefitId => {
        const benefit = getBenefitById(benefitId);
        if (benefit && text.toLowerCase().includes(benefit.title.toLowerCase())) {
          benefits.push(benefitId);
        }
      });
    });

    // Extract concerns (keywords)
    const concernKeywords = ['worried', 'concerned', 'afraid', 'anxious', 'scared', 'nervous'];
    concernKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        concerns.push(keyword);
      }
    });

    // Extract values (keywords)
    const valueKeywords = ['family', 'freedom', 'security', 'growth', 'impact', 'legacy', 'purpose'];
    valueKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        values.push(keyword);
      }
    });

    return { goals, benefits, concerns, values };
  }

  /**
   * Discover insights from user's response
   */
  private discoverInsights(
    text: string,
    extracted: ReturnType<typeof this.extractInformation>
  ): InsightDiscovery[] {
    const insights: InsightDiscovery[] = [];

    // Pattern: Multiple concerns about security
    if (extracted.concerns.length > 1) {
      insights.push({
        id: uuidv4(),
        type: 'fear',
        content: 'User shows significant anxiety about future security',
        confidence: 0.8,
        supportingEvidence: [text],
        relatedGoals: extracted.goals,
        relatedBenefits: extracted.benefits,
        discoveredAt: new Date(),
      });
    }

    // Pattern: Values not aligned with goals
    if (extracted.values.includes('family') && !extracted.goals.some(g => {
      const goal = this.session.userGoals.find(ug => ug.id === g);
      return goal?.description.toLowerCase().includes('family');
    })) {
      insights.push({
        id: uuidv4(),
        type: 'pattern',
        content: 'User values family but goals don\'t explicitly reflect this',
        confidence: 0.7,
        supportingEvidence: [text],
        relatedGoals: extracted.goals,
        relatedBenefits: extracted.benefits,
        discoveredAt: new Date(),
      });
    }

    // More insight patterns would be added here

    return insights;
  }

  /**
   * Detect contradictions in user's responses
   */
  private detectContradictions(text: string): Contradiction[] {
    const contradictions: Contradiction[] = [];

    // Check for goal conflicts
    const mentionedGoals = this.session.userGoals.filter(goal =>
      text.toLowerCase().includes(goal.title.toLowerCase())
    );

    if (mentionedGoals.length > 1) {
      // Check if goals have conflicting timelines or resources
      for (let i = 0; i < mentionedGoals.length - 1; i++) {
        for (let j = i + 1; j < mentionedGoals.length; j++) {
          const goal1 = mentionedGoals[i];
          const goal2 = mentionedGoals[j];

          // Timeline conflict
          if (
            Math.abs(new Date(goal1.targetDate).getTime() - new Date(goal2.targetDate).getTime()) < 
            30 * 24 * 60 * 60 * 1000 // Within 30 days
          ) {
            contradictions.push({
              id: uuidv4(),
              type: 'timeline_conflict',
              description: `Goals "${goal1.title}" and "${goal2.title}" have overlapping timelines`,
              conflictingElements: {
                element1: { type: 'goal', content: goal1.title, reference: goal1.id },
                element2: { type: 'goal', content: goal2.title, reference: goal2.id },
              },
            });
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Determine if we should probe deeper
   */
  private shouldProbeDeeper(text: string, insights: InsightDiscovery[]): boolean {
    // Probe if we discovered significant insights
    if (insights.length > 0 && insights.some(i => i.confidence > 0.7)) {
      return true;
    }

    // Probe if response is very short
    if (text.split(' ').length < 10) {
      return true;
    }

    // Probe if we detect emotional language
    const emotionalKeywords = ['feel', 'felt', 'believe', 'think', 'wish', 'hope', 'dream'];
    if (emotionalKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * Generate a probe question based on the response
   */
  private generateProbeQuestion(text: string, insights: InsightDiscovery[]): string {
    const templates = QUESTION_TEMPLATES.deeper;
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Extract key phrase from user's response
    const sentences = text.split(/[.!?]/);
    const lastSentence = sentences[sentences.length - 2] || sentences[sentences.length - 1];
    
    return template
      .replace('{reason}', lastSentence.trim())
      .replace('{statement}', lastSentence.trim())
      .replace('{benefit}', 'that');
  }

  /**
   * Check if we should advance to the next stage
   */
  private shouldAdvanceStage(): boolean {
    const currentStageMessages = this.stageMessageCounts.get(this.session.currentStage) || 0;
    
    // Simple heuristic: advance after minimum messages for stage
    const minMessages: Record<ConversationStage, number> = {
      initial_assessment: 5,
      surface_exploration: 10,
      deeper_discovery: 15,
      true_motivation: 10,
      action_planning: 10,
      commitment: 5,
    };

    return currentStageMessages >= minMessages[this.session.currentStage];
  }

  /**
   * Advance to the next conversation stage
   */
  private advanceStage(): void {
    const stages: ConversationStage[] = [
      'initial_assessment',
      'surface_exploration',
      'deeper_discovery',
      'true_motivation',
      'action_planning',
      'commitment',
    ];

    const currentIndex = stages.indexOf(this.session.currentStage);
    if (currentIndex < stages.length - 1) {
      this.session.currentStage = stages[currentIndex + 1];
      this.stageMessageCounts.set(this.session.currentStage, 0);
    }
  }

  /**
   * Helper methods
   */
  private analyzeRecentTopics(): string[] {
    const recentMessages = this.session.messageHistory.slice(-5);
    const topics: string[] = [];

    recentMessages.forEach(msg => {
      if (msg.content.toLowerCase().includes('money') || msg.content.toLowerCase().includes('financial')) {
        topics.push('investments', 'savings');
      }
      if (msg.content.toLowerCase().includes('career') || msg.content.toLowerCase().includes('work')) {
        topics.push('advancement', 'skills');
      }
      if (msg.content.toLowerCase().includes('health') || msg.content.toLowerCase().includes('fitness')) {
        topics.push('wellness', 'fitness');
      }
    });

    return topics;
  }

  private getRecentContext(): { lastReason?: string; lastStatement?: string } {
    const lastUserMessage = [...this.session.messageHistory]
      .reverse()
      .find(m => m.role === 'user');

    if (!lastUserMessage) return {};

    return {
      lastStatement: lastUserMessage.content.split('.')[0],
      lastReason: lastUserMessage.content,
    };
  }

  private selectFocusGoal(): Goal | undefined {
    // Select the goal that hasn't been discussed much
    const goalMentionCounts = new Map<string, number>();
    
    this.session.userGoals.forEach(goal => {
      goalMentionCounts.set(goal.id, 0);
    });

    this.session.messageHistory.forEach(msg => {
      this.session.userGoals.forEach(goal => {
        if (msg.content.toLowerCase().includes(goal.title.toLowerCase())) {
          goalMentionCounts.set(goal.id, (goalMentionCounts.get(goal.id) || 0) + 1);
        }
      });
    });

    // Find least discussed goal
    let minMentions = Infinity;
    let focusGoal: Goal | undefined;

    this.session.userGoals.forEach(goal => {
      const mentions = goalMentionCounts.get(goal.id) || 0;
      if (mentions < minMentions) {
        minMentions = mentions;
        focusGoal = goal;
      }
    });

    return focusGoal;
  }

  private selectFocusBenefit(): BenefitTag | undefined {
    const allBenefitIds = this.session.benefitSelections.flatMap(s => 
      [...s.topPriorities, ...s.important]
    );

    if (allBenefitIds.length === 0) return undefined;

    const benefitId = allBenefitIds[Math.floor(Math.random() * allBenefitIds.length)];
    return getBenefitById(benefitId);
  }

  private addAgentPersonality(question: string, agent: AgentRole): string {
    const personalities: Record<AgentRole, string> = {
      financial_advisor: "From a financial perspective, ",
      career_coach: "In terms of your career growth, ",
      health_specialist: "Considering your well-being, ",
      psychologist: "I'm curious about the emotional aspect - ",
      life_strategist: "Looking at the bigger picture, ",
    };

    return personalities[agent] + question.charAt(0).toLowerCase() + question.slice(1);
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
    const positiveWords = ['happy', 'excited', 'great', 'wonderful', 'love', 'amazing'];
    const negativeWords = ['sad', 'worried', 'concerned', 'afraid', 'anxious', 'stressed'];

    const hasPositive = positiveWords.some(word => text.toLowerCase().includes(word));
    const hasNegative = negativeWords.some(word => text.toLowerCase().includes(word));

    if (hasPositive && hasNegative) return 'mixed';
    if (hasPositive) return 'positive';
    if (hasNegative) return 'negative';
    return 'neutral';
  }

  private calculateConfidence(): number {
    // Base confidence on how much information we've gathered
    const insightCount = this.session.insights.length;
    const messageCount = this.session.messageHistory.length;

    return Math.min(0.95, 0.5 + (insightCount * 0.05) + (messageCount * 0.01));
  }

  private incrementStageMessageCount(stage: ConversationStage): void {
    const current = this.stageMessageCounts.get(stage) || 0;
    this.stageMessageCounts.set(stage, current + 1);
  }

  private updateScores(insights: InsightDiscovery[], contradictions: Contradiction[]): void {
    // Update authenticity score
    if (contradictions.length > 0) {
      this.session.authenticityScore = Math.max(0, this.session.authenticityScore - 5);
    }
    if (insights.some(i => i.type === 'motivation')) {
      this.session.authenticityScore = Math.min(100, this.session.authenticityScore + 10);
    }

    // Update clarity score
    if (insights.length > 0) {
      this.session.clarityScore = Math.min(100, this.session.clarityScore + 5);
    }

    // Update readiness score based on stage
    const stageReadiness: Record<ConversationStage, number> = {
      initial_assessment: 10,
      surface_exploration: 20,
      deeper_discovery: 35,
      true_motivation: 50,
      action_planning: 75,
      commitment: 90,
    };
    this.session.readinessScore = stageReadiness[this.session.currentStage];
  }

  /**
   * Get current session state
   */
  public getSession(): ConversationSession {
    return this.session;
  }

  /**
   * Generate final analysis and recommendations
   */
  public generateFinalAnalysis(): {
    hiddenMotivations: HiddenMotivation[];
    goalRefinements: GoalRefinement[];
    actionPlan: string[];
  } {
    // Analyze all conversations to extract hidden motivations
    const hiddenMotivations = this.extractHiddenMotivations();

    // Generate goal refinements based on discoveries
    const goalRefinements = this.generateGoalRefinements();

    // Create action plan
    const actionPlan = this.createActionPlan();

    return {
      hiddenMotivations,
      goalRefinements,
      actionPlan,
    };
  }

  private extractHiddenMotivations(): HiddenMotivation[] {
    // This would use more sophisticated NLP in production
    const motivations: HiddenMotivation[] = [];

    this.session.userGoals.forEach(goal => {
      const goalMessages = this.session.messageHistory.filter(m =>
        m.content.toLowerCase().includes(goal.title.toLowerCase())
      );

      if (goalMessages.length >= 3) {
        motivations.push({
          id: uuidv4(),
          statedGoal: goal.title,
          surfaceReason: goal.description,
          deeperReason: 'Security and stability for family',
          trueMotivation: 'Fear of repeating parental financial mistakes',
          emotionalDrivers: ['fear', 'responsibility', 'love'],
          implicationsForGoal: 'Focus on risk management alongside growth',
          suggestedRefinements: ['Add insurance component', 'Create multiple safety nets'],
        });
      }
    });

    return motivations;
  }

  private generateGoalRefinements(): GoalRefinement[] {
    const refinements: GoalRefinement[] = [];

    this.session.userGoals.forEach(goal => {
      const relatedInsights = this.session.insights.filter(i =>
        i.relatedGoals.includes(goal.id)
      );

      if (relatedInsights.length > 0) {
        refinements.push({
          originalGoalId: goal.id,
          originalGoal: goal,
          refinements: [
            {
              field: 'description',
              originalValue: goal.description,
              suggestedValue: `${goal.description} (aligned with personal values of security and growth)`,
              reason: 'Better reflects discovered motivations',
            },
            {
              field: 'alignmentScore',
              originalValue: goal.alignmentScore,
              suggestedValue: Math.min(100, goal.alignmentScore + 20),
              reason: 'Improved understanding of authentic motivations',
            },
          ],
          alignmentImprovement: 20,
          motivationAlignment: ['security', 'growth', 'family'],
        });
      }
    });

    return refinements;
  }

  private createActionPlan(): string[] {
    return [
      'Review and refine goal priorities based on discovered motivations',
      'Add specific milestones that address underlying concerns',
      'Create accountability system for essential goals',
      'Schedule monthly review of progress and alignment',
      'Connect with professionals for specialized guidance',
    ];
  }
}