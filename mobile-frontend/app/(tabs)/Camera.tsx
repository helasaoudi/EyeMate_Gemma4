import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
  Dimensions,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import ttsService from '../../services/ttsService';
import voiceToTextService from '../../services/voiceToTextService';
import fileService from '../../services/fileService';
import imageAnalysisService from '../../services/imageAnalysisService';
import { handleGlobalVoiceCommand } from '../../services/globalVoiceCommands';

const { width } = Dimensions.get('window');

type AppState =
  | 'greeting'
  | 'listening'
  | 'processing'
  | 'analyzing'
  | 'error'
  | 'redirecting';

export default function CameraScreen() {
  const { quick: quickParam } = useLocalSearchParams<{ quick?: string }>();
  /** Opened via voice command (`?quick=1`) — skip long welcome + shorten countdown */
  const quickEntry = quickParam === '1';

  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<AppState>('greeting');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const listeningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true); // <--- AJOUT SÉCURITÉ
  const prevPermissionGranted = useRef<boolean | undefined>(undefined);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // --- FONCTION DE NETTOYAGE ---
  const cleanupAll = useCallback(async () => {
    isMounted.current = false;
    await ttsService.stop();
    await voiceToTextService.stopListening();
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    setIsListening(false);
  }, []);

  const getLocalizedText = (fr: string, en: string) =>
    ttsService.getLanguage() === 'fr' ? fr : en;

  const speakLocalized = async (fr: string, en: string, options?: any) => {
    if (!isMounted.current) return;
    await ttsService.speak(getLocalizedText(fr, en), options ?? {});
  };

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      startCameraApp();
      return () => {
        cleanupAll();
      };
    }, [cleanupAll])
  );

  /** If camera permission was just granted, start session (initial flow had exited early). */
  useEffect(() => {
    const granted = !!permission?.granted;
    if (prevPermissionGranted.current === false && granted && isMounted.current) {
      startCameraApp();
    }
    prevPermissionGranted.current = granted;
  }, [permission?.granted]);

  const startCameraApp = async () => {
    if (!isMounted.current) return;
    setState('greeting');
    setTranscript('');
    setStatusMessage(getLocalizedText('Initialisation...', 'Initializing...'));
    if (!permission?.granted) return;

    if (quickEntry) {
      setState('processing');
      setStatusMessage(getLocalizedText('Préparation...', 'Preparing...'));
      await new Promise((r) => setTimeout(r, 350));
      if (isMounted.current) await startAutoCapture({ quick: true });
      return;
    }

    await speakLocalized(
      'Bienvenue sur la caméra. Je vais analyser votre environnement.',
      'Welcome to the camera. I will analyze your environment.',
      { onDone: () => isMounted.current && startAutoCapture({ quick: false }) }
    );
  };

  const startAutoCapture = async (opts?: { quick?: boolean }) => {
    if (!isMounted.current) return;
    const quick = opts?.quick ?? false;
    setState('processing');
    setStatusMessage(getLocalizedText('Préparation...', 'Preparing...'));
    await voiceToTextService.stopListening();
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    setIsListening(false);
    if (!quick) {
      await speakLocalized(
        "Analyse de l'environnement. La photo sera prise automatiquement.",
        'Environment analysis. The photo will be taken automatically.'
      );
    }
    await new Promise((r) => setTimeout(r, quick ? 800 : 1200));
    if (!isMounted.current) return;
    Vibration.vibrate([100, 50, 100]);
    const uri = await takePicture();
    if (!uri) { goHomeWithError(); return; }
    await analyzeImage(uri);
    if (!isMounted.current) return;
    await new Promise(r => setTimeout(r, 600));
    await playBeepSound();
    if (isMounted.current) await startVoiceListening();
  };

  const takePicture = async (): Promise<string | null> => {
    try {
      if (!cameraRef.current || !isMounted.current) return null;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo.base64) return null;
      return await fileService.saveImage(photo.base64, fileService.generateFilename('environment'));
    } catch { return null; }
  };

  const analyzeImage = async (uri: string) => {
    if (!isMounted.current) return;
    try {
      setState('analyzing');
      setStatusMessage(getLocalizedText('Analyse en cours...', 'Analyzing...'));
      const description = await imageAnalysisService.analyzeImage(uri, () => {});
      if (!isMounted.current) return;
      setState('processing');
      setStatusMessage(
        getLocalizedText('Lecture de la description...', 'Reading description...')
      );
      await ttsService.speak(description);
    } finally {
      if (isMounted.current) setState('listening');
    }
  };

  const startVoiceListening = async () => {
    if (!isMounted.current) return;
    setState('listening');
    setIsListening(true);
    setStatusMessage(getLocalizedText('En écoute...', 'Listening...'));
    Vibration.vibrate(100);
    const success = await voiceToTextService.startListening(handleVoiceResult, restartListening);
    if (!success && isMounted.current) { restartListening(); return; }
    listeningTimer.current = setTimeout(stopVoiceListening, 10000);
  };

  const stopVoiceListening = async () => {
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    setIsListening(false);
    setState('processing');
    await voiceToTextService.stopListening();
  };

  const handleVoiceResult = async (text: string) => {
    if (!isMounted.current) return;
    if (!text) { restartListening(); return; }
    const clean = text.toLowerCase();
    setTranscript(clean);
    await voiceToTextService.stopListening();
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    setIsListening(false);
    const commandHandled = await handleGlobalVoiceCommand(clean, router, () => {
        if (isMounted.current) {
          speakLocalized('Très bien, nouvelle capture.', 'Okay, new capture.', {
            onDone: () => startAutoCapture({ quick: true }),
          });
        }
    });
    if (commandHandled) return;
    if (clean.includes('autre chose') || clean.includes('retry') || clean.includes('réessayer')) {
      if (isMounted.current) {
        await speakLocalized('Très bien, essayons à nouveau.', "Okay, let's try again.", {
          onDone: () => startAutoCapture({ quick: true }),
        });
      }
      return;
    }
    if (isMounted.current) restartListening();
  };

  const restartListening = async () => {
    if (!isMounted.current) return;
    setState('error');
    await speakLocalized(
      'Je n’ai pas compris. Dites "réessayer" ou "accueil".',
      'I did not understand. Say "try again" or "home".',
      { onDone: () => isMounted.current && startVoiceListening() }
    );
  };

  /** Post-analysis cue (asset bip.wav was missing from the repo). */
  const playBeepSound = async () => {
    if (!isMounted.current) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 40, 60, 40]);
    } catch (error) {
      console.log('Beep feedback error:', error);
    }
  };

  const goHomeWithError = async () => {
    if (!isMounted.current) return;
    setState('error');
    await speakLocalized('Erreur caméra. Retour à l’accueil.', 'Camera error. Returning home.');
    router.replace('/(tabs)');
  };

  if (!permission) return <View style={styles.darkBg}><ActivityIndicator size="large" color="#a855f7" /></View>;

  if (!permission.granted) {
    return (
      <Pressable style={styles.darkBg} onPress={requestPermission}>
        <Ionicons name="camera-outline" size={64} color="#a855f7" />
        <Text style={styles.text}>{getLocalizedText('Accès Caméra', 'Camera Access')}</Text>
        <Text style={styles.subText}>{getLocalizedText('Appuyez pour autoriser', 'Tap to allow')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />
      <View style={styles.overlayContainer}>
        <View style={styles.hudFrame} />
        <View style={styles.topStatus}>
          <Text style={styles.statusText}>{statusMessage}</Text>
          {(state === 'analyzing' || state === 'processing') && (
            <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
          )}
        </View>
        {transcript !== '' && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          </View>
        )}
        <View style={styles.bottomControls}>
          <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }], opacity: isListening ? 1 : 0.4 }]}>
            <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.micCircle}>
              <Ionicons name={isListening ? "mic" : "mic-off"} size={30} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.listeningHint}>
            {isListening ? getLocalizedText('🎤 Je vous écoute...', '🎤 Listening...') : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  darkBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#08041a' },
  text: { fontSize: 22, color: '#fff', marginTop: 15, fontWeight: '600' },
  subText: { fontSize: 16, color: '#a855f7', marginTop: 8 },
  overlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  hudFrame: { width: width * 0.85, height: width * 1.2, borderWidth: 2, borderColor: 'rgba(168, 85, 247, 0.4)', borderRadius: 30, backgroundColor: 'rgba(168, 85, 247, 0.03)' },
  topStatus: { position: 'absolute', top: 60, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  statusText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  transcriptContainer: { position: 'absolute', bottom: 160, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, maxWidth: '80%' },
  transcriptText: { color: '#4ade80', fontSize: 16, fontStyle: 'italic', textAlign: 'center' },
  bottomControls: { position: 'absolute', bottom: 40, alignItems: 'center' },
  micContainer: { marginBottom: 10 },
  micCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#a855f7', shadowOpacity: 0.5, shadowRadius: 10 },
  listeningHint: { color: '#a855f7', fontSize: 14, fontWeight: '600' }
});