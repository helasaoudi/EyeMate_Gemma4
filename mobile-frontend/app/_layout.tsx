import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SettingsProvider } from '../contexts/SettingsContext';

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

/**
 * Competition / demo mode:
 * - App always opens on `/onboarding` (every cold start).
 * - Clerk sign-in / sign-up flows are NOT used — we do not redirect to `/(auth)/sign-in`.
 *   Screens remain under `app/(auth)/` for later; re-enable the commented block for production.
 */
function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const openedOnboarding = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!openedOnboarding.current) {
      openedOnboarding.current = true;
      router.replace('/onboarding');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)/Home');
    }
    // Production: require Clerk session for main app
    // } else if (!isSignedIn && !inAuthGroup && segments[0] !== 'onboarding' && segments[0] !== '(auth)') {
    //   router.replace('/(auth)/sign-in');
    // }
  }, [isLoaded, isSignedIn, segments, router]);

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