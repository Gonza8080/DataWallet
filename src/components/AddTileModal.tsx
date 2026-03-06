import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Text,
  Platform,
  Animated,
  AccessibilityInfo,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  PanResponder,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import GraphemeSplitter from 'grapheme-splitter';
import { Modal } from './Modal';
import { MinimalistInput } from './MinimalistInput';
import { PillButton } from './PillButton';
import { CircularActionButton } from './CircularActionButton';
import { colors } from '../constants/colors';
import { pickAndResizeImage, deleteFilesIfExist } from '../utils/ocrHelpers';
import type { ImageSource } from '../utils/ocrHelpers';
import type { Tile } from '../types/tile';
import type { TextBlock } from '../../modules/vision-ocr';

const MAX_NAME_LENGTH = 25;
const MAX_CONTENT_LENGTH = 250;
const THRESHOLD = 0.8;

const CONTENT_FONT_SIZE = 19;
const CONTENT_FONT_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const CONTENT_CHAR_WIDTH = Platform.OS === 'ios' ? CONTENT_FONT_SIZE * 0.6 : CONTENT_FONT_SIZE * 0.55;

const SCREEN_HEIGHT = Dimensions.get('window').height;
const OCR_IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT - 160);
const BRUSH_WIDTH = 30;
const BRUSH_COLOR = 'rgba(10, 132, 255, 0.35)';
const MIN_POINT_DIST_SQ = 16;
const TAP_THRESHOLD_SQ = 100;

const splitter = new GraphemeSplitter();

type ModalMode = 'form' | 'source' | 'ocr';
type OcrPhase = 'paint' | 'text';

function pointsToSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const p = pts[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

interface AddTileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (tile: Omit<Tile, 'id' | 'usageCount' | 'createdAt' | 'lastUsed'>) => void;
  editTile?: Tile | null;
  prefillContent?: string;
}

