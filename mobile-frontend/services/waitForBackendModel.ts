import axios from 'axios';
import { BACKEND_CONFIG } from '../config/backendConfig';

/**
 * Blocks until GET /health returns status "ready" (Gemma finished loading in Docker).
 * First startup can take many minutes while HF weights download.
 *
 * Uses axios instead of fetch: React Native's fetch often hits "Network request timed out"
 * to VPN / Tailscale IPs while Safari and axios work for the same URL.
 */
export async function waitForBackendModelReady(): Promise<void> {
  const intervalMs = BACKEND_CONFIG.HEALTH_POLL_INTERVAL_MS;
  const maxWaitMs = BACKEND_CONFIG.MODEL_LOAD_MAX_WAIT_MS;
  const healthUrl = BACKEND_CONFIG.HEALTH_URL;

  if (!/^https?:\/\//i.test(healthUrl)) {
    throw new Error(
      `Missing or invalid EXPO_PUBLIC_BACKEND_URL (resolved HEALTH_URL="${healthUrl}"). Set .env and restart Expo with: npx expo start -c`
    );
  }

  console.log('EyeMate backend health URL:', healthUrl);

  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await axios.get(healthUrl, {
        timeout: BACKEND_CONFIG.HEALTH_REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
        headers: { ...BACKEND_CONFIG.COMMON_HEADERS },
      });

      if (res.status >= 200 && res.status < 300) {
        const j = res.data as { status?: string; message?: string };
        if (j.status === 'ready') {
          return;
        }
        if (j.status === 'error') {
          throw new Error(
            j.message ??
              'Model failed to load on the server. Check Docker logs for [Gemma4].'
          );
        }
        const elapsedMin = Math.floor((Date.now() - start) / 60_000);
        console.log(
          `⏳ [${elapsedMin}m] ${j.message ?? j.status ?? 'loading...'}`
        );
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.log(
        '⏳ EyeMate backend: health check failed, retrying...',
        detail
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    'EyeMate server did not become ready in time. Keep Docker running until Hugging Face download finishes, then try again.'
  );
}
