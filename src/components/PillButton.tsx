import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    return icon === 'priority' ? 'star' : 'lock-closed';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        active && styles.containerActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Ionicons 
          name={getIconName()} 
          size={16} 
          color={active ? colors.background : colors.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.text, active && styles.textActive]}>
          {title}
        </Text>
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    marginTop: 1,
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

