import { BACKEND_CONFIG } from '../config/backendConfig';

/**
 * Blocks until GET /health returns status "ready" (Gemma finished loading in Docker).
 * First startup can take many minutes while HF weights download.
 */
export async function waitForBackendModelReady(): Promise<void> {
  const intervalMs = BACKEND_CONFIG.HEALTH_POLL_INTERVAL_MS;
  const maxWaitMs = BACKEND_CONFIG.MODEL_LOAD_MAX_WAIT_MS;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(BACKEND_CONFIG.HEALTH_URL, { method: 'GET' });
      if (res.ok) {
        const j = (await res.json()) as { status?: string; message?: string };
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
    } catch {
      console.log('⏳ EyeMate backend: health check failed, retrying...');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    'EyeMate server did not become ready in time. Keep Docker running until Hugging Face download finishes, then try again.'
  );
}
