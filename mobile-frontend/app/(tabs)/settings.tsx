import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Image, 
  Dimensions, 
  Platform,
  Vibration,
  Animated,
  AccessibilityInfo
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ttsService from '../../services/ttsService';
import voiceToTextService from '../../services/voiceToTextService';
import { handleGlobalVoiceCommand, getAvailableCommands } from '../../services/globalVoiceCommands';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { language, voiceGender, changeLanguage, changeVoiceGender } = useSettings();
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const isMounted = useRef(true);
  const listeningTimer = useRef<NodeJS.Timeout | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ===================== ANIMATION ===================== */
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1.2, 
            duration: 1000, 
            useNativeDriver: true 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 1000, 
            useNativeDriver: true 
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isListening]);

  /* ===================== LIFECYCLE ===================== */
  useFocusEffect(
    React.useCallback(() => {
      isMounted.current = true;
      
      // Annonce vocale d'accueil
      speakLocalized(
        'Écran des paramètres. Vous pouvez modifier la langue, la voix ou vous déconnecter par commande vocale. Dites "aide" pour connaître les commandes disponibles.',
        'Settings screen. You can change language, voice or sign out using voice commands. Say "help" to know available commands.'
      );
      
      // Démarrer l'écoute automatiquement
      setTimeout(() => {
        if (isMounted.current) {
          startVoiceListening();
        }
      }, 1500);

      return () => {
        isMounted.current = false;
        cleanupResources();
      };
    }, [])
  );

  /* ===================== LOCALIZED TEXT ===================== */
  const getLocalizedText = (fr: string, en: string) =>
    ttsService.getLanguage() === 'fr' ? fr : en;

  const speakLocalized = async (fr: string, en: string, options?: any) => {
    if (!isMounted.current) return;
    await ttsService.speak(getLocalizedText(fr, en), options ?? {});
  };

  /* ===================== VOICE LISTENING ===================== */
  const startVoiceListening = async () => {
    if (!isMounted.current) return;

    setIsListening(true);
    setVoiceStatus(getLocalizedText('En écoute...', 'Listening...'));
    
    Vibration.vibrate(100);
    
    AccessibilityInfo.announceForAccessibility(
      getLocalizedText('Microphone activé. Parlez maintenant.', 'Microphone activated. Speak now.')
    );
    
    const success = await voiceToTextService.startListening(
      handleVoiceResult, 
      restartListening
    );
    
    if (!success && isMounted.current) {
      restartListening();
      return;
    }
    
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    listeningTimer.current = setTimeout(() => {
      if (isMounted.current) stopVoiceListening();
    }, 15000);
  };

  const stopVoiceListening = async () => {
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    setIsListening(false);
    await voiceToTextService.stopListening();
  };

  const handleVoiceResult = async (textReceived: string) => {
    if (!isMounted.current) return;
    
    if (!textReceived || textReceived.trim() === '') {
      restartListening();
      return;
    }

    const clean = textReceived.toLowerCase().trim();
    setTranscript(clean);
    
    await voiceToTextService.stopListening();
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    setIsListening(false);

    Vibration.vibrate(50);

    // 🔴 GESTION DES COMMANDES VOCALES
    const commandHandled = await handleGlobalVoiceCommand(
      clean,
      router,
      undefined, // Pas de refresh action ici
      {
        onLogout: handleSignOut,
        onLanguageChange: (lang: 'fr' | 'en') => {
          handleLanguageChange(lang);
        },
        onVoiceGenderChange: (gender: 'male' | 'female') => {
          handleVoiceGenderChange(gender);
        },
        onHelp: showHelp
      }
    );
    
    if (commandHandled) {
      console.log('✅ Voice command handled');
      return;
    }

    // Si aucune commande n'est reconnue
    if (isMounted.current) {
      restartListening();
    }
  };

  const restartListening = async () => {
    if (!isMounted.current) return;

    await speakLocalized(
      'Commande non reconnue. Dites "aide" pour connaître les commandes disponibles.',
      'Command not recognized. Say "help" to know available commands.',
      { onDone: () => {
        if (isMounted.current) {
          setTimeout(() => startVoiceListening(), 800);
        }
      }}
    );
  };

  const cleanupResources = async () => {
    await ttsService.stop();
    await voiceToTextService.stopListening();
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    setIsListening(false);
  };

  /* ===================== HANDLERS ===================== */
  const handleSignOut = () => {
    Alert.alert(
      getLocalizedText('Déconnexion', 'Logout'),
      getLocalizedText(
        'Êtes-vous sûr de vouloir vous déconnecter ?',
        'Are you sure you want to sign out?'
      ),
      [
        { 
          text: getLocalizedText('Annuler', 'Cancel'), 
          style: 'cancel',
          onPress: () => {
            if (isMounted.current) startVoiceListening();
          }
        },
        {
          text: getLocalizedText('Déconnexion', 'Sign Out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await speakLocalized(
                'Déconnexion en cours...',
                'Signing out...'
              );
              await signOut();
              router.replace('/(auth)/sign-in');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
              if (isMounted.current) startVoiceListening();
            }
          },
        },
      ]
    );
  };

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    changeLanguage(lang);
    i18n.changeLanguage(lang);
    ttsService.setLanguage(lang);
    
    const confirmationMessage = lang === 'fr' 
      ? 'Langue changée en français.' 
      : 'Language changed to English.';
    
    ttsService.speak(confirmationMessage, {
      onDone: () => {
        if (isMounted.current) startVoiceListening();
      }
    });
  };

  const handleVoiceGenderChange = (gender: 'male' | 'female') => {
    changeVoiceGender(gender);
    ttsService.setVoiceGender(gender);
    
    const confirmationMessage = ttsService.getLanguage() === 'fr'
      ? `Voix changée en ${gender === 'male' ? 'masculine' : 'féminine'}.`
      : `Voice changed to ${gender === 'male' ? 'male' : 'female'}.`;
    
    ttsService.speak(confirmationMessage, {
      onDone: () => {
        if (isMounted.current) startVoiceListening();
      }
    });
  };

  const showHelp = () => {
    Alert.alert(
      getLocalizedText('Aide - Commandes vocales', 'Help - Voice Commands'),
      getAvailableCommands(ttsService.getLanguage()),
      [
        {
          text: getLocalizedText('OK', 'OK'),
          onPress: () => {
            if (isMounted.current) startVoiceListening();
          }
        }
      ]
    );
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08041a', '#120a2e']} style={StyleSheet.absoluteFill} />
      
      {/* Voice Listening Indicator */}
      {isListening && (
        <View style={styles.voiceOverlay}>
          <Animated.View style={[styles.micPulse, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.micButton}>
              <Ionicons name="mic" size={30} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.voiceStatus}>{voiceStatus}</Text>
          <Text style={styles.voiceHint}>
            {getLocalizedText(
              'Dites "aide" pour les commandes',
              'Say "help" for commands'
            )}
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('settings', 'Settings')}</Text>
          <Text style={styles.headerSubtitle}>
            {getLocalizedText(
              'Personnalisez votre expérience EyeMate',
              'Personalize your EyeMate experience'
            )}
          </Text>
        </View>

        {/* Profile Card */}
        <View style={styles.glassCard}>
          <View style={styles.profileHeader}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.profileImage} />
            ) : (
              <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>{user?.firstName?.[0] || '?'}</Text>
              </LinearGradient>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress}</Text>
            </View>
          </View>
        </View>

        {/* Voice Commands Info */}
        <View style={styles.voiceCommandsCard}>
          <View style={styles.voiceCommandsHeader}>
            <Ionicons name="mic-circle" size={32} color="#a855f7" />
            <Text style={styles.voiceCommandsTitle}>
              {getLocalizedText('Commandes Vocales', 'Voice Commands')}
            </Text>
          </View>
          <Text style={styles.voiceCommandsText}>
            {getLocalizedText(
              'Dites : "Français", "Anglais", "Voix homme", "Voix femme", "Déconnexion"',
              'Say: "French", "English", "Male voice", "Female voice", "Logout"'
            )}
          </Text>
          <TouchableOpacity 
            style={styles.helpButton} 
            onPress={showHelp}
            accessible={true}
            accessibilityLabel={getLocalizedText('Bouton aide', 'Help button')}
          >
            <Ionicons name="help-circle" size={20} color="#a855f7" />
            <Text style={styles.helpButtonText}>
              {getLocalizedText('Voir toutes les commandes', 'View all commands')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preference Section */}
        <Text style={styles.sectionLabel}>{t('preferences', 'PREFERENCES')}</Text>
        
        <View style={styles.glassCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBox}><Ionicons name="globe-outline" size={20} color="#c084fc" /></View>
              <Text style={styles.settingText}>{t('language', 'App Language')}</Text>
            </View>
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                onPress={() => handleLanguageChange('fr')} 
                style={[styles.toggleBtn, language === 'fr' && styles.toggleBtnActive]}
                accessible={true}
                accessibilityLabel={getLocalizedText('Changer en français', 'Change to French')}
              >
                <Text style={styles.toggleText}>FR</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleLanguageChange('en')} 
                style={[styles.toggleBtn, language === 'en' && styles.toggleBtnActive]}
                accessible={true}
                accessibilityLabel={getLocalizedText('Changer en anglais', 'Change to English')}
              >
                <Text style={styles.toggleText}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBox}><Ionicons name="mic-outline" size={20} color="#c084fc" /></View>
              <Text style={styles.settingText}>{t('voice', 'Voice Gender')}</Text>
            </View>
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                onPress={() => handleVoiceGenderChange('male')} 
                style={[styles.toggleBtn, voiceGender === 'male' && styles.toggleBtnActive]}
                accessible={true}
                accessibilityLabel={getLocalizedText('Changer voix masculine', 'Change to male voice')}
              >
                <Ionicons name="male" size={16} color={voiceGender === 'male' ? '#fff' : '#c084fc'} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleVoiceGenderChange('female')} 
                style={[styles.toggleBtn, voiceGender === 'female' && styles.toggleBtnActive]}
                accessible={true}
                accessibilityLabel={getLocalizedText('Changer voix féminine', 'Change to female voice')}
              >
                <Ionicons name="female" size={16} color={voiceGender === 'female' ? '#fff' : '#c084fc'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Support Section */}
        <Text style={styles.sectionLabel}>{getLocalizedText('SUPPORT', 'SUPPORT')}</Text>
        <View style={styles.glassCard}>
          <MenuLink 
            icon="help-circle-outline" 
            label={getLocalizedText('Centre d\'aide', 'Help Center')}
            onPress={showHelp}
          />
          <MenuLink icon="heart-outline" label={getLocalizedText('Contactez-nous', 'Contact Us')} />
          <View style={styles.menuItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconBox}><Ionicons name="information-circle-outline" size={20} color="#c084fc" /></View>
              <Text style={styles.settingText}>Version 1.0.0</Text>
            </View>
          </View>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleSignOut}
          accessible={true}
          accessibilityLabel={getLocalizedText('Bouton de déconnexion', 'Sign out button')}
        >
          <LinearGradient colors={['rgba(255, 68, 68, 0.15)', 'rgba(255, 68, 68, 0.05)']} style={styles.logoutGradient}>
            <Ionicons name="log-out-outline" size={22} color="#ff5555" />
            <Text style={styles.logoutText}>
              {getLocalizedText('Déconnexion de EyeMate', 'Sign Out of EyeMate')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Voice Control Button */}
        <TouchableOpacity 
          style={styles.voiceControlButton} 
          onPress={() => isListening ? stopVoiceListening() : startVoiceListening()}
          accessible={true}
          accessibilityLabel={isListening 
            ? getLocalizedText('Arrêter l\'écoute vocale', 'Stop voice listening') 
            : getLocalizedText('Activer le contrôle vocal', 'Activate voice control')
          }
        >
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.voiceControlGradient}>
            <Ionicons name={isListening ? "mic-off" : "mic"} size={20} color="#fff" />
            <Text style={styles.voiceControlText}>
              {isListening 
                ? getLocalizedText('Arrêter l\'écoute', 'Stop Listening') 
                : getLocalizedText('Activer la voix', 'Activate Voice')
              }
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Transcript Toast */}
      {transcript !== '' && (
        <View style={styles.transcriptToast}>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}
    </View>
  );
}

