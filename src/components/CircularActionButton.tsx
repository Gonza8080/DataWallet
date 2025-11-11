import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/colors';

interface CircularActionButtonProps {
  onPress: () => void;
  active: boolean;
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
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        active ? styles.buttonActive : styles.buttonInactive,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!active}
    >
      <View style={styles.iconContainer}>
        <UpArrowIcon color={colors.foreground} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
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


