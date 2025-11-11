import React from 'react';
import { AlertDialog } from './AlertDialog';

interface DeleteConfirmDialogProps {
  visible: boolean;
  tileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  visible,
  tileName,
  onConfirm,
  onCancel,
}) => {
  return (
    <AlertDialog
      visible={visible}
      title="Are you sure?"
      description={`This will permanently delete "${tileName}".`}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmText="Yes"
      cancelText="No"
      confirmVariant="destructive"
    />
  );
};


