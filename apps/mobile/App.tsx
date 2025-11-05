/**
 * Life Navigator Mobile App
 *
 * Elite-level React Native application
 * Enterprise-grade architecture with TypeScript
 */

import React, { useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/store/authStore';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { colors } from './src/utils/colors';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { initialize, isInitialized, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize authentication state on app start
    initialize();
  }, []);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? colors.dark.primary : colors.light.primary,
    flex: 1,
  };

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.center]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={backgroundStyle.backgroundColor}
        />
        {/* Add a proper loading component here */}
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaView style={backgroundStyle}>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor={backgroundStyle.backgroundColor}
          />
          {/* For now, just show login screen */}
          {/* In production, this will be replaced with navigation */}
          <LoginScreen />
        </SafeAreaView>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
