import ttsService from './ttsService';
import voiceToTextService from './voiceToTextService';

export interface SettingsCommands {
  onLogout: () => void;
  onLanguageChange: (lang: 'fr' | 'en') => void;
  onVoiceGenderChange: (gender: 'male' | 'female') => void;
  onHelp: () => void;
}

/**
 * Paper / text to read → Read document. Checked before environment so
 * "describe the document" does not open the camera.
 */
function matchesDocumentNav(clean: string): boolean {
  const snippets = [
    'document',
    'papier',
    'paper',
    'facture',
    'invoice',
    'reçu',
    'recu',
    'receipt',
    'lettre',
    'letter',
    'formulaire',
    'form',
    'passeport',
    'passport',
    'ticket',
    'contrat',
    'contract',
    "carte d'identité",
    'carte identité',
    'id card',
    'business card',
    'read this text',
    'lire ce texte',
    'lire le texte',
    'scan this page',
    'scanne cette page',
    'feuille',
    'sheet of paper',
    'billet',
    'note de frais',
    'read document',
    'mode document',
    'scan a document',
    'scanne un document',
  ];
  if (snippets.some((s) => clean.includes(s))) return true;
  if (
    clean.includes('lire') &&
    (clean.includes('document') ||
      clean.includes('texte') ||
      clean.includes('page') ||
      clean.includes('papier'))
  ) {
    return true;
  }
  return false;
}

/**
 * Surroundings / scene / "what happens around me" → Camera (substring match, not exact phrase).
 */
function matchesEnvironmentNav(clean: string): boolean {
  const direct = [
    'environnement',
    'environment',
    'around me',
    'autour de moi',
    'around us',
    'autour de nous',
    'what happen',
    "what's happening",
    'whats happening',
    'what is happening',
    'happens around',
    'se passe autour',
    'what is around',
    "what's around",
    'describe the scene',
    'décris la scène',
    'describe my surroundings',
    'in this room',
    'dans cette pièce',
    'surroundings',
    'alentours',
    'camera',
    'caméra',
    'field of view',
    'what do you see',
    'see around',
    'voir autour',
  ];
  if (direct.some((s) => clean.includes(s))) return true;

  const hasSpatial =
    clean.includes('around') ||
    clean.includes('autour') ||
    clean.includes('environnement') ||
    clean.includes('environment') ||
    clean.includes('surroundings') ||
    clean.includes('happen') ||
    clean.includes('happening') ||
    clean.includes('scene') ||
    clean.includes('scène') ||
    clean.includes('room') ||
    clean.includes('pièce');

  const hasDescribeOrAsk =
    clean.includes('describe') ||
    clean.includes('explain') ||
    clean.includes('décris') ||
    clean.includes('décrire') ||
    clean.includes('explique') ||
    clean.includes('tell me') ||
    clean.includes('can you') ||
    clean.includes('could you') ||
    clean.includes('peux-tu') ||
    clean.includes('pourrais-tu');

  if (hasSpatial && hasDescribeOrAsk) return true;

  if (
    (clean.includes('explain') || clean.includes('explique')) &&
    (clean.includes('around') ||
      clean.includes('autour') ||
      clean.includes('happen') ||
      clean.includes('happening'))
  ) {
    return true;
  }

  return false;
}

async function speakAndNavigate(
  router: { push: (href: string) => void },
  fr: string,
  en: string,
  path: string
): Promise<void> {
  const lang = ttsService.getLanguage() === 'fr' ? fr : en;
  await voiceToTextService.stopListening();
  await ttsService.speak(lang, {
    onDone: () =>
      path === '/(tabs)/Camera'
        ? router.push('/(tabs)/Camera?quick=1')
        : router.push(path),
  });
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

  // Navigation — flexible phrases (substring). Document checked before environment.
  if (matchesDocumentNav(clean)) {
    await speakAndNavigate(
      router,
      'Ouverture du document',
      'Opening document',
      '/(tabs)/ReadDocument'
    );
    return true;
  }

  if (matchesEnvironmentNav(clean)) {
    await speakAndNavigate(
      router,
      'Ouverture de la caméra',
      'Opening camera',
      '/(tabs)/Camera'
    );
    return true;
  }

  const commands = [
    { keywords: ['accueil', 'home', 'retour'], path: '/(tabs)/Home', fr: 'Retour à l\'accueil', en: 'Returning home' },
    { keywords: ['historique', 'history'], path: '/(tabs)/History', fr: 'Ouverture de l\'historique', en: 'Opening history' },
    { keywords: ['analyse', 'analysis'], path: '/(tabs)/AnalysisResults', fr: 'Ouverture des résultats', en: 'Opening analysis' },
    { keywords: ['paramètres', 'parametres', 'settings'], path: '/(tabs)/settings', fr: 'Ouverture des paramètres', en: 'Opening settings' },
  ];

  for (const command of commands) {
    if (command.keywords.some((keyword) => clean.includes(keyword))) {
      const lang = ttsService.getLanguage() === 'fr' ? command.fr : command.en;

      await voiceToTextService.stopListening();

      await ttsService.speak(lang, {
        onDone: () =>
          command.path === '/(tabs)/Camera'
            ? router.push('/(tabs)/Camera?quick=1')
            : router.push(command.path),
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
• Document / papier / facture… - Mode document (mots contenus dans la phrase)
• "Historique" - Voir l'historique
• Environnement, autour de moi, décris ce qui se passe… - Caméra (mots contenus)
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
• Document, paper, invoice… - Document mode (phrase contains these)
• "History" - View history
• Environment, around me, what happens, describe the scene… - Camera (phrase contains these)
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