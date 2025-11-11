import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';

interface ToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
  keyboardOffset?: number;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  onHide,
  duration = 1200,
  keyboardOffset = 0,
}) => {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Reset position
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible, duration, onHide]);

  if (!visible && translateY.__getValue() === 100) {
    return null;
  }

  const bottomPosition = 130 + keyboardOffset;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomPosition,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(60, 60, 67, 0.92)', // Semi-transparent dark gray matching iOS style
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200, // Above bottom bar (which is 100)
  },
  message: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});