export const AddTileModal: React.FC<AddTileModalProps> = ({
  visible,
  onClose,
  onSave,
  editTile,
  prefillContent,
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'content' | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const contentInputRef = useRef<TextInput>(null);

  const nameOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const prevNameState = useRef<'normal' | 'near' | 'over'>('normal');
  const prevContentState = useRef<'normal' | 'near' | 'over'>('normal');

  // --- Mode ---
  const [mode, setMode] = useState<ModalMode>('form');

  // --- OCR state ---
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [ocrBlocks, setOcrBlocks] = useState<TextBlock[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDisplayRect, setOcrDisplayRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const ocrUrisRef = useRef<string[]>([]);

  // --- Paintbrush state ---
  const [ocrPhase, setOcrPhase] = useState<OcrPhase>('paint');
  const [extractedText, setExtractedText] = useState('');
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const [strokesVersion, setStrokesVersion] = useState(0);
  const lastRenderTimeRef = useRef(0);
  const displayRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const touchStartRef = useRef({ x: 0, y: 0 });
  const undoHintOpacity = useRef(new Animated.Value(0)).current;

  // --- Brush PanResponder (created once, stable) ---
  const brushResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        touchStartRef.current = { x: locationX, y: locationY };
        const r = displayRectRef.current;
        const insideImage =
          r.width > 0 &&
          locationX >= r.x && locationX <= r.x + r.width &&
          locationY >= r.y && locationY <= r.y + r.height;
        if (insideImage) {
          currentStrokeRef.current = [{ x: locationX, y: locationY }];
          setStrokesVersion((v) => v + 1);
        }
      },
      onPanResponderMove: (evt) => {
        if (currentStrokeRef.current.length === 0) return;
        const { locationX, locationY } = evt.nativeEvent;
        const pts = currentStrokeRef.current;
        const last = pts[pts.length - 1];
        if (last) {
          const d = (locationX - last.x) ** 2 + (locationY - last.y) ** 2;
          if (d < MIN_POINT_DIST_SQ) return;
        }
        pts.push({ x: locationX, y: locationY });
        const now = Date.now();
        if (now - lastRenderTimeRef.current > 16) {
          lastRenderTimeRef.current = now;
          setStrokesVersion((v) => v + 1);
        }
      },
      onPanResponderRelease: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (currentStrokeRef.current.length > 0) {
          strokesRef.current.push(currentStrokeRef.current);
          currentStrokeRef.current = [];
          setStrokesVersion((v) => v + 1);
        } else {
          const dx = locationX - touchStartRef.current.x;
          const dy = locationY - touchStartRef.current.y;
          if (dx * dx + dy * dy < TAP_THRESHOLD_SQ && strokesRef.current.length > 0) {
            strokesRef.current.pop();
            setStrokesVersion((v) => v + 1);
          }
        }
      },
    }),
  ).current;

  // --- Form init ---
  useEffect(() => {
    if (editTile) {
      setName(editTile.name);
      setContent(editTile.content);
      setIsPriority(editTile.isPriority);
      setIsSecure(editTile.isSecure);
    } else {
      setName('');
      setContent(prefillContent || '');
      setIsPriority(false);
      setIsSecure(false);
    }
  }, [editTile, prefillContent, visible]);

  useEffect(() => {
    if (!visible) {
      setMode('form');
      cleanupOcr();
    }
  }, [visible]);

  // Keep ref in sync for PanResponder
  useEffect(() => {
    displayRectRef.current = ocrDisplayRect;
  }, [ocrDisplayRect]);

  useEffect(() => {
    const target = strokesRef.current.length > 0 ? 1 : 0;
    Animated.timing(undoHintOpacity, { toValue: target, duration: 250, useNativeDriver: true }).start();
  }, [strokesVersion, undoHintOpacity]);

  // --- Grapheme calculations ---
  const nameGraphemes = splitter.splitGraphemes(name);
  const contentGraphemes = splitter.splitGraphemes(content);
  const nameLength = nameGraphemes.length;
  const contentLength = contentGraphemes.length;

  const nameProgress = nameLength / MAX_NAME_LENGTH;
  const contentProgress = contentLength / MAX_CONTENT_LENGTH;
  const nameShowCounter = nameProgress >= THRESHOLD;
  const contentShowCounter = contentProgress >= THRESHOLD;
  const nameNear = nameProgress >= THRESHOLD && nameProgress <= 1;
  const nameOver = nameProgress > 1;
  const contentNear = contentProgress >= THRESHOLD && contentProgress <= 1;
  const contentOver = contentProgress > 1;

  // --- Counter animations ---
  useEffect(() => {
    Animated.timing(nameOpacity, { toValue: nameShowCounter ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [nameShowCounter, nameOpacity]);
  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: contentShowCounter ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [contentShowCounter, contentOpacity]);

  // --- Haptics for name ---
  useEffect(() => {
    if (!visible) return;
    const currentState = nameOver ? 'over' : nameNear ? 'near' : 'normal';
    if (currentState !== prevNameState.current) {
      if (currentState === 'near') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (currentState === 'over') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (nameNear && !nameOver) AccessibilityInfo.announceForAccessibility(`${nameLength} of ${MAX_NAME_LENGTH} characters used`);
      else if (nameOver) { const o = nameLength - MAX_NAME_LENGTH; AccessibilityInfo.announceForAccessibility(`Over the limit by ${o} character${o === 1 ? '' : 's'}`); }
      prevNameState.current = currentState;
    }
    if (currentState === 'over') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [nameLength, nameNear, nameOver, visible]);

  // --- Haptics for content ---
  useEffect(() => {
    if (!visible) return;
    const currentState = contentOver ? 'over' : contentNear ? 'near' : 'normal';
    if (currentState !== prevContentState.current) {
      if (currentState === 'near') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (currentState === 'over') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (contentNear && !contentOver) AccessibilityInfo.announceForAccessibility(`${contentLength} of ${MAX_CONTENT_LENGTH} characters used`);
      else if (contentOver) { const o = contentLength - MAX_CONTENT_LENGTH; AccessibilityInfo.announceForAccessibility(`Over the limit by ${o} character${o === 1 ? '' : 's'}`); }
      prevContentState.current = currentState;
    }
    if (currentState === 'over') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [contentLength, contentNear, contentOver, visible]);

  // ===================== OCR helpers =====================

  const cleanupOcr = useCallback(() => {
    if (ocrUrisRef.current.length > 0) {
      deleteFilesIfExist(ocrUrisRef.current);
      ocrUrisRef.current = [];
    }
    setOcrImageUri(null);
    setOcrBlocks([]);
    setOcrError(null);
    setOcrLoading(false);
    setOcrDisplayRect({ x: 0, y: 0, width: 0, height: 0 });
    setOcrPhase('paint');
    setExtractedText('');
    strokesRef.current = [];
    currentStrokeRef.current = [];
    undoHintOpacity.setValue(0);
  }, [undoHintOpacity]);

  const handleSourceSelect = useCallback(async (source: ImageSource) => {
    const result = await pickAndResizeImage(source);
    if (!result) return;

    ocrUrisRef.current =
      result.originalUri && result.originalUri !== result.uri
        ? [result.uri, result.originalUri]
        : [result.uri];

    setOcrImageUri(result.uri);
    setOcrDisplayRect({ x: 0, y: 0, width: 0, height: 0 });
    setOcrPhase('paint');
    setExtractedText('');
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokesVersion(0);
    setMode('ocr');

    setOcrLoading(true);
    setOcrError(null);
    setOcrBlocks([]);

    try {
      const { VisionOcr } = await import('../../modules/vision-ocr');
      const blocks = await VisionOcr.recognizeTextAsync(result.uri);
      setOcrBlocks(blocks);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  }, []);

  const handleExtract = useCallback(() => {
    const allPoints = strokesRef.current.flat();
    if (allPoints.length === 0 || ocrDisplayRect.width === 0) return;

    const MIN_HIT_POINTS = 3;

    const normPoints = allPoints.map((p) => ({
      x: (p.x - ocrDisplayRect.x) / ocrDisplayRect.width,
      y: 1 - (p.y - ocrDisplayRect.y) / ocrDisplayRect.height,
    }));

    const matched = ocrBlocks.filter((block) => {
      const f = block.frame;
      let hits = 0;
      for (const p of normPoints) {
        if (p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height) {
          hits++;
          if (hits >= MIN_HIT_POINTS) return true;
        }
      }
      return false;
    });

    const text = matched
      .map((b) => b.text)
      .join('\n')
      .trim()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ');

    setExtractedText(text || '');
    setOcrPhase('text');
  }, [ocrBlocks, ocrDisplayRect]);

  const handleBackToPaint = useCallback(() => {
    setOcrPhase('paint');
  }, []);

  const handleAddExtractedText = useCallback(() => {
    const trimmed =
      extractedText.length > MAX_CONTENT_LENGTH
        ? extractedText.slice(0, MAX_CONTENT_LENGTH)
        : extractedText;
    setContent(trimmed);
    cleanupOcr();
    setMode('form');
  }, [extractedText, cleanupOcr]);

  const handleOcrCancel = useCallback(() => {
    cleanupOcr();
    setMode('form');
  }, [cleanupOcr]);

  const handleUndo = useCallback(() => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      setStrokesVersion((v) => v + 1);
    }
  }, []);

  // ===================== Form actions =====================

  const handleSave = () => {
    const trimmedName = nameGraphemes.slice(0, MAX_NAME_LENGTH).join('').trim();
    const trimmedContent = contentGraphemes.slice(0, MAX_CONTENT_LENGTH).join('').trim();
    if (!trimmedName) { nameInputRef.current?.focus(); return; }
    if (!trimmedContent) { contentInputRef.current?.focus(); return; }
    onSave({ name: trimmedName, content: trimmedContent, isPriority, isSecure });
    onClose();
  };

  const handleClose = useCallback(() => {
    cleanupOcr();
    setMode('form');
    onClose();
  }, [onClose, cleanupOcr]);

  const isFormValid = name.trim() !== '' && content.trim() !== '' && !nameOver && !contentOver;

  // ===================== RENDER: Form =====================
  const renderForm = () => (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        <View style={styles.inputWrapper}>
          <MinimalistInput
            ref={nameInputRef}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            autoFocus={true}
            returnKeyType="next"
            onSubmitEditing={() => contentInputRef.current?.focus()}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            blurOnSubmit={false}
            enablesReturnKeyAutomatically={true}
            textContentType="none"
            autoComplete="off"
            autoCapitalize="words"
            isFirst={true}
            style={nameOver ? { color: '#ff0000' } : undefined}
          />
          {nameShowCounter && focusedField === 'name' && (
            <Animated.Text
              style={[styles.counter, { opacity: nameOpacity, color: nameOver ? '#ff0000' : '#8a8a8e' }]}
              accessibilityLiveRegion="polite"
            >
              {nameLength} / {MAX_NAME_LENGTH}
            </Animated.Text>
          )}
        </View>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.contentInputWrapper}>
          <MinimalistInput
            ref={contentInputRef}
            value={content}
            onChangeText={setContent}
            placeholder="Contents"
            multiline
            style={[styles.contentInput, contentOver ? { color: '#ff0000' } : undefined]}
            textContentType="none"
            autoComplete="off"
            autoCapitalize="sentences"
            returnKeyType="default"
            blurOnSubmit={true}
            onFocus={() => setFocusedField('content')}
            onBlur={() => setFocusedField(null)}
          />
          {contentShowCounter && focusedField === 'content' && (
            <Animated.Text
              style={[styles.counter, { opacity: contentOpacity, color: contentOver ? '#ff0000' : '#8a8a8e' }]}
              accessibilityLiveRegion="polite"
            >
              {contentLength} / {MAX_CONTENT_LENGTH}
            </Animated.Text>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.pillButtonGroup}>
          {!editTile && (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => setMode('source')}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add from photo"
              accessibilityHint="Opens camera or gallery to import text from image"
            >
              <Ionicons name="camera-outline" size={20} color={colors.priority} />
            </TouchableOpacity>
          )}
          <PillButton title="Pin" icon="priority" active={isPriority} onPress={() => setIsPriority(!isPriority)} />
          <PillButton title="Secure" icon="secure" active={isSecure} onPress={() => setIsSecure(!isSecure)} />
        </View>
        <CircularActionButton
          onPress={handleSave}
          active={isFormValid}
          progress={
            focusedField === 'name'
              ? nameProgress
              : focusedField === 'content'
                ? contentProgress
                : Math.max(nameProgress, contentProgress)
          }
          showProgress={name.length > 0 || content.length > 0}
        />
      </View>
    </View>
  );

  // ===================== RENDER: Source picker =====================
  const renderSourcePicker = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => setMode('form')}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.mutedForeground} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.sourceTilesRow}>
        <TouchableOpacity style={styles.sourceTile} onPress={() => handleSourceSelect('camera')} activeOpacity={0.7}>
          <View style={styles.sourceTileIcon}>
            <Ionicons name="camera" size={28} color={colors.priority} />
          </View>
          <Text style={styles.sourceTileLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sourceTile} onPress={() => handleSourceSelect('library')} activeOpacity={0.7}>
          <View style={styles.sourceTileIcon}>
            <Ionicons name="images" size={28} color={colors.priority} />
          </View>
          <Text style={styles.sourceTileLabel}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===================== RENDER: OCR (paint + text) =====================
  const renderOcrPicker = () => {
    if (ocrPhase === 'paint') {
      const allStrokes = [...strokesRef.current];
      if (currentStrokeRef.current.length > 0) allStrokes.push(currentStrokeRef.current);
      const hasStrokes = strokesRef.current.length > 0;
      const canExtract = hasStrokes && !ocrLoading && !ocrError;

      return (
        <View style={styles.container}>
          <View style={styles.ocrHeader}>
            <TouchableOpacity onPress={handleOcrCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.ocrCancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.ocrTitleWrap} pointerEvents="none">
              <Text style={styles.ocrTitleCenter}>Mark text area</Text>
            </View>
            <TouchableOpacity
              onPress={canExtract ? handleExtract : undefined}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={!canExtract}
            >
              <Text style={[styles.ocrDoneText, !canExtract && { opacity: 0.4 }]}>
                {ocrLoading ? 'Wait…' : 'Extract'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ocrImageWrapper}>
            <View style={styles.ocrImageContainer} {...brushResponder.panHandlers}>
              {ocrImageUri && (
                <Image
                  source={{ uri: ocrImageUri }}
                  style={styles.ocrImage}
                  resizeMode="contain"
                  onLayout={(e) => {
                    const { width: cW, height: cH } = e.nativeEvent.layout;
                    if (ocrImageUri) {
                      Image.getSize(
                        ocrImageUri,
                        (imgW, imgH) => {
                          const scale = Math.min(cW / imgW, cH / imgH);
                          const dW = imgW * scale;
                          const dH = imgH * scale;
                          setOcrDisplayRect({ x: (cW - dW) / 2, y: (cH - dH) / 2, width: dW, height: dH });
                        },
                        () => {},
                      );
                    }
                  }}
                />
              )}

              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {allStrokes.map((stroke, i) => {
                  const d = pointsToSvgPath(stroke);
                  if (!d) return null;
                  return (
                    <Path
                      key={`${i}-${stroke.length}`}
                      d={d}
                      stroke={BRUSH_COLOR}
                      strokeWidth={BRUSH_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}
              </Svg>

              {ocrLoading && (
                <View style={styles.ocrLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.ocrLoadingText}>Recognizing text…</Text>
                </View>
              )}

              {ocrError && (
                <View style={styles.ocrErrorOverlay}>
                  <Text style={styles.ocrErrorText}>{ocrError}</Text>
                </View>
              )}
            </View>

            <Animated.View
              pointerEvents={hasStrokes ? 'auto' : 'none'}
              style={[styles.undoFloating, { opacity: undoHintOpacity }]}
            >
              <TouchableOpacity onPress={handleUndo} style={styles.undoFloatingButton} activeOpacity={0.7}>
                <Ionicons name="arrow-undo" size={16} color="#fff" />
                <Text style={styles.undoFloatingText}>Undo</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      );
    }

    // --- Text phase ---
    const hasText = extractedText.trim().length > 0;

    return (
      <View style={styles.container}>
        <View style={styles.ocrHeader}>
          <TouchableOpacity onPress={handleBackToPaint} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <View style={styles.ocrHeaderBack}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
              <Text style={styles.ocrDoneText}>Repaint</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.ocrTitleWrap} pointerEvents="none">
            <Text style={styles.ocrTitleCenter}>Result</Text>
          </View>
          <TouchableOpacity
            onPress={hasText ? handleAddExtractedText : undefined}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={!hasText}
          >
            <Text style={[styles.ocrDoneText, !hasText && { opacity: 0.4 }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {hasText ? (
          <TextInput
            style={styles.extractedTextInput}
            value={extractedText}
            onChangeText={setExtractedText}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        ) : (
          <View style={styles.noTextContainer}>
            <Text style={styles.noTextMessage}>
              No text found in the selected area.{'\n'}Try painting over a different region.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ===================== Return =====================
  return (
    <Modal visible={visible} onClose={handleClose}>
      {mode === 'form' && renderForm()}
      {mode === 'source' && renderSourcePicker()}
      {mode === 'ocr' && renderOcrPicker()}
    </Modal>
  );
};

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  container: { width: '100%' },
  inputSection: { marginBottom: 12 },
  inputWrapper: { position: 'relative' },
  contentInputWrapper: { position: 'relative' },
  counter: { position: 'absolute', right: 0, bottom: -10, fontSize: 12, fontFamily: MONO },
  contentInput: {
    fontSize: 19,
    fontWeight: '400',
    fontFamily: CONTENT_FONT_FAMILY,
    minHeight: 60,
    maxWidth: CONTENT_CHAR_WIDTH * 25,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  pillButtonGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cameraButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9F0A20',
    borderWidth: 1,
    borderColor: colors.priority,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Source picker
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backText: { fontSize: 16, color: colors.mutedForeground, fontFamily: MONO, marginLeft: 4 },
  sourceTilesRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  sourceTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceTileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9F0A18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sourceTileLabel: { fontSize: 15, fontWeight: '500', color: colors.foreground, fontFamily: MONO },

  // OCR shared
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 28,
    position: 'relative',
  },
  ocrTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ocrTitleCenter: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    fontFamily: MONO,
  },
  ocrCancelText: { fontSize: 16, color: colors.mutedForeground, fontFamily: MONO },
  ocrDoneText: { fontSize: 16, fontWeight: '600', color: colors.primary, fontFamily: MONO },
  ocrHeaderBack: { flexDirection: 'row', alignItems: 'center' },

  // OCR paint phase
  ocrImageWrapper: { marginHorizontal: -24, position: 'relative' },
  ocrImageContainer: { height: OCR_IMAGE_HEIGHT, overflow: 'hidden', position: 'relative' },
  ocrImage: { width: '100%', height: '100%' },
  ocrLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrLoadingText: { color: colors.foreground, marginTop: 12, fontFamily: MONO },
  ocrErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ocrErrorText: { color: colors.destructive, textAlign: 'center', fontFamily: MONO },
  undoFloating: { position: 'absolute', bottom: 16, left: 16 },
  undoFloatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  undoFloatingText: { color: '#fff', fontSize: 14, fontWeight: '500', fontFamily: MONO },

  // OCR text phase
  extractedTextInput: {
    fontSize: 17,
    fontFamily: MONO,
    color: colors.foreground,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
  },
  noTextContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  noTextMessage: { fontSize: 15, color: colors.mutedForeground, fontFamily: MONO, textAlign: 'center', lineHeight: 22 },
});
