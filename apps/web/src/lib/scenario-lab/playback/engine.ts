/**
 * Timeline Playback Engine
 * =============================================================================
 * War-game style simulation engine that plays through scenarios over time
 *
 * Inspired by military simulations:
 * - Test multiple strategies before committing
 * - Identify vulnerabilities and risks
 * - Practice decision-making under realistic conditions
 * - Learn from simulated failures without real consequences
 */

import type {
  TimelinePlaybackConfig,
  TimelineState,
  TimelineSimulationResult,
  PathData,
  TimePoint,
  LifeEvent,
  Milestone,
  TimelineNotification,
  DecisionPoint,
  PlaybackState,
} from '../types';

export class TimelinePlaybackEngine {
  private config: TimelinePlaybackConfig;
  private state: TimelineState;
  private simulationData: TimelineSimulationResult;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;

  constructor(
    config: TimelinePlaybackConfig,
    simulationData: TimelineSimulationResult
  ) {
    this.config = config;
    this.simulationData = simulationData;

    const totalMonths = this.calculateMonthsDifference(
      config.startDate,
      config.endDate
    );

    this.state = {
      currentDate: config.startDate,
      progress: 0,
      playbackState: 'idle',
      elapsedMonths: 0,
      totalMonths,
    };
  }

  // ============================================================================
  // PUBLIC API - Playback Controls
  // ============================================================================

