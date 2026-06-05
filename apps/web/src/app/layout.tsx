import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import './globals.css';
import './dark-mode.css'; // Import the dark mode styles
import { Providers } from '@/providers';
import { Analytics } from '@/components/analytics/Analytics';
import { Toaster } from '@/components/ui/toaster';
import { getThemeScript } from './theme-script';
import { ProductionErrorBoundary } from '@/components/error-boundary/ProductionErrorBoundary';
import ChatSidebar from '@/components/chat/ChatSidebar';

// Font configuration
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Editorial display serif — the single highest-leverage signal that this is a
// premium, considered product and not a generic SaaS template. Used only on the
// largest headlines and pull-quotes via the `.font-display` class.
const newsreader = Newsreader({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

// Metadata
export const metadata: Metadata = {
  title: 'LifeNavigator — Decision Intelligence for Life',
  description:
    'LifeNavigator connects your finances, career, education, health, and goals into one trusted AI system — helping you make better decisions grounded in your own data.',
  keywords: [
    'decision intelligence',
    'AI life planning',
    'financial planning',
    'career development',
    'education planning',
    'personal AI',
    'grounded AI',
  ],
  authors: [{ name: 'LifeNavigator' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nexlevel-intelligence.com',
    siteName: 'LifeNavigator',
    title: 'LifeNavigator — Decision Intelligence for Life',
    description:
      'Connect your finances, career, education, health, and goals into one trusted AI system — decisions grounded in your own data.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Life Navigator',
      },
    ],
  },
};

// Viewport
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Root layout
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeScript() }} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/force-dark-mode.js" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <ProductionErrorBoundary level="page" maxRetries={3}>
            {children}
            <Toaster />
            <ChatSidebar />
          </ProductionErrorBoundary>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
