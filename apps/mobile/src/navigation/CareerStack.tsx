/**
 * Life Navigator - Career Stack Navigator
 *
 * Career development module navigation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CareerStackParamList } from './types';
import { CareerScreen } from '../screens/main/CareerScreen';
import { SkillsScreen } from '../screens/career/SkillsScreen';
import { ResumeScreen } from '../screens/career/ResumeScreen';
import { OpportunitiesScreen } from '../screens/career/OpportunitiesScreen';
import { NetworkingScreen } from '../screens/career/NetworkingScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator<CareerStackParamList>();

export function CareerStack() {
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
        name="CareerOverview"
        component={CareerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Skills"
        component={SkillsScreen}
        options={{ title: 'Skills Development' }}
      />
      <Stack.Screen
        name="Resume"
        component={ResumeScreen}
        options={{ title: 'Resume Builder' }}
      />
      <Stack.Screen
        name="Opportunities"
        component={OpportunitiesScreen}
        options={{ title: 'Job Opportunities' }}
      />
      <Stack.Screen
        name="Networking"
        component={NetworkingScreen}
        options={{ title: 'Professional Network' }}
      />
    </Stack.Navigator>
  );
}
