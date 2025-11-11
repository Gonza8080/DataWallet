import React, { forwardRef } from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { colors } from '../constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
}

export const Input = forwardRef<TextInput, InputProps>(({ label, style, ...props }, ref) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        spellCheck={false}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.mutedForeground,
    marginBottom: 8,
    letterSpacing: -0.08,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.input,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: colors.foreground,
    backgroundColor: colors.muted,
    minHeight: 56,
  },
});


