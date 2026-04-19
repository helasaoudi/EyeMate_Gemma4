#!/usr/bin/env bash
# EyeMate Backend - One-Command Auto Setup & Run
# Just run: ./run.sh
# This will automatically handle everything: Docker, vLLM, dependencies, and start the backend

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$PROJECT_ROOT/.venv"
CONTAINER_NAME="eyemate-vllm"

# Configuration
MODEL_NAME="${MODEL_NAME:-google/gemma-4-E4B-it}"
VLLM_PORT="${VLLM_PORT:-8000}"
GPU_MEMORY="${GPU_MEMORY_UTILIZATION:-0.90}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

# Check if running on DGX Spark (ARM64 + NVIDIA)
is_dgx_spark() {
    nvidia-smi &> /dev/null && uname -m | grep -q "aarch64"
}

# Main auto-setup and run
main() {
    clear
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║           🚀 EyeMate Backend - Auto Setup                 ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    # STEP 1: Detect environment
    print_header "Step 1/6: Detecting Environment"
    if is_dgx_spark; then
        print_success "DGX Spark detected (ARM64 + NVIDIA GPU)"
        USE_CONTAINER=true
    elif nvidia-smi &> /dev/null && docker --version &> /dev/null; then
        print_success "NVIDIA GPU + Docker detected"
        USE_CONTAINER=true
    else
        print_info "No GPU/Docker - using Transformers mode"
        USE_CONTAINER=false
    fi
    echo ""
    
    # STEP 2: Create venv and install dependencies
    print_header "Step 2/6: Setting Up Dependencies"
    
    if [[ ! -d "$VENV_PATH" ]]; then
        print_info "Creating virtual environment..."
        python3 -m venv "$VENV_PATH"
    fi
    
    source "$VENV_PATH/bin/activate"
    print_success "Virtual environment activated"
    
    pip install -q --upgrade pip
    
    if [[ "$USE_CONTAINER" == "true" ]]; then
        print_info "Installing API-only dependencies (vLLM runs in container)..."
        
        # Install PyTorch if on ARM64
        if uname -m | grep -q "aarch64"; then
            pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cu121 || true
        fi
        
        # Install API dependencies
        pip install -q fastapi uvicorn python-multipart pydantic pillow numpy openai httpx requests 2>/dev/null || {
            print_warning "Some packages may already be installed"
        }
    else
        print_info "Installing full Transformers dependencies..."
        pip install -q torch torchvision pillow fastapi uvicorn python-multipart pydantic 2>/dev/null || {
            print_warning "Some packages may already be installed"
        }
        
        # Install transformers (supports 4.x and 5.x)
        print_info "Installing transformers >= 4.51.0 (Gemma 4 vision support)..."
        pip install --upgrade 'transformers>=4.51.0' accelerate 2>/dev/null || {
            print_error "Failed to install transformers"
            exit 1
        }
    fi
    
    print_success "Dependencies ready"
    echo ""
    
    # STEP 3: Fix Docker if needed
    if [[ "$USE_CONTAINER" == "true" ]]; then
        print_header "Step 3/6: Configuring Docker for GPU"
        
        # Test if GPU access works
        if docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi &> /dev/null; then
            print_success "Docker GPU access working"
        else
            print_warning "Docker GPU access not configured - attempting fix..."
            
            # Try to fix
            if command -v nvidia-ctk &> /dev/null; then
                sudo nvidia-ctk runtime configure --runtime=docker 2>/dev/null || true
                sudo systemctl restart docker 2>/dev/null || true
                sleep 2
            else
                print_info "Installing NVIDIA Container Toolkit..."
                distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
                curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg 2>/dev/null
                curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
                    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
                    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null
                sudo apt-get update -qq
                sudo apt-get install -y -qq nvidia-container-toolkit
                sudo nvidia-ctk runtime configure --runtime=docker
                sudo systemctl restart docker
            fi
            
            # Test again
            if docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi &> /dev/null; then
                print_success "Docker GPU access configured successfully"
            else
                print_error "Could not configure Docker GPU - falling back to Transformers"
                USE_CONTAINER=false
            fi
        fi
        echo ""
    fi
    
    # STEP 4: Start vLLM container (if using container mode)
    if [[ "$USE_CONTAINER" == "true" ]]; then
        print_header "Step 4/6: Starting vLLM Container"
        
        # Stop existing container
        if docker ps -a | grep -q $CONTAINER_NAME; then
            print_info "Stopping existing container..."
            docker stop $CONTAINER_NAME 2>/dev/null || true
            docker rm $CONTAINER_NAME 2>/dev/null || true
        fi
        
        # Pull image if not exists
        if ! docker images | grep -q "vllm/vllm-openai"; then
            print_info "Pulling vLLM container image..."
            docker pull vllm/vllm-openai:latest
        fi
        
        print_info "Starting vLLM container..."
        print_info "Model: $MODEL_NAME"
        print_info "Port: $VLLM_PORT"
        
        docker run -d \
            --name $CONTAINER_NAME \
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
            --gpu-memory-utilization $GPU_MEMORY \
            --trust-remote-code \
            --enable-chunked-prefill \
            --enable-prefix-caching > /dev/null 2>&1
        
        print_success "vLLM container started"
        print_info "Container logs: docker logs -f $CONTAINER_NAME"
        echo ""
        
        # STEP 5: Wait for model
        print_header "Step 5/6: Waiting for Model to Load"
        print_warning "First run downloads model - can take 10-30 minutes"
        print_info "Press Ctrl+C to skip waiting and check manually later"
        echo ""
        
        for i in {1..180}; do
            if curl -s http://localhost:$VLLM_PORT/health > /dev/null 2>&1; then
                print_success "Model loaded and ready!"
                break
            fi
            
            if [[ $((i % 6)) -eq 0 ]]; then
                mins=$((i / 6))
                echo -e "${YELLOW}⏳ Loading... (${mins} minutes elapsed)${NC}"
            fi
            sleep 10
        done
        
        echo ""
        
        # STEP 6: Run backend (proxy mode)
        print_header "Step 6/6: Starting FastAPI Backend"
        print_info "Backend connects to vLLM container"
        print_info "API URL: http://localhost:$VLLM_PORT"
        echo ""
        
        export VLLM_API_URL="http://localhost:$VLLM_PORT"
        export USE_VLLM_CONTAINER=true
        
    else
        # Transformers mode (no container)
        print_header "Step 4/6: Skipping vLLM Container"
        print_info "Using Transformers mode (no Docker needed)"
        echo ""
        
        print_header "Step 5/6: Preparing Model"
        print_warning "First run downloads model - can take 10-30 minutes"
        echo ""
        
        print_header "Step 6/6: Starting FastAPI Backend"
        print_info "Using Transformers with trust_remote_code=True"
        print_info "API URL: http://localhost:$VLLM_PORT"
        echo ""
        
        export USE_VLLM=false
        export GEMMA4_MODEL_NAME="$MODEL_NAME"
    fi
    
    # Final summary
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║              ✅ Setup Complete - Starting Server           ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    if [[ "$USE_CONTAINER" == "true" ]]; then
        print_info "⚡ Mode: vLLM Container (Optimized)"
        print_info "📡 API: http://localhost:$VLLM_PORT"
        print_info "📊 Logs: docker logs -f $CONTAINER_NAME"
    else
        print_info "🐢 Mode: Transformers (Compatible)"
        print_info "📡 API: http://localhost:$VLLM_PORT"
    fi
    
    echo ""
    print_warning "Starting backend... (Press Ctrl+C to stop)"
    echo ""
    
    # Start the backend
    export HOST="0.0.0.0"
    export PORT="$VLLM_PORT"
    exec python "$PROJECT_ROOT/main.py"
}

# Run main
main
