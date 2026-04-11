import { useRouter } from 'expo-router';
import ttsService from './ttsService';
import voiceToTextService from './voiceToTextService';
import { useSettings } from '../contexts/SettingsContext';

export interface SettingsCommands {
  onLogout: () => void;
  onLanguageChange: (lang: 'fr' | 'en') => void;
  onVoiceGenderChange: (gender: 'male' | 'female') => void;
  onHelp: () => void;
}

export const handleGlobalVoiceCommand = async (
  text: string, 
  router: any,
  onRefreshAction?: () => void,
  settingsCommands?: SettingsCommands
): Promise<boolean> => {
  const clean = text.toLowerCase();
  
  // COMMANDES DE NOUVEAU DOCUMENT
  if (onRefreshAction) {
    if (
      clean.includes('nouveau document') || clean.includes('nouvelle capture') ||
      clean.includes('nouveau scan') || clean.includes('autre document') ||
      clean.includes('new document') || clean.includes('new capture') ||
      clean.includes('new picture') || clean.includes('another document') ||
      clean.includes('scan again') || clean.includes('take another')
    ) {
      await voiceToTextService.stopListening();
      onRefreshAction();
      return true;
    }
  }

  // COMMANDES DE NAVIGATION
  const commands = [
    { keywords: ['accueil', 'home', 'retour'], path: '/(tabs)/Home', fr: 'Retour à l\'accueil', en: 'Returning home' },
    { keywords: ['document', 'lire'], path: '/(tabs)/ReadDocument', fr: 'Ouverture du document', en: 'Opening document' },
    { keywords: ['historique', 'history'], path: '/(tabs)/History', fr: 'Ouverture de l\'historique', en: 'Opening history' },
    { keywords: ['camera', 'environnement', 'environment'], path: '/(tabs)/Camera', fr: 'Ouverture de la caméra', en: 'Opening camera' },
    { keywords: ['analyse', 'analysis'], path: '/(tabs)/AnalysisResults', fr: 'Ouverture des résultats', en: 'Opening analysis' },
    { keywords: ['paramètres', 'parametres', 'settings'], path: '/(tabs)/settings', fr: 'Ouverture des paramètres', en: 'Opening settings' },
  ];

  for (const command of commands) {
    if (command.keywords.some(keyword => clean.includes(keyword))) {
      const lang = ttsService.getLanguage() === 'fr' ? command.fr : command.en;
      
      await voiceToTextService.stopListening();
      
      await ttsService.speak(lang, { 
        onDone: () => router.push(command.path) 
      });
      return true;
    }
  }

  // 🔴 COMMANDES SPÉCIFIQUES AUX PARAMÈTRES (si settingsCommands fourni)
  if (settingsCommands) {
    const settingsHandled = await handleSettingsVoiceCommands(clean, settingsCommands);
    if (settingsHandled) return true;
  }

  return false;
};

