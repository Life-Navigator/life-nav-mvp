/**
 * Life Navigator - More Stack Navigator
 *
 * Additional features and settings navigation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { MoreMenuScreen } from '../screens/more/MoreMenuScreen';
import { GoalsScreen } from '../screens/main/GoalsScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { CalendarScreen } from '../screens/more/CalendarScreen';
import { InsightsScreen } from '../screens/more/InsightsScreen';
import { RoadmapScreen } from '../screens/more/RoadmapScreen';
import { IntegrationsScreen } from '../screens/more/IntegrationsScreen';
import { SettingsScreen } from '../screens/more/SettingsScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.light.primary,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.gray[900],
        },
        headerTintColor: colors.primary.blue,
      }}
    >
      <Stack.Screen
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: 'My Goals' }}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
      <Stack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ title: 'Insights & Analytics' }}
      />
      <Stack.Screen
        name="Roadmap"
        component={RoadmapScreen}
        options={{ title: 'Life Roadmap' }}
      />
      <Stack.Screen
        name="Integrations"
        component={IntegrationsScreen}
        options={{ title: 'Integrations' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}
