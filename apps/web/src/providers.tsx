'use client';

import React, { useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ToastProvider } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}