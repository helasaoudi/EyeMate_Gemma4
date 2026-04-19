// Backend Configuration — Gemma 4 FastAPI (see eye_mate_backend_fastAPI)

/**
 * No trailing slash. Required: set `EXPO_PUBLIC_BACKEND_URL` in `.env`, then restart Expo.
 * No hardcoded fallback — competition / demo builds must point at your tunnel explicitly.
 */
function resolveBaseUrl(): string {
  const raw =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) || '';
  return raw.trim().replace(/\/$/, '');
}

export const BACKEND_CONFIG = {
  get BASE_URL(): string {
    return resolveBaseUrl();
  },

  /** Helps ngrok’s free tier return the API response instead of an HTML warning page */
  COMMON_HEADERS: {
    'ngrok-skip-browser-warning': 'true',
  } as Record<string, string>,

  INFER_PATH: '/infer',
  DOCUMENT_PATH: '/document/analyze',
  HEALTH_PATH: '/health',

  get INFER_URL() {
    return `${this.BASE_URL}${this.INFER_PATH}`;
  },

  get DOCUMENT_URL() {
    return `${this.BASE_URL}${this.DOCUMENT_PATH}`;
  },

  get HEALTH_URL() {
    return `${this.BASE_URL}${this.HEALTH_PATH}`;
  },

  /** @deprecated Use INFER_URL — kept for existing imports */
  get FULL_URL() {
    return this.INFER_URL;
  },

  // Prompt for scene / camera analysis (Gemma 4 natural-language instruction)
  PROMPT:
    'Describe in detail what you see in this image, including objects, colors, and their positions.',

  REQUEST_DELAY: 1000,

  /**
   * Gemma inference can take minutes (esp. CPU / cold start). RN `fetch` often
   * times out around ~60s — axios uses these for /infer and /document/analyze.
   */
  INFER_TIMEOUT_MS: 600_000,
  DOCUMENT_TIMEOUT_MS: 600_000,

  /** Single GET /health request timeout (RN fetch often fails VPN/Tailscale; axios uses longer native timeouts) */
  HEALTH_REQUEST_TIMEOUT_MS: 120_000,

  /** How often to poll GET /health while waiting for Gemma to load */
  HEALTH_POLL_INTERVAL_MS: 3000,
  /** Max time to wait for model (first Docker run can be very long) */
  MODEL_LOAD_MAX_WAIT_MS: 3_600_000,
};
