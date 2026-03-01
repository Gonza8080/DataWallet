import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

export type SortMode = 'frequency' | 'alphabetical';

interface BottomMenuProps {
  visible: boolean;
  currentSortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onExport: () => void;
  onImport: () => void;
  onClose: () => void;
}

type MenuLevel = 'main' | 'sort';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const BottomMenu: React.FC<BottomMenuProps> = ({
  visible,
  currentSortMode,
  onSortChange,
  onExport,
  onImport,
  onClose,
}) => {
  const [menuLevel, setMenuLevel] = useState<MenuLevel>('main');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMenuLevel('main');
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, overlayAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleSortSelect = (mode: SortMode) => {
    onSortChange(mode);
  };

  const renderMainMenu = () => (
    <>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Menu</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.doneButton}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.separator} />
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setMenuLevel('sort')}
        activeOpacity={0.6}
      >
        <View style={styles.menuItemLeft}>
          <Ionicons name="swap-vertical-outline" size={22} color={colors.foreground} style={styles.menuItemIcon} />
          <Text style={styles.menuItemText}>Sort</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => { handleClose(); setTimeout(onExport, 300); }}
        activeOpacity={0.6}
      >
        <View style={styles.menuItemLeft}>
          <Ionicons name="share-outline" size={22} color={colors.foreground} style={styles.menuItemIcon} />
          <Text style={styles.menuItemText}>Export</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.menuItem, styles.lastMenuItem]}
        onPress={() => { handleClose(); setTimeout(onImport, 300); }}
        activeOpacity={0.6}
      >
        <View style={styles.menuItemLeft}>
          <Ionicons name="download-outline" size={22} color={colors.foreground} style={styles.menuItemIcon} />
          <Text style={styles.menuItemText}>Import</Text>
        </View>
      </TouchableOpacity>
    </>
  );

  const sortOptions: { mode: SortMode; label: string; icon: string }[] = [
    { mode: 'frequency', label: 'By frequency', icon: 'trending-up-outline' },
    { mode: 'alphabetical', label: 'Alphabetically', icon: 'text-outline' },
  ];

  const renderSortMenu = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuLevel('main')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sort</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.doneButton}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.separator} />
      {sortOptions.map((option, index) => (
        <TouchableOpacity
          key={option.mode}
          style={[
            styles.menuItem,
            index === sortOptions.length - 1 && styles.lastMenuItem,
          ]}
          onPress={() => handleSortSelect(option.mode)}
          activeOpacity={0.6}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name={option.icon as any} size={22} color={colors.foreground} style={styles.menuItemIcon} />
            <Text style={styles.menuItemText}>{option.label}</Text>
          </View>
          {currentSortMode === option.mode && (
            <Ionicons name="checkmark" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      ))}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={handleClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        {menuLevel === 'main' ? renderMainMenu() : renderSortMenu()}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouch: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.mutedForeground,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 50,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  doneButton: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 50,
    textAlign: 'right',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.1,
  },
});
