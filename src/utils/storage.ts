import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tile } from '../types/tile';

const TILES_KEY = 'datawallet-tiles';

export const storeTiles = async (tiles: Tile[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TILES_KEY, JSON.stringify(tiles));
  } catch (error) {
    console.error('Error storing tiles:', error);
  }
};

export const loadTiles = async (): Promise<Tile[]> => {
  try {
    const storedTiles = await AsyncStorage.getItem(TILES_KEY);
    return storedTiles ? JSON.parse(storedTiles) : [];
  } catch (error) {
    console.error('Error loading tiles:', error);
    return [];
  }
};


