'use client';

import React, { useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ToastProvider } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { createPersistentQueryClient } from '@/lib/cache/persistQueryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create the client in a state to ensure it's only created once on the client side
  // This is important for Next.js to avoid hydration mismatches
  const [queryClient] = useState(() => createPersistentQueryClient());

  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
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
    </SessionProvider>
  );
}