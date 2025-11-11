import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { colors } from '../constants/colors';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'outline' | 'destructive';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const getButtonStyle = () => {
    if (variant === 'outline') {
      return styles.outlineButton;
    }
    if (variant === 'destructive') {
      return styles.destructiveButton;
    }
    return styles.primaryButton;
  };

  const getTextStyle = () => {
    if (variant === 'outline') {
      return styles.outlineText;
    }
    return styles.primaryText;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        (disabled || loading) && styles.disabledButton,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? colors.foreground : colors.primaryForeground}
        />
      ) : (
        <Text style={[styles.text, getTextStyle()]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border,
  },
  destructiveButton: {
    backgroundColor: colors.destructive,
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  primaryText: {
    color: colors.primaryForeground,
  },
  outlineText: {
    color: colors.foreground,
  },
});


