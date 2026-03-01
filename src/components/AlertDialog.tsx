import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Modal } from './Modal';
import { PillButton } from './PillButton';
import { colors } from '../constants/colors';

interface AlertDialogProps {
  visible: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'destructive';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  visible,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Yes',
  cancelText = 'No',
  confirmVariant = 'primary',
}) => {
  return (
    <Modal visible={visible} onClose={onCancel}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.description} accessibilityRole="text">{description}</Text>
      <View style={styles.actions}>
        <View style={styles.buttonWrapper}>
          <PillButton
            title={cancelText}
            active={false}
            onPress={onCancel}
          />
        </View>
        <View style={styles.buttonWrapper}>
          <PillButton
            title={confirmText}
            active={confirmVariant === 'destructive'}
            destructive={confirmVariant === 'destructive'}
            onPress={onConfirm}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '400',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 24,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: 24,
  },
  buttonWrapper: {
    minWidth: 96,
  },
});


