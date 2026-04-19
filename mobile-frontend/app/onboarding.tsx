// app/onboarding.tsx
// Competition / demo: no sign-in after onboarding — always continue to main tabs.
// Clerk sign-in & sign-up live under app/(auth)/ — disabled in app/_layout.tsx for the competition.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Dimensions,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;

  const screens = [
    {
      title: "The World,\nArticulated.",
      subtitle: "MEET EYEMATE",
      mainText: "Vision",
      bottomText: "Experience a breakthrough in independence. Your personal AI assistant that turns sight into sound.",
      colors: ['#08041a', '#1a0d3f'],
      icon: "eye-outline"
    },
    {
      title: "Simply Ask.\nI'm Listening.",
      subtitle: "NATURAL DIALOGUE",
      mainText: "Voice",
      bottomText: "No buttons, no clutter. Just speak naturally to explore your environment or read documents.",
      colors: ['#120a2e', '#2d1b5e'],
      icon: "mic-outline"
    },
    {
      title: "Navigate with\nConfidence.",
      subtitle: "SPATIAL AWARENESS",
      mainText: "Space",
      bottomText: "Real-time object detection and spatial guidance. Move through the world with a digital guardian.",
      colors: ['#1a0d3f', '#4a3575'],
      icon: "navigate-outline"
    },
    {
      title: "Knowledge in\nEvery Detail.",
      subtitle: "SMART TEXT",
      mainText: "Clarity",
      bottomText: "From restaurant menus to handwritten notes—hear the world's information read back to you.",
      colors: ['#2d1b5e', '#08041a'],
      icon: "book-outline"
    }
  ];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, {
          toValue: 1.12,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbPulse, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -30, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setCurrentScreen(currentScreen + 1);
        slideAnim.setValue(30);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
        ]).start();
      });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = () => {
    router.replace('/(tabs)/Home');
  };

  const screen = screens[currentScreen];

  return (
    <View style={styles.container}>
      <LinearGradient colors={screen.colors} style={StyleSheet.absoluteFill} />

      <Pressable style={styles.skipButton} onPress={completeOnboarding}>
        <Text style={styles.skipText}>SKIP</Text>
      </Pressable>

      <Animated.View 
        style={[
          styles.content, 
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }
        ]}
      >
        <View style={styles.topSection}>
          <Text style={styles.subtitle}>{screen.subtitle}</Text>
          <Text style={styles.title}>{screen.title}</Text>
        </View>

        <View style={styles.centerSection}>
          <Animated.View style={[styles.orbWrapper, { transform: [{ scale: orbPulse }] }]}>
            <View style={styles.outerGlow} />
            <LinearGradient
              colors={['#c084fc', '#7c3aed', 'transparent']}
              style={styles.mainOrb}
            >
              <Ionicons name={screen.icon as any} size={48} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.mainText}>{screen.mainText}</Text>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>{screen.bottomText}</Text>
          
          <View style={styles.footerRow}>
            <View style={styles.dotsContainer}>
              {screens.map((_, index) => (
                <View 
                  key={index} 
                  style={[styles.dot, index === currentScreen ? styles.dotActive : null]} 
                />
              ))}
            </View>

            <Pressable style={styles.nextButton} onPress={handleNext}>
              <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.nextGradient}>
                <Ionicons 
                  name={currentScreen === screens.length - 1 ? "checkmark" : "arrow-forward"} 
                  size={28} 
                  color="white" 
                />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 30,
    zIndex: 20,
    padding: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  content: { 
    flex: 1, 
    justifyContent: 'space-between', 
    paddingHorizontal: 35, 
    paddingVertical: height * 0.1 // Adjusts spacing based on screen height
  },
  topSection: { marginTop: 20 },
  subtitle: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
    letterSpacing: -1,
  },
  centerSection: { alignItems: 'center' },
  orbWrapper: {
    width: width * 0.55,
    height: width * 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  outerGlow: {
    position: 'absolute',
    width: '110%',
    height: '110%',
    borderRadius: 200,
    backgroundColor: '#7c3aed',
    opacity: 0.1,
  },
  mainOrb: {
    width: '90%',
    height: '90%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  mainText: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '200',
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  bottomSection: { width: '100%' },
  bottomText: {
    color: '#94a3b8',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 35,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsContainer: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    width: 32,
    backgroundColor: '#c084fc',
  },
  nextButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  nextGradient: {
    flex: 1,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});