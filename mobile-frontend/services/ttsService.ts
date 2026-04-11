import * as Speech from 'expo-speech';

export type VoiceGender = 'male' | 'female';
export type Language = 'fr' | 'en';

interface SpeakOptions {
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
}

class TTSService {
  private isSpeaking = false;
  private selectedLanguage: Language = 'en';
  private currentLanguage = 'en-US';
  private voiceGender: VoiceGender = 'female';
  private currentText = '';
  private currentOptions: SpeakOptions = {};

  /* ================= LANG ================= */
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

  /* ================= CORE ================= */
  async speak(text: string, options: SpeakOptions = {}) {
    try {
      if (!text || text.trim().length === 0) return;

      // Arrêter toute parole précédente
      if (this.isSpeaking) {
        Speech.stop();
      }
      
      this.isSpeaking = true;
      this.currentText = text;
      this.currentOptions = options;

      Speech.speak(text, {
        language: this.currentLanguage,
        rate: 0.9,
        pitch: this.voiceGender === 'female' ? 1.1 : 0.9,
        volume: 1.0,

        onDone: () => {
          this.isSpeaking = false;
          this.currentText = '';
          options.onDone?.();
        },

        onStopped: () => {
          this.isSpeaking = false;
          this.currentText = '';
          options.onStopped?.();
        },

        onError: (error) => {
          this.isSpeaking = false;
          this.currentText = '';
          console.error('TTS Error:', error);
          options.onError?.(error);
        },
      });
    } catch (error) {
      this.isSpeaking = false;
      this.currentText = '';
      console.error('TTS speak failed:', error);
    }
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

  /* ================= CHECK ================= */
  async isAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return false;
    }
  }

  /* ================= UTILITY ================= */
  async speakWithControls(text: string, options: SpeakOptions = {}) {
    return this.speak(text, {
      ...options,
      onStopped: () => {
        this.isSpeaking = false;
        options.onStopped?.();
      }
    });
  }
}

export default new TTSService();