import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export type VoiceGender = 'male' | 'female';
export type Language = 'fr' | 'en';

interface SpeakOptions {
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * iOS: recording mode (`allowsRecordingIOS: true`, used for the mic) prevents
 * expo-speech from playing through the speaker. Call this before Speech.speak.
 */
export async function setAudioModeForPlayback(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn('[TTS] setAudioModeForPlayback failed:', e);
  }
}

const SPEECH_CHUNK_MAX = 3200;

function chunkTextForSpeech(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      chunks.push(rest);
      break;
    }
    let slice = rest.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.55) slice = slice.slice(0, lastSpace);
    chunks.push(slice.trim());
    rest = rest.slice(slice.length).trimStart();
  }
  return chunks.length ? chunks : [''];
}

function normalizeForSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class TTSService {
  private isSpeaking = false;
  private selectedLanguage: Language = 'en';
  private currentLanguage = 'en-US';
  private voiceGender: VoiceGender = 'female';
  private currentText = '';
  private currentOptions: SpeakOptions = {};

  setLanguage(language: Language) {
    this.selectedLanguage = language;
    this.currentLanguage = language === 'fr' ? 'fr-FR' : 'en-US';
  }

  getLanguage(): Language {
    return this.selectedLanguage;
  }

  setVoiceGender(gender: VoiceGender) {
    this.voiceGender = gender;
  }

  getVoiceGender(): VoiceGender {
    return this.voiceGender;
  }

  /**
   * Speaks text; awaits until finished (chunks + onDone). Sets iOS audio to playback
   * before speaking so voice is audible after mic use.
   */
  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!text || !text.trim()) return;

    const cleaned = normalizeForSpeech(text);
    if (!cleaned) return;

    const chunks = chunkTextForSpeech(cleaned, SPEECH_CHUNK_MAX).filter(
      (c) => c.trim().length > 0
    );
    if (chunks.length === 0) return;

    if (this.isSpeaking) {
      Speech.stop();
    }

    await setAudioModeForPlayback();

    this.isSpeaking = true;
    this.currentText = cleaned;
    this.currentOptions = options;

    try {
      for (let i = 0; i < chunks.length; i++) {
        await this.speakChunkWithTimeout(chunks[i]);
        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 120));
        }
      }
      options.onDone?.();
    } catch (error) {
      console.error('TTS speak failed:', error);
      options.onError?.(error);
    } finally {
      this.isSpeaking = false;
      this.currentText = '';
    }
  }

  private speakChunkWithTimeout(chunk: string): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timeoutMs = Math.min(
        15 * 60 * 1000,
        Math.max(20000, Math.ceil((chunk.length / 11) * 1000))
      );
      const timer = setTimeout(() => {
        console.warn(
          `[TTS] Chunk onDone timeout (${timeoutMs}ms, ${chunk.length} chars) — unblocking`
        );
        finish();
      }, timeoutMs);

      Speech.speak(chunk, {
        language: this.currentLanguage,
        rate: 0.9,
        pitch: this.voiceGender === 'female' ? 1.1 : 0.9,
        volume: 1.0,
        onDone: finish,
        onStopped: finish,
        onError: (error) => {
          console.error('TTS Error:', error);
          finish();
        },
      });
    });
  }

  async stop() {
    try {
      Speech.stop();
      this.isSpeaking = false;
      this.currentText = '';
      this.currentOptions.onStopped?.();
    } catch (error) {
      console.error('Error stopping TTS:', error);
    }
  }

  async resume() {
    if (this.currentText && !this.isSpeaking) {
      await this.speak(this.currentText, this.currentOptions);
    }
  }

  getIsSpeaking() {
    return this.isSpeaking;
  }

  getCurrentText() {
    return this.currentText;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return false;
    }
  }

  async speakWithControls(text: string, options: SpeakOptions = {}) {
    return this.speak(text, {
      ...options,
      onStopped: () => {
        this.isSpeaking = false;
        options.onStopped?.();
      },
    });
  }
}

export default new TTSService();
