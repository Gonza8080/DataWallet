import React, { forwardRef } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  Platform,
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
          accessible={true}
          accessibilityRole="none"
          accessibilityLabel={props.placeholder || label}
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
    marginBottom: 1,
  },
  input: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.foreground,
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    minHeight: 32,
    textAlignVertical: 'top', // Align text to top instead of centering
  },
});

