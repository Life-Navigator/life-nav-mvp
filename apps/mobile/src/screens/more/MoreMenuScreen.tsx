/**
 * Life Navigator - More Menu Screen
 *
 * Hub for additional features and settings
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../../navigation/types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';

type NavigationProp = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItem {
  title: string;
  subtitle: string;
  screen: keyof MoreStackParamList;
  icon: string;
  color: string;
}

export function MoreMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  const menuItems: MenuItem[] = [
    {
      title: 'Goals',
      subtitle: 'Track your life goals',
      screen: 'Goals',
      icon: '\uD83C\uDFAF',
      color: colors.primary.blue,
    },
    {
      title: 'Calendar',
      subtitle: 'View all events',
      screen: 'Calendar',
      icon: '\uD83D\uDCC5',
      color: colors.semantic.info,
    },
    {
      title: 'Insights',
      subtitle: 'Analytics and reports',
      screen: 'Insights',
      icon: '\uD83D\uDCC8',
      color: colors.domains.career,
    },
    {
      title: 'Roadmap',
      subtitle: 'Life planning roadmap',
      screen: 'Roadmap',
      icon: '\uD83D\uDEE3\uFE0F',
      color: colors.semantic.success,
    },
    {
      title: 'Integrations',
      subtitle: 'Connected apps',
      screen: 'Integrations',
      icon: '\uD83D\uDD17',
      color: colors.semantic.warning,
    },
    {
      title: 'Profile',
      subtitle: 'Manage your profile',
      screen: 'Profile',
      icon: '\uD83D\uDC64',
      color: colors.gray[600],
    },
    {
      title: 'Settings',
      subtitle: 'App preferences',
      screen: 'Settings',
      icon: '\u2699\uFE0F',
      color: colors.gray[700],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>
          Additional features and settings
        </Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>\u203A</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  headerSubtitle: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  menuContainer: {
    padding: spacing[4],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  icon: {
    fontSize: 24,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    ...textStyles.h5,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  menuSubtitle: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  chevron: {
    ...textStyles.h4,
    color: colors.gray[400],
  },
});
