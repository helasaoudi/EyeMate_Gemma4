#!/bin/bash
# Run vLLM container on DGX Spark for Gemma 4 E4B IT inference

set -e

# Configuration
MODEL_NAME="${MODEL_NAME:-google/gemma-4-E4B-it}"
VLLM_PORT="${VLLM_PORT:-8000}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.90}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"
CONTAINER_NAME="eyemate-vllm"

echo "🚀 Starting vLLM container on DGX Spark"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Model: $MODEL_NAME"
echo "Port: $VLLM_PORT"
echo "GPU Memory: ${GPU_MEMORY_UTILIZATION}%"
echo "Max Length: $MAX_MODEL_LEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stop existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🛑 Stopping existing container..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
fi

# Pull latest vLLM image optimized for ARM64 + GPU
echo "📥 Pulling vLLM container..."
docker pull vllm/vllm-openai:latest

# Run vLLM container
echo "🏃 Starting vLLM container..."
docker run -d \
    --name $CONTAINER_NAME \
    --runtime=nvidia \
    --gpus all \
    -p $VLLM_PORT:8000 \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -e NVIDIA_VISIBLE_DEVICES=all \
    -e HUGGING_FACE_HUB_TOKEN="${HUGGING_FACE_HUB_TOKEN:-}" \
    vllm/vllm-openai:latest \
    --model $MODEL_NAME \
    --host 0.0.0.0 \
    --port 8000 \
    --dtype auto \
    --max-model-len $MAX_MODEL_LEN \
    --gpu-memory-utilization $GPU_MEMORY_UTILIZATION \
    --trust-remote-code \
    --enable-chunked-prefill \
    --enable-prefix-caching

echo ""
echo "✅ vLLM container started successfully!"
echo ""
echo "📊 Monitor logs:"
echo "   docker logs -f $CONTAINER_NAME"
echo ""
echo "🔍 Check health:"
echo "   curl http://localhost:$VLLM_PORT/health"
echo ""
echo "🧪 Test inference:"
echo "   curl http://localhost:$VLLM_PORT/v1/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{"
echo "       \"model\": \"$MODEL_NAME\","
echo "       \"prompt\": \"Describe this image:\","
echo "       \"max_tokens\": 100"
echo "     }'"
echo ""
echo "🛑 Stop container:"
echo "   docker stop $CONTAINER_NAME"
echo ""

# Wait for model to load (can take several minutes)
echo "⏳ Waiting for model to load (this can take 5-15 minutes)..."
echo "   Monitoring container logs..."
docker logs -f $CONTAINER_NAME &
LOG_PID=$!

# Wait for health check
MAX_WAIT=900  # 15 minutes
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:$VLLM_PORT/health > /dev/null 2>&1; then
        echo ""
        echo "🎉 vLLM is ready for inference!"
        kill $LOG_PID 2>/dev/null || true
        exit 0
    fi
    sleep 10
    ELAPSED=$((ELAPSED + 10))
    echo -n "."
done

echo ""
echo "⚠️  Timeout waiting for vLLM to be ready. Check logs:"
echo "   docker logs $CONTAINER_NAME"
kill $LOG_PID 2>/dev/null || true
exit 1
