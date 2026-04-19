#!/bin/bash
# Simple startup script for DGX Spark - No vLLM container needed!
# Uses standard Transformers (fixed with trust_remote_code=True)

set -e

echo "🚀 Starting EyeMate Backend (Transformers Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if in virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  No virtual environment detected!"
    echo "Creating and activating .venv..."
    
    if [ ! -d ".venv" ]; then
        python3.12 -m venv .venv
    fi
    
    source .venv/bin/activate
    
    # Install dependencies if needed
    if ! python -c "import transformers" 2>/dev/null; then
        echo "📦 Installing dependencies..."
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
        pip install transformers accelerate pillow fastapi uvicorn python-multipart pydantic
    fi
fi

echo "✅ Virtual environment: $VIRTUAL_ENV"

# Check GPU
if command -v nvidia-smi &> /dev/null; then
    echo "🖥️  GPU Status:"
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
else
    echo "⚠️  No GPU detected - will run on CPU (slow!)"
fi

# Set environment to use Transformers (not vLLM)
export USE_VLLM=false
export HOST=0.0.0.0
export PORT=8000
export GEMMA4_MODEL_NAME=google/gemma-4-E4B-it

echo ""
echo "📋 Configuration:"
echo "   Engine: Transformers (with trust_remote_code=True)"
echo "   Model: $GEMMA4_MODEL_NAME"
echo "   Host: $HOST:$PORT"
echo ""
echo "⏳ Starting server..."
echo "   (First run downloads model - can take 10-30 minutes)"
echo ""

# Start backend
python main.py
