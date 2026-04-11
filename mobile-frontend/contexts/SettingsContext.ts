import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../locales/i18n';
import ttsService, { VoiceGender, Language } from '../services/ttsService';

// Définition du type du contexte
interface SettingsContextType {
  language: Language;
  voiceGender: VoiceGender;
  changeLanguage: (lang: Language) => Promise<void>;
  changeVoiceGender: (gender: VoiceGender) => Promise<void>;
  isLoading: boolean;
}

// Création du contexte
export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Provider
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('male');
  const [isLoading, setIsLoading] = useState(true);

  // Charger les paramètres au démarrage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('language') as Language | null;
      const savedVoice = await AsyncStorage.getItem('voiceGender') as VoiceGender | null;

      console.log('📥 Loading settings:', { savedLanguage, savedVoice });

      if (savedLanguage) {
        setLanguage(savedLanguage);
        i18n.changeLanguage(savedLanguage);
        ttsService.setLanguage(savedLanguage);
      }

      if (savedVoice) {
        setVoiceGender(savedVoice);
        ttsService.setVoiceGender(savedVoice);
      }

      // Vérifier les voix disponibles
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Changer la langue
  const changeLanguage = async (newLanguage: Language) => {
    try {
      console.log('🌍 Changing language to:', newLanguage);
      
      setLanguage(newLanguage);
      i18n.changeLanguage(newLanguage);
      ttsService.setLanguage(newLanguage);
      await AsyncStorage.setItem('language', newLanguage);
      
      // Vérifier les nouvelles voix disponibles
      
      console.log('✅ Language changed successfully');
    } catch (error) {
      console.error('❌ Error changing language:', error);
    }
  };

  // Changer la voix
  const changeVoiceGender = async (newGender: VoiceGender) => {
    try {
      console.log('🎭 Changing voice gender from', voiceGender, 'to', newGender);
      
      setVoiceGender(newGender);
      ttsService.setVoiceGender(newGender);
      await AsyncStorage.setItem('voiceGender', newGender);
      
      console.log('✅ Voice gender changed successfully');
      
    
    } catch (error) {
      console.error('❌ Error changing voice gender:', error);
    }
  };

  const value = {
    language,
    voiceGender,
    changeLanguage,
    changeVoiceGender,
    isLoading
  };

  return React.createElement(
    SettingsContext.Provider,
    { value: value },
    children
  );
};

// Hook pour utiliser le contexte
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};