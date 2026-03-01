import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, Text, Platform, Animated, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import GraphemeSplitter from 'grapheme-splitter';
import { Modal } from './Modal';
import { MinimalistInput } from './MinimalistInput';
import { PillButton } from './PillButton';
import { CircularActionButton } from './CircularActionButton';
import { colors } from '../constants/colors';
import type { Tile } from '../types/tile';

// Character limits
const MAX_NAME_LENGTH = 25;
const MAX_CONTENT_LENGTH = 250;
const THRESHOLD = 0.8; // 80% threshold for showing counter

// Font configuration (matches MinimalistInput)
const NAME_FONT_SIZE = 22;
const NAME_FONT_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const CONTENT_FONT_SIZE = 19;
const CONTENT_FONT_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const CONTENT_MIN_HEIGHT = 60;
const CONTENT_CHAR_WIDTH = Platform.OS === 'ios' ? CONTENT_FONT_SIZE * 0.6 : CONTENT_FONT_SIZE * 0.55;

const splitter = new GraphemeSplitter();

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
  const [focusedField, setFocusedField] = useState<'name' | 'content' | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);
  
  // Animation refs for fading counters
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // Track previous threshold states for haptics
  const prevNameState = useRef<'normal' | 'near' | 'over'>('normal');
  const prevContentState = useRef<'normal' | 'near' | 'over'>('normal');

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

  // Calculate grapheme counts
  const nameGraphemes = splitter.splitGraphemes(name);
  const contentGraphemes = splitter.splitGraphemes(content);
  const nameLength = nameGraphemes.length;
  const contentLength = contentGraphemes.length;

  // Calculate progress and states
  const nameProgress = nameLength / MAX_NAME_LENGTH;
  const contentProgress = contentLength / MAX_CONTENT_LENGTH;
  
  const nameShowCounter = nameProgress >= THRESHOLD;
  const contentShowCounter = contentProgress >= THRESHOLD;
  
  const nameNear = nameProgress >= THRESHOLD && nameProgress <= 1;
  const nameOver = nameProgress > 1;
  const contentNear = contentProgress >= THRESHOLD && contentProgress <= 1;
  const contentOver = contentProgress > 1;

  // Animate counter visibility
  useEffect(() => {
    Animated.timing(nameOpacity, {
      toValue: nameShowCounter ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [nameShowCounter, nameOpacity]);

  useEffect(() => {
    Animated.timing(contentOpacity, {
      toValue: contentShowCounter ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [contentShowCounter, contentOpacity]);

  // Haptic feedback and accessibility announcements for name
  useEffect(() => {
    if (!visible) return;

    const currentState = nameOver ? 'over' : nameNear ? 'near' : 'normal';
    
    if (currentState !== prevNameState.current) {
      // Trigger haptic on threshold change
      if (currentState === 'near') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (currentState === 'over') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      // Accessibility announcements
      if (nameNear && !nameOver) {
        AccessibilityInfo.announceForAccessibility(
          `${nameLength} of ${MAX_NAME_LENGTH} characters used`
        );
      } else if (nameOver) {
        const overBy = nameLength - MAX_NAME_LENGTH;
        AccessibilityInfo.announceForAccessibility(
          `Over the limit by ${overBy} character${overBy === 1 ? '' : 's'}`
        );
      }
      
      prevNameState.current = currentState;
    }
    
    // Trigger haptic on every character when in overflow
    if (currentState === 'over') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [nameLength, nameNear, nameOver, visible]);

  // Haptic feedback and accessibility announcements for content
  useEffect(() => {
    if (!visible) return;

    const currentState = contentOver ? 'over' : contentNear ? 'near' : 'normal';
    
    if (currentState !== prevContentState.current) {
      // Trigger haptic on threshold change
      if (currentState === 'near') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (currentState === 'over') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      // Accessibility announcements
      if (contentNear && !contentOver) {
        AccessibilityInfo.announceForAccessibility(
          `${contentLength} of ${MAX_CONTENT_LENGTH} characters used`
        );
      } else if (contentOver) {
        const overBy = contentLength - MAX_CONTENT_LENGTH;
        AccessibilityInfo.announceForAccessibility(
          `Over the limit by ${overBy} character${overBy === 1 ? '' : 's'}`
        );
      }
      
      prevContentState.current = currentState;
    }
    
    // Trigger haptic on every character when in overflow
    if (currentState === 'over') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [contentLength, contentNear, contentOver, visible]);

  const handleSave = () => {
    // Trim to max length using graphemes
    const trimmedName = nameGraphemes.slice(0, MAX_NAME_LENGTH).join('').trim();
    const trimmedContent = contentGraphemes.slice(0, MAX_CONTENT_LENGTH).join('').trim();

    if (!trimmedName) {
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedContent) {
      contentInputRef.current?.focus();
      return;
    }

    onSave({
      name: trimmedName,
      content: trimmedContent,
      isPriority,
      isSecure,
    });
    onClose();
  };

  const isFormValid = name.trim() !== '' && content.trim() !== '' && !nameOver && !contentOver;

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {/* Tile Name Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <MinimalistInput
              ref={nameInputRef}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              autoFocus={true}
              returnKeyType="next"
              onSubmitEditing={() => {
                contentInputRef.current?.focus();
              }}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              blurOnSubmit={false}
              enablesReturnKeyAutomatically={true}
              textContentType="none"
              autoComplete="off"
              autoCapitalize="words"
              isFirst={true}
              style={nameOver ? { color: '#ff0000' } : undefined}
            />

            {/* Fading counter */}
            {nameShowCounter && focusedField === 'name' && (
              <Animated.Text
                style={[
                  styles.counter,
                  {
                    opacity: nameOpacity,
                    color: nameOver ? '#ff0000' : '#8a8a8e',
                  },
                ]}
                accessibilityLiveRegion="polite"
              >
                {nameLength} / {MAX_NAME_LENGTH}
              </Animated.Text>
            )}
          </View>
        </View>

        {/* Contents Input */}
        <View style={styles.inputSection}>
          <View style={styles.contentInputWrapper}>
            <MinimalistInput
              ref={contentInputRef}
              value={content}
              onChangeText={setContent}
              placeholder="Contents"
              multiline
              style={[
                styles.contentInput,
                contentOver ? { color: '#ff0000' } : undefined
              ]}
              textContentType="none"
              autoComplete="off"
              autoCapitalize="sentences"
              returnKeyType="default"
              blurOnSubmit={true}
              onFocus={() => setFocusedField('content')}
              onBlur={() => setFocusedField(null)}
            />

            {/* Fading counter */}
            {contentShowCounter && focusedField === 'content' && (
              <Animated.Text
                style={[
                  styles.counter,
                  {
                    opacity: contentOpacity,
                    color: contentOver ? '#ff0000' : '#8a8a8e',
                  },
                ]}
                accessibilityLiveRegion="polite"
              >
                {contentLength} / {MAX_CONTENT_LENGTH}
              </Animated.Text>
            )}
          </View>
        </View>

        {/* Action Row: Pill Buttons + Create Button with Progress Ring */}
        <View style={styles.actionRow}>
          <View style={styles.pillButtonGroup}>
            <PillButton
              title="Pin"
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
            progress={focusedField === 'name' ? nameProgress : focusedField === 'content' ? contentProgress : Math.max(nameProgress, contentProgress)}
            showProgress={name.length > 0 || content.length > 0}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 12,
  },
  inputWrapper: {
    position: 'relative',
  },
  contentInputWrapper: {
    position: 'relative',
  },
  counter: {
    position: 'absolute',
    right: 0,
    bottom: -10,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contentInput: {
    fontSize: 19,
    fontWeight: '400',
    fontFamily: CONTENT_FONT_FAMILY,
    minHeight: 60,
    maxWidth: CONTENT_CHAR_WIDTH * 25, // Break exactly at 25 characters
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pillButtonGroup: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
});
