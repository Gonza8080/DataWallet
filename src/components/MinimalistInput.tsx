import React, { forwardRef } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { colors } from '../constants/colors';

interface MinimalistInputProps extends TextInputProps {
  label?: string;
  isFirst?: boolean;
}

export const MinimalistInput = forwardRef<TextInput, MinimalistInputProps>(
  ({ label, style, isFirst = false, ...props }, ref) => {
    return (
      <View style={[styles.container, isFirst && styles.firstContainer]}>
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
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  firstContainer: {
    marginBottom: 20,
  },
  input: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.foreground,
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    minHeight: 32,
  },
});

