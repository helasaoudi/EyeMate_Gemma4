// app/(auth)/_layout.tsx
// Competition build: root layout does not navigate here (sign-in / sign-up unused).
// Kept for later production — Clerk flows in sign-in.tsx & sign-up.tsx.
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function AuthRoutesLayout() {
  const { isSignedIn } = useAuth();

  // Si l'utilisateur est déjà connecté, rediriger vers l'accueil
  // Note: L'onboarding est géré par les pages d'inscription
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}