// hooks/useLazyComponent.ts
'use client';

import { useState, useEffect } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';

/**
 * Hook that returns whether to render a component based on viewport visibility
 * @param rootMargin Distance from viewport to pre-load component
 * @returns [ref, shouldRender] - Ref to attach to container and boolean to control rendering
 */
export function useLazyComponent(rootMargin: string = '200px') {
  const [ref, isVisible] = useIntersectionObserver({ rootMargin });
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    if (isVisible && !shouldRender) {
      setShouldRender(true);
    }
  }, [isVisible, shouldRender]);
  
  return [ref, shouldRender] as const;
}