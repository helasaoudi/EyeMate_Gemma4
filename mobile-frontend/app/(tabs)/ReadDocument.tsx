import { CameraView } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
  Dimensions,
  Animated,
  AccessibilityInfo,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import fileService from '../../services/fileService';
import documentAnalysisService, {
  DocumentType,
} from '../../services/documentAnalysisService';
import ttsService from '../../services/ttsService';
import voiceToTextService from '../../services/voiceToTextService';
import { handleGlobalVoiceCommand } from '../../services/globalVoiceCommands';

const { width } = Dimensions.get('window');

type AppState = 
  | 'greeting' 
  | 'listening' 
  | 'processing' 
  | 'analyzing' 
  | 'capturing' 
  | 'error' 
  | 'redirecting'
  | 'speaking_details'
  | 'paused_details';

export default function ReadDocument() {
  const router = useRouter();
  
  const [state, setState] = useState<AppState>('greeting');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const [documentType, setDocumentType] = useState<DocumentType>('autre');
  const [summary, setSummary] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  
  const cameraRef = useRef<CameraView>(null);
  const listeningTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const isCapturing = useRef(false);
  const currentSpeechRef = useRef<string>('');
  const isPausedByUser = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* ===================== ANIMATIONS ===================== */
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

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

  /* ===================== LOCALIZED TEXT ===================== */
  const getLocalizedText = (fr: string, en: string) =>
    ttsService.getLanguage() === 'fr' ? fr : en;

  const speakLocalized = async (fr: string, en: string, options?: any) => {
    if (!isMounted.current) return;
    const text = getLocalizedText(fr, en);
    console.log('🗣️ Speaking:', text);
    await ttsService.speak(text, options ?? {});
  };

  /* ===================== CLEANUP ===================== */
  const cleanupResources = useCallback(async () => {
    console.log('🧹 Cleaning up resources');
    await ttsService.stop();
    await voiceToTextService.stopListening();
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    setIsListening(false);
    isCapturing.current = false;
    setIsSpeaking(false);
    isPausedByUser.current = false;
    setState('greeting');
  }, []);

  /* ===================== LIFECYCLE ===================== */
  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      console.log('📄 ReadDocument mounted');
      
      AccessibilityInfo.announceForAccessibility(
        getLocalizedText('Page document', 'Document screen')
      );

      startDocumentApp();

      return () => {
        console.log('📄 ReadDocument unmounting');
        isMounted.current = false;
        cleanupResources();
      };
    }, [cleanupResources])
  );

  /* ===================== APP FLOW ===================== */
  const startDocumentApp = async () => {
    if (!isMounted.current) return;

    console.log('🚀 Starting document app');
    await cleanupResources();
    
    setState('greeting');
    setTranscript('');
    setShowCamera(true);
    setSummary('');
    setDetails('');
    setDocumentType('autre');
    setShowDetails(false);
    setIsSpeaking(false);
    isPausedByUser.current = false;
    setStatusMessage(getLocalizedText('Initialisation...', 'Initializing...'));

    await new Promise(r => setTimeout(r, 300));

    if (!isMounted.current) return;
    
    await speakLocalized(
      'Mode document. Placez le texte devant la caméra.',
      'Document mode. Place the text in front of the camera.',
      { 
        onDone: () => {
          if (isMounted.current) {
            console.log('✅ Greeting spoken, starting auto capture');
            setTimeout(() => {
              if (isMounted.current) startAutoCapture();
            }, 500);
          }
        }
      }
    );
  };

  const restartCapture = async () => {
    if (!isMounted.current) return;

    console.log('🔄 Restart capture requested');

    // Arrêter toutes les ressources en cours
    await ttsService.stop();
    await voiceToTextService.stopListening();
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    
    // Réinitialiser l'état
    setState('greeting');
    setTranscript('');
    setShowCamera(true);
    setSummary('');
    setDetails('');
    setDocumentType('autre');
    setShowDetails(false);
    setIsSpeaking(false);
    setIsListening(false);
    isPausedByUser.current = false;
    
    // Redémarrer la caméra
    setCameraKey(prev => prev + 1);
    
    await new Promise(r => setTimeout(r, 500));
    
    if (!isMounted.current) return;

    await speakLocalized(
      'Nouveau document. Préparez le texte.',
      'New document. Prepare the text.',
      { 
        onDone: () => {
          if (isMounted.current) {
            console.log('✅ New document prompt spoken');
            setTimeout(() => {
              if (isMounted.current) startAutoCapture();
            }, 800);
          }
        }
      }
    );
  };

  const startAutoCapture = async () => {
    if (!isMounted.current || isCapturing.current || !showCamera) {
      console.log('⏸️ Cannot start auto capture:', { isMounted: isMounted.current, isCapturing: isCapturing.current, showCamera });
      return;
    }

    console.log('📸 Starting auto capture');
    isCapturing.current = true;
    
    setState('capturing');
    setStatusMessage(getLocalizedText(
      'Capture dans 3 secondes...',
      'Capturing in 3 seconds...'
    ));
    
    await speakLocalized(
      "Capture automatique dans trois secondes.",
      "Auto capture in three seconds."
    );
    
    // Attendre 3 secondes
    await new Promise(r => setTimeout(r, 3000));
    
    if (!isMounted.current || !showCamera) {
      console.log('❌ Aborting capture - unmounted or camera hidden');
      isCapturing.current = false;
      return;
    }
    
    console.log('📸 Taking picture now');
    Vibration.vibrate([100, 50, 100]);
    await takePicture();
  };

  const compressImage = async (uri: string, quality: number = 0.7): Promise<string> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { 
          compress: quality, 
          format: ImageManipulator.SaveFormat.JPEG, 
          base64: true 
        }
      );
      return manipResult.base64 || '';
    } catch (error) {
      console.error('❌ Error compressing image:', error);
      throw error;
    }
  };

  const takePicture = async () => {
    try {
      if (!cameraRef.current || !isMounted.current) {
        console.log('❌ Camera ref not ready or unmounted');
        isCapturing.current = false;
        return;
      }

      setState('processing');
      setStatusMessage(getLocalizedText('Traitement...', 'Processing...'));
      
      console.log('📸 Taking picture...');
      
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.7, 
        base64: true,
      });

      if (!photo.base64 || !isMounted.current) {
        console.log('❌ No base64 or not mounted');
        isCapturing.current = false;
        return;
      }

      console.log('✅ Picture taken, compressing...');

      let processedBase64 = photo.base64;
      
      if (photo.uri) {
        try { 
          processedBase64 = await compressImage(photo.uri, 0.5); 
          console.log('✅ Image compressed');
        } catch (compressError) { 
          console.error('⚠️ Compression error, using original:', compressError); 
        }
      }

      if (!isMounted.current) {
        isCapturing.current = false;
        return;
      }
      
      const filename = fileService.generateFilename('document');
      await fileService.saveImage(processedBase64, filename);
      console.log('✅ Image saved:', filename);
      
      setShowCamera(false);
      isCapturing.current = false;
      
      await processDocumentWithBackend(processedBase64);

    } catch (error) {
      console.error('❌ Error taking picture:', error);
      isCapturing.current = false;
      
      if (isMounted.current) {
        await speakLocalized(
          'Impossible de prendre la photo.',
          'Unable to take photo.'
        );
        restartListening();
      }
    }
  };

  const processDocumentWithBackend = async (imageBase64: string) => {
    if (!isMounted.current) return;

    try {
      setState('analyzing');
      setStatusMessage(
        getLocalizedText('Analyse du document...', 'Analyzing document...')
      );

      console.log('🔍 Starting document analysis (Gemma 4 backend)...');

      await speakLocalized(
        "Analyse intelligente du document en cours...",
        "Intelligent document analysis in progress..."
      );

      const currentLanguage = ttsService.getLanguage();

      const isConnected = await documentAnalysisService.testConnection();
      if (!isConnected) {
        throw new Error(
          currentLanguage === 'fr'
            ? 'Impossible de se connecter au serveur EyeMate (Gemma 4).'
            : 'Unable to connect to the EyeMate server (Gemma 4).'
        );
      }

      const result = await documentAnalysisService.analyzeDocumentWithOCR(
        imageBase64,
        currentLanguage
      );

      console.log('✅ Analysis complete:', result.type);

      if (!isMounted.current) return;

      if (!result.summary || result.summary.trim().length === 0) {
        await speakLocalized(
          "Aucune information trouvée.",
          "No information found."
        );
        setSummary(
          currentLanguage === 'fr' 
            ? '📄 Aucune information essentielle trouvée.\n\nLe document peut être illisible.'
            : '📄 No essential information found.\n\nThe document may be unreadable.'
        );
        setDetails('');
        setState('listening');
        await startVoiceListening();
        return;
      }

      setDocumentType(result.type);
      setSummary(result.summary);
      setDetails(result.details);
      setShowDetails(false); // Toujours commencer par le résumé
      
      setState('listening');
      setStatusMessage(getLocalizedText('En écoute...', 'Listening...'));
      
      const typeNames = {
        facture: { fr: 'Facture détectée', en: 'Invoice detected' },
        recu: { fr: 'Reçu détecté', en: 'Receipt detected' },
        cin: { fr: 'Carte d\'identité détectée', en: 'ID card detected' },
        passeport: { fr: 'Passeport détecté', en: 'Passport detected' },
        ticket: { fr: 'Ticket détecté', en: 'Ticket detected' },
        guichet: { fr: 'Numéro de guichet détecté', en: 'Queue number detected' },
        contrat: { fr: 'Contrat détecté', en: 'Contract detected' },
        lettre: { fr: 'Lettre détectée', en: 'Letter detected' },
        formulaire: { fr: 'Formulaire détecté', en: 'Form detected' },
        carte: { fr: 'Carte détectée', en: 'Card detected' },
        autre: { fr: 'Document détecté', en: 'Document detected' },
      };

      const typeName = typeNames[result.type];
      await speakLocalized(
        `${typeName.fr}. Voici les informations essentielles.`,
        `${typeName.en}. Here are the essential information.`
      );

      await new Promise(r => setTimeout(r, 600));

      if (!isMounted.current) return;

      // Lire le résumé automatiquement
      setIsSpeaking(true);
      await ttsService.speak(result.summary, {
        onDone: () => {
          if (isMounted.current) {
            console.log('✅ Summary TTS finished, starting voice listening');
            setIsSpeaking(false);
            startVoiceListening();
          }
        },
        onStopped: () => {
          if (isMounted.current) {
            setIsSpeaking(false);
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error processing document:', error);
      
      if (!isMounted.current) return;

      const currentLanguage = ttsService.getLanguage();
      let errorMessage = error.message;
      
      if (
        error.message.includes('serveur') ||
        error.message.includes('server') ||
        error.message.includes('connect')
      ) {
        errorMessage =
          currentLanguage === 'fr'
            ? 'Vérifiez que le serveur EyeMate est démarré et que BASE_URL est correct dans la config.'
            : 'Ensure the EyeMate backend is running and BASE_URL is set in config.';
      }
      
      await speakLocalized(
        "Erreur lors de l'analyse.",
        "Error during analysis."
      );
      
      setSummary(errorMessage);
      setDetails('');
      setState('error');
      restartListening();
    }
  };

  /* ===================== VOICE LISTENING ===================== */
  const startVoiceListening = async () => {
    if (!isMounted.current) return;

    console.log('🎤 Starting voice listening');
    setState('listening');
    setIsListening(true);
    setStatusMessage(getLocalizedText("J'écoute...", "Listening..."));
    
    Vibration.vibrate(100);

    AccessibilityInfo.announceForAccessibility(
      getLocalizedText('Écoute en cours', 'Now listening')
    );
    
    const success = await voiceToTextService.startListening(
      handleVoiceResult, 
      restartListening
    );
    
    if (!success && isMounted.current) {
      console.log('❌ Failed to start listening');
      restartListening();
      return;
    }
    
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
    listeningTimer.current = setTimeout(() => {
      if (isMounted.current) {
        console.log('⏰ Listening timeout');
        stopVoiceListening();
      }
    }, 15000); // 15 secondes timeout
  };

  const stopVoiceListening = async () => {
    console.log('🛑 Stopping voice listening');
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    setIsListening(false);
    await voiceToTextService.stopListening();
  };

  const handleVoiceResult = async (textReceived: string) => {
    if (!isMounted.current) return;
    
    console.log('🎤 Voice result:', textReceived);
    
    if (!textReceived || textReceived.trim() === '') {
      console.log('ℹ️ Empty transcript, restarting');
      restartListening();
      return;
    }

    const clean = textReceived.toLowerCase().trim();
    setTranscript(clean);
    
    // Arrêter l'écoute immédiatement
    await stopVoiceListening();

    Vibration.vibrate(50);

    // 🔴 NAVIGATION GLOBALE AVEC SUPPORT "NEW DOCUMENT"
    console.log('🔍 Checking global commands...');
    const commandHandled = await handleGlobalVoiceCommand(clean, router, restartCapture);
    
    if (commandHandled) {
      console.log('✅ Global command handled');
      return;
    }

    // 🔴 COMMANDES SPÉCIFIQUES DOCUMENT
    const normalizedCommand = clean.toLowerCase();
    
    // "nouveau document" - reset complet
    if (
      normalizedCommand.includes('nouveau') && normalizedCommand.includes('document') ||
      normalizedCommand.includes('another document') ||
      normalizedCommand.includes('new document') ||
      normalizedCommand.includes('autre document') ||
      normalizedCommand.includes('encore') && normalizedCommand.includes('document')
    ) {
      console.log('📄 Command: New document');
      await speakLocalized(
        "Nouveau document. Préparez-vous.",
        "New document. Get ready."
      );
      await restartCapture();
      return;
    }

    // "relire" / "répéter"
    if (
      normalizedCommand.includes('relire') ||
      normalizedCommand.includes('répéter') ||
      normalizedCommand.includes('repeat') ||
      normalizedCommand.includes('encore') ||
      normalizedCommand.includes('replay')
    ) {
      console.log('🔊 Command: Repeat');
      await speakLocalized(
        "Je répète les informations.",
        "I'll repeat the information."
      );
      
      const textToSpeak = showDetails ? details : summary;
      if (textToSpeak) {
        setIsSpeaking(true);
        await ttsService.speak(textToSpeak, {
          onDone: () => {
            if (isMounted.current) {
              setIsSpeaking(false);
              startVoiceListening();
            }
          },
          onStopped: () => {
            if (isMounted.current) {
              setIsSpeaking(false);
            }
          }
        });
      }
      return;
    }

    // "détails" / "plus de détails"
    if (
      normalizedCommand.includes('détails') ||
      normalizedCommand.includes('details') ||
      normalizedCommand.includes('complet') ||
      normalizedCommand.includes('plus') ||
      normalizedCommand.includes('tout') ||
      normalizedCommand.includes('more details') ||
      normalizedCommand.includes('full details')
    ) {
      console.log('📋 Command: Show details');
      await showFullDetails();
      return;
    }

    // "résumé" / "essentiel"
    if (
      normalizedCommand.includes('résumé') ||
      normalizedCommand.includes('résume') ||
      normalizedCommand.includes('principal') ||
      normalizedCommand.includes('essentiel') ||
      normalizedCommand.includes('essentiels') ||
      normalizedCommand.includes('summary') ||
      normalizedCommand.includes('main points')
    ) {
      console.log('📝 Command: Show summary');
      await showSummary();
      return;
    }

    // "pause" / "arrêter"
    if (
      normalizedCommand.includes('pause') ||
      normalizedCommand.includes('arrêter') ||
      normalizedCommand.includes('arrête') ||
      normalizedCommand.includes('stop')
    ) {
      console.log('⏸️ Command: Pause');
      await ttsService.stop();
      setIsSpeaking(false);
      isPausedByUser.current = true;
      setState('listening');
      await speakLocalized(
        "Lecture arrêtée.",
        "Reading stopped."
      );
      await startVoiceListening();
      return;
    }

    // "reprendre" / "continuer"
    if (
      normalizedCommand.includes('reprendre') ||
      normalizedCommand.includes('continuer') ||
      normalizedCommand.includes('continue') ||
      normalizedCommand.includes('resume')
    ) {
      console.log('▶️ Command: Resume');
      if (showDetails && details) {
        await resumeDetailsReading();
      } else if (summary) {
        await resumeSummaryReading();
      }
      return;
    }

    // "retour" / "accueil"
    if (
      normalizedCommand.includes('retour') ||
      normalizedCommand.includes('accueil') ||
      normalizedCommand.includes('home') ||
      normalizedCommand.includes('menu') ||
      normalizedCommand.includes('retour accueil') ||
      normalizedCommand.includes('return home') ||
      normalizedCommand.includes('go home')
    ) {
      console.log('🏠 Command: Go home');
      router.replace('/(tabs)');
      return;
    }

    // Si aucune commande n'est reconnue
    console.log('❌ Command not recognized:', clean);
    if (isMounted.current) {
      restartListening();
    }
  };

  const restartListening = async () => {
    if (!isMounted.current) return;

    console.log('🔄 Restarting listening');
    setState('listening');
    setStatusMessage(getLocalizedText('En écoute...', 'Listening...'));

    await speakLocalized(
      'Dites "relire", "détails", "résumé", "nouveau document", "pause", "reprendre" ou "accueil".', 
      'Say "repeat", "details", "summary", "new document", "pause", "resume" or "home".', 
      { 
        onDone: () => {
          if (isMounted.current) {
            console.log('✅ Prompt spoken, starting voice listening');
            setTimeout(() => startVoiceListening(), 300);
          }
        }
      }
    );
  };

  /* ===================== DETAILS MANAGEMENT ===================== */
  const showFullDetails = async () => {
    if (!details) {
      console.log('❌ No details available');
      await speakLocalized(
        "Pas de détails disponibles.",
        "No details available."
      );
      await startVoiceListening();
      return;
    }
    
    console.log('📋 Showing full details');
    setShowDetails(true);
    setStatusMessage(getLocalizedText('Détails complets', 'Full details'));
    
    await speakLocalized(
      "Voici tous les détails du document.",
      "Here are all the document details."
    );
    
    // Sauvegarder le texte en cours de lecture
    currentSpeechRef.current = 'details';
    setState('speaking_details');
    setIsSpeaking(true);
    isPausedByUser.current = false;
    
    await ttsService.speak(details, {
      onDone: () => {
        if (isMounted.current) {
          console.log('✅ Details reading finished');
          setIsSpeaking(false);
          setState('listening');
          startVoiceListening();
        }
      },
      onStopped: () => {
        if (isMounted.current) {
          console.log('🛑 Details reading stopped');
          setIsSpeaking(false);
          if (!isPausedByUser.current) {
            setState('listening');
            startVoiceListening();
          }
        }
      }
    });
  };

  const showSummary = async () => {
    if (!summary) {
      console.log('❌ No summary available');
      await startVoiceListening();
      return;
    }
    
    console.log('📝 Showing summary');
    setShowDetails(false);
    setStatusMessage(getLocalizedText('Résumé', 'Summary'));
    
    await speakLocalized(
      "Retour aux informations essentielles.",
      "Back to essential information."
    );
    
    // Arrêter la lecture des détails si en cours
    if (state === 'speaking_details' || state === 'paused_details') {
      await ttsService.stop();
      setIsSpeaking(false);
      isPausedByUser.current = false;
    }
    
    setState('listening');
    
    // Lire le résumé
    setIsSpeaking(true);
    await ttsService.speak(summary, {
      onDone: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
          startVoiceListening();
        }
      },
      onStopped: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
        }
      }
    });
  };

  const resumeDetailsReading = async () => {
    if (!details) return;
    
    console.log('▶️ Resuming details reading');
    setState('speaking_details');
    setIsSpeaking(true);
    isPausedByUser.current = false;
    setStatusMessage(getLocalizedText('Lecture des détails...', 'Reading details...'));
    
    await speakLocalized(
      "Reprise de la lecture.",
      "Resuming reading."
    );
    
    await ttsService.speak(details, {
      onDone: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
          setState('listening');
          startVoiceListening();
        }
      },
      onStopped: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
          if (!isPausedByUser.current) {
            setState('listening');
            startVoiceListening();
          }
        }
      }
    });
  };

  const resumeSummaryReading = async () => {
    if (!summary) return;
    
    console.log('▶️ Resuming summary reading');
    setIsSpeaking(true);
    isPausedByUser.current = false;
    
    await ttsService.speak(summary, {
      onDone: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
          startVoiceListening();
        }
      },
      onStopped: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
        }
      }
    });
  };

  /* ===================== TOUCH HANDLERS ===================== */
  const handleScreenPress = async () => {
    if (!summary) return;
    
    console.log('👆 Screen pressed, state:', state);
    Vibration.vibrate([100, 50, 100]);
    
    // Si on est en train de lire
    if (isSpeaking) {
      console.log('⏸️ Pausing speech');
      await ttsService.stop();
      setIsSpeaking(false);
      isPausedByUser.current = true;
      
      if (state === 'speaking_details') {
        setState('paused_details');
        setStatusMessage(getLocalizedText('Lecture en pause', 'Reading paused'));
        
        await speakLocalized(
          "Lecture en pause. Dites 'reprendre' pour continuer.",
          "Reading paused. Say 'resume' to continue."
        );
      } else {
        setState('listening');
        setStatusMessage(getLocalizedText('Lecture arrêtée', 'Reading stopped'));
        
        await speakLocalized(
          "Lecture arrêtée.",
          "Reading stopped."
        );
      }
      
      // Redémarrer l'écoute pour les commandes
      await startVoiceListening();
      return;
    }
    
    // Si la lecture est en pause
    if (state === 'paused_details') {
      console.log('▶️ Resuming from pause');
      await resumeDetailsReading();
      return;
    }
    
    // Si on est en écoute et qu'on appuie sur l'écran
    if (state === 'listening') {
      console.log('🔊 Starting speech from screen press');
      setIsSpeaking(true);
      isPausedByUser.current = false;
      
      const textToSpeak = showDetails ? details : summary;
      currentSpeechRef.current = showDetails ? 'details' : 'summary';
      
      if (showDetails) {
        setState('speaking_details');
        setStatusMessage(getLocalizedText('Lecture des détails...', 'Reading details...'));
      } else {
        setStatusMessage(getLocalizedText('Lecture du résumé...', 'Reading summary...'));
      }
      
      await ttsService.speak(textToSpeak, {
        onDone: () => {
          if (isMounted.current) {
            setIsSpeaking(false);
            if (showDetails) {
              setState('listening');
            }
            startVoiceListening();
          }
        },
        onStopped: () => {
          if (isMounted.current) {
            setIsSpeaking(false);
          }
        }
      });
      return;
    }
    
    // Autres états
    console.log('ℹ️ No action for screen press in state:', state);
  };

  /* ===================== ICON HELPER ===================== */
  const getDocumentIcon = (): string => {
    const icons: { [key in DocumentType]: string } = {
      facture: 'receipt',
      recu: 'receipt-outline',
      cin: 'card',
      passeport: 'airplane',
      ticket: 'ticket',
      guichet: 'time',
      contrat: 'document-text',
      lettre: 'mail',
      formulaire: 'clipboard',
      carte: 'card-outline',
      autre: 'document'
    };
    return icons[documentType] || 'document';
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#08041a', '#1a0d3f']} 
        style={StyleSheet.absoluteFill} 
      />
      
      {showCamera ? (
        <Animated.View 
          style={[styles.cameraContainer, { opacity: fadeAnim }]}
        >
          <CameraView 
            key={cameraKey}
            ref={cameraRef} 
            style={styles.camera} 
            facing="back" 
          />
          
          <View style={styles.cameraOverlay}>
            <View style={styles.hudFrame} />
            
            <View style={styles.statusBadge}>
              <Text 
                style={styles.statusBadgeText}
                accessible={true}
                accessibilityLiveRegion="polite"
              >
                {statusMessage}
              </Text>
            </View>

            {(state === 'processing' || state === 'analyzing') && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.loadingText}>
                  {state === 'analyzing' 
                    ? getLocalizedText('Analyse intelligente...', 'Intelligent analysis...')
                    : getLocalizedText('Traitement...', 'Processing...')
                  }
                </Text>
              </View>
            )}

            {isListening && (
              <View style={styles.listeningBadge}>
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.listeningBadgeText}>
                  {getLocalizedText('En écoute', 'Listening')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.stateIndicator}>
            <View 
              style={[
                styles.stateDot,
                { backgroundColor: getStateColor(state) }
              ]}
              accessible={true}
              accessibilityLabel={`${getLocalizedText('État', 'State')}: ${state}`}
            />
          </View>
        </Animated.View>
      ) : (
        <Pressable 
          style={styles.resultsWrapper} 
          onPress={handleScreenPress}
          accessible={true}
          accessibilityLabel={getLocalizedText(
            showDetails ? 'Détails du document. Appuyez pour contrôler la lecture.' : 'Document analysé. Appuyez pour écouter.',
            showDetails ? 'Document details. Tap to control reading.' : 'Analyzed document. Tap to listen.'
          )}
        >
          <View style={styles.resultHeader}>
            <Ionicons name={getDocumentIcon() as any} size={32} color="#a855f7" />
            <View>
              <Text style={styles.resultTitle}>
                {getLocalizedText('Document Analysé', 'Analyzed Document')}
              </Text>
              <Text style={styles.documentTypeLabel}>
                {documentType.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <ScrollView 
            style={styles.glassCard} 
            contentContainerStyle={styles.scrollContent}
          >
            <Text 
              style={styles.extractedText}
              accessible={true}
            >
              {showDetails ? details : summary}
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Animated.View 
              style={[
                styles.micPulse, 
                { 
                  transform: [{ scale: pulseAnim }], 
                  opacity: isListening ? 1 : 0.3 
                }
              ]}
            >
              <LinearGradient 
                colors={['#a855f7', '#7c3aed']} 
                style={styles.micButton}
              >
                <Ionicons 
                  name={isListening ? "mic" : "mic-outline"} 
                  size={30} 
                  color="#fff" 
                />
              </LinearGradient>
            </Animated.View>
            
            <Text style={styles.instructionText}>
              {state === 'speaking_details' 
                ? getLocalizedText('🔊 Lecture des détails', '🔊 Reading details')
                : state === 'paused_details'
                ? getLocalizedText('⏸️ Lecture en pause', '⏸️ Reading paused')
                : isListening 
                ? getLocalizedText('🎤 J\'écoute...', '🎤 Listening...') 
                : isSpeaking
                ? getLocalizedText('🔊 Lecture', '🔊 Reading')
                : getLocalizedText(
                    showDetails ? '📄 Détails complets' : '📋 Résumé',
                    showDetails ? '📄 Full details' : '📋 Summary'
                  )
              }
            </Text>
            
            {/* Affichage des commandes vocales disponibles */}
            <View style={styles.voiceCommandsHint}>
              <Text style={styles.voiceCommandsText}>
                {getLocalizedText(
                  'Commandes: "relire", "détails", "nouveau document", "pause", "accueil"',
                  'Commands: "repeat", "details", "new document", "pause", "home"'
                )}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      {transcript !== '' && (
        <View style={styles.transcriptToast}>
          <Text style={styles.transcriptText}>
            {transcript}
          </Text>
        </View>
      )}
    </View>
  );
}

const getStateColor = (state: AppState): string => {
  switch (state) {
    case 'greeting': return '#3b82f6';
    case 'listening': return '#10b981';
    case 'capturing': return '#f59e0b';
    case 'processing': return '#f97316';
    case 'analyzing': return '#a855f7';
    case 'error': return '#ef4444';
    case 'redirecting': return '#06b6d4';
    case 'speaking_details': return '#8b5cf6';
    case 'paused_details': return '#f59e0b';
    default: return '#6b7280';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  hudFrame: { 
    width: width * 0.8, 
    height: width * 1.1, 
    borderWidth: 3, 
    borderColor: 'rgba(168, 85, 247, 0.6)', 
    borderRadius: 30,
    borderStyle: 'dashed',
  },
  statusBadge: { 
    position: 'absolute', 
    top: 60, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  statusBadgeText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 20,
  },
  loadingText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  listeningBadge: {
    position: 'absolute',
    bottom: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  listeningBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stateIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  resultsWrapper: { 
    flex: 1, 
    padding: 20, 
    paddingTop: 60 
  },
  resultHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 20 
  },
  resultTitle: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '600' 
  },
  documentTypeLabel: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  glassCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: { 
    padding: 20 
  },
  extractedText: { 
    color: 'rgba(255,255,255,0.9)', 
    fontSize: 18, 
    lineHeight: 28 
  },
  footer: { 
    alignItems: 'center', 
    paddingVertical: 30 
  },
  micPulse: { 
    marginBottom: 10 
  },
  micButton: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  instructionText: { 
    color: '#a855f7', 
    fontSize: 14, 
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 10,
  },
  voiceCommandsHint: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  voiceCommandsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
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