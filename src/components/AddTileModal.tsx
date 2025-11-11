import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Modal } from './Modal';
import { MinimalistInput } from './MinimalistInput';
import { PillButton } from './PillButton';
import { CircularActionButton } from './CircularActionButton';
import { colors } from '../constants/colors';
import type { Tile } from '../types/tile';

interface AddTileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (tile: Omit<Tile, 'id' | 'usageCount' | 'createdAt' | 'lastUsed'>) => void;
  editTile?: Tile | null;
  prefillContent?: string;
}

export const AddTileModal: React.FC<AddTileModalProps> = ({
  visible,
  onClose,
  onSave,
  editTile,
  prefillContent,
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editTile) {
      setName(editTile.name);
      setContent(editTile.content);
      setIsPriority(editTile.isPriority);
      setIsSecure(editTile.isSecure);
    } else {
      setName('');
      setContent(prefillContent || '');
      setIsPriority(false);
      setIsSecure(false);
    }
  }, [editTile, prefillContent, visible]);

  const handleSave = () => {
    if (name.trim() && content.trim()) {
      onSave({
        name: name.trim(),
        content: content.trim(),
        isPriority,
        isSecure,
      });
      onClose();
    }
  };

  const isFormValid = name.trim() !== '' && content.trim() !== '';

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Tile Name Input */}
        <MinimalistInput
          ref={nameInputRef}
          value={name}
          onChangeText={setName}
          placeholder="Tile Name"
          autoFocus={true}
          returnKeyType="next"
          onSubmitEditing={() => {
            contentInputRef.current?.focus();
          }}
          blurOnSubmit={false}
          enablesReturnKeyAutomatically={true}
          textContentType="none"
          autoComplete="off"
          autoCapitalize="words"
          isFirst={true}
        />

        {/* Contents Input */}
        <MinimalistInput
          ref={contentInputRef}
          value={content}
          onChangeText={setContent}
          placeholder="Contents"
          multiline
          style={styles.contentInput}
          textContentType="none"
          autoComplete="off"
          autoCapitalize="sentences"
          returnKeyType="default"
          blurOnSubmit={true}
        />

        {/* Action Row: Pill Buttons + Create Button */}
        <View style={styles.actionRow}>
          <View style={styles.pillButtonGroup}>
            <PillButton
              title="Priority"
              icon="priority"
              active={isPriority}
              onPress={() => setIsPriority(!isPriority)}
            />
            <PillButton
              title="Secure"
              icon="secure"
              active={isSecure}
              onPress={() => setIsSecure(!isSecure)}
            />
          </View>
          
          <CircularActionButton
            onPress={handleSave}
            active={isFormValid}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 240,
  },
  contentInput: {
    fontSize: 19,
    fontWeight: '400',
    minHeight: 60,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  pillButtonGroup: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
});

