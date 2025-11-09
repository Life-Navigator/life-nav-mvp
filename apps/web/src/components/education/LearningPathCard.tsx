'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, TrendingUp, Award, ChevronRight } from 'lucide-react';

interface LearningPathCardProps {
  path: {
    id: string;
    title: string;
    description?: string;
    path_type: string;
    difficulty_level?: string;
    target_role?: string;
    progress_percentage: number;
    courses_completed: number;
    total_courses: number;
    estimated_months?: number;
    skills_to_master?: string[];
    color?: string;
    icon?: string;
  };
  onViewDetails?: () => void;
}

export function LearningPathCard({ path, onViewDetails }: LearningPathCardProps) {
  const pathTypeColors: Record<string, string> = {
    career_focused: 'bg-purple-100 text-purple-800',
    skill_specific: 'bg-blue-100 text-blue-800',
    certification_prep: 'bg-green-100 text-green-800',
    custom: 'bg-orange-100 text-orange-800',
  };

  const difficultyEmoji: Record<string, string> = {
    beginner: '🌱',
    intermediate: '🚀',
    advanced: '⚡',
    expert: '👑',
  };

  // Calculate progress ring (simplified)
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (path.progress_percentage / 100) * circumference;

  return (
    <Card
      className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
      onClick={onViewDetails}
      style={{
        background: path.color
          ? `linear-gradient(135deg, ${path.color}10 0%, ${path.color}05 100%)`
          : undefined,
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          {/* Progress Ring */}
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={path.color || 'currentColor'}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-primary transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{path.progress_percentage}%</span>
              <span className="text-xs text-muted-foreground">Complete</span>
            </div>
          </div>

          {/* Title and Description */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg line-clamp-2 mb-2">{path.title}</h3>
            {path.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{path.description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className={pathTypeColors[path.path_type] || 'bg-gray-100'}>
            {path.path_type.replace('_', ' ')}
          </Badge>
          {path.difficulty_level && (
            <Badge variant="outline">
              {difficultyEmoji[path.difficulty_level]} {path.difficulty_level}
            </Badge>
          )}
        </div>

        {/* Target Role */}
        {path.target_role && (
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-medium">{path.target_role}</span>
          </div>
        )}

        {/* Course Progress */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {path.courses_completed} / {path.total_courses} courses
            </span>
          </div>
          {path.estimated_months && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {path.estimated_months}mo
            </div>
          )}
        </div>

        {/* Skills */}
        {path.skills_to_master && path.skills_to_master.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Skills to Master</p>
            <div className="flex flex-wrap gap-1">
              {path.skills_to_master.slice(0, 4).map((skill, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {path.skills_to_master.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{path.skills_to_master.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={path.progress_percentage} className="h-2" />
        </div>

        {/* View Details Button */}
        <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
          View Learning Path
          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