// 🔴 FONCTION POUR LES COMMANDES DES PARAMÈTRES
const handleSettingsVoiceCommands = async (
  clean: string,
  commands: SettingsCommands
): Promise<boolean> => {
  // COMMANDES DE DÉCONNEXION
  if (
    clean.includes('déconnexion') ||
    clean.includes('déconnecter') ||
    clean.includes('logout') ||
    clean.includes('log out') ||
    clean.includes('sign out') ||
    clean.includes('se déconnecter') ||
    clean.includes('déconnexion de eye mate') ||
    clean.includes('déconnexion de eye mate')
  ) {
    await voiceToTextService.stopListening();
    await ttsService.speak(
      ttsService.getLanguage() === 'fr' 
        ? 'Déconnexion en cours...' 
        : 'Logging out...'
    );
    setTimeout(() => {
      commands.onLogout();
    }, 1000);
    return true;
  }

  // COMMANDES DE CHANGEMENT DE LANGUE
  if (
    clean.includes('français') ||
    clean.includes('francais') ||
    clean.includes('french') ||
    clean.includes('en français') ||
    clean.includes('changer en français') ||
    clean.includes('passe en français')
  ) {
    await voiceToTextService.stopListening();
    await ttsService.speak(
      ttsService.getLanguage() === 'fr'
        ? 'Langue changée en français.'
        : 'Changing language to French.'
    );
    commands.onLanguageChange('fr');
    return true;
  }

  if (
    clean.includes('anglais') ||
    clean.includes('english') ||
    clean.includes('en anglais') ||
    clean.includes('changer en anglais') ||
    clean.includes('passe en anglais')
  ) {
    await voiceToTextService.stopListening();
    await ttsService.speak(
      ttsService.getLanguage() === 'fr'
        ? 'Langue changée en anglais.'
        : 'Changing language to English.'
    );
    commands.onLanguageChange('en');
    return true;
  }

  // COMMANDES DE CHANGEMENT DE VOIX
  if (
    clean.includes('voix homme') ||
    clean.includes('voix masculine') ||
    clean.includes('homme') ||
    clean.includes('male voice') ||
    clean.includes('male') ||
    clean.includes('changer voix homme') ||
    clean.includes('passe en voix homme')
  ) {
    await voiceToTextService.stopListening();
    await ttsService.speak(
      ttsService.getLanguage() === 'fr'
        ? 'Voix changée en masculine.'
        : 'Changing to male voice.'
    );
    commands.onVoiceGenderChange('male');
    return true;
  }

  if (
    clean.includes('voix femme') ||
    clean.includes('voix féminine') ||
    clean.includes('voix feminine') ||
    clean.includes('femme') ||
    clean.includes('female voice') ||
    clean.includes('female') ||
    clean.includes('changer voix femme') ||
    clean.includes('passe en voix femme')
  ) {
    await voiceToTextService.stopListening();
    await ttsService.speak(
      ttsService.getLanguage() === 'fr'
        ? 'Voix changée en féminine.'
        : 'Changing to female voice.'
    );
    commands.onVoiceGenderChange('female');
    return true;
  }

  // COMMANDES D'AIDE
  if (
    clean.includes('aide') ||
    clean.includes('help') ||
    clean.includes('commandes') ||
    clean.includes('que faire') ||
    clean.includes('what can i do') ||
    clean.includes('comment utiliser')
  ) {
    await voiceToTextService.stopListening();
    commands.onHelp();
    return true;
  }

  return false;
};

// 🔴 FONCTION POUR OBTENIR LA LISTE DES COMMANDES
export const getAvailableCommands = (language: 'fr' | 'en') => {
  if (language === 'fr') {
    return `
🎤 COMMANDES VOCALES DISPONIBLES :

📍 NAVIGATION :
• "Accueil" - Retour à l'accueil
• "Document" - Mode document
• "Historique" - Voir l'historique
• "Environnement" - Mode environnement
• "Paramètres" - Écran des paramètres

⚙️ PARAMÈTRES :
• "Déconnexion" - Se déconnecter
• "Français" - Changer en français
• "Anglais" - Changer en anglais
• "Voix homme" - Voix masculine
• "Voix femme" - Voix féminine
• "Aide" - Voir les commandes

📄 DOCUMENT :
• "Nouveau document" - Scanner un autre document
• "Relire" - Répéter les informations
• "Détails" - Plus de détails
• "Résumé" - Retour au résumé

💡 ASTUCE : Parlez clairement et simplement.
    `;
  } else {
    return `
🎤 AVAILABLE VOICE COMMANDS :

📍 NAVIGATION :
• "Home" - Return to home
• "Document" - Document mode
• "History" - View history
• "Environment" - Environment mode
• "Settings" - Settings screen

⚙️ SETTINGS :
• "Logout" - Sign out
• "French" - Change to French
• "English" - Change to English
• "Male voice" - Male voice
• "Female voice" - Female voice
• "Help" - View commands

📄 DOCUMENT :
• "New document" - Scan another document
• "Repeat" - Repeat information
• "Details" - More details
• "Summary" - Back to summary

💡 TIP: Speak clearly and simply.
    `;
  }
};