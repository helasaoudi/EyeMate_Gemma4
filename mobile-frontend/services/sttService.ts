// app/services/sttService.ts
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
  type ExpoSpeechRecognitionOptions
} from 'expo-speech-recognition';

export type VoiceToTextCallback = (text: string) => void;
export type VoiceToTextErrorCallback = (error: string) => void;

class VoiceToTextService {
  private isRecording: boolean = false;
  private onResultCallback: VoiceToTextCallback | null = null;
  private onErrorCallback: VoiceToTextErrorCallback | null = null;
  private finalTranscript: string = '';
  private interimTranscript: string = '';

  private getErrorMessage(errorCode: ExpoSpeechRecognitionErrorCode): string {
    const errorMessages: Record<string, string> = {
      'aborted': 'Reconnaissance annulée',
      'audio-capture': 'Erreur d\'enregistrement audio',
      'bad-grammar': 'Erreur de grammaire',
      'language-not-supported': 'Langue non supportée',
      'network': 'Erreur réseau',
      'no-speech': 'Aucune parole détectée',
      'not-allowed': 'Permission refusée',
      'service-not-allowed': 'Service non disponible',
      'busy': 'Service occupé',
      'client': 'Erreur client'
    };

    return errorMessages[errorCode] || `Erreur: ${errorCode}`;
  }

  async startListening(
    onResult: VoiceToTextCallback,
    onError?: VoiceToTextErrorCallback
  ): Promise<boolean> {
    try {
      // Vérifier les permissions
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (!granted) {
        console.error('🎤 Permissions not granted');
        if (onError) {
          onError('Permissions microphone refusées');
        }
        return false;
      }

      // Arrêter toute reconnaissance en cours
      if (this.isRecording) {
        await this.stopListening();
      }

      this.onResultCallback = onResult;
      this.onErrorCallback = onError || null;
      this.finalTranscript = '';
      this.interimTranscript = '';

      console.log('🎤 Starting speech recognition...');

      const options: ExpoSpeechRecognitionOptions = {
        lang: 'fr-FR',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: [
          'reconnaissance',
          'environnement',
          'caméra',
          'document',
          'lecture',
          'lire'
        ],
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
          EXTRA_MAX_RESULTS: 1
        },
        iosTaskHint: 'search',
        iosPrefersOnDeviceRecognition: false
      };

      // Démarrer la reconnaissance vocale
      ExpoSpeechRecognitionModule.start(options);

      this.isRecording = true;
      return true;

    } catch (error) {
      console.error('🎤 Error starting recognition:', error);
      if (onError) {
        onError('Impossible de démarrer la reconnaissance vocale');
      }
      return false;
    }
  }

  // Méthode pour traiter les résultats (appelée depuis le composant React)
  handleResult(results: any[]): void {
    if (!results || results.length === 0) return;

    const result = results[0];
    
    if (result.isFinal) {
      this.finalTranscript = result.transcript;
      console.log('🎤 Final transcript:', this.finalTranscript);
      
      if (this.onResultCallback && this.finalTranscript.trim()) {
        this.onResultCallback(this.finalTranscript);
      }
    } else {
      this.interimTranscript = result.transcript;
      console.log('🎤 Interim transcript:', this.interimTranscript);
    }
  }

  // Méthode pour traiter les erreurs (appelée depuis le composant React)
  handleError(errorCode: ExpoSpeechRecognitionErrorCode): void {
    console.error('🎤 Recognition error:', errorCode);
    this.isRecording = false;
    
    const errorMessage = this.getErrorMessage(errorCode);
    
    if (this.onErrorCallback) {
      this.onErrorCallback(errorMessage);
    }
  }

  // Méthode pour traiter la fin (appelée depuis le composant React)
  handleEnd(): void {
    console.log('🎤 Recognition ended');
    this.isRecording = false;
    
    if (this.finalTranscript.trim() && this.onResultCallback) {
      this.onResultCallback(this.finalTranscript);
    }
  }

  async stopListening(): Promise<string | null> {
    try {
      if (!this.isRecording) {
        return null;
      }

      console.log('🎤 Stopping recognition...');
      
      ExpoSpeechRecognitionModule.stop();
      
      this.isRecording = false;
      
      return this.finalTranscript || null;

    } catch (error) {
      console.error('🎤 Error stopping recognition:', error);
      this.isRecording = false;
      return null;
    } finally {
      this.onResultCallback = null;
      this.onErrorCallback = null;
    }
  }

  async abort(): Promise<void> {
    try {
      console.log('🎤 Aborting recognition...');
      ExpoSpeechRecognitionModule.abort();
      this.isRecording = false;
      this.finalTranscript = '';
      this.interimTranscript = '';
    } catch (error) {
      console.error('🎤 Error aborting recognition:', error);
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getFinalTranscript(): string {
    return this.finalTranscript;
  }

  getInterimTranscript(): string {
    return this.interimTranscript;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('🎤 Error checking availability:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('🎤 Error checking permissions:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('🎤 Error requesting permissions:', error);
      return false;
    }
  }

  destroy() {
    if (this.isRecording) {
      this.abort();
    }
    this.isRecording = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.finalTranscript = '';
    this.interimTranscript = '';
  }
}

export default new VoiceToTextService();