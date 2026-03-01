import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import {
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  TapGestureHandlerStateChangeEvent,
  LongPressGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { Tile as TileType } from '../types/tile';

const MAX_TILE_NAME_LENGTH = 25; // Must match AddTileModal limit

interface TileProps {
  tile: TileType;
  onTap: (tile: TileType) => void;
  onDoubleTap: (tile: TileType) => void;
  onLongPress: (tile: TileType, position: { x: number; y: number }) => void;
  pressedTileId: string | null;
  pressedTimestamp: number;
  failedAuthTileId: string | null;
  failedAuthTimestamp: number;
  isContextMenuOpen: boolean;
  showContent?: boolean;
}

const TileComponent: React.FC<TileProps> = ({
  tile,
  onTap,
  onDoubleTap,
  onLongPress,
  pressedTileId,
  pressedTimestamp,
  failedAuthTileId,
  failedAuthTimestamp,
  isContextMenuOpen,
  showContent = false,
}) => {
  const [isInFadeSequence, setIsInFadeSequence] = useState(false);
  const [isInFailedAuthSequence, setIsInFailedAuthSequence] = useState(false);
  const backgroundColor = useRef(new Animated.Value(0)).current;
  const failedAuthColor = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Refs for gesture handler coordination
  const doubleTapRef = useRef(null);
  const longPressRef = useRef(null);

  // Handle pressed animation
  useEffect(() => {
    if (pressedTileId === tile.id && pressedTimestamp > 0 && !isInFadeSequence) {
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
        }).start(() => {
          setIsInFadeSequence(false);
        });
      });
    } else if (pressedTileId !== tile.id && pressedTileId !== null && isInFadeSequence) {
      // Snap back instantly if a DIFFERENT tile is pressed (not when cleared to null)
      backgroundColor.setValue(0);
      setIsInFadeSequence(false);
    }
  }, [pressedTileId, pressedTimestamp, tile.id]);

  // Handle failed authentication animation (red flash)
  useEffect(() => {
    if (failedAuthTileId === tile.id && failedAuthTimestamp > 0 && !isInFailedAuthSequence) {
      setIsInFailedAuthSequence(true);

      // Quick transition to red state
      Animated.timing(failedAuthColor, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        // Fade back to normal
        Animated.timing(failedAuthColor, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }).start(() => {
          setIsInFailedAuthSequence(false);
        });
      });
    } else if (failedAuthTileId !== tile.id && failedAuthTileId !== null && isInFailedAuthSequence) {
      // Snap back instantly if a DIFFERENT tile fails auth (not when cleared to null)
      failedAuthColor.setValue(0);
      setIsInFailedAuthSequence(false);
    }
  }, [failedAuthTileId, failedAuthTimestamp, tile.id]);

  // Reset scale when context menu opens
  useEffect(() => {
    if (isContextMenuOpen) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [isContextMenuOpen]);

  // Reset color animation when content is shown/hidden
  useEffect(() => {
    if (showContent) {
      // Stop any ongoing fade animation and reset when content opens
      backgroundColor.stopAnimation();
      backgroundColor.setValue(0);
      setIsInFadeSequence(false);
    }
  }, [showContent]);

  // Helper to reset scale to normal
  const resetScale = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Native single tap handler
  const handleSingleTap = (event: TapGestureHandlerStateChangeEvent) => {
    const { state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      resetScale();
      if (isContextMenuOpen) return;
      onTap(tile);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  };

  // Native double tap handler
  const handleDoubleTap = (event: TapGestureHandlerStateChangeEvent) => {
    const { state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      resetScale();
      if (isContextMenuOpen) return;
      onDoubleTap(tile);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  };

  // Native long press handler
  const handleLongPress = (event: LongPressGestureHandlerStateChangeEvent) => {
    const { state } = event.nativeEvent;
    
    if (state === State.BEGAN) {
      // Scale down when touch begins
      if (!isContextMenuOpen) {
        Animated.spring(scale, {
          toValue: 0.95,
          useNativeDriver: true,
        }).start();
      }
    } else if (state === State.ACTIVE) {
      if (isContextMenuOpen) return;

      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      resetScale();

      // Call onLongPress with position from event
      onLongPress(tile, {
        x: event.nativeEvent.absoluteX,
        y: event.nativeEvent.absoluteY,
      });
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  };

  const interpolatedColor = backgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.tileBase, colors.tilePressed],
  });

  const interpolatedFailedAuthColor = failedAuthColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.tileBase, colors.error],
  });

  // Determine which color to use based on animation state
  // Failed auth takes priority over pressed state
  const tileBackgroundColor = isInFailedAuthSequence ? interpolatedFailedAuthColor : interpolatedColor;

  const displayName = tile.name
    ? tile.name.slice(0, MAX_TILE_NAME_LENGTH)
    : '';

  return (
    <LongPressGestureHandler
      ref={longPressRef}
      onHandlerStateChange={handleLongPress}
      minDurationMs={500}
      enabled={!isContextMenuOpen}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        <TapGestureHandler
          ref={doubleTapRef}
          onHandlerStateChange={handleDoubleTap}
          numberOfTaps={2}
          enabled={!isContextMenuOpen}
        >
          <Animated.View style={styles.touchable}>
            <TapGestureHandler
              onHandlerStateChange={handleSingleTap}
              numberOfTaps={1}
              waitFor={doubleTapRef}
              enabled={!isContextMenuOpen}
            >
              <Animated.View
                style={[
                  styles.tile,
                  { backgroundColor: showContent ? colors.tileOpen : tileBackgroundColor },
                  tile.isPriority && styles.priorityBorder,
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={(showContent || isInFadeSequence) ? `${tile.name} content: ${tile.content}` : tile.name}
                accessibilityHint={`Tap to copy ${tile.name}. Double tap to ${showContent ? 'hide' : 'view'} content. Long press for more options.`}
                accessibilityState={{
                  selected: showContent || isInFadeSequence,
                  disabled: isContextMenuOpen
                }}
              >
                <View style={styles.content}>
                  {(showContent || isInFadeSequence) ? (
                    <Text style={styles.name} numberOfLines={5}>
                      {tile.content}
                    </Text>
                  ) : (
                    <View style={styles.nameWrapper}>
                      <Text style={styles.name} numberOfLines={3} ellipsizeMode="tail">
                        {displayName}
                      </Text>
                    </View>
                  )}
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
            </TapGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </Animated.View>
    </LongPressGestureHandler>
  );
};

export const Tile = React.memo(TileComponent, (prev, next) => {
  return (
    prev.tile === next.tile &&
    prev.pressedTileId === next.pressedTileId &&
    prev.pressedTimestamp === next.pressedTimestamp &&
    prev.failedAuthTileId === next.failedAuthTileId &&
    prev.failedAuthTimestamp === next.failedAuthTimestamp &&
    prev.isContextMenuOpen === next.isContextMenuOpen &&
    prev.showContent === next.showContent
  );
});

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
  nameWrapper: {
    width: '100%',
    position: 'relative',
  },
  name: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.tileBaseForeground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  secureIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  priorityIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  iconText: {
    fontSize: 18,
  },
});
