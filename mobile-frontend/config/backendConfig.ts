// Backend Configuration — Gemma 4 FastAPI (see eye_mate_backend_fastAPI)

export const BACKEND_CONFIG = {
  /**
   * Docker/API on your Mac: use the Mac's LAN IP (same Wi‑Fi as the phone).
   * Never use 127.0.0.1 on a real device — it points at the phone, not your PC.
   * Simulator on Mac: http://127.0.0.1:8000 | Android emulator: http://10.0.2.2:8000
   */
  BASE_URL: 'http://192.168.1.13:8000',

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
