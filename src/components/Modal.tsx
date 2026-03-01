import React, { useRef } from 'react';
import {
  Modal as RNModal,
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  PanResponder,
} from 'react-native';
import { colors } from '../constants/colors';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ visible, onClose, children }) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          // User is dragging down
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 50) {
          // Dragged down more than 50px, close modal
          try {
            onClose();
          } catch (error) {
            // Silently handle any errors during close
          }
        }
      },
    })
  ).current;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
          accessibilityHint="Tap outside modal to close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalWrapper} pointerEvents="box-none">
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={styles.modalTouchable}
            >
              <View style={styles.content} pointerEvents="auto">
                <View {...panResponder.panHandlers} style={styles.handleBarContainer}>
                  <View style={styles.handleBar} accessibilityRole="none" accessibilityLabel="Swipe down to close" />
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="none"
                  bounces={false}
                >
                  {children}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  avoidingView: {
    width: '100%',
  },
  modalTouchable: {
    width: '100%',
  },
  modalWrapper: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  handleBarContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: colors.mutedForeground,
    borderRadius: 3,
    opacity: 0.3,
  },
  content: {
    backgroundColor: colors.card,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 17 : 20,
    paddingTop: 0,
  },
});


