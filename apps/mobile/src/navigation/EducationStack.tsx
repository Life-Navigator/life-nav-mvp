/**
 * Life Navigator - Education Stack Navigator
 *
 * Education and learning module navigation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EducationStackParamList } from './types';
import { EducationOverview } from '../screens/education/EducationOverview';
import { CoursesScreen } from '../screens/education/CoursesScreen';
import { CertificationsScreen } from '../screens/education/CertificationsScreen';
import { ProgressScreen } from '../screens/education/ProgressScreen';
import { LearningPathScreen } from '../screens/education/LearningPathScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator<EducationStackParamList>();

export function EducationStack() {
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
        name="EducationOverview"
        component={EducationOverview}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Courses"
        component={CoursesScreen}
        options={{ title: 'My Courses' }}
      />
      <Stack.Screen
        name="Certifications"
        component={CertificationsScreen}
        options={{ title: 'Certifications' }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: 'Learning Progress' }}
      />
      <Stack.Screen
        name="LearningPath"
        component={LearningPathScreen}
        options={{ title: 'Learning Path' }}
      />
    </Stack.Navigator>
  );
}
