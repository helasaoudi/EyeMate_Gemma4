// app/(auth)/onboarding.tsx
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { useUser } from '@clerk/clerk-expo';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { changeLanguage, changeVoiceGender } = useSettings();
  const { user } = useUser();

  const [step, setStep] = useState(1);
  const [selectedLanguage, setSelectedLanguage] = useState<'fr' | 'en'>('fr');
  const [selectedVoice, setSelectedVoice] = useState<'male' | 'female'>('female');

  const handleLanguageSelect = (lang: 'fr' | 'en') => {
    setSelectedLanguage(lang);
  };

  const handleVoiceSelect = (voice: 'male' | 'female') => {
    setSelectedVoice(voice);
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleFinish = async () => {
    try {
      // Sauvegarder les préférences
      await changeLanguage(selectedLanguage);
      await changeVoiceGender(selectedVoice);

      // Rediriger vers l'accueil
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences:', error);
    }
  };

  return (
    <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.container}>
      <View style={styles.content}>
        {/* Indicateur de progression */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        </View>

        {step === 1 ? (
          // Étape 1: Choix de la langue
          <View style={styles.stepContainer}>
            <Text style={styles.welcomeText}>
              Bienvenue {user?.firstName || ''} ! 👋
            </Text>
            <Text style={styles.title}>Choisissez votre langue</Text>
            <Text style={styles.subtitle}>
              Choose your language
            </Text>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedLanguage === 'fr' && styles.optionCardActive
                ]}
                onPress={() => handleLanguageSelect('fr')}
              >
                <Text style={styles.optionIcon}>🇫🇷</Text>
                <Text style={styles.optionTitle}>Français</Text>
                <Text style={styles.optionDescription}>
                  Interface et voix en français
                </Text>
                {selectedLanguage === 'fr' && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedLanguage === 'en' && styles.optionCardActive
                ]}
                onPress={() => handleLanguageSelect('en')}
              >
                <Text style={styles.optionIcon}>🇬🇧</Text>
                <Text style={styles.optionTitle}>English</Text>
                <Text style={styles.optionDescription}>
                  Interface and voice in English
                </Text>
                {selectedLanguage === 'en' && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Suivant →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Étape 2: Choix de la voix
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Choisissez votre voix préférée</Text>
            <Text style={styles.subtitle}>
              Cette voix sera utilisée pour vous parler
            </Text>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedVoice === 'male' && styles.optionCardActive
                ]}
                onPress={() => handleVoiceSelect('male')}
              >
                <Text style={styles.optionIcon}>👨</Text>
                <Text style={styles.optionTitle}>Voix masculine</Text>
                <Text style={styles.optionDescription}>
                  Une voix claire et rassurante
                </Text>
                {selectedVoice === 'male' && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedVoice === 'female' && styles.optionCardActive
                ]}
                onPress={() => handleVoiceSelect('female')}
              >
                <Text style={styles.optionIcon}>👩</Text>
                <Text style={styles.optionTitle}>Voix féminine</Text>
                <Text style={styles.optionDescription}>
                  Une voix douce et agréable
                </Text>
                {selectedVoice === 'female' && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>✨ Commencer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setStep(1)}
            >
              <Text style={styles.backButtonText}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#fff',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 10,
  },
  progressLineActive: {
    backgroundColor: '#fff',
  },
  stepContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0f2fe',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    flex: 1,
    gap: 20,
  },
  optionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  optionCardActive: {
    borderColor: '#fff',
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optionIcon: {
    fontSize: 50,
    textAlign: 'center',
    marginBottom: 15,
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nextButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});