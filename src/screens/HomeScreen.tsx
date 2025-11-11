import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { storeTiles, loadTiles } from '../utils/storage';
import type { Tile as TileType } from '../types/tile';

// Minimum time in background (in milliseconds) before tile positions can be updated
// Options: 30000 (30 sec), 60000 (1 min), 180000 (3 min), 300000 (5 min)
const BACKGROUND_THRESHOLD_MS = 60000; // 1 minute - recommended default

export const HomeScreen: React.FC = () => {
  const [tiles, setTiles] = useState<TileType[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<TileType | null>(null);
  const [deletingTile, setDeletingTile] = useState<TileType | null>(null);
  const [pressedTileId, setPressedTileId] = useState<string | null>(null);
  const [pressedTimestamp, setPressedTimestamp] = useState<number>(0);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuTile, setContextMenuTile] = useState<TileType | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Double tap functionality
  const [showingContentTileId, setShowingContentTileId] = useState<string | null>(null);
  const lastTapRef = useRef<{ tileId: string; timestamp: number } | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clipboard prefill functionality
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  
  // Track display order separately from actual tile data
  // This order is frozen while app is active and only updates after background threshold
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const backgroundTimestamp = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  // Helper function to close any open tile
  const closeOpenTile = () => {
    if (showingContentTileId !== null) {
      setShowingContentTileId(null);
    }
  };

  // Check if clipboard content matches any existing tile
  const hasMatchingTile = (content: string): boolean => {
    const normalizedContent = content.trim().toLowerCase();
    return tiles.some(tile => 
      tile.content.trim().toLowerCase() === normalizedContent
    );
  };

  // Biometric authentication with retry logic and better error handling
  const authenticateWithBiometrics = async (promptMessage: string): Promise<boolean> => {
    try {
      // Check if biometric hardware is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        showToast('Biometric authentication not available on this device');
        return false;
      }

      // Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        showToast('No biometric credentials enrolled. Please set up Face ID or Touch ID in Settings');
        return false;
      }

      // Attempt authentication with up to 2 retries
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
          fallbackLabel: 'Use Passcode',
        });

        if (result.success) {
          return true;
        }

        // Authentication failed - check if we should retry
        // Note: result.success is false here, which means user failed auth or cancelled
        // We'll show a generic message and allow retry
        
        // Show retry message for failed attempts (but not on last attempt)
        if (attempt < 2) {
          showToast('Authentication failed. Please try again');
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // After 3 failed attempts
      showToast('Authentication failed after multiple attempts. Please try again later');
      return false;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      showToast('Authentication error occurred');
      return false;
    }
  };

  const handleClearSearch = () => {
    closeOpenTile();
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
    if (!searchQuery.trim()) {
      setIsSearchFocused(false);
    }
    // If search has text, keep it active but just close keyboard
    // isSearchFocused stays true to keep the X button visible
  };

  // Helper function to compute sorted tile order based on priority -> usage -> newest
  const computeSortedOrder = (tilesToSort: TileType[]): string[] => {
    const sorted = [...tilesToSort].sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
      return b.createdAt - a.createdAt;
    });
    return sorted.map(tile => tile.id);
  };

  // Load tiles on mount
  useEffect(() => {
    loadTilesFromStorage();
    checkClipboard();
  }, []);

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
    if (tiles.length > 0) {
      storeTiles(tiles);
    }
  }, [tiles]);

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
        
        // Check clipboard when app returns to foreground
        checkClipboard();
        
        backgroundTimestamp.current = null;
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [tiles]);

  // Initialize display order when tiles are first loaded
  useEffect(() => {
    if (tiles.length > 0 && displayOrder.length === 0) {
      const initialOrder = computeSortedOrder(tiles);
      setDisplayOrder(initialOrder);
    }
  }, [tiles, displayOrder]);

  const loadTilesFromStorage = async () => {
    const loadedTiles = await loadTiles();
    setTiles(loadedTiles);
    // Set initial display order
    if (loadedTiles.length > 0) {
      const initialOrder = computeSortedOrder(loadedTiles);
      setDisplayOrder(initialOrder);
    }
  };

  const checkClipboard = async () => {
    try {
      const content = await Clipboard.getStringAsync();
      
      // Directly open tile creation modal if:
      // 1. Content is not empty
      // 2. Content is reasonable length (not too long)
      // 3. Content doesn't already exist in a tile
      if (
        content && 
        content.trim().length > 0 && 
        content.length < 1000 &&
        !hasMatchingTile(content)
      ) {
        setClipboardContent(content);
        setIsAddModalOpen(true);
      }
    } catch (error) {
      // User denied permission or clipboard access failed
      console.log('Clipboard access denied or failed:', error);
    }
  };

  // Sort tiles based on display order (frozen during app session)
  const sortedTiles = React.useMemo(() => {
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
  const filteredTiles = React.useMemo(() => {
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

  const handleTileTap = async (tile: TileType) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;

    // If any tile is showing content, close it first but continue with the tap action
    closeOpenTile();

    // Check for double tap (within 300ms)
    if (lastTap && lastTap.tileId === tile.id && now - lastTap.timestamp < 300) {
      // Double tap detected - cancel any pending single tap action
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = null;
      handleDoubleTap(tile);
      return;
    }

    // Store this tap for double tap detection
    lastTapRef.current = { tileId: tile.id, timestamp: now };

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

    // Delay the copy action to wait for potential double tap
    tapTimeoutRef.current = setTimeout(async () => {
      // Biometric authentication for secure tiles
      if (tile.isSecure) {
        const authenticated = await authenticateWithBiometrics(`Authenticate to copy ${tile.name}`);
        if (!authenticated) {
          return;
        }
      }

      // Copy to clipboard
      await Clipboard.setStringAsync(tile.content);
      
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
    }, 300);
  };

  const handleDoubleTap = async (tile: TileType) => {
    // Haptic feedback for double tap
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // If closing the content, no auth needed
    if (showingContentTileId === tile.id) {
      setShowingContentTileId(null);
      return;
    }

    // Authentication for secure tiles before showing content
    if (tile.isSecure) {
      const authenticated = await authenticateWithBiometrics(`Authenticate to view ${tile.name}`);
      if (!authenticated) {
        return;
      }
    }

    // Show content after authentication (or immediately for non-secure tiles)
    setShowingContentTileId(tile.id);
  };

  const handleTileLongPress = (tile: TileType, position: { x: number; y: number }) => {
    setContextMenuTile(tile);
    setContextMenuPosition(position);
    setContextMenuVisible(true);
    // Clear any showing content when opening context menu
    setShowingContentTileId(null);
  };

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
      showToast('Tile updated');
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
      
      showToast('Tile created');
    }
  };

  const handleEditTile = () => {
    if (contextMenuTile) {
      setEditingTile(contextMenuTile);
      setIsAddModalOpen(true);
      setContextMenuVisible(false);
    }
  };

  const handleDeleteTile = () => {
    setDeletingTile(contextMenuTile);
    setContextMenuVisible(false);
  };

  const confirmDelete = () => {
    if (deletingTile) {
      setTiles((prev) => prev.filter((t) => t.id !== deletingTile.id));
      setDisplayOrder(prev => prev.filter(id => id !== deletingTile.id));
      showToast('Tile deleted');
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
        contextMenuTile.isSecure ? 'Tile unsecured' : 'Tile secured'
      );
      setContextMenuVisible(false);
    }
  };

  const renderTile = ({ item }: { item: TileType }) => (
    <View style={styles.tileWrapper}>
      <Tile
        tile={item}
        onTap={handleTileTap}
        onLongPress={handleTileLongPress}
        pressedTileId={pressedTileId}
        pressedTimestamp={pressedTimestamp}
        isContextMenuOpen={contextMenuVisible}
        showContent={showingContentTileId === item.id}
      />
    </View>
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
        <Text style={styles.emptyTitle}>No tiles yet</Text>
        <Text style={styles.emptyDescription}>
          Tap the + button to create your first tile
        </Text>
        <TouchableOpacity
          style={styles.emptyAddButton}
          onPress={() => {
            closeOpenTile();
            setIsAddModalOpen(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Pressable style={styles.header} onPress={closeOpenTile}>
        <Text style={styles.headerTitle}>DataWallet</Text>
        {searchQuery.trim() && (
          <Text style={styles.resultsCounter}>
            {filteredTiles.length} {filteredTiles.length === 1 ? 'result' : 'results'} found
          </Text>
        )}
      </Pressable>

      {/* Content */}
      <Pressable 
        style={[styles.contentWrapper, keyboardHeight > 0 && { marginBottom: keyboardHeight }]}
        onPress={() => {
          closeOpenTile();
          if (isSearchFocused && !searchQuery.trim()) {
            Keyboard.dismiss();
            // Delay the state update to prevent visual glitch
            setTimeout(() => {
              setIsSearchFocused(false);
            }, 100);
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
            keyExtractor={(item) => item.id}
            numColumns={3}
            inverted
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            ListHeaderComponent={() => <View style={{ height: keyboardHeight > 0 ? 20 : 100 }} />}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </Pressable>

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
            placeholder="SEARCH"
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
          />
          {(isSearchFocused || searchQuery.length > 0) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.clearButtonCircle}>
                <Text style={styles.clearButtonText}>✕</Text>
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
        >
          <Text style={styles.fabIcon}>+</Text>
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
    borderBottomWidth: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.4,
  },
  resultsCounter: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
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
  clearButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.background,
    lineHeight: 20,
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
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.mutedForeground,
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
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
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
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
});


