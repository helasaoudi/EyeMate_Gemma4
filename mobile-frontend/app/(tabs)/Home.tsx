import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  Vibration,
  View,
  Pressable,
  Easing,
  ActivityIndicator
} from 'react-native';
// AJOUT DE L'IMPORT AUDIO ICI
import { Audio } from 'expo-av'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import ttsService from '../../services/ttsService';
import voiceToTextService from '../../services/voiceToTextService';
import { handleGlobalVoiceCommand } from '../../services/globalVoiceCommands';

const { width } = Dimensions.get('window');

const VoiceWave = ({ active }: { active: boolean }) => {
  const anims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;

  useEffect(() => {
    if (active) {
      const animations = anims.map((anim, i) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 400 + i * 100,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 400 + i * 100,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: false,
            }),
          ])
        );
      });
      Animated.parallel(animations).start();
    } else {
      anims.forEach(anim => anim.setValue(0));
    }
  }, [active]);

  return (
    <View style={styles.waveRow}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 25],
              }),
              opacity: active ? 1 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState('greeting');
  const [statusMessage, setStatusMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const listeningTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.6)).current;
  const bottomWaveY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(orbScale, { toValue: 1.15, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(orbScale, { toValue: 0.95, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(orbOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(orbOpacity, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      orbScale.setValue(1);
      orbOpacity.setValue(0.3);
    }
  }, [isListening]);

  const startApp = useCallback(async () => {
    if (!isMounted.current) return;
  
    setState('greeting');
    setTranscript('');
    setIsListening(false);
    setStatusMessage(ttsService.getLanguage() === 'fr' ? 'Initialisation...' : 'Initializing...');
  
    try {
      // Configuration audio globale
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
  
      await new Promise(resolve => setTimeout(resolve, 1500));
  
      if (isMounted.current) {
        const welcomeMsg = ttsService.getLanguage() === 'fr' 
          ? "Bonjour, comment puis-je vous aider ?" 
          : "Hi, how can I assist you today?";
        
        setStatusMessage(welcomeMsg);
        
        await ttsService.stop(); 
        
        // Amorce du moteur
        await ttsService.speak("", {}); 
  
        await ttsService.speak(welcomeMsg, {
          onDone: () => {
            if (isMounted.current) {
              setTimeout(() => {
                if (isMounted.current) startVoiceListening();
              }, 500);
            }
          },
          onError: (err) => console.error("TTS Error:", err)
        });
      }
    } catch (error) {
      console.error("Erreur initialisation audio:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      startApp();

      return () => {
        isMounted.current = false;
        ttsService.stop();
        voiceToTextService.stopListening();
        if (listeningTimer.current) clearTimeout(listeningTimer.current);
        setIsListening(false);
      };
    }, [startApp])
  );

  const startVoiceListening = async () => {
    if (!isMounted.current) return;
    
    setState('listening');
    setIsListening(true);
    setStatusMessage(ttsService.getLanguage() === 'fr' ? "Je vous écoute..." : "I'm listening...");
    Vibration.vibrate(100);

    const success = await voiceToTextService.startListening(handleVoiceResult, restart);
    
    if (!success && isMounted.current) {
        restart();
        return;
    }

    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    listeningTimer.current = setTimeout(stopVoiceListening, 12000);
  };

  const stopVoiceListening = async () => {
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    setIsListening(false);
    await voiceToTextService.stopListening();
  };

  const handleVoiceResult = async (text: string) => {
    if (!isMounted.current) return;
    if (!text) {
        restart();
        return;
    }

    const clean = text.toLowerCase();
    setTranscript(clean);
    setIsListening(false);
    
    await voiceToTextService.stopListening();

    const handled = await handleGlobalVoiceCommand(clean, router);
    
    if (!handled && isMounted.current) {
        restart();
    }
  };

  const restart = async () => {
    if (!isMounted.current) return;
    setState('error');
    const retryMsg = ttsService.getLanguage() === 'fr' 
        ? "Je n'ai pas compris votre commande." 
        : "I didn't catch that command.";
        
    await ttsService.speak(retryMsg, {
      onDone: () => {
        if (isMounted.current) startVoiceListening();
      }
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08041a', '#120a2e', '#1a0d3f']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.centerContent}>
        <View style={styles.orbWrapper}>
          <Animated.View style={[styles.outerGlow, { transform: [{ scale: orbScale }], opacity: Animated.multiply(orbOpacity, 0.3) }]} />
          <Animated.View style={[styles.mainOrb, { transform: [{ scale: orbScale }], opacity: orbOpacity }]}>
            <LinearGradient colors={['#c084fc', '#7c3aed', 'transparent']} style={styles.orbGradient} />
          </Animated.View>
          <View style={styles.iconCenterContainer}>
            <Ionicons name="mic-outline" size={40} color="#fff" style={{ marginBottom: 10 }} />
            <VoiceWave active={isListening} />
          </View>
          <View style={styles.innerRim} />
        </View>
        <Text style={styles.statusText}>{statusMessage}</Text>
        {transcript !== '' && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcript}>"{transcript}"</Text>
          </View>
        )}
      </View>

      <Animated.View style={[styles.bottomWaveContainer, { transform: [{ translateY: bottomWaveY }] }]}>
        <LinearGradient colors={['transparent', '#a855f7', '#e879f9']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.bottomWave} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08041a' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  orbWrapper: { width: 280, height: 280, justifyContent: 'center', alignItems: 'center', marginBottom: 50 },
  mainOrb: { width: 200, height: 200, borderRadius: 100, overflow: 'hidden', backgroundColor: 'rgba(124, 58, 237, 0.2)', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.3)' },
  orbGradient: { flex: 1 },
  outerGlow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#7c3aed' },
  innerRim: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  iconCenterContainer: { position: 'absolute', alignItems: 'center', zIndex: 5 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
  waveBar: { width: 3, backgroundColor: '#fff', borderRadius: 2 },
  statusText: { color: '#fff', fontSize: 22, fontWeight: '300', letterSpacing: 0.5, textAlign: 'center', marginBottom: 20 },
  transcriptContainer: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15 },
  transcript: { color: '#a855f7', fontSize: 16, fontStyle: 'italic', textAlign: 'center' },
  bottomWaveContainer: { position: 'absolute', bottom: 0, width: width, height: 80 },
  bottomWave: { flex: 1, opacity: 0.3 }
});