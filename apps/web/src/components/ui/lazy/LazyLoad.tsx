// components/ui/lazy/LazyLoad.tsx
'use client';

import React, { ReactNode, Suspense } from 'react';
import { useLazyComponent } from '@/hooks/useLazyComponent';

interface LazyLoadProps {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  className?: string;
}

/**
 * Component that lazily renders its children when they come into view
 */
export const LazyLoad: React.FC<LazyLoadProps> = ({
  children,
  fallback,
  rootMargin = '200px',
  className = '',
}) => {
  const [containerRef, shouldRender] = useLazyComponent(rootMargin);
  
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={className}>
      {shouldRender ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
};