# EyeMate Backend FastAPI

FastAPI service for **Gemma 4** multimodal inference (`google/gemma-4-E4B-it`): scene description (`POST /infer`) and structured document reading (`POST /document/analyze`).

**🚀 NEW: vLLM Support** - Get 2-5x faster inference with 50% less GPU memory!  
⚠️ **Linux + NVIDIA GPU only** | macOS users see [MAC_OPTIMIZATION_GUIDE.md](MAC_OPTIMIZATION_GUIDE.md)

## Features

- ✅ **Multimodal AI**: Image + Text → Text with Gemma 4
- ✅ **High Performance**: vLLM engine for optimized inference
- ✅ **Dual Mode**: Switch between vLLM and standard Transformers
- ✅ **Scene Analysis**: Describe images for blind users
- ✅ **Document OCR**: Extract structured data from documents
- ✅ **Multi-language**: English & French support

## Project Structure

```
eye_mate_backend_fastAPI/
├── app/
│   ├── app.py                          # FastAPI app + lifespan
│   ├── config.py                       # Configuration with vLLM settings
│   ├── prompts/                        # Document prompts (FR/EN)
│   ├── models/schemas.py
│   ├── services/
│   │   ├── gemma4_service.py          # Standard transformers service
│   │   └── gemma4_vllm_service.py     # vLLM optimized service
│   └── controllers/image_controller.py
├── main.py
├── requirements.txt
├── VLLM_MIGRATION_GUIDE.md            # Complete vLLM setup guide
└── benchmark_vllm.py                   # Performance testing tool
```

## API Endpoints

- `GET /` — API info
- `GET /health` — Model load status (`status: ready` when usable)
- `POST /infer` — Multipart: `image` file + form field `text` (scene analysis)
- `POST /document/analyze` — JSON: `{ "image_base64": "...", "language": "fr" | "en" }`

## Quick Start

### Standard Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run with standard Transformers
python main.py
```

### vLLM Installation (Recommended for Production)

```bash
# Install vLLM for optimized inference
pip install vllm

# Copy and configure environment
cp .env.example .env
# Edit .env and set USE_VLLM=true

# Run with vLLM
python main.py
```

Default URL: `http://0.0.0.0:8000`

## Performance Comparison

| Engine | Latency | Throughput | GPU Memory | Concurrent Requests |
|--------|---------|------------|------------|---------------------|
| **Transformers** | ~500ms | ~30 tok/s | 100% | 1-2 |
| **vLLM** | ~200ms | ~100-150 tok/s | 50-70% | 8-16+ |

**Speedup: 2-5x faster with 30-50% less GPU memory!**

## Configuration

### Key Environment Variables

**Server:**
- `HOST` — Server host (default: `0.0.0.0`)
- `PORT` — Server port (default: `8000`)
- `LOG_LEVEL` — Logging level (default: `INFO`)

**Model:**
- `GEMMA4_MODEL_NAME` — Model name (default: `google/gemma-4-E4B-it`)
- `MAX_NEW_TOKENS_SCENE` — Max tokens for scene analysis (default: `1024`)
- `MAX_NEW_TOKENS_DOCUMENT` — Max tokens for documents (default: `2048`)

**vLLM (Recommended):**
- `USE_VLLM` — Enable vLLM engine (default: `true`)
- `VLLM_GPU_MEMORY_UTILIZATION` — GPU memory to use (default: `0.90`)
- `VLLM_TENSOR_PARALLEL_SIZE` — Number of GPUs (default: `1`)
- `VLLM_DTYPE` — Model dtype (default: `auto`)
- `VLLM_ENABLE_PREFIX_CACHING` — Cache repeated prompts (default: `true`)
- `VLLM_MAX_MODEL_LEN` — Max sequence length (default: `8192`)

**Transformers (Fallback):**
- `DEVICE_MAP` — Device mapping (default: `auto`)
- `ATTN_IMPLEMENTATION` — Attention type (default: `sdpa`)
- `TORCH_DTYPE` — Torch dtype (default: `bfloat16`)

See [.env.example](.env.example) for complete configuration.

## Requirements

### For vLLM (Linux only)
- **OS**: Linux (Ubuntu 20.04+, etc.)
- **GPU**: NVIDIA GPU with CUDA (16GB+ VRAM recommended)
- **CUDA**: 11.8 or 12.1+
- **Python**: 3.8+
- **RAM**: 32GB+ system RAM recommended

### For macOS
- **OS**: macOS (Apple Silicon or Intel)
- **GPU**: Metal (MPS) for Apple Silicon, or CPU for Intel
- **Python**: 3.8+
- **RAM**: 16GB+ recommended
- **Note**: See [MAC_OPTIMIZATION_GUIDE.md](MAC_OPTIMIZATION_GUIDE.md)

## Benchmarking

Test your setup and compare performance:

```bash
# Run benchmark
python benchmark_vllm.py --requests 5

# Use custom image
python benchmark_vllm.py --image path/to/image.jpg --requests 10
```
