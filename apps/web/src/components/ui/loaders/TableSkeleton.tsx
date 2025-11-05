// components/ui/loaders/TableSkeleton.tsx
import React from 'react';

interface TableSkeletonProps {
  className?: string;
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  className = '',
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className={`rounded-lg bg-white p-4 shadow-md ${className}`}>
      {/* Table title */}
      <div className="h-7 bg-gray-200 rounded-md w-1/3 mb-4 animate-pulse"></div>
      
      <div className="w-full">
        {/* Table header */}
        <div className="flex mb-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div 
              key={`header-${i}`} 
              className="h-8 bg-gray-300 rounded-md mr-2 animate-pulse table-cell"
              data-columns={columns}
            ></div>
          ))}
        </div>
        
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex mb-2">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={`cell-${rowIndex}-${colIndex}`} 
                className="h-6 bg-gray-200 rounded-md mr-2 animate-pulse table-cell"
                data-columns={columns}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};