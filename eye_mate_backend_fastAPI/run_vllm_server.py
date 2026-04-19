#!/usr/bin/env python3
"""
Alternative: Run vLLM server directly in Python (if container doesn't work)
This requires vLLM to be installed, which may not work on all platforms.
"""

import os
import argparse
from vllm import LLM, SamplingParams
from vllm.entrypoints.openai.api_server import run_server


def main():
    parser = argparse.ArgumentParser(description="Run vLLM OpenAI-compatible server")
    parser.add_argument("--model", type=str, default="google/gemma-4-E4B-it")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--gpu-memory-utilization", type=float, default=0.90)
    parser.add_argument("--max-model-len", type=int, default=8192)
    parser.add_argument("--trust-remote-code", action="store_true", default=True)
    
    args = parser.parse_args()
    
    print("🚀 Starting vLLM OpenAI-compatible server")
    print(f"Model: {args.model}")
    print(f"Host: {args.host}:{args.port}")
    print(f"GPU Memory: {args.gpu_memory_utilization}")
    
    # Run OpenAI-compatible server
    run_server(
        model=args.model,
        host=args.host,
        port=args.port,
        gpu_memory_utilization=args.gpu_memory_utilization,
        max_model_len=args.max_model_len,
        trust_remote_code=args.trust_remote_code,
        enable_chunked_prefill=True,
    )


if __name__ == "__main__":
    main()
