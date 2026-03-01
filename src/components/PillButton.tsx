import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface PillButtonProps {
  title: string;
  icon?: 'priority' | 'secure';
  active: boolean;
  onPress: () => void;
  destructive?: boolean;
}

export const PillButton: React.FC<PillButtonProps> = ({
  title,
  icon,
  active,
  onPress,
  destructive = false,
}) => {
  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    // Use filled icons when active, outline when inactive
    if (icon === 'priority') {
      return active ? 'star' : 'star-outline';
    } else {
      // lock-closed is filled, lock-open-outline is outline (closest we have)
      return active ? 'lock-closed' : 'lock-open-outline';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        active && !destructive && styles.containerActive,
        active && destructive && styles.containerDestructive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole={icon ? "togglebutton" : "button"}
      accessibilityLabel={icon ? `${title} ${icon === 'priority' ? 'priority' : 'secure'}` : title}
      accessibilityHint={icon ? `Tap to ${active ? 'disable' : 'enable'} ${title.toLowerCase()}` : undefined}
      accessibilityState={icon ? {
        checked: active
      } : undefined}
    >
      <View style={styles.content}>
        {icon && (
          <Ionicons 
            name={getIconName()} 
            size={16} 
            color={active 
              ? '#FFFFFF'  // White star or white lock when active
              : colors.mutedForeground  // Gray when inactive
            }
            style={styles.icon}
          />
        )}
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
  containerDestructive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textActive: {
    color: colors.foreground,
  },
});

