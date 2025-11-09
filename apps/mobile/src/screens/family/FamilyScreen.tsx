/**
 * Life Navigator - Family Screen
 *
 * Comprehensive family management with CRUD operations
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  useFamilyMembers,
  useAddFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
  useFamilyEvents,
} from '../../hooks/useFamily';
import { FamilyMember } from '../../types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { formatDate } from '../../utils/formatters';

const RELATIONSHIPS = [
  'Spouse',
  'Partner',
  'Child',
  'Parent',
  'Sibling',
  'Grandparent',
  'Grandchild',
  'Other',
];

export function FamilyScreen() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    birthday: '',
    phone: '',
    email: '',
    emergencyContact: false,
  });

  const { data: members, isLoading, refetch, isRefetching } = useFamilyMembers();
  const { data: events } = useFamilyEvents();
  const addMember = useAddFamilyMember();
  const updateMember = useUpdateFamilyMember();
  const deleteMember = useDeleteFamilyMember();

  const resetForm = () => {
    setFormData({
      name: '',
      relationship: '',
      birthday: '',
      phone: '',
      email: '',
      emergencyContact: false,
    });
    setEditingMember(null);
  };

  const handleAddMember = async () => {
    if (!formData.name || !formData.relationship) {
      Alert.alert('Error', 'Please enter name and relationship');
      return;
    }

    try {
      await addMember.mutateAsync({
        name: formData.name,
        relationship: formData.relationship,
        birthday: formData.birthday || undefined,
        contactInfo: {
          phone: formData.phone || undefined,
          email: formData.email || undefined,
        },
        emergencyContact: formData.emergencyContact,
      });

      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', 'Family member added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add family member');
    }
  };

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      birthday: member.birthday || '',
      phone: member.contactInfo?.phone || '',
      email: member.contactInfo?.email || '',
      emergencyContact: member.emergencyContact || false,
    });
    setShowAddModal(true);
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !formData.name || !formData.relationship) {
      Alert.alert('Error', 'Please enter name and relationship');
      return;
    }

    try {
      await updateMember.mutateAsync({
        id: editingMember.id,
        updates: {
          name: formData.name,
          relationship: formData.relationship,
          birthday: formData.birthday || undefined,
          contactInfo: {
            phone: formData.phone || undefined,
            email: formData.email || undefined,
          },
          emergencyContact: formData.emergencyContact,
        },
      });

      setShowAddModal(false);
      resetForm();
      Alert.alert('Success', 'Family member updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update family member');
    }
  };

  const handleDeleteMember = (member: FamilyMember) => {
    Alert.alert(
      'Delete Family Member',
      `Are you sure you want to remove ${member.name} from your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMember.mutateAsync(member.id);
              Alert.alert('Success', 'Family member removed successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove family member');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUpcomingBirthdays = () => {
    if (!members) return [];

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return members
      .filter((member) => member.birthday)
      .map((member) => {
        const birthday = new Date(member.birthday!);
        const thisYearBirthday = new Date(
          today.getFullYear(),
          birthday.getMonth(),
          birthday.getDate()
        );

        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        return {
          ...member,
          nextBirthday: thisYearBirthday,
          daysUntil: Math.ceil(
            (thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          ),
        };
      })
      .filter((member) => member.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading family...</Text>
      </View>
    );
  }

  const upcomingBirthdays = getUpcomingBirthdays();
  const emergencyContacts = members?.filter((m) => m.emergencyContact) || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family</Text>
        <Button
          title="Add Member"
          onPress={() => setShowAddModal(true)}
          size="small"
          variant="primary"
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members?.length || 0}</Text>
            <Text style={styles.statLabel}>Family Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingBirthdays.length}</Text>
            <Text style={styles.statLabel}>Upcoming Birthdays</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{emergencyContacts.length}</Text>
            <Text style={styles.statLabel}>Emergency Contacts</Text>
          </View>
        </View>

        {/* Upcoming Birthdays */}
        {upcomingBirthdays.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Birthdays</Text>
            {upcomingBirthdays.map((member) => (
              <View key={member.id} style={styles.birthdayCard}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarTextSmall}>{getInitials(member.name)}</Text>
                </View>
                <View style={styles.birthdayInfo}>
                  <Text style={styles.birthdayName}>{member.name}</Text>
                  <Text style={styles.birthdayDate}>
                    {formatDate(member.nextBirthday)} • {member.daysUntil} days
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Family Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Members</Text>

          {!members || members.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No family members yet</Text>
              <Text style={styles.emptyStateText}>
                Add your family members to track birthdays, contact info, and important dates
              </Text>
              <Button
                title="Add Your First Member"
                onPress={() => setShowAddModal(true)}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          ) : (
            members.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberHeader}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.emergencyContact && (
                      <View style={styles.emergencyBadge}>
                        <Text style={styles.emergencyBadgeText}>Emergency</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberRelationship}>{member.relationship}</Text>
                  {member.birthday && (
                    <Text style={styles.memberDetail}>
                      Birthday: {formatDate(member.birthday)}
                    </Text>
                  )}
                  {member.contactInfo?.phone && (
                    <Text style={styles.memberDetail}>
                      Phone: {member.contactInfo.phone}
                    </Text>
                  )}
                  {member.contactInfo?.email && (
                    <Text style={styles.memberDetail}>
                      Email: {member.contactInfo.email}
                    </Text>
                  )}
                </View>
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    onPress={() => handleEditMember(member)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteMember(member)}
                    style={styles.actionButton}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Shared Events */}
        {events && events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Events</Text>
            {events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingMember ? 'Edit Family Member' : 'Add Family Member'}
            </Text>

            <ScrollView style={styles.modalForm}>
              <Input
                label="Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter name"
              />

              <Text style={styles.fieldLabel}>Relationship *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.relationshipChips}
              >
                {RELATIONSHIPS.map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    style={[
                      styles.relationshipChip,
                      formData.relationship === rel && styles.relationshipChipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, relationship: rel })}
                  >
                    <Text
                      style={[
                        styles.relationshipChipText,
                        formData.relationship === rel &&
                          styles.relationshipChipTextSelected,
                      ]}
                    >
                      {rel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input
                label="Birthday"
                value={formData.birthday}
                onChangeText={(text) => setFormData({ ...formData, birthday: text })}
                placeholder="YYYY-MM-DD"
              />

              <Input
                label="Phone"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />

              <Input
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Email address"
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setFormData({
                    ...formData,
                    emergencyContact: !formData.emergencyContact,
                  })
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    formData.emergencyContact && styles.checkboxChecked,
                  ]}
                >
                  {formData.emergencyContact && (
                    <Text style={styles.checkboxCheck}>\u2713</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Emergency Contact</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing[3] }} />
              <Button
                title={editingMember ? 'Update' : 'Add Member'}
                onPress={editingMember ? handleUpdateMember : handleAddMember}
                loading={addMember.isPending || updateMember.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  scrollView: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.primary,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h3,
    color: colors.domains.family,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.gray[600],
    textAlign: 'center',
  },
  section: {
    padding: spacing[4],
    paddingTop: 0,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.domains.family,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarTextSmall: {
    ...textStyles.label,
    color: colors.light.primary,
    fontWeight: '600',
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayName: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  birthdayDate: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  memberCard: {
    flexDirection: 'row',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.domains.family,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    ...textStyles.h4,
    color: colors.light.primary,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  memberName: {
    ...textStyles.h5,
    color: colors.gray[900],
    marginRight: spacing[2],
  },
  emergencyBadge: {
    backgroundColor: colors.semantic.error,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  emergencyBadgeText: {
    ...textStyles.labelSmall,
    color: colors.light.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  memberRelationship: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[2],
  },
  memberDetail: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
    marginBottom: spacing[1],
  },
  memberActions: {
    justifyContent: 'center',
    gap: spacing[2],
  },
  actionButton: {
    padding: spacing[2],
  },
  actionButtonText: {
    ...textStyles.label,
    color: colors.primary.blue,
  },
  deleteText: {
    color: colors.semantic.error,
  },
  eventCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  eventTitle: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  eventDate: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyStateTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.gray[600],
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.light.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    maxHeight: '90%',
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[4],
  },
  modalForm: {
    maxHeight: '70%',
  },
  fieldLabel: {
    ...textStyles.label,
    color: colors.gray[700],
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  relationshipChips: {
    marginBottom: spacing[4],
    maxHeight: 50,
  },
  relationshipChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing[2],
  },
  relationshipChipSelected: {
    backgroundColor: colors.domains.family,
  },
  relationshipChipText: {
    ...textStyles.bodySmall,
    color: colors.gray[700],
  },
  relationshipChipTextSelected: {
    color: colors.light.primary,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.gray[400],
    marginRight: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  checkboxCheck: {
    color: colors.light.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    ...textStyles.body,
    color: colors.gray[900],
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
