// app/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Index() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  useEffect(() => {
    const checkOnboarding = async () => {
      console.log('🔍 Checking onboarding status...');
      setDebugInfo('Checking auth...');
      
      if (!isLoaded) {
        console.log('⏳ Auth not loaded yet...');
        return;
      }

      try {
        setDebugInfo('Reading storage...');
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        
        console.log('📱 Has seen onboarding:', hasSeenOnboarding);
        console.log('🔐 Is signed in:', isSignedIn);
        console.log('✅ Auth loaded:', isLoaded);

        // Small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!hasSeenOnboarding) {
          console.log('🎯 Navigating to ONBOARDING');
          setDebugInfo('Going to onboarding...');
          router.replace('/onboarding');
        } else if (isSignedIn) {
          console.log('🎯 Navigating to HOME');
          setDebugInfo('Going to home...');
          router.replace('/(tabs)/Home');
        } else {
          console.log('🎯 Navigating to AUTH');
          setDebugInfo('Going to sign in...');
          router.replace('/(auth)/sign-in');
        }
      } catch (error) {
        console.error('❌ Error checking onboarding:', error);
        setDebugInfo('Error occurred');
        router.replace('/onboarding');
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboarding();
  }, [isLoaded, isSignedIn]);

  return (
    <LinearGradient
      colors={['#1e1b4b', '#581c87', '#1e1b4b']}
      style={styles.container}
    >
      <ActivityIndicator size="large" color="#a78bfa" />
      <Text style={styles.debugText}>{debugInfo}</Text>
      <Text style={styles.smallText}>
        Auth: {isLoaded ? '✓' : '⏳'} | Signed: {isSignedIn ? '✓' : '✗'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
  },
  debugText: {
    color: '#a78bfa',
    fontSize: 16,
    marginTop: 20,
    fontWeight: '600',
  },
  smallText: {
    color: '#93c5fd',
    fontSize: 12,
    marginTop: 10,
  },
});