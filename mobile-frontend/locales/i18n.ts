import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// Définir les traductions
const resources = {
  fr: {
    translation: {
      welcome: "Bienvenue sur EyeMate",
      register: "Créer un compte",
      name: "Nom",
      email: "Email",
      password: "Mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      chooseLanguage: "Choisir la langue",
      chooseVoice: "Choisir la voix",
      male: "Homme",
      female: "Femme",
      continueWithGoogle: "Continuer avec Google",
      createAccount: "Créer le compte",
      homeGreeting: "Comment puis-je vous aider aujourd'hui ?",
      french: "Français",
      english: "Anglais",
      home: "Accueil",
      explore: "Explorer",
      settings: "Paramètres",
      describe: "Reconnaissance environnement",
      read: "Lire",
      navigation: "Navigation",
      repeat: "Répéter",
      stop: "Stop",
      speaking: "En cours de lecture...",
    }
  },
  en: {
    translation: {
      welcome: "Welcome to EyeMate",
      register: "Create Account",
      name: "Name",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      chooseLanguage: "Choose Language",
      chooseVoice: "Choose Voice",
      male: "Male",
      female: "Female",
      continueWithGoogle: "Continue with Google",
      createAccount: "Create Account",
      homeGreeting: "How can I help you today?",
      french: "French",
      english: "English",
      home: "Home",
      explore: "Explore",
      settings: "Settings",
      describe: "Environment recognition",
      read: "Read",
      navigation: "Navigation",
      repeat: "Repeat",
      stop: "Stop",
      speaking: "Speaking...",
    }
  }
};

// Récupérer la langue du device
const deviceLanguage: string = getLocales()[0]?.languageCode ?? 'en';

// Initialiser i18n
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage, // ici on utilise getLocales
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
