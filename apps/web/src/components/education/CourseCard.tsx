'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, CheckCircle2, Clock, TrendingUp, MoreVertical } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    platform: string;
    thumbnail?: string;
    instructor?: string;
    status: string;
    progress_percentage: number;
    estimated_hours?: number;
    hours_completed: number;
    difficulty?: string;
    skills?: string[];
    last_accessed?: string;
    target_completion_date?: string;
  };
  onContinue?: () => void;
  onComplete?: () => void;
}

export function CourseCard({ course, onContinue, onComplete }: CourseCardProps) {
  const platformColors: Record<string, string> = {
    coursera: 'bg-blue-600',
    udemy: 'bg-purple-600',
    linkedin_learning: 'bg-blue-700',
    pluralsight: 'bg-pink-600',
    edx: 'bg-red-600',
    udacity: 'bg-cyan-600',
    other: 'bg-gray-600',
  };

  const statusConfig = {
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: Play },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    not_started: { color: 'bg-gray-100 text-gray-800', icon: Clock },
    paused: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  };

  const config = statusConfig[course.status as keyof typeof statusConfig] || statusConfig.not_started;
  const StatusIcon = config.icon;

  const difficultyColors: Record<string, string> = {
    beginner: 'text-green-600',
    intermediate: 'text-yellow-600',
    advanced: 'text-orange-600',
    expert: 'text-red-600',
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TrendingUp className="w-12 h-12 text-primary/30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={`${platformColors[course.platform] || platformColors.other} text-white border-0`}>
            {course.platform.replace('_', ' ')}
          </Badge>
        </div>
        {course.status === 'completed' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
          </div>
        )}
      </div>

      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2 flex-1">{course.title}</h3>
          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
        {course.instructor && (
          <p className="text-sm text-muted-foreground">by {course.instructor}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{course.progress_percentage}%</span>
          </div>
          <Progress value={course.progress_percentage} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Time Invested</p>
            <p className="font-medium">{Math.round(course.hours_completed)}h</p>
          </div>
          {course.estimated_hours && (
            <div>
              <p className="text-muted-foreground text-xs">Total Duration</p>
              <p className="font-medium">{course.estimated_hours}h</p>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={config.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {course.status.replace('_', ' ')}
          </Badge>
          {course.difficulty && (
            <Badge variant="outline" className={difficultyColors[course.difficulty]}>
              {course.difficulty}
            </Badge>
          )}
        </div>

        {/* Skills */}
        {course.skills && course.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {course.skills.slice(0, 3).map((skill, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {course.skills.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{course.skills.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Last Accessed */}
        {course.last_accessed && (
          <p className="text-xs text-muted-foreground">
            Last accessed {formatDistanceToNow(new Date(course.last_accessed), { addSuffix: true })}
          </p>
        )}

        {/* Action Button */}
        {course.status === 'in_progress' && onContinue && (
          <Button className="w-full" onClick={onContinue}>
            <Play className="w-4 h-4 mr-2" />
            Continue Learning
          </Button>
        )}
        {course.status === 'not_started' && onContinue && (
          <Button variant="outline" className="w-full" onClick={onContinue}>
            <Play className="w-4 h-4 mr-2" />
            Start Course
          </Button>
        )}
        {course.status === 'in_progress' && course.progress_percentage >= 90 && onComplete && (
          <Button variant="outline" className="w-full" onClick={onComplete}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
