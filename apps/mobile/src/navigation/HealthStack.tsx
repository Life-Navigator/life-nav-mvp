/**
 * Life Navigator - Health Stack Navigator
 *
 * Healthcare module navigation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HealthStackParamList } from './types';
import { HealthScreen } from '../screens/main/HealthScreen';
import { AppointmentsScreen } from '../screens/health/AppointmentsScreen';
import { RecordsScreen } from '../screens/health/RecordsScreen';
import { DocumentsScreen } from '../screens/health/DocumentsScreen';
import { WellnessScreen } from '../screens/health/WellnessScreen';
import { PreventiveScreen } from '../screens/health/PreventiveScreen';
import { WearableIntegrationsScreen } from '../screens/health/WearableIntegrationsScreen';
import { colors } from '../utils/colors';

const Stack = createNativeStackNavigator<HealthStackParamList>();

export function HealthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
        },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen
        name="HealthOverview"
        component={HealthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <Stack.Screen
        name="Records"
        component={RecordsScreen}
        options={{ title: 'Medical Records' }}
      />
      <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ title: 'Documents' }}
      />
      <Stack.Screen
        name="Wellness"
        component={WellnessScreen}
        options={{ title: 'Wellness Tracker' }}
      />
      <Stack.Screen
        name="Preventive"
        component={PreventiveScreen}
        options={{ title: 'Preventive Care' }}
      />
      <Stack.Screen
        name="WearableIntegrations"
        component={WearableIntegrationsScreen}
        options={{ title: 'Wearable Devices' }}
      />
    </Stack.Navigator>
  );
}
