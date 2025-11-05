// hooks/useIntersectionObserver.ts
'use client';

import { useEffect, useRef, useState, RefObject } from 'react';

interface IntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * Hook that tracks whether an element is visible in the viewport
 * @param options IntersectionObserver configuration options
 * @param onceOnly If true, stops observing once element is visible
 * @returns [ref, isIntersecting] - Ref to attach to element and boolean indicating visibility
 */
export function useIntersectionObserver<T extends Element>(
  options: IntersectionObserverOptions = {},
  onceOnly: boolean = true
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [isIntersecting, setIntersecting] = useState<boolean>(false);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const element = ref.current;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
      
      // If onceOnly is true and the element has been intersected,
      // disconnect the observer to save resources
      if (onceOnly && entry.isIntersecting) {
        observer.disconnect();
      }
    }, {
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
      threshold: options.threshold || 0
    });
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [options.root, options.rootMargin, options.threshold, onceOnly]);
  
  return [ref, isIntersecting];
}