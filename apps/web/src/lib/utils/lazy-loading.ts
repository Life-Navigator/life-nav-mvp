// lib/utils/lazy-loading.ts
import dynamic from 'next/dynamic';
import { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { DynamicOptionsLoadingProps } from 'next/dynamic';

interface LazyLoadOptions {
  ssr?: boolean;
  loading?: (props: DynamicOptionsLoadingProps) => ReactNode;
}

/**
 * Utility function for lazily loading components with consistent options
 * @param factory Factory function that imports the component
 * @param options Configuration options for lazy loading
 * @returns Dynamically imported component
 */
export function lazyLoad<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): LazyExoticComponent<T> {
  return dynamic(factory, {
    ssr: options.ssr ?? true,
    loading: options.loading,
  }) as LazyExoticComponent<T>;
}