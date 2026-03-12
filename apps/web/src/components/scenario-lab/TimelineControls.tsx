'use client';

/**
 * Timeline Controls Component
 * =============================================================================
 * War-game style controls for timeline playback
 * Play, pause, speed control, and timeline scrubber
 */

import { useState, useEffect } from 'react';
import type { TimelineState, PlaybackSpeed } from '@/lib/scenario-lab/types';

interface TimelineControlsProps {
  state: TimelineState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onStep: () => void;
}

export default function TimelineControls({
  state,
  onPlay,
  onPause,
  onReset,
  onSeek,
  onSpeedChange,
  onStep,
}: TimelineControlsProps) {
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
  const [isDragging, setIsDragging] = useState(false);

  const handleSpeedChange = (newSpeed: PlaybackSpeed) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    onSeek(progress);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatElapsedTime = () => {
    const years = Math.floor(state.elapsedMonths / 12);
    const months = state.elapsedMonths % 12;

    if (years === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }

    if (months === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    }

    return `${years}y ${months}m`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      {/* Status Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              state.playbackState === 'playing'
                ? 'bg-green-500 animate-pulse'
                : state.playbackState === 'paused'
                ? 'bg-yellow-500'
                : state.playbackState === 'completed'
                ? 'bg-blue-500'
                : 'bg-gray-400'
            }`}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {state.playbackState === 'playing'
              ? 'Simulating...'
              : state.playbackState === 'paused'
              ? 'Paused'
              : state.playbackState === 'completed'
              ? 'Complete'
              : 'Ready'}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(state.currentDate)} • {formatElapsedTime()}
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="mb-4">
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">
              Progress
            </div>
            <div className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">
              {Math.round(state.progress)}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={state.progress}
            onChange={handleSeek}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer"
          />
        </div>

        {/* Time Labels */}
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Start</span>
          <span>
            {state.elapsedMonths} / {state.totalMonths} months
          </span>
          <span>End</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between">
        {/* Main Controls */}
        <div className="flex items-center space-x-2">
          {/* Reset */}
          <button
            onClick={onReset}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="Reset to beginning"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Step Backward (if paused) */}
          {state.playbackState === 'paused' && (
            <button
              onClick={() => onSeek(Math.max(0, state.progress - 1))}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              title="Step backward"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Play/Pause */}
          {state.playbackState === 'playing' ? (
            <button
              onClick={onPause}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg"
              title="Pause"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="p-3 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg"
              title="Play"
              disabled={state.playbackState === 'completed'}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {/* Step Forward (if paused) */}
          {state.playbackState === 'paused' && (
            <button
              onClick={onStep}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              title="Step forward"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Speed Control */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">Speed:</span>
          <div className="flex space-x-1">
            {(['slow', 'normal', 'fast', 'instant'] as PlaybackSpeed[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'slow' && '0.5×'}
                {s === 'normal' && '1×'}
                {s === 'fast' && '3×'}
                {s === 'instant' && '⚡'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* War Game Info */}
      {state.playbackState !== 'idle' && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                War Game Simulation Active
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Testing your financial strategy across multiple scenarios. Watch for critical events and
                decision points.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
