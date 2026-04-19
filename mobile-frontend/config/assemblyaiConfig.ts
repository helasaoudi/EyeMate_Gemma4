/**
 * AssemblyAI (voice recording → transcript) — used by `voiceToTextService`.
 * Set `EXPO_PUBLIC_ASSEMBLYAI_API_KEY` in `.env` (restart Expo after changes).
 */
import Constants from 'expo-constants';

type Extra = { ASSEMBLYAI_API_KEY?: string };

function getApiKey(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
  const fromExtra = (Constants.expoConfig?.extra as Extra | undefined)?.ASSEMBLYAI_API_KEY;
  return (fromEnv || fromExtra || '').trim();
}

export const ASSEMBLYAI_CONFIG = {
  get API_KEY() {
    return getApiKey();
  },
  BASE_URL: 'https://api.assemblyai.com',
} as const;
