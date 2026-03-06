import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Tile } from '../types/tile';

const TILES_KEY = 'nuggio-nuggets';
const SORT_MODE_KEY = 'nuggio-sort-mode';
const FIRST_LAUNCH_KEY = 'nuggio-first-launch-done';
const SECURE_CONTENT_PREFIX = 'secure_tile_';

// AsyncStorage limits: ~6MB on iOS, ~10MB on Android
// We'll use conservative 5MB limit for cross-platform safety
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB
const WARNING_THRESHOLD = 0.8; // Warn at 80% capacity

export const storeTiles = async (tiles: Tile[]): Promise<{ success: boolean; error?: string }> => {
  try {
    // Separate secure and non-secure tiles
    const tilesForAsyncStorage = tiles.map(tile => {
      if (tile.isSecure) {
        // Store secure tile content separately in SecureStore
        // Replace content with a reference
        return {
          ...tile,
          content: `${SECURE_CONTENT_PREFIX}${tile.id}`, // Reference to SecureStore
        };
      }
      return tile;
    });
    
    // Store secure tile contents in SecureStore (iOS Keychain / Android EncryptedSharedPreferences)
    for (const tile of tiles) {
      if (tile.isSecure) {
        await SecureStore.setItemAsync(`${SECURE_CONTENT_PREFIX}${tile.id}`, tile.content);
      }
    }
    
    const jsonString = JSON.stringify(tilesForAsyncStorage);
    const sizeBytes = new Blob([jsonString]).size;
    
    // Check if we're approaching or exceeding the limit
    if (sizeBytes >= STORAGE_LIMIT_BYTES) {
      return {
        success: false,
        error: 'Storage full. Please delete some nuggets to continue.'
      };
    }
    
    await AsyncStorage.setItem(TILES_KEY, jsonString);
    return { success: true };
  } catch (error) {
    // Storage error - could be quota exceeded or other issues
    // In production, this should be reported to error tracking service
    return {
      success: false,
      error: 'Failed to save nuggets. Storage may be full.'
    };
  }
};

export const loadTiles = async (): Promise<Tile[]> => {
  try {
    const storedTiles = await AsyncStorage.getItem(TILES_KEY);
    if (!storedTiles) return [];
    
    const tiles: Tile[] = JSON.parse(storedTiles);
    
    // Load secure tile contents from SecureStore
    const tilesWithSecureContent = await Promise.all(
      tiles.map(async (tile) => {
        if (tile.isSecure && tile.content.startsWith(SECURE_CONTENT_PREFIX)) {
          // This is a reference - load actual content from SecureStore
          try {
            const secureContent = await SecureStore.getItemAsync(`${SECURE_CONTENT_PREFIX}${tile.id}`);
            return {
              ...tile,
              content: secureContent || tile.content, // Fallback to reference if not found
            };
          } catch (error) {
            // If SecureStore fails, return tile with reference (better than losing the tile)
            return tile;
          }
        }
        return tile;
      })
    );
    
    return tilesWithSecureContent;
  } catch (error) {
    // Return empty array on error - app continues to work with empty state
    // In production, this should be reported to error tracking service
    return [];
  }
};

export const deleteTileSecureContent = async (tileId: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(`${SECURE_CONTENT_PREFIX}${tileId}`);
  } catch (error) {
    // Silently fail - item might not exist or already deleted
  }
};

export const storeSortMode = async (mode: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(SORT_MODE_KEY, mode);
  } catch {
    // Silently fail
  }
};

export const loadSortMode = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(SORT_MODE_KEY);
  } catch {
    return null;
  }
};

const SAMPLE_TILES: Omit<Tile, 'id' | 'usageCount' | 'createdAt' | 'lastUsed'>[] = [
  { name: '👉 Tap me to copy', content: 'This text is copied instantly.', isPriority: false, isSecure: false },
  { name: '👁 Double tap to reveal', content: 'Content stays hidden until you need it.', isPriority: false, isSecure: false },
  { name: '📌 Hold to prioritize', content: 'Prioritize important tiles to keep them at hand.', isPriority: false, isSecure: false },
  { name: '🔒 Hold to secure', content: 'Mark sensitive information as secure and protect it.', isPriority: false, isSecure: false },
  { name: '📷 Add from image', content: 'Import text from screenshots or photos using text recognition.', isPriority: false, isSecure: false },
  { name: 'Zoom Meeting', content: 'https://zoom.us/j/123456789', isPriority: false, isSecure: false },
  { name: 'Passport No', content: 'AB 1234567', isPriority: false, isSecure: false },
  { name: 'IBAN', content: 'DE89 3704 0044 0532 0130 00', isPriority: false, isSecure: false },
  { name: 'Gym Membership', content: 'MBR-2024-08-5531', isPriority: false, isSecure: false },
  { name: 'LinkedIn Profile', content: 'linkedin.com/in/johndoe', isPriority: false, isSecure: false },
  { name: 'Email Signature', content: 'Best regards,\nJohn Doe', isPriority: false, isSecure: false },
];

export const loadSampleTilesIfFirstLaunch = async (): Promise<{ tiles: Tile[]; isFirstLaunch: boolean }> => {
  try {
    const done = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (done) return { tiles: [], isFirstLaunch: false };

    const existing = await AsyncStorage.getItem(TILES_KEY);
    if (existing) {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
      return { tiles: [], isFirstLaunch: false };
    }

    const now = Date.now();
    const n = SAMPLE_TILES.length;
    const sampleTiles: Tile[] = SAMPLE_TILES.map((t, i) => ({
      ...t,
      id: `sample_${now}_${i}`,
      usageCount: 0,
      createdAt: now - (n - 1 - i),
      lastUsed: now - (n - 1 - i),
    }));

    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
    return { tiles: sampleTiles, isFirstLaunch: true };
  } catch {
    return { tiles: [], isFirstLaunch: false };
  }
};

export const getStorageInfo = async (): Promise<{
  sizeBytes: number;
  sizeMB: number;
  percentUsed: number;
  isNearLimit: boolean;
}> => {
  try {
    const storedTiles = await AsyncStorage.getItem(TILES_KEY);
    const sizeBytes = storedTiles ? new Blob([storedTiles]).size : 0;
    const sizeMB = sizeBytes / (1024 * 1024);
    const percentUsed = (sizeBytes / STORAGE_LIMIT_BYTES) * 100;
    const isNearLimit = sizeBytes >= STORAGE_LIMIT_BYTES * WARNING_THRESHOLD;
    
    return {
      sizeBytes,
      sizeMB,
      percentUsed,
      isNearLimit,
    };
  } catch (error) {
    return {
      sizeBytes: 0,
      sizeMB: 0,
      percentUsed: 0,
      isNearLimit: false,
    };
  }
};


