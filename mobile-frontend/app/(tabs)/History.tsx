// app/(tabs)/History.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Dimensions,
  Vibration,
  ActivityIndicator,
  Animated,
  Easing
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import fileService from '../../services/fileService';
import ttsService from '../../services/ttsService';
import voiceToTextService from '../../services/voiceToTextService';
import { handleGlobalVoiceCommand } from '../../services/globalVoiceCommands';

const { width } = Dimensions.get('window');

type AppState = 'greeting' | 'listening' | 'processing' | 'loading' | 'error';

export default function GalleryScreen() {
  const router = useRouter();
  const [state, setState] = useState<AppState>('greeting');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  
  const listeningTimer = useRef<NodeJS.Timeout | null>(null);

  /* ===================== ANIMATIONS ===================== */
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(orbScale, { toValue: 1.2, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(orbScale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(orbOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
            Animated.timing(orbOpacity, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
          ])
        ])
      ).start();
    } else {
      orbScale.setValue(1);
      orbOpacity.setValue(0.3);
    }
  }, [isListening]);

  /* ===================== LOGIC ===================== */
  const getLocalizedText = (fr: string, en: string) => ttsService.getLanguage() === 'fr' ? fr : en;
  const speakLocalized = async (fr: string, en: string, options?: any) => {
    await ttsService.speak(getLocalizedText(fr, en), options ?? {});
  };

  useFocusEffect(
    useCallback(() => {
      startHistoryApp();
      return () => {
        ttsService.stop();
        voiceToTextService.stopListening();
        if (listeningTimer.current) clearTimeout(listeningTimer.current);
      };
    }, [])
  );

  const startHistoryApp = async () => {
    setState('greeting');
    setStatusMessage(getLocalizedText('Chargement...', 'Loading history...'));
    await speakLocalized(
      'Historique. Chargement de vos images.',
      'History. Loading your images.',
      { onDone: loadImages }
    );
  };

  const loadImages = async () => {
    setState('loading');
    try {
      const imageUris = await fileService.getImageUris();
      setImages(imageUris);
      startVoiceListening();
    } catch (error) {
      setState('error');
      startVoiceListening();
    }
  };

  const startVoiceListening = async () => {
    setState('listening');
    setIsListening(true);
    Vibration.vibrate(100);
    const success = await voiceToTextService.startListening(handleVoiceResult, restartListening);
    if (success) listeningTimer.current = setTimeout(stopVoiceListening, 10000);
  };

  const stopVoiceListening = async () => {
    setIsListening(false);
    setState('processing');
    await voiceToTextService.stopListening();
  };

  const handleVoiceResult = async (text: string) => {
    const clean = text.toLowerCase();
    setTranscript(clean);
    setIsListening(false);
    const handled = await handleGlobalVoiceCommand(clean, router);
    if (!handled) restartListening();
  };

  const restartListening = async () => {
    await speakLocalized('Commande non reconnue.', 'Unrecognized command.', { onDone: startVoiceListening });
  };

  const saveToGallery = async (uri: string) => {
    if (!permissionResponse?.granted) await requestPermission();
    const asset = await MediaLibrary.createAssetAsync(uri);
    await MediaLibrary.createAlbumAsync('EyeMate', asset, false);
    speakLocalized('Sauvegardé.', 'Saved.');
  };

  const shareImage = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08041a', '#1a0d3f']} style={StyleSheet.absoluteFill} />

      {/* Floating Orb Indicator (Mini Version) */}
      <View style={styles.orbHeader}>
        <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }], opacity: orbOpacity }]} />
        <Text style={styles.statusText}>
          {isListening ? getLocalizedText('J\'écoute...', 'Listening...') : getLocalizedText('Historique', 'History')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageCard}>
            <Image source={{ uri }} style={styles.imagePreview} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay}>
              <View style={styles.cardFooter}>
                <Text style={styles.imageDate}>Capture #{images.length - index}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.iconButton} onPress={() => saveToGallery(uri)}>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => shareImage(uri)}>
                    <Ionicons name="share-social-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        ))}

        {images.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={60} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>{getLocalizedText('Aucune image', 'No images found')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Transcript Toast */}
      {transcript !== '' && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      )}

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.homeGradient}>
            <Ionicons name="home" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  orbHeader: {
    paddingTop: 60,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  orb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#a855f7',
    marginRight: 10,
    shadowColor: '#a855f7',
    shadowRadius: 10,
    shadowOpacity: 1,
  },
  statusText: { color: '#fff', fontSize: 18, fontWeight: '300', letterSpacing: 1 },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 100 },
  imageCard: {
    width: '100%',
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imagePreview: { width: '100%', height: '100%' },
  cardOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  cardFooter: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageDate: { color: '#fff', fontSize: 14, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: 'rgba(255,255,255,0.3)', marginTop: 10, fontSize: 16 },
  transcriptContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  transcriptText: { color: '#a855f7', fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  homeBtn: { width: 60, height: 60, borderRadius: 30, elevation: 10, shadowColor: '#a855f7', shadowRadius: 15, shadowOpacity: 0.4 },
  homeGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
});