function MenuLink({ icon, label, onPress }: { icon: any, label: string, onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconBox}><Ionicons name={icon} size={20} color="#c084fc" /></View>
        <Text style={styles.settingText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08041a' },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 140
  },
  voiceOverlay: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 100,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  micPulse: {
    marginBottom: 8,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceStatus: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceHint: {
    color: '#c084fc',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },
  header: { marginBottom: 30 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { color: '#94a3b8', fontSize: 16, marginTop: 5 },
  
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  voiceCommandsCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  voiceCommandsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceCommandsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  voiceCommandsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  helpButtonText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 64, height: 64, borderRadius: 22 },
  profilePlaceholder: { width: 64, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  profileInitial: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileInfo: { marginLeft: 16 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileEmail: { color: '#64748b', fontSize: 14, marginTop: 2 },

  sectionLabel: { color: '#a855f7', fontSize: 13, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 8 },
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center' },
  settingText: { color: '#fff', fontSize: 16, marginLeft: 14, fontWeight: '500' },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#7c3aed' },
  toggleText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },
  
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  
  logoutButton: { marginTop: 10, borderRadius: 20, overflow: 'hidden' },
  logoutGradient: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 18, borderWidth: 1, borderColor: 'rgba(255, 68, 68, 0.3)' 
  },
  logoutText: { color: '#ff5555', fontSize: 16, fontWeight: '700', marginLeft: 12 },

  voiceControlButton: { 
    marginTop: 20, 
    marginBottom: 40,
    borderRadius: 20, 
    overflow: 'hidden' 
  },
  voiceControlGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 16,
  },
  voiceControlText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700', 
    marginLeft: 12 
  },

  transcriptToast: { 
    position: 'absolute', 
    bottom: 120, 
    alignSelf: 'center', 
    backgroundColor: 'rgba(0,0,0,0.9)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  transcriptText: { 
    color: '#4ade80', 
    fontStyle: 'italic',
    fontSize: 14,
  }
});