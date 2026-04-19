import axios from 'axios';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { ASSEMBLYAI_CONFIG } from '../config/assemblyaiConfig';

export type VoiceToTextCallback = (text: string) => void;
export type VoiceToTextErrorCallback = (error: string) => void;

class VoiceToTextService {
  private isRecording: boolean = false;
  private isStarting: boolean = false;
  private onResultCallback: VoiceToTextCallback | null = null;
  private onErrorCallback: VoiceToTextErrorCallback | null = null;
  private recording: Audio.Recording | null = null;
  private recordingStartTime: number = 0;
  
  private readonly MIN_RECORDING_DURATION = 1000;

  private getTranscribeHeaders(): Record<string, string> {
    const key = ASSEMBLYAI_CONFIG.API_KEY;
    if (!key) {
      console.error(
        '[voiceToText] Missing EXPO_PUBLIC_ASSEMBLYAI_API_KEY — add it to .env and restart Expo'
      );
    }
    return { authorization: key };
  }

  constructor() {
    this.setupAudio();
  }

  private async setupAudio() {
    try {
      await Audio.requestPermissionsAsync();
      await this.setAudioModeForRecording();
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  }

  /**
   * Required before every Recording session on iOS. TTS / playback leaves
   * `allowsRecordingIOS: false`, which triggers "Recording not allowed on iOS".
   */
  async setAudioModeForRecording(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
  }

  async startListening(
    onResult: VoiceToTextCallback,
    onError?: VoiceToTextErrorCallback
  ): Promise<boolean> {
    if (this.isStarting) return false;
    this.isStarting = true;

    try {
      await this.setAudioModeForRecording();

      // Nettoyage si un enregistrement existe déjà
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch (e) {}
        this.recording = null;
      }

      this.onResultCallback = onResult;
      this.onErrorCallback = onError || null;
      
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });

      await recording.startAsync();
      this.recording = recording;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      this.isRecording = false;
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  async stopListening(): Promise<string | null> {
    if (!this.recording) {
      this.isRecording = false;
      return null;
    }

    try {
      const recordingToStop = this.recording;
      this.recording = null; // Libérer la ref immédiatement
      this.isRecording = false;

      const duration = Date.now() - this.recordingStartTime;
      const uri = recordingToStop.getURI();
      
      await recordingToStop.stopAndUnloadAsync();

      if (duration < this.MIN_RECORDING_DURATION || !uri) {
        console.log("⚠️ Recording too short");
        return null;
      }

      const transcript = await this.transcribeAudioFile(uri);
      if (transcript && this.onResultCallback) {
        this.onResultCallback(transcript);
      }
      return transcript;

    } catch (error) {
      console.error("Error stopping voice recognition:", error);
      return null;
    }
  }

  private async transcribeAudioFile(audioUri: string): Promise<string> {
    const key = ASSEMBLYAI_CONFIG.API_KEY;
    if (!key) {
      throw new Error(
        'AssemblyAI key missing. Set EXPO_PUBLIC_ASSEMBLYAI_API_KEY in .env and restart Expo.'
      );
    }
    const headers = this.getTranscribeHeaders();
    const base = ASSEMBLYAI_CONFIG.BASE_URL;

    try {
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = atob(audioData);
      const audioBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }

      const uploadResponse = await axios.post(`${base}/v2/upload`, audioBytes, {
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      });

      const audioUrl = uploadResponse.data.upload_url;
      const transcriptResponse = await axios.post(
        `${base}/v2/transcript`,
        {
          audio_url: audioUrl,
          language_code: 'fr',
        },
        { headers }
      );

      return await this.pollTranscriptResult(transcriptResponse.data.id, headers, base);
    } catch (error) {
      throw error;
    }
  }

  private async pollTranscriptResult(
    transcriptId: string,
    headers: Record<string, string>,
    baseUrl: string
  ): Promise<string> {
    const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;
    while (true) {
      const response = await axios.get(pollingEndpoint, { headers });
      if (response.data.status === "completed") return response.data.text;
      if (response.data.status === "error") throw new Error("Transcription failed");
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  getIsRecording() { return this.isRecording; }

  destroy() {
    if (this.recording) this.recording.stopAndUnloadAsync();
    this.recording = null;
    this.isRecording = false;
  }
}

export default new VoiceToTextService();