'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useEffect } from 'react';

/**
 * Analytics component for tracking page views and custom events
 * Uses a minimal implementation that can be extended with your preferred analytics provider
 */
export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views
  useEffect(() => {
    if (!pathname) return;

    // Construct URL from pathname and search params
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Track page view
    trackPageView(url);
  }, [pathname, searchParams]);

  return (
    <>
      {/* Replace with your actual analytics script if needed */}
      {process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ANALYTICS_ID && (
        <Script
          id="analytics-script"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_ANALYTICS_ID}`}
        />
      )}
    </>
  );
}

/**
 * Helper function to track page views
 * This implementation logs to console in development and sends to analytics in production
 */
function trackPageView(url: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📊 Page view: ${url}`);
    return;
  }

  try {
    // Replace with your analytics provider's implementation
    if (window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_ANALYTICS_ID as string, {
        page_path: url,
      });
    }
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
}

/**
 * Helper function to track custom events
 * Can be imported and used throughout the application
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📊 Event: ${eventName}`, properties);
    return;
  }

  try {
    // Replace with your analytics provider's implementation
    if (window.gtag) {
      window.gtag('event', eventName, properties);
    }
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

// Add TypeScript interface for window with gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event',
      targetId: string,
      options?: Record<string, any>
    ) => void;
  }
}