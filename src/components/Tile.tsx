import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { Tile as TileType } from '../types/tile';

interface TileProps {
  tile: TileType;
  onTap: (tile: TileType) => void;
  onLongPress: (tile: TileType, position: { x: number; y: number }) => void;
  pressedTileId: string | null;
  pressedTimestamp: number;
  isContextMenuOpen: boolean;
  showContent?: boolean;
}

export const Tile: React.FC<TileProps> = ({
  tile,
  onTap,
  onLongPress,
  pressedTileId,
  pressedTimestamp,
  isContextMenuOpen,
  showContent = false,
}) => {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isInFadeSequence, setIsInFadeSequence] = useState(false);
  const backgroundColor = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const touchPosition = useRef({ x: 0, y: 0 });
  const initialTouchPosition = useRef({ x: 0, y: 0 });

  // Handle pressed animation
  useEffect(() => {
    if (pressedTileId === tile.id && pressedTimestamp > 0) {
      setIsInFadeSequence(true);

      // Quick transition to pressed state
      Animated.timing(backgroundColor, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        // Slow fade back to normal
        Animated.timing(backgroundColor, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }).start();
      });
    } else if (isInFadeSequence) {
      // Snap back instantly if another tile is pressed
      backgroundColor.setValue(0);
      setIsInFadeSequence(false);
    }
  }, [pressedTileId, pressedTimestamp, tile.id, isInFadeSequence]);

  // Reset scale when context menu opens
  useEffect(() => {
    if (isContextMenuOpen) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [isContextMenuOpen]);

  const handlePressIn = (event: any) => {
    if (isContextMenuOpen) return;

    // Store initial and current touch position
    const position = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
    initialTouchPosition.current = position;
    touchPosition.current = position;

    // Scale down animation
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // Start long press timer
    const timer = setTimeout(() => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      // Reset scale before opening menu
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      onLongPress(tile, touchPosition.current);
    }, 500);
    setLongPressTimer(timer);
  };

  const handlePressOut = (event: any) => {
    if (isContextMenuOpen) return;

    // Scale back animation
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Clear timer and check if it was a tap
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      
      // Calculate movement distance
      const finalX = event.nativeEvent.pageX;
      const finalY = event.nativeEvent.pageY;
      const deltaX = finalX - initialTouchPosition.current.x;
      const deltaY = finalY - initialTouchPosition.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Only trigger tap if movement is less than 15px (not a scroll)
      if (distance < 15) {
        onTap(tile);
      }
    }
  };

  const handleLongPress = (event: any) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const interpolatedColor = backgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.tileBase, colors.tilePressed],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={1}
        disabled={isContextMenuOpen}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.tile,
            { backgroundColor: showContent ? colors.tileOpen : interpolatedColor },
            tile.isPriority && styles.priorityBorder,
          ]}
        >
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={showContent ? 5 : 3}>
              {showContent ? tile.content : tile.name}
            </Text>
          </View>

          {tile.isSecure && (
            <View style={styles.secureIcon}>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            </View>
          )}

          {tile.isPriority && (
            <View style={styles.priorityIcon}>
              <Ionicons name="star" size={18} color="#FFD700" />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  touchable: {
    width: '100%',
    aspectRatio: 1,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  priorityBorder: {
    borderWidth: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.tileBaseForeground,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  secureIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  priorityIcon: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  iconText: {
    fontSize: 18,
  },
});


