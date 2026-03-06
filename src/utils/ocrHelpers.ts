import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_DIMENSION = 2500;

export type ImageSource = 'library' | 'camera';

/**
 * Picks or captures an image, then converts to a file:// URI for native Vision OCR.
 * manipulateAsync always produces a temp file URI that Vision can read.
 */
export async function pickAndResizeImage(
  source: ImageSource = 'library',
): Promise<{ uri: string; originalUri?: string } | null> {
  try {
    const { status } =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
          });

    if (result.canceled || !result.assets?.[0]?.uri) return null;

    const inputUri = result.assets[0].uri;

    const actions: Parameters<typeof manipulateAsync>[1] = [];

    const w = result.assets[0].width;
    const h = result.assets[0].height;
    if (w && h && w > h) {
      actions.push({ rotate: 90 });
    }

    const manipulated = await manipulateAsync(inputUri, actions, {
      compress: 0.85,
      format: SaveFormat.JPEG,
    });

    const needsResize =
      (manipulated.width ?? 0) > MAX_DIMENSION ||
      (manipulated.height ?? 0) > MAX_DIMENSION;
    const final =
      needsResize && manipulated.width != null && manipulated.height != null
        ? await manipulateAsync(
            manipulated.uri,
            manipulated.width > manipulated.height
              ? [{ resize: { width: MAX_DIMENSION } }]
              : [{ resize: { height: MAX_DIMENSION } }],
            { compress: 0.85, format: SaveFormat.JPEG },
          )
        : manipulated;

    return { uri: final.uri, originalUri: inputUri };
  } catch {
    return null;
  }
}

export async function deleteFilesIfExist(uris: string[]): Promise<void> {
  for (const uri of uris) {
    try {
      if (uri.startsWith('file://')) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // Ignore
    }
  }
}
