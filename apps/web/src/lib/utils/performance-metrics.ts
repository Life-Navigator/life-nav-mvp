// src/lib/utils/performance-metrics.ts

import { useEffect } from 'react';

// Types for measurement metrics
export interface PerformanceMetrics {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  domLoad: number | null; // DOM Content Loaded
  windowLoad: number | null; // Window Load
  componentMount: number | null; // Component Mount Time
}

/**
 * Records a performance metric to the console and/or analytics
 * 
 * @param metricName The name of the metric
 * @param value The value to record
 */
function recordMetric(metricName: string, value: number): void {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`Performance: ${metricName} = ${value.toFixed(2)}ms`);
  }
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    // This would be replaced with your actual analytics provider
    // Example: analytics.track('performance_metric', { name: metricName, value });
    
    // You can also use the Web Vitals API to report metrics
    // See: https://web.dev/vitals/
  }
}

/**
 * Hook to measure various performance metrics for the component
 * that calls it. Returns a cleanup function.
 * 
 * @returns Cleanup function
 */
export function measurePerformance(): () => void {
  const mountTime = performance.now();
  
  useEffect(() => {
    const metrics: PerformanceMetrics = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      domLoad: null,
      windowLoad: null,
      componentMount: performance.now() - mountTime
    };
    
    // Record component mount time
    if (metrics.componentMount !== null) {
      recordMetric('Component Mount', metrics.componentMount);
    }
    
    // Measure Time to First Byte if available
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const navEntry = navigationEntries[0] as PerformanceNavigationTiming;
      metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      if (metrics.ttfb !== null) {
        recordMetric('TTFB', metrics.ttfb);
      }
    }
    
    // Use Performance Observer to measure Core Web Vitals
    if ('PerformanceObserver' in window) {
      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const fcp = entries[0] as PerformanceEntry;
          metrics.fcp = fcp.startTime;
          recordMetric('FCP', metrics.fcp);
        }
      });
      
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const lcp = entries[entries.length - 1] as PerformanceEntry;
          metrics.lcp = lcp.startTime;
          recordMetric('LCP', metrics.lcp);
        }
      });
      
      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const fid = entries[0] as PerformanceEntry;
          // @ts-ignore - TypeScript doesn't know about processingStart
          metrics.fid = fid.processingStart - fid.startTime;
          recordMetric('FID', metrics.fid);
        }
      });
      
      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((entryList) => {
        let clsValue = 0;
        const entries = entryList.getEntries();
        
        entries.forEach((entry) => {
          // @ts-ignore - TypeScript doesn't know about value
          if (!entry.hadRecentInput) {
            // @ts-ignore - TypeScript doesn't know about value
            clsValue += entry.value;
          }
        });
        
        metrics.cls = clsValue;
        recordMetric('CLS', metrics.cls * 1000); // Convert to milliseconds for consistency
      });
      
      // Start observing
      try {
        fcpObserver.observe({ type: 'paint', buffered: true });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        fidObserver.observe({ type: 'first-input', buffered: true });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        
        // Return cleanup function to disconnect observers
        return () => {
          fcpObserver.disconnect();
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
        };
      } catch (error) {
        console.error('Error setting up performance observers:', error);
      }
    }
    
    return () => {
      // Cleanup function if observers couldn't be created
    };
  }, []);
  
  // Return a cleanup function
  return () => {
    // Additional cleanup if needed
  };
}

/**
 * Measure the performance of a specific function or code block
 * 
 * @param label Label for the measurement
 * @param fn Function to measure
 * @returns Result of the function
 */
export function measureFunctionPerformance<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  recordMetric(label, end - start);
  
  return result;
}

/**
 * Creates a high-resolution timestamp for measuring smaller operations
 * 
 * @returns High-resolution timestamp
 */
export function getHighResTime(): number {
  return performance.now();
}

/**
 * Measures elapsed time since a high-resolution timestamp
 * 
 * @param startTime High-resolution timestamp from getHighResTime()
 * @param label Optional label for logging
 * @returns Elapsed time in milliseconds
 */
export function measureElapsedTime(startTime: number, label?: string): number {
  const endTime = performance.now();
  const elapsed = endTime - startTime;
  
  if (label) {
    recordMetric(label, elapsed);
  }
  
  return elapsed;
}