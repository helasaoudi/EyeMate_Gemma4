import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { BACKEND_CONFIG } from '../config/backendConfig';
import { waitForBackendModelReady } from './waitForBackendModel';

export type ImageAnalysisCallback = (description: string) => void;
export type ImageAnalysisErrorCallback = (error: string) => void;

class ImageAnalysisService {
  private readonly BACKEND_URL = BACKEND_CONFIG.INFER_URL;
  private readonly ANALYSIS_PROMPT = BACKEND_CONFIG.PROMPT;

  async analyzeImage(
    imageUri: string,
    onResult: ImageAnalysisCallback,
    onError?: ImageAnalysisErrorCallback
  ): Promise<string> {
    try {
      console.log('🖼️ Analyzing image:', imageUri);

      await waitForBackendModelReady();

      // Read the image file as base64
      const imageData = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create FormData for the request
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);
      formData.append('text', this.ANALYSIS_PROMPT);

      // Send request to backend
      console.log('🖼️ Sending request to:', this.BACKEND_URL);
      console.log('🖼️ FormData keys:', Object.keys(formData));
      console.log('🖼️ Image URI:', imageUri);
      console.log('🖼️ Prompt:', this.ANALYSIS_PROMPT);
      
      console.log(
        '🖼️ Request in flight (Gemma can take minutes); waiting for server...'
      );
      // Do not set Content-Type — axios adds multipart boundary for FormData.
      const response = await axios.post(this.BACKEND_URL, formData, {
        timeout: BACKEND_CONFIG.INFER_TIMEOUT_MS,
        validateStatus: () => true,
        headers: { ...BACKEND_CONFIG.COMMON_HEADERS },
      });

      console.log('🖼️ Response status:', response.status);

      if (response.status < 200 || response.status >= 300) {
        const errorText =
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
        console.error('🖼️ Backend error response:', errorText);
        if (response.status === 503) {
          throw new Error(
            'Model is still loading on the server. Wait a minute and try again, or check Docker logs.'
          );
        }
        throw new Error(`Backend request failed: ${response.status} - ${errorText}`);
      }

      const result = response.data as Record<string, unknown>;
      console.log('🖼️ Backend response:', result);
      
      // Nested result from backend: { description: "..." } or legacy single-key map
      let description = '';
      if (result.result && typeof result.result === 'object') {
        const r = result.result as Record<string, string>;
        if (typeof r.description === 'string') {
          description = r.description;
        } else {
          const taskKey = Object.keys(r)[0];
          description = r[taskKey];
        }
        console.log('🖼️ Extracted description from nested result:', description);
      } else if (result.description || result.text || result.result) {
        description = String(
          result.description ?? result.text ?? result.result ?? ''
        );
        console.log('🖼️ Direct description:', description);
      } else {
        throw new Error('No description found in response');
      }
      
      console.log('🖼️ Final image analysis result:', description);
      
      if (onResult) {
        onResult(description);
      }
      
      return description;

    } catch (error: any) {
      console.error('Error analyzing image:', error);
      const errorMessage = error.message || 'Failed to analyze image';
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw error;
    }
  }

  async analyzeMultipleImages(
    imageUris: string[],
    onProgress?: (current: number, total: number) => void,
    onError?: ImageAnalysisErrorCallback
  ): Promise<string[]> {
    const descriptions: string[] = [];
    
    try {
      console.log(`🖼️ analyzeMultipleImages called with ${imageUris.length} images`);
      console.log(`🖼️ Image URIs:`, imageUris);
      console.log(`🖼️ Backend URL:`, this.BACKEND_URL);

      for (let i = 0; i < imageUris.length; i++) {
        const imageUri = imageUris[i];
        
        console.log(`🖼️ Processing image ${i + 1}/${imageUris.length}`);
        
        if (onProgress) {
          onProgress(i + 1, imageUris.length);
        }

        try {
          const description = await this.analyzeImage(
            imageUri,
            (result) => {
              console.log(`🖼️ Image ${i + 1} analyzed:`, result);
            },
            (error) => {
              console.error(`❌ Error analyzing image ${i + 1}:`, error);
            }
          );
          
          descriptions.push(description);
          
          // Wait between requests (except for the last one)
          if (i < imageUris.length - 1) {
            console.log(`⏳ Waiting ${BACKEND_CONFIG.REQUEST_DELAY/1000} seconds before next analysis...`);
            await new Promise(resolve => setTimeout(resolve, BACKEND_CONFIG.REQUEST_DELAY));
          }
          
        } catch (error: any) {
          console.error(`Error analyzing image ${i + 1}:`, error);
          const errorMessage = `Failed to analyze image ${i + 1}: ${error.message}`;
          
          if (onError) {
            onError(errorMessage);
          }
          
          // Add placeholder for failed analysis
          descriptions.push(`[Error analyzing image ${i + 1}]`);
        }
      }

      console.log('🖼️ All images analyzed:', descriptions);
      return descriptions;

    } catch (error: any) {
      console.error('Error in batch image analysis:', error);
      if (onError) {
        onError(error.message || 'Batch analysis failed');
      }
      throw error;
    }
  }

  concatenateDescriptions(descriptions: string[]): string {
    if (descriptions.length === 0) {
      return 'No image descriptions available.';
    }

    const concatenated = descriptions
      .map((desc, index) => `Image ${index + 1}: ${desc}`)
      .join('\n\n');

    return `Environment Analysis Summary:\n\n${concatenated}`;
  }

  async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch(BACKEND_CONFIG.HEALTH_URL, {
        method: 'GET',
        headers: { ...BACKEND_CONFIG.COMMON_HEADERS },
      });
      if (!response.ok) return false;
      const j = (await response.json()) as { status?: string };
      return j.status === 'ready';
    } catch (error) {
      console.log('Backend not available:', error);
      return false;
    }
  }
}

export default new ImageAnalysisService();
