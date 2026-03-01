import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { Tile } from '../types/tile';

interface ContextMenuProps {
  visible: boolean;
  tile: Tile | null;
  position: { x: number; y: number };
  onEdit: () => void;
  onDelete: () => void;
  onTogglePriority: () => void;
  onToggleSecure: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  tile,
  position,
  onEdit,
  onDelete,
  onTogglePriority,
  onToggleSecure,
  onClose,
}) => {
  if (!tile) return null;

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const menuWidth = 200;
  const menuHeight = 200;

  // Calculate menu position (keep it within screen bounds)
  let left = position.x;
  let top = position.y;

  if (left + menuWidth > screenWidth) {
    left = screenWidth - menuWidth - 20;
  }
  if (top + menuHeight > screenHeight) {
    top = screenHeight - menuHeight - 20;
  }

  const menuOptions = [
    { label: 'Edit', icon: 'create-outline', action: onEdit },
    {
      label: tile.isPriority ? 'Unpin' : 'Pin',
      icon: tile.isPriority ? 'star' : 'star-outline',
      action: onTogglePriority,
    },
    {
      label: tile.isSecure ? 'Unsecure' : 'Secure',
      icon: tile.isSecure ? 'lock-open-outline' : 'lock-closed',
      action: onToggleSecure,
    },
    { label: 'Delete', icon: 'trash-outline', action: onDelete, destructive: true },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.menu, { left, top }]}>
          {menuOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index === menuOptions.length - 1 && styles.lastMenuItem,
                option.destructive && styles.destructiveItem,
              ]}
              onPress={() => {
                option.action();
              }}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityHint={
                option.label === 'Edit' 
            ? 'Tap to edit this nugget'
            : option.label === 'Delete'
            ? 'Tap to delete this nugget'
            : option.label.includes('Pin')
            ? `Tap to ${option.label.toLowerCase()} this nugget`
            : option.label.includes('Secure')
            ? `Tap to ${option.label.toLowerCase()} this nugget`
                  : undefined
              }
            >
              <View style={styles.menuItemContent}>
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={option.destructive ? colors.destructive : colors.foreground}
                  style={styles.menuIcon}
                  accessibilityElementsHidden={true}
                />
                <Text
                  style={[
                    styles.menuText,
                    option.destructive && styles.destructiveText,
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    minWidth: 180,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  destructiveItem: {
    backgroundColor: colors.destructive + '10',
  },
  menuText: {
    fontSize: 17,
    color: colors.foreground,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.1,
  },
  destructiveText: {
    color: colors.destructive,
  },
});

