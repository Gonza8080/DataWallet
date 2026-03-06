import { registerWebModule } from 'expo';
import type { TextBlock } from './VisionOcr.types';

class VisionOcrModule {
  async recognizeTextAsync(_uriString: string): Promise<TextBlock[]> {
    throw new Error('OCR is not supported on web. Use a native build.');
  }
}

export default registerWebModule(VisionOcrModule as any, 'VisionOcr');
