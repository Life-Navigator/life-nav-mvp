/**
 * Life Navigator - Main Tab Navigator
 *
 * Bottom tab navigation for main app screens
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { HealthStack } from './HealthStack';
import { FinanceStack } from './FinanceStack';
import { CareerStack } from './CareerStack';
import { EducationStack } from './EducationStack';
import { FamilyScreen } from '../screens/family/FamilyScreen';
import { MoreStack } from './MoreStack';
import { colors } from '../utils/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary.blue,
        tabBarInactiveTintColor: colors.gray[500],
        tabBarStyle: {
          backgroundColor: colors.light.primary,
          borderTopColor: colors.gray[200],
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: colors.light.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.gray[900],
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          title: 'Life Navigator',
        }}
      />
      <Tab.Screen
        name="Health"
        component={HealthStack}
        options={{
          tabBarLabel: 'Health',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceStack}
        options={{
          tabBarLabel: 'Finance',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Career"
        component={CareerStack}
        options={{
          tabBarLabel: 'Career',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Education"
        component={EducationStack}
        options={{
          tabBarLabel: 'Education',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Family"
        component={FamilyScreen}
        options={{
          tabBarLabel: 'Family',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}
