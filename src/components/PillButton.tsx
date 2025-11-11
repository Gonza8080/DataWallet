import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface PillButtonProps {
  title: string;
  icon: 'priority' | 'secure';
  active: boolean;
  onPress: () => void;
}

export const PillButton: React.FC<PillButtonProps> = ({
  title,
  icon,
  active,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        active && styles.containerActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.textActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  textActive: {
    color: colors.background,
  },
});

