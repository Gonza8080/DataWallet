import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';
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
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.actions}>
        <Button
          title={cancelText}
          variant="outline"
          onPress={onCancel}
          style={styles.button}
        />
        <Button
          title={confirmText}
          variant={confirmVariant}
          onPress={onConfirm}
          style={styles.button}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: colors.foreground,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    color: colors.mutedForeground,
    marginBottom: 24,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    flex: 1,
  },
});