  /**
   * Start or resume playback
   */
  play(): void {
    if (this.state.playbackState === 'completed') {
      this.reset();
    }

    this.state.playbackState = 'playing';
    this.lastUpdateTime = performance.now();
    this.emit('stateChange', this.state);

    if (this.config.autoAdvance) {
      this.startAnimationLoop();
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.state.playbackState = 'paused';
    this.emit('stateChange', this.state);

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Stop and reset to beginning
   */
  reset(): void {
    this.state = {
      currentDate: this.config.startDate,
      progress: 0,
      playbackState: 'idle',
      elapsedMonths: 0,
      totalMonths: this.state.totalMonths,
    };

    this.emit('stateChange', this.state);
    this.emit('reset', null);
  }

  /**
   * Jump to specific progress point (0-100)
   */
  seekTo(progress: number): void {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const monthsToSeek = Math.floor(
      (clampedProgress / 100) * this.state.totalMonths
    );

    this.state.elapsedMonths = monthsToSeek;
    this.state.progress = clampedProgress;
    this.state.currentDate = this.addMonths(
      this.config.startDate,
      monthsToSeek
    );

    this.processEventsUpToDate(this.state.currentDate);
    this.emit('seek', { progress: clampedProgress, date: this.state.currentDate });
    this.emit('stateChange', this.state);
  }

  /**
   * Advance by one time step
   */
  step(): void {
    const stepMonths = this.getStepMonths();
    this.advanceTime(stepMonths);
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: TimelinePlaybackConfig['playbackSpeed']): void {
    this.config.playbackSpeed = speed;
    this.emit('speedChange', speed);
  }

  // ============================================================================
  // ANIMATION LOOP - War Game Turn System
  // ============================================================================

  private startAnimationLoop(): void {
    const update = (timestamp: number) => {
      if (this.state.playbackState !== 'playing') {
        return;
      }

      const deltaTime = timestamp - this.lastUpdateTime;
      const speedMultiplier = this.getSpeedMultiplier();
      const realTimeMsPerMonth = 1000 / speedMultiplier; // Base: 1 second per month

      if (deltaTime >= realTimeMsPerMonth) {
        const monthsToAdvance = Math.floor(deltaTime / realTimeMsPerMonth);
        this.advanceTime(monthsToAdvance);
        this.lastUpdateTime = timestamp;
      }

      // Check if simulation is complete
      if (this.state.progress >= 100) {
        this.complete();
        return;
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  private advanceTime(months: number): void {
    const newElapsedMonths = Math.min(
      this.state.elapsedMonths + months,
      this.state.totalMonths
    );

    this.state.elapsedMonths = newElapsedMonths;
    this.state.progress = (newElapsedMonths / this.state.totalMonths) * 100;
    this.state.currentDate = this.addMonths(
      this.config.startDate,
      newElapsedMonths
    );

    // Check for events, milestones, decision points at this time
    this.processEventsUpToDate(this.state.currentDate);

    // Emit current state for all paths
    const currentData = this.getCurrentTimelineData();
    this.emit('tick', currentData);
    this.emit('stateChange', this.state);

    if (this.state.progress >= 100) {
      this.complete();
    }
  }

  private complete(): void {
    this.state.playbackState = 'completed';
    this.pause();

    const finalData = this.getFinalOutcome();
    this.emit('complete', finalData);
    this.emit('stateChange', this.state);
  }

  // ============================================================================
  // EVENT PROCESSING - Intelligence & Risk Detection
  // ============================================================================

  private processEventsUpToDate(targetDate: Date): void {
    // Find events that occur at or before target date
    const relevantEvents = this.simulationData.events.filter(
      (event) => event.date <= targetDate
    );

    // Find milestones achieved
    const achievedMilestones = this.simulationData.milestones.filter(
      (milestone) => milestone.date <= targetDate && !milestone.achieved
    );

    // Check for decision points
    const activeDecisionPoints = this.simulationData.decisionPoints?.filter(
      (dp) => dp.date <= targetDate
    );

    // Emit events
    relevantEvents.forEach((event) => {
      if (this.config.enableNotifications) {
        this.emitNotification(event);
      }

      if (this.config.pauseOnEvents && event.severity === 'negative') {
        this.pause();
      }
    });

    // Emit milestones
    achievedMilestones.forEach((milestone) => {
      milestone.achieved = true;

      if (this.config.enableNotifications) {
        this.emitMilestoneNotification(milestone);
      }
    });

    // Handle decision points
    if (activeDecisionPoints && activeDecisionPoints.length > 0) {
      this.pause();
      this.emit('decisionRequired', activeDecisionPoints[0]);
    }
  }

  private emitNotification(event: LifeEvent): void {
    const notification: TimelineNotification = {
      id: event.id,
      timestamp: event.date,
      type: 'event',
      severity: event.severity,
      title: event.title,
      message: event.description,
      icon: event.icon,
      autoClose: event.severity !== 'negative',
      duration: 5000,
    };

    this.emit('notification', notification);
  }

  private emitMilestoneNotification(milestone: Milestone): void {
    const notification: TimelineNotification = {
      id: milestone.id,
      timestamp: milestone.date,
      type: 'milestone',
      severity: 'positive',
      title: milestone.title,
      message: milestone.description,
      icon: milestone.celebration?.icon || '🎯',
      autoClose: false,
    };

    this.emit('notification', notification);
  }

  // ============================================================================
  // DATA EXTRACTION - Current State Analysis
  // ============================================================================

  private getCurrentTimelineData() {
    const pathsAtCurrentTime = this.simulationData.paths.map((path) => ({
      ...path,
      currentPoint: this.getTimePointAtDate(path, this.state.currentDate),
    }));

    return {
      date: this.state.currentDate,
      progress: this.state.progress,
      paths: pathsAtCurrentTime,
      elapsedMonths: this.state.elapsedMonths,
    };
  }

  private getTimePointAtDate(path: PathData, targetDate: Date): TimePoint | null {
    // Find the closest time point at or before target date
    for (let i = path.timePoints.length - 1; i >= 0; i--) {
      if (path.timePoints[i].date <= targetDate) {
        return path.timePoints[i];
      }
    }

    return path.timePoints[0] || null;
  }

  private getFinalOutcome() {
    return {
      ...this.simulationData.finalOutcome,
      totalMonths: this.state.totalMonths,
      paths: this.simulationData.paths,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getSpeedMultiplier(): number {
    switch (this.config.playbackSpeed) {
      case 'slow':
        return 0.5; // 2 seconds per month
      case 'normal':
        return 1; // 1 second per month
      case 'fast':
        return 3; // 0.33 seconds per month
      case 'instant':
        return 100; // Nearly instant
      default:
        return 1;
    }
  }

  private getStepMonths(): number {
    switch (this.config.stepSize) {
      case 'month':
        return 1;
      case 'quarter':
        return 3;
      case 'year':
        return 12;
      default:
        return 1;
    }
  }

  private calculateMonthsDifference(start: Date, end: Date): number {
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  // ============================================================================
  // EVENT SYSTEM - Pub/Sub for UI Updates
  // ============================================================================

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getState(): TimelineState {
    return { ...this.state };
  }

  getConfig(): TimelinePlaybackConfig {
    return { ...this.config };
  }

  getSimulationData(): TimelineSimulationResult {
    return this.simulationData;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.listeners.clear();
  }
}

/**
 * Factory function to create timeline playback engine
 */
export function createTimelinePlayback(
  config: TimelinePlaybackConfig,
  simulationData: TimelineSimulationResult
): TimelinePlaybackEngine {
  return new TimelinePlaybackEngine(config, simulationData);
}
