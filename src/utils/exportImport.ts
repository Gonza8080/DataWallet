import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import GraphemeSplitter from 'grapheme-splitter';
import type { Tile } from '../types/tile';

const CHECKSUM_SECRET = 'nuggio_export_v1_2024';
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_NAME_GRAPHEMES = 25;
const MAX_CONTENT_GRAPHEMES = 250;

const splitter = new GraphemeSplitter();

interface ExportFile {
  app: 'nuggio';
  version: 1;
  exportedAt: number;
  checksum: string;
  tiles: ExportTile[];
}

interface ExportTile {
  name: string;
  content: string;
  isPriority: boolean;
  isSecure: boolean;
}

export interface ImportResult {
  success: boolean;
  tiles?: Tile[];
  count?: number;
  error?: string;
  checksumMismatch?: boolean;
}

async function computeChecksum(tilesJson: string): Promise<string> {
  const payload = CHECKSUM_SECRET + tilesJson;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

function truncateGraphemes(text: string, max: number): string {
  const graphemes = splitter.splitGraphemes(text);
  if (graphemes.length <= max) return text;
  return graphemes.slice(0, max).join('');
}

function validateAndSanitizeTile(raw: any): ExportTile | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.content !== 'string') return null;

  return {
    name: truncateGraphemes(raw.name.trim(), MAX_NAME_GRAPHEMES),
    content: truncateGraphemes(raw.content, MAX_CONTENT_GRAPHEMES),
    isPriority: typeof raw.isPriority === 'boolean' ? raw.isPriority : false,
    isSecure: typeof raw.isSecure === 'boolean' ? raw.isSecure : false,
  };
}

export async function exportTiles(tiles: Tile[]): Promise<{ success: boolean; error?: string }> {
  try {
    const exportTiles: ExportTile[] = tiles.map(t => ({
      name: t.name,
      content: t.content,
      isPriority: t.isPriority,
      isSecure: t.isSecure,
    }));

    const tilesJson = JSON.stringify(exportTiles);
    const checksum = await computeChecksum(tilesJson);

    const exportData: ExportFile = {
      app: 'nuggio',
      version: 1,
      exportedAt: Date.now(),
      checksum,
      tiles: exportTiles,
    };

    const filePath = `${FileSystem.cacheDirectory}nuggio_export.json`;
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2));

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Nuggio nuggets',
      UTI: 'public.json',
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Export failed:', message);
    return { success: false, error: `Export failed: ${message}` };
  }
}

export async function importTiles(): Promise<ImportResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false };
    }

    const asset = result.assets[0];

    if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
      return { success: false, error: 'File is too large (max 2MB)' };
    }

    const content = await FileSystem.readAsStringAsync(asset.uri);

    if (content.length > MAX_FILE_SIZE_BYTES) {
      return { success: false, error: 'File content is too large' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'Invalid file format: not valid JSON' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid file format' };
    }
    if (parsed.app !== 'nuggio') {
      return { success: false, error: 'This file is not a Nuggio export' };
    }
    if (parsed.version !== 1) {
      return { success: false, error: `Unsupported export version: ${parsed.version}` };
    }
    if (!Array.isArray(parsed.tiles)) {
      return { success: false, error: 'Invalid file: no tiles found' };
    }

    // Checksum verification
    let checksumMismatch = false;
    if (typeof parsed.checksum === 'string') {
      const tilesJson = JSON.stringify(parsed.tiles);
      const expectedChecksum = await computeChecksum(tilesJson);
      checksumMismatch = parsed.checksum !== expectedChecksum;
    } else {
      checksumMismatch = true;
    }

    const now = Date.now();
    const validTiles: Tile[] = [];

    for (const raw of parsed.tiles) {
      const sanitized = validateAndSanitizeTile(raw);
      if (sanitized) {
        validTiles.push({
          id: `${now}_${Math.random().toString(36).slice(2, 9)}`,
          name: sanitized.name,
          content: sanitized.content,
          isPriority: sanitized.isPriority,
          isSecure: sanitized.isSecure,
          usageCount: 0,
          createdAt: now,
          lastUsed: now,
        });
      }
    }

    if (validTiles.length === 0) {
      return { success: false, error: 'No valid nuggets found in file' };
    }

    if (checksumMismatch) {
      return {
        success: true,
        tiles: validTiles,
        count: validTiles.length,
        checksumMismatch: true,
      };
    }

    return {
      success: true,
      tiles: validTiles,
      count: validTiles.length,
      checksumMismatch: false,
    };
  } catch (error) {
    return { success: false, error: 'Failed to import file' };
  }
}
