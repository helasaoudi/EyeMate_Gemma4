// Backend Configuration — Gemma 4 FastAPI (see eye_mate_backend_fastAPI)

export const BACKEND_CONFIG = {
  /**
   * Public tunnel (ngrok) or local LAN URL — no trailing slash.
   * For local dev: http://<your-mac-lan-ip>:8000 (never 127.0.0.1 on a real device).
   */
  BASE_URL: 'https://660e-68-226-74-146.ngrok-free.app',

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

  /** How often to poll GET /health while waiting for Gemma to load */
  HEALTH_POLL_INTERVAL_MS: 3000,
  /** Max time to wait for model (first Docker run can be very long) */
  MODEL_LOAD_MAX_WAIT_MS: 3_600_000,
};
