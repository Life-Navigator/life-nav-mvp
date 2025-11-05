// components/ui/loaders/ChartSkeleton.tsx
import React from 'react';

interface ChartSkeletonProps {
  className?: string;
  height?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  className = '',
  height = '240px',
}) => {
  return (
    <div className={`rounded-lg bg-white p-4 shadow-md ${className}`}>
      {/* Chart title */}
      <div className="h-6 bg-gray-200 rounded-md w-1/3 mb-4 animate-pulse"></div>
      
      {/* Chart area */}
      <div
        className="bg-gray-200 rounded-md w-full animate-pulse chart-area"
        style={{ '--chart-height': height } as React.CSSProperties}
      ></div>
      
      {/* Chart legend */}
      <div className="flex justify-between mt-4">
        <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
      </div>
    </div>
  );
};