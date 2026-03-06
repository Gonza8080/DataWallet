import { requireNativeModule } from 'expo';
import type { TextBlock } from './VisionOcr.types';

interface VisionOcrModuleInterface {
  recognizeTextAsync(uriString: string): Promise<TextBlock[]>;
}

export default requireNativeModule<VisionOcrModuleInterface>('VisionOcr');
