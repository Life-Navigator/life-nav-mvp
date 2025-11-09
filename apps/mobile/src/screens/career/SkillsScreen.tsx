/**
 * Life Navigator - Skills Screen
 *
 * Skills matrix and development tracking
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from '../../hooks/useCareer';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Skill } from '../../types';

export function SkillsScreen() {
  const { data: skills, isLoading, error } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Technical', 'Soft Skills', 'Languages', 'Tools', 'Other'];

  const filteredSkills = skills?.filter(
    (skill) => selectedCategory === 'All' || skill.category === selectedCategory
  );

  const renderStars = (proficiency: number, onPress?: (rating: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onPress?.(star)}
            disabled={!onPress}
          >
            <Text style={styles.star}>
              {star <= proficiency ? '\u2605' : '\u2606'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleAddSkill = () => {
    setEditingSkill(null);
    setModalVisible(true);
  };

  const handleEditSkill = (skill: Skill) => {
    setEditingSkill(skill);
    setModalVisible(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.career} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load skills</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Skills Matrix</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddSkill}>
          <Text style={styles.addButtonText}>+ Add Skill</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Skills List */}
      <ScrollView style={styles.skillsList}>
        {filteredSkills?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No skills added yet</Text>
            <Text style={styles.emptySubtext}>
              Start building your skills matrix by adding your first skill
            </Text>
          </View>
        ) : (
          filteredSkills?.map((skill) => (
            <TouchableOpacity
              key={skill.id}
              style={styles.skillCard}
              onPress={() => handleEditSkill(skill)}
            >
              <View style={styles.skillHeader}>
                <View style={styles.skillInfo}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Text style={styles.skillCategory}>{skill.category}</Text>
                </View>
                {skill.verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>

              {/* Proficiency */}
              <View style={styles.proficiencyContainer}>
                <Text style={styles.proficiencyLabel}>Proficiency:</Text>
                {renderStars(skill.proficiency)}
                <Text style={styles.levelText}>{skill.level}</Text>
              </View>

              {/* Endorsements */}
              {skill.endorsements > 0 && (
                <Text style={styles.endorsements}>
                  {skill.endorsements} endorsement{skill.endorsements !== 1 ? 's' : ''}
                </Text>
              )}

              {/* Last Used */}
              <Text style={styles.lastUsed}>
                Last used: {new Date(skill.lastUsed).toLocaleDateString()}
              </Text>

              {/* AI Recommendations */}
              {skill.aiRecommendations && skill.aiRecommendations.length > 0 && (
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.recommendationsTitle}>AI Recommendations:</Text>
                  {skill.aiRecommendations.map((rec, index) => (
                    <Text key={index} style={styles.recommendationText}>
                      • {rec}
                    </Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    padding: spacing[6],
  },
  errorText: {
    ...textStyles.body,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  addButton: {
    backgroundColor: colors.domains.career,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  categoryFilter: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  categoryChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  categoryChipActive: {
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
  },
  categoryChipText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  categoryChipTextActive: {
    color: colors.text.light.inverse,
  },
  skillsList: {
    flex: 1,
    padding: spacing[4],
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyText: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  emptySubtext: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  skillCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  skillCategory: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  verifiedBadge: {
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  verifiedText: {
    ...textStyles.labelSmall,
    color: colors.text.light.inverse,
  },
  proficiencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  proficiencyLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginRight: spacing[2],
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: spacing[2],
  },
  star: {
    fontSize: 20,
    color: colors.charts.yellow,
    marginRight: spacing[1],
  },
  levelText: {
    ...textStyles.labelSmall,
    color: colors.text.light.tertiary,
    textTransform: 'capitalize',
  },
  endorsements: {
    ...textStyles.bodySmall,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  lastUsed: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  recommendationsContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: borderRadius.md,
  },
  recommendationsTitle: {
    ...textStyles.label,
    color: colors.domains.career,
    marginBottom: spacing[2],
  },
  recommendationText: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
});

export default SkillsScreen;
