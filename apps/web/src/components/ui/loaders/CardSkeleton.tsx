// components/ui/loaders/CardSkeleton.tsx
import React from 'react';

interface CardSkeletonProps {
  className?: string;
  lines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  className = '',
  lines = 3,
}) => {
  return (
    <div className={`rounded-lg bg-white p-4 shadow-md ${className}`}>
      {/* Title skeleton */}
      <div className="h-7 bg-gray-200 rounded-md w-3/4 mb-4 animate-pulse"></div>
      
      {/* Content skeleton */}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i} 
            className={`h-4 bg-gray-200 rounded-md animate-pulse ${
              i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-5/6' : 'w-4/6'
            }`}
          ></div>
        ))}
      </div>
      
      {/* Button/action skeleton */}
      <div className="mt-4 h-8 bg-gray-200 rounded-md w-1/3 animate-pulse"></div>
    </div>
  );
};