import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  AppState,
  AppStateStatus,
  TextInput,
  Keyboard,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Tile } from '../components/Tile';
import { AddTileModal } from '../components/AddTileModal';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { ContextMenu } from '../components/ContextMenu';
import { Toast } from '../components/Toast';
import { colors } from '../constants/colors';
import { storeTiles, loadTiles, getStorageInfo, deleteTileSecureContent, storeSortMode, loadSortMode, loadSampleTilesIfFirstLaunch } from '../utils/storage';
import { BottomMenu, SortMode } from '../components/BottomMenu';
import { AlertDialog } from '../components/AlertDialog';
import { exportTiles, importTiles } from '../utils/exportImport';
import type { Tile as TileType } from '../types/tile';

// Minimum time in background (in milliseconds) before tile positions can be updated
// Options: 30000 (30 sec), 60000 (1 min), 180000 (3 min), 300000 (5 min)
const BACKGROUND_THRESHOLD_MS = 60000; // 1 minute - recommended default

// AsyncStorage key for clipboard token tracking
const CLIPBOARD_TOKEN_KEY = 'pb.lastPromptedClipboardToken.v1';

// Clipboard permission dialog detection threshold (in milliseconds)
// If clipboard access takes longer than this, we assume iOS showed the permission dialog
const CLIPBOARD_PERMISSION_THRESHOLD_MS = 500; // 500ms catches quick permission approvals

export const HomeScreen: React.FC = () => {
  const [tiles, setTiles] = useState<TileType[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<TileType | null>(null);
  const [deletingTile, setDeletingTile] = useState<TileType | null>(null);
  const [pressedTileId, setPressedTileId] = useState<string | null>(null);
  const [pressedTimestamp, setPressedTimestamp] = useState<number>(0);
  const [failedAuthTileId, setFailedAuthTileId] = useState<string | null>(null);
  const [failedAuthTimestamp, setFailedAuthTimestamp] = useState<number>(0);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuTile, setContextMenuTile] = useState<TileType | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Double tap functionality (native gesture handler in Tile component)
  const [showingContentTileId, setShowingContentTileId] = useState<string | null>(null);
  const justRevealedRef = useRef<string | null>(null); // Track tiles that just revealed content
  
  // Clipboard prefill functionality
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  const clipboardClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track display order separately from actual tile data
  // This order is frozen while app is active and only updates after background threshold
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const backgroundTimestamp = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  
  // Search functionality
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Sort mode
  const [sortMode, setSortMode] = useState<SortMode>('frequency');
  const [isBottomMenuVisible, setIsBottomMenuVisible] = useState(false);

  // Import checksum warning
  const [pendingImportTiles, setPendingImportTiles] = useState<TileType[] | null>(null);
  const [checksumWarningVisible, setChecksumWarningVisible] = useState(false);

  // Scroll tracking for header (only shrink when content is scrollable)
  const [isScrolled, setIsScrolled] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const hasValidMeasurements = contentHeight > 100 && containerHeight > 100;
  const isScrollable = hasValidMeasurements && contentHeight > containerHeight + 80;
  
  // Get safe area insets to ensure status bar visibility
  const insets = useSafeAreaInsets();

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

  // Helper function to close any open tile
  const closeOpenTile = useCallback(() => {
    setShowingContentTileId(null);
    justRevealedRef.current = null; // Clear flag so next tap works normally
  }, []);

  const computeSortedOrder = useCallback((tilesToSort: TileType[], mode: SortMode = sortMode): string[] => {
    const sorted = [...tilesToSort].sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;

      if (mode === 'alphabetical_az') {
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }
      if (mode === 'alphabetical_za') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }

      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
      return b.createdAt - a.createdAt;
    });
    return sorted.map(tile => tile.id);
  }, [sortMode]);

  // Biometric authentication - single attempt, no retry loop
  const authenticateWithBiometrics = useCallback(async (promptMessage: string): Promise<boolean> => {
    try {
      // Check if biometric hardware is available (don't show loading yet)
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        showToast('Biometric authentication not available on this device');
        return false;
      }

      // Check if biometrics are enrolled (don't show loading yet)
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        showToast('No biometric credentials enrolled. Please set up Face ID or Touch ID in Settings');
        return false;
      }

      // Single authentication attempt (no loading overlay - Face ID has its own UI)
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return true;
      }

      // Handle authentication failure
      if ('error' in result) {
        if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
          // User explicitly cancelled - silent fail, no toast
          return false;
        }
        if (result.error === 'lockout') {
          showToast('Too many attempts. Try again later.');
          return false;
        }
        if (result.error === 'authentication_failed') {
          // Authentication failed (wrong face/finger) - silent fail
          return false;
        }
        if (result.error === 'not_available') {
          showToast('Biometric authentication not available');
          return false;
        }
        if (result.error === 'passcode_not_set') {
          showToast('Please set up a device passcode first');
          return false;
        }
        if (result.error === 'not_enrolled') {
          showToast('No biometrics enrolled. Set up Face ID or Touch ID in Settings');
          return false;
        }
      }

      // Generic failure message for other unexpected errors
      showToast(`Authentication failed: ${('error' in result) ? result.error : 'unknown'}`);
      return false;
    } catch (error) {
      // Biometric authentication error
      showToast('Authentication error occurred');
      return false;
    }
  }, [showToast]);

  const handleClearSearch = () => {
    closeOpenTile();
    setSearchInput('');
    setSearchQuery('');
    Keyboard.dismiss();
    // Delay the state update to prevent visual glitch
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 100);
  };

  const handleSearchBlur = () => {
    closeOpenTile();
    // If search is empty, close it completely
    if (!searchInput.trim()) {
      setIsSearchFocused(false);
    }
    // If search has text, keep it active but just close keyboard
    // isSearchFocused stays true to keep the X button visible
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 200);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Clear any showing content when keyboard opens
        setShowingContentTileId(null);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Save tiles whenever they change
  useEffect(() => {
    const saveTiles = async () => {
      if (tiles.length > 0) {
        const result = await storeTiles(tiles);
        if (!result.success && result.error) {
          showToast(result.error);
        }
      }
    };
    saveTiles();
  }, [tiles, showToast]);

  // Use timestamp-based approach for clipboard detection
  async function getClipboardChangeToken(): Promise<number> {
    return Date.now();
  }

  const checkClipboard = useCallback(async () => {
    try {
      // Get current timestamp
      const tokenNow = await getClipboardChangeToken();

      // Get saved token
      const lastStr = await AsyncStorage.getItem(CLIPBOARD_TOKEN_KEY);
      const lastToken = lastStr ? Number(lastStr) : 0;

      // Always check clipboard (timestamp-based workaround)

      // 4) Токен вырос ⇒ буфер меняли, пока нас не было.
      //    WORKAROUND: Force iOS to show permission dialog with double-read pattern
      
      // Start timer to measure clipboard access duration
      const startTime = Date.now();
      
      // First read attempt - might be cached/silent
      let content = '';
      let clipboardAccessTime = 0;
      
      try {
        content = await Clipboard.getStringAsync();
        clipboardAccessTime = Date.now() - startTime;
      } catch (e) {
        // Silently handle clipboard read failures
      }

      // If we didn't get content or it was too fast, try again
      if (!content || clipboardAccessTime < 50) {
        // Small delay to ensure iOS processes the first request
        await new Promise(resolve => setTimeout(resolve, 100));

        // Second read - this often triggers the permission dialog
        // iOS sees repeated access attempts as potentially suspicious
        try {
          const secondStartTime = Date.now();
          content = await Clipboard.getStringAsync();
          clipboardAccessTime = Date.now() - secondStartTime;
        } catch (e) {
          // AGGRESSIVE WORKAROUND: Try a third time with longer delay
          await new Promise(resolve => setTimeout(resolve, 200));
          try {
            const thirdStartTime = Date.now();
            content = await Clipboard.getStringAsync();
            clipboardAccessTime = Date.now() - thirdStartTime;
          } catch (e2) {
            // Silently handle third read failure
          }
        }
      }

      const hasContent = !!(content && content.trim().length > 0 && content.length < 2000);
      const shouldShowModal = clipboardAccessTime > CLIPBOARD_PERMISSION_THRESHOLD_MS;

      // 5) Store the token to prevent re-triggering for the same copy event
      // In production: stores the actual changeCount
      // In Expo Go: stores the timestamp (but we always check anyway)
      await AsyncStorage.setItem(CLIPBOARD_TOKEN_KEY, String(tokenNow));

      // 6) Only open modal if:
      // - We have valid content
      // - The access time suggests iOS showed a permission dialog
      if (hasContent && shouldShowModal) {
        setClipboardContent(content);
        setIsAddModalOpen((cur) => (cur ? cur : true));
      }
      // если пусто — молча выходим (но токен уже обновлён, и повторов не будет)
    } catch (error) {
      // Silently handle clipboard check failures
    }
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousState = appState.current;
      
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        // App going to background - record the timestamp
        backgroundTimestamp.current = Date.now();
      } else if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground
        const now = Date.now();
        const timeInBackground = backgroundTimestamp.current 
          ? now - backgroundTimestamp.current 
          : 0;
        
        // Only update display order if app was in background for longer than threshold
        if (timeInBackground >= BACKGROUND_THRESHOLD_MS) {
          const newOrder = computeSortedOrder(tiles);
          setDisplayOrder(newOrder);
        }
        
        // Проверяем системный токен clipboard при возврате в актив
        checkClipboard();
        
        backgroundTimestamp.current = null;
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [tiles, checkClipboard, computeSortedOrder]);

  // Initialize display order when tiles are first loaded
  useEffect(() => {
    if (tiles.length > 0 && displayOrder.length === 0) {
      const initialOrder = computeSortedOrder(tiles);
      setDisplayOrder(initialOrder);
    }
  }, [tiles, displayOrder, computeSortedOrder]);

  const handleSortModeChange = useCallback((mode: SortMode) => {
    setSortMode(mode);
    storeSortMode(mode);
    const newOrder = computeSortedOrder(tiles, mode);
    setDisplayOrder(newOrder);
  }, [tiles, computeSortedOrder]);

  const applyImportedTiles = useCallback((importedTiles: TileType[]) => {
    const updatedTiles = [...tiles, ...importedTiles];
    setTiles(updatedTiles);
    const newOrder = computeSortedOrder(updatedTiles);
    setDisplayOrder(newOrder);
    showToast(`Imported ${importedTiles.length} nugget${importedTiles.length === 1 ? '' : 's'}`);
  }, [tiles, computeSortedOrder, showToast]);

  const handleExport = useCallback(async () => {
    if (tiles.length === 0) {
      showToast('No nuggets to export');
      return;
    }

    const hasSecure = tiles.some(t => t.isSecure);
    if (hasSecure) {
      const authenticated = await authenticateWithBiometrics(
        'Authenticate to export secure nuggets'
      );
      if (!authenticated) {
        showToast('Authentication required to export secure nuggets');
        return;
      }
    }

    const result = await exportTiles(tiles);
    if (!result.success && result.error) {
      showToast(result.error);
    }
  }, [tiles, authenticateWithBiometrics, showToast]);

  const handleImport = useCallback(async () => {
    const result = await importTiles();

    if (!result.success) {
      if (result.error) {
        showToast(result.error);
      }
      return;
    }

    if (!result.tiles || result.tiles.length === 0) {
      showToast('No valid nuggets found in file');
      return;
    }

    if (result.checksumMismatch) {
      setPendingImportTiles(result.tiles);
      setChecksumWarningVisible(true);
      return;
    }

    applyImportedTiles(result.tiles);
  }, [showToast, applyImportedTiles]);

  const confirmChecksumImport = useCallback(() => {
    if (pendingImportTiles) {
      applyImportedTiles(pendingImportTiles);
    }
    setPendingImportTiles(null);
    setChecksumWarningVisible(false);
  }, [pendingImportTiles, applyImportedTiles]);

  const cancelChecksumImport = useCallback(() => {
    setPendingImportTiles(null);
    setChecksumWarningVisible(false);
  }, []);

  const loadTilesFromStorage = useCallback(async () => {
    try {
      const savedSortMode = await loadSortMode();
      const activeMode: SortMode = (
        savedSortMode === 'alphabetical_az' ||
        savedSortMode === 'alphabetical_za' ||
        savedSortMode === 'frequency'
      )
        ? (savedSortMode as SortMode)
        : savedSortMode === 'alphabetical'
          ? 'alphabetical_az'
          : 'frequency';
      setSortMode(activeMode);

      let loadedTiles = await loadTiles();

      if (loadedTiles.length === 0) {
        const { tiles: sampleTiles, isFirstLaunch } = await loadSampleTilesIfFirstLaunch();
        if (isFirstLaunch && sampleTiles.length > 0) {
          loadedTiles = sampleTiles;
          await storeTiles(sampleTiles);
          showToast('These are sample nuggets. Feel free to delete them!');
        }
      }

      setTiles(loadedTiles);
      if (loadedTiles.length > 0) {
        const initialOrder = computeSortedOrder(loadedTiles, activeMode);
        setDisplayOrder(initialOrder);
        
        const storageInfo = await getStorageInfo();
        if (storageInfo.isNearLimit) {
          showToast(`Storage at ${Math.round(storageInfo.percentUsed)}%. Consider deleting unused nuggets.`);
        }
      } else {
        setDisplayOrder([]);
      }
    } catch (error) {
      // Silently handle errors
    }
  }, [computeSortedOrder, showToast]);


  // Load tiles on mount
  useEffect(() => {
    loadTilesFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize clipboard token on first run to avoid false positives
  useEffect(() => {
    (async () => {
      try {
        const tokenNow = await getClipboardChangeToken();
        const lastStr = await AsyncStorage.getItem(CLIPBOARD_TOKEN_KEY);
        if (!lastStr && tokenNow) {
          await AsyncStorage.setItem(CLIPBOARD_TOKEN_KEY, String(tokenNow));
        }
      } catch {}
    })();
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (clipboardClearTimeoutRef.current) {
        clearTimeout(clipboardClearTimeoutRef.current);
      }
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);
  // Sort tiles based on display order (frozen during app session)
  const sortedTiles = useMemo(() => {
    if (displayOrder.length === 0) return tiles;
    
    // Create a map for quick lookup
    const tileMap = new Map(tiles.map(tile => [tile.id, tile]));
    
    // Sort based on displayOrder, append any new tiles not in displayOrder at the end
    const ordered = displayOrder
      .map(id => tileMap.get(id))
      .filter((tile): tile is TileType => tile !== undefined);
    
    // Add any tiles not in displayOrder (newly added)
    const orderedIds = new Set(displayOrder);
    const newTiles = tiles.filter(tile => !orderedIds.has(tile.id));
    
    return [...ordered, ...newTiles];
  }, [tiles, displayOrder]);

  // Filter tiles based on search query
  const filteredTiles = useMemo(() => {
    // If no search query, show all tiles
    if (!searchQuery.trim()) {
      // But if search is focused and empty, show no tiles
      if (isSearchFocused) {
        return [];
      }
      return sortedTiles;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return sortedTiles.filter((tile) => {
      // Always search in tile name
      const nameMatch = tile.name.toLowerCase().includes(query);
      
      // For secure tiles, only search in name
      if (tile.isSecure) {
        return nameMatch;
      }
      
      // For non-secure tiles, search in both name and content
      const contentMatch = tile.content.toLowerCase().includes(query);
      return nameMatch || contentMatch;
    });
  }, [sortedTiles, searchQuery, isSearchFocused]);

  const handleDoubleTap = useCallback(
    async (tile: TileType) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (showingContentTileId === tile.id) {
        setShowingContentTileId(null);
        justRevealedRef.current = null; // Clear the flag when hiding content
        return;
      }

      if (tile.isSecure) {
        const authenticated = await authenticateWithBiometrics(`Authenticate to view ${tile.name}`);
        if (!authenticated) {
          // Clear pressed state immediately when authentication fails
          setPressedTileId(null);
          if (fadeTimeoutRef.current) {
            clearTimeout(fadeTimeoutRef.current);
            fadeTimeoutRef.current = null;
          }
          // Trigger red flash animation
          setFailedAuthTileId(tile.id);
          setFailedAuthTimestamp(Date.now());
          // Clear after fade-back has started to allow re-triggering
          setTimeout(() => {
            setFailedAuthTileId(null);
            setFailedAuthTimestamp(0);
          }, 160); // 160ms = 10ms after fade-back animation starts
          return;
        }
      }

      setShowingContentTileId(tile.id);
      justRevealedRef.current = tile.id; // Mark this tile as just revealed
    },
    [authenticateWithBiometrics, showingContentTileId]
  );

  const handleTileTap = useCallback(async (tile: TileType) => {
    // If any tile is showing content, close it first but continue with the tap action
    closeOpenTile();

    // If this tile was just revealed by double-tap, skip copy on first tap
    if (justRevealedRef.current === tile.id) {
      justRevealedRef.current = null; // Clear the flag for next tap
      return;
    }

    // Clear any existing fade timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }

    // Set this tile as the currently pressed one
    setPressedTileId(tile.id);
    setPressedTimestamp(Date.now());

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Clear the pressed state after fade animation
    const timeout = setTimeout(() => {
      setPressedTileId(null);
      fadeTimeoutRef.current = null;
    }, 4150);
    fadeTimeoutRef.current = timeout;

    // Biometric authentication for secure tiles
    if (tile.isSecure) {
      const authenticated = await authenticateWithBiometrics(`Authenticate to copy ${tile.name}`);
      if (!authenticated) {
        // Clear pressed state immediately when authentication fails
        setPressedTileId(null);
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = null;
        }
        // Trigger red flash animation
        setFailedAuthTileId(tile.id);
        setFailedAuthTimestamp(Date.now());
        // Clear after fade-back has started to allow re-triggering
        setTimeout(() => {
          setFailedAuthTileId(null);
          setFailedAuthTimestamp(0);
        }, 160); // 160ms = 10ms after fade-back animation starts
        return;
      }
    }

    // Copy to clipboard
    await Clipboard.setStringAsync(tile.content);
    
    // Auto-clear clipboard after 90 seconds for security
    if (clipboardClearTimeoutRef.current) {
      clearTimeout(clipboardClearTimeoutRef.current);
    }
    clipboardClearTimeoutRef.current = setTimeout(async () => {
      try {
        // Only clear if the content hasn't changed
        const currentClipboard = await Clipboard.getStringAsync();
        if (currentClipboard === tile.content) {
          await Clipboard.setStringAsync('');
        }
      } catch (error) {
        // Silently fail
      }
    }, 90000); // 90 seconds
    
    // Haptic feedback on successful copy
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    showToast(`Copied: ${tile.name}`);

    // Update usage count
    setTiles((prev) =>
      prev.map((t) =>
        t.id === tile.id
          ? { ...t, usageCount: t.usageCount + 1, lastUsed: Date.now() }
          : t
      )
    );
  }, [authenticateWithBiometrics, closeOpenTile, showToast]);

  const handleTileLongPress = useCallback((tile: TileType, position: { x: number; y: number }) => {
    setContextMenuTile(tile);
    setContextMenuPosition(position);
    setContextMenuVisible(true);
    setShowingContentTileId(null);
  }, []);

  const handleAddTile = (
    tileData: Omit<TileType, 'id' | 'usageCount' | 'createdAt' | 'lastUsed'>
  ) => {
    closeOpenTile();
    if (editingTile) {
      // Edit existing tile
      const updatedTiles = tiles.map((t) => 
        (t.id === editingTile.id ? { ...t, ...tileData } : t)
      );
      setTiles(updatedTiles);
      
      // If priority changed during edit, update display order immediately
      const oldTile = tiles.find(t => t.id === editingTile.id);
      if (oldTile && oldTile.isPriority !== tileData.isPriority) {
        const newOrder = computeSortedOrder(updatedTiles);
        setDisplayOrder(newOrder);
      }
      
      setEditingTile(null);
      showToast('Nugget updated');
    } else {
      // Add new tile
      const newTile: TileType = {
        ...tileData,
        id: Date.now().toString(),
        usageCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      const updatedTiles = [...tiles, newTile];
      setTiles(updatedTiles);
      
      // If the new tile is created as priority or secure, update display order immediately
      // Otherwise, add it to the end of display order
      if (newTile.isPriority) {
        const newOrder = computeSortedOrder(updatedTiles);
        setDisplayOrder(newOrder);
      } else {
        setDisplayOrder(prev => [...prev, newTile.id]);
      }
      
      // Clear clipboard content after successful creation
      setClipboardContent(null);
      
      showToast('Nugget created');
    }
  };

  const handleEditTile = async () => {
    if (contextMenuTile) {
      // Require authentication for secure tiles
      if (contextMenuTile.isSecure) {
        const authenticated = await authenticateWithBiometrics(`Authenticate to edit ${contextMenuTile.name}`);
        if (!authenticated) {
          setContextMenuVisible(false);
          // Trigger red flash animation
          setFailedAuthTileId(contextMenuTile.id);
          setFailedAuthTimestamp(Date.now());
          // Clear after fade-back has started to allow re-triggering
          setTimeout(() => {
            setFailedAuthTileId(null);
            setFailedAuthTimestamp(0);
          }, 160); // 160ms = 10ms after fade-back animation starts
          return;
        }
      }
      
      setEditingTile(contextMenuTile);
      setIsAddModalOpen(true);
      setContextMenuVisible(false);
    }
  };

  const handleDeleteTile = () => {
    setDeletingTile(contextMenuTile);
    setContextMenuVisible(false);
  };

  const confirmDelete = async () => {
    if (deletingTile) {
      // Require authentication for secure tiles
      if (deletingTile.isSecure) {
        const authenticated = await authenticateWithBiometrics(`Authenticate to delete ${deletingTile.name}`);
        if (!authenticated) {
          setDeletingTile(null);
          // Trigger red flash animation
          setFailedAuthTileId(deletingTile.id);
          setFailedAuthTimestamp(Date.now());
          // Clear after fade-back has started to allow re-triggering
          setTimeout(() => {
            setFailedAuthTileId(null);
            setFailedAuthTimestamp(0);
          }, 160); // 160ms = 10ms after fade-back animation starts
          return;
        }
        
        // Clean up SecureStore after authentication
        await deleteTileSecureContent(deletingTile.id);
      }
      
      setTiles((prev) => prev.filter((t) => t.id !== deletingTile.id));
      setDisplayOrder(prev => prev.filter(id => id !== deletingTile.id));
      showToast('Nugget deleted');
      setDeletingTile(null);
    }
  };

  const handleTogglePriority = () => {
    if (contextMenuTile) {
      // Update the tile's priority status
      const updatedTiles = tiles.map((t) =>
        t.id === contextMenuTile.id ? { ...t, isPriority: !t.isPriority } : t
      );
      setTiles(updatedTiles);
      
      // Immediately update display order when priority changes (exception to frozen order)
      const newOrder = computeSortedOrder(updatedTiles);
      setDisplayOrder(newOrder);
      
      showToast(
        contextMenuTile.isPriority ? 'Priority removed' : 'Priority added'
      );
      setContextMenuVisible(false);
    }
  };

  const handleToggleSecure = async () => {
    if (contextMenuTile) {
      // If tile is currently secure, require biometric authentication to unsecure it
      if (contextMenuTile.isSecure) {
        const authenticated = await authenticateWithBiometrics(`Authenticate to unsecure ${contextMenuTile.name}`);
        if (!authenticated) {
          setContextMenuVisible(false);
          // Trigger red flash animation
          setFailedAuthTileId(contextMenuTile.id);
          setFailedAuthTimestamp(Date.now());
          // Clear after fade-back has started to allow re-triggering
          setTimeout(() => {
            setFailedAuthTileId(null);
            setFailedAuthTimestamp(0);
          }, 160); // 160ms = 10ms after fade-back animation starts
          return;
        }
      }

      // Toggle the secure state
      setTiles((prev) =>
        prev.map((t) =>
          t.id === contextMenuTile.id ? { ...t, isSecure: !t.isSecure } : t
        )
      );
      showToast(
        contextMenuTile.isSecure ? 'Nugget unsecured' : 'Nugget secured'
      );
      setContextMenuVisible(false);
    }
  };

  const renderTile = useCallback(
    ({ item }: { item: TileType }) => (
      <View style={styles.tileWrapper}>
        <Tile
          tile={item}
          onTap={handleTileTap}
          onDoubleTap={handleDoubleTap}
          onLongPress={handleTileLongPress}
          pressedTileId={pressedTileId}
          pressedTimestamp={pressedTimestamp}
          failedAuthTileId={failedAuthTileId}
          failedAuthTimestamp={failedAuthTimestamp}
          isContextMenuOpen={contextMenuVisible}
          showContent={showingContentTileId === item.id}
        />
      </View>
    ),
    [
      handleTileTap,
      handleDoubleTap,
      handleTileLongPress,
      pressedTileId,
      pressedTimestamp,
      failedAuthTileId,
      failedAuthTimestamp,
      contextMenuVisible,
      showingContentTileId,
    ]
  );

  const keyExtractor = useCallback((item: TileType) => item.id, []);

  const listHeaderComponent = useMemo(
    () => <View style={{ height: keyboardHeight > 0 ? 20 : 100 }} />,
    [keyboardHeight]
  );

  const renderEmptyState = () => {
    // Search is focused but empty - show nothing
    if (isSearchFocused && !searchQuery.trim()) {
      return null;
    }

    // No search results
    if (searchQuery.trim() && filteredTiles.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyDescription}>
            Try a different search term
          </Text>
        </View>
      );
    }

    // No tiles at all
    return (
      <View style={styles.emptyState}>
        <Image
          source={require('../../assets/empty-state.png')}
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <Text style={styles.emptyTitle}>No nuggets yet</Text>
        <Text style={styles.emptyDescription}>
          Tap the + button to create your first nugget
        </Text>
        <TouchableOpacity
          style={styles.emptyAddButton}
          onPress={() => {
            closeOpenTile();
            setIsAddModalOpen(true);
          }}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Create first nugget"
          accessibilityHint="Opens the create new nugget dialog"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#000000"
        hidden={false}
      />
      {/* Header */}
      <View style={[styles.header, isScrolled && styles.headerScrolled, { paddingTop: insets.top + (isScrolled ? 10 : 20), paddingBottom: isScrolled ? 10 : 20 }]}>
        <Pressable onPress={closeOpenTile} style={styles.headerLeft}>
          <Text style={[styles.headerTitle, isScrolled && styles.headerTitleScrolled]}>
            Nuggio
          </Text>
          {searchQuery.trim() && (
            <Text style={styles.resultsCounter}>
              {filteredTiles.length} {filteredTiles.length === 1 ? 'result' : 'results'} found
            </Text>
          )}
        </Pressable>
        <TouchableOpacity
          onPress={() => setIsBottomMenuVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerMenuButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityHint="Opens settings menu"
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View 
        style={[styles.contentWrapper, keyboardHeight > 0 && { marginBottom: keyboardHeight }]}
        onTouchEnd={(e) => {
          if (e.nativeEvent.target === e.nativeEvent.currentTarget) {
            closeOpenTile();
            if (isSearchFocused && !searchQuery.trim()) {
              Keyboard.dismiss();
              setTimeout(() => {
                setIsSearchFocused(false);
              }, 100);
            }
          }
        }}
      >
        {tiles.length === 0 ? (
          renderEmptyState()
        ) : filteredTiles.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={filteredTiles}
            renderItem={renderTile}
            keyExtractor={keyExtractor}
            numColumns={3}
            inverted
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            ListHeaderComponent={listHeaderComponent}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            onScroll={(event) => {
              if (!isScrollable) {
                if (isScrolled) setIsScrolled(false);
                return;
              }
              const offset = event.nativeEvent.contentOffset.y;
              const maxScroll = contentHeight - containerHeight;
              const isBouncing = offset < 0 || (maxScroll > 0 && offset > maxScroll + 5);
              if (isBouncing) return;
              if (offset > 100 && !isScrolled) setIsScrolled(true);
              else if (offset < 15 && isScrolled) setIsScrolled(false);
            }}
            scrollEventThrottle={16}
            onContentSizeChange={(_, h) => setContentHeight(h)}
            onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
          />
        )}
      </View>

      {/* Bottom Bar: Search and FAB */}
      <View style={[
        styles.bottomBar,
        keyboardHeight > 0 && { bottom: keyboardHeight + 2 }
      ]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              closeOpenTile();
              setToastVisible(false); // Hide toast when search is activated
              setIsSearchFocused(true);
            }}
            onBlur={handleSearchBlur}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            keyboardAppearance="dark"
            accessible={true}
            accessibilityLabel="Search nuggets"
            accessibilityHint="Search for nuggets by name or content"
          />
          {(isSearchFocused || searchInput.length > 0 || searchQuery.length > 0) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              accessibilityHint="Tap to close search query"
            >
              <View style={styles.clearButtonCircle}>
                <Ionicons name="close" size={14} color={colors.background} accessibilityElementsHidden={true} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Floating Action Button for New Tile */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            closeOpenTile();
            setIsAddModalOpen(true);
          }}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new nugget"
          accessibilityHint="Opens the create new nugget dialog"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <AddTileModal
        visible={isAddModalOpen && !editingTile}
        onClose={() => {
          setIsAddModalOpen(false);
          setClipboardContent(null);
        }}
        onSave={handleAddTile}
        prefillContent={clipboardContent || undefined}
      />

      <AddTileModal
        visible={isAddModalOpen && !!editingTile}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTile(null);
        }}
        onSave={handleAddTile}
        editTile={editingTile}
      />

      <DeleteConfirmDialog
        visible={!!deletingTile}
        tileName={deletingTile?.name || ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTile(null)}
      />

      <ContextMenu
        visible={contextMenuVisible}
        tile={contextMenuTile}
        position={contextMenuPosition}
        onEdit={handleEditTile}
        onDelete={handleDeleteTile}
        onTogglePriority={handleTogglePriority}
        onToggleSecure={handleToggleSecure}
        onClose={() => setContextMenuVisible(false)}
      />

      <BottomMenu
        visible={isBottomMenuVisible}
        currentSortMode={sortMode}
        onSortChange={handleSortModeChange}
        onExport={handleExport}
        onImport={handleImport}
        onClose={() => setIsBottomMenuVisible(false)}
      />

      <AlertDialog
        visible={checksumWarningVisible}
        title="File may have been modified"
        description="The integrity check failed. This file may have been edited outside of Nuggio. Do you still want to import?"
        confirmText="Import"
        cancelText="Cancel"
        confirmVariant="destructive"
        onConfirm={confirmChecksumImport}
        onCancel={cancelChecksumImport}
      />

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        keyboardOffset={keyboardHeight}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerMenuButton: {
    paddingTop: 8,
    paddingLeft: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.4,
  },
  headerScrolled: {
    // paddingTop and paddingBottom controlled by inline styles
  },
  headerTitleScrolled: {
    fontSize: 17,
  },
  resultsCounter: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.mutedForeground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  contentWrapper: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.searchBar,
    borderRadius: 22,
    paddingHorizontal: 18,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
    margin: 0,
    letterSpacing: 0.5,
  },
  clearButton: {
    marginLeft: 8,
  },
  clearButtonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.mutedForeground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: 12,
    flexDirection: 'row-reverse',
    marginHorizontal: -6,
  },
  tileWrapper: {
    flexBasis: '33.33%',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingBottom: 100,
  },
  emptyImage: {
    width: 192,
    height: 192,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.mutedForeground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.mutedForeground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});


