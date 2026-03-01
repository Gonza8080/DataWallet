import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../constants/colors';

interface CircularActionButtonProps {
  onPress: () => void;
  active: boolean;
  progress?: number; // 0 to 1, for progress ring
  showProgress?: boolean; // Whether to show the progress ring
}

const UpArrowIcon = ({ color }: { color: string }) => (
  <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <Path
      d="M10 16V4M10 4L4 10M10 4L16 10"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CircularActionButton: React.FC<CircularActionButtonProps> = ({
  onPress,
  active,
  progress = 0,
  showProgress = false,
}) => {
  // Progress ring calculation - use larger radius so ring shows outside button
  const R = 22; // Increased from 20 to extend beyond button edge
  const circumference = 2 * Math.PI * R;
  
  // Clamp progress at 100% for visual display, even when overflowing
  const visualProgress = Math.min(progress, 1);
  const strokeDashoffset = circumference * (1 - visualProgress);
  
  // Color semantics: neutral -> amber (80%) -> vibrant red (overflow)
  const isOverflow = progress > 1;
  const isNearLimit = progress >= 0.8 && progress <= 1;
  
  let ringColor = colors.actionButtonActive; // FAB blue (0-79%)
  if (isOverflow) {
    ringColor = '#ff0000'; // vibrant red - stays full until back within limit
  } else if (isNearLimit) {
    ringColor = '#ffcc00'; // amber
  }

  return (
    <View style={styles.container}>
      {showProgress && (
        <Svg width={52} height={52} style={styles.progressSvg}>
          {/* Background circle */}
          <Circle
            cx={26}
            cy={26}
            r={R}
            stroke="#2a2a2a30"
            strokeWidth={4}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={26}
            cy={26}
            r={R}
            stroke={ringColor}
            strokeWidth={4}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin="26, 26"
          />
        </Svg>
      )}
      <TouchableOpacity
        style={[
          styles.button,
          active ? styles.buttonActive : styles.buttonInactive,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!active}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Create nugget"
        accessibilityHint={active ? "Tap to create nugget" : "Fill in nugget name and contents to enable"}
        accessibilityState={{
          disabled: !active
        }}
      >
        <View style={styles.iconContainer}>
          <UpArrowIcon color={colors.foreground} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 2,
  },
  buttonActive: {
    backgroundColor: colors.actionButtonActive,
  },
  buttonInactive: {
    backgroundColor: colors.actionButtonInactive,
    opacity: 0.6,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});


