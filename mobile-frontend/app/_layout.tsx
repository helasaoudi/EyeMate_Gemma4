import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SettingsProvider } from '../contexts/SettingsContext'; 

const tokenCache = {
  async getToken(key: string) {
    try { return SecureStore.getItemAsync(key); } catch { return null; }
  },
  async saveToken(key: string, value: string) {
    try { return SecureStore.setItemAsync(key, value); } catch { return; }
  },
};

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)/Home');
    } else if (!isSignedIn && !inAuthGroup && segments[0] !== 'onboarding' && segments[0] !== '(auth)') {
      router.replace('/(auth)/sign-in');
    }
  }, [isSignedIn, isLoaded]);

  return <Slot />;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        {/* THIS IS THE FIX: Wrapping everything inside SettingsProvider here */}
        <SettingsProvider>
          <InitialLayout />
        </SettingsProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}