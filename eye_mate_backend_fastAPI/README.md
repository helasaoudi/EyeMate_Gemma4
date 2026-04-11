# EyeMate Backend FastAPI

FastAPI service for **Gemma 4** multimodal inference (`google/gemma-4-E4B-it`): scene description (`POST /infer`) and structured document reading (`POST /document/analyze`).

## Project Structure

```
eye_mate_backend_fastAPI/
├── app/
│   ├── app.py                 # FastAPI app + lifespan (loads model at startup)
│   ├── config.py
│   ├── prompts/               # Long-form document prompts (FR/EN)
│   ├── models/schemas.py
│   ├── services/gemma4_service.py
│   └── controllers/image_controller.py
├── main.py
└── requirements.txt
```

## API Endpoints

- `GET /` — API info
- `GET /health` — Model load status (`status: ready` when usable)
- `POST /infer` — Multipart: `image` file + form field `text` (scene analysis)
- `POST /document/analyze` — JSON: `{ "image_base64": "...", "language": "fr" | "en" }`

## Running

```bash
pip install -r requirements.txt
python main.py
```

Default URL: `http://0.0.0.0:8000`.

## Environment

- `GEMMA4_MODEL_NAME` — default `google/gemma-4-E4B-it`
- `HOST`, `PORT`, `LOG_LEVEL`
- `MAX_NEW_TOKENS_SCENE`, `MAX_NEW_TOKENS_DOCUMENT`
- `DEVICE_MAP` — default `auto`
- `ATTN_IMPLEMENTATION` — default `sdpa` (set `eager` if needed)

A CUDA GPU with sufficient VRAM is strongly recommended for E4B (~BF16).
