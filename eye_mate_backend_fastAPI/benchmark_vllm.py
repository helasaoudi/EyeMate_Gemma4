#!/usr/bin/env python3
"""
Benchmark script to compare vLLM vs standard Transformers performance.
Run this to verify your vLLM setup and measure performance improvements.
"""

import argparse
import os
import sys
import time
from pathlib import Path

import requests
from PIL import Image
import io


def check_server_health(base_url: str) -> dict:
    """Check if the server is healthy and ready."""
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Server health check failed: {e}")
        sys.exit(1)


def run_inference_test(
    base_url: str, image_path: str, task: str, num_requests: int = 1
) -> dict:
    """Run inference and measure performance."""
    
    # Read image
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}")
        sys.exit(1)
    
    with open(image_path, "rb") as f:
        image_data = f.read()
    
    timings = []
    results = []
    
    print(f"\n🚀 Running {num_requests} inference request(s)...")
    
    for i in range(num_requests):
        start = time.time()
        
        try:
            response = requests.post(
                f"{base_url}/infer",
                files={"file": ("image.jpg", image_data, "image/jpeg")},
                data={"task": task},
                timeout=60,
            )
            response.raise_for_status()
            result = response.json()
            results.append(result)
        except Exception as e:
            print(f"❌ Request {i+1} failed: {e}")
            continue
        
        end = time.time()
        elapsed = end - start
        timings.append(elapsed)
        
        print(f"  Request {i+1}/{num_requests}: {elapsed:.2f}s")
    
    if not timings:
        print("❌ All requests failed")
        sys.exit(1)
    
    return {
        "timings": timings,
        "results": results,
        "avg_time": sum(timings) / len(timings),
        "min_time": min(timings),
        "max_time": max(timings),
        "total_time": sum(timings),
    }


def create_test_image(size=(800, 600)):
    """Create a test image if none exists."""
    from PIL import Image, ImageDraw, ImageFont
    
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw some shapes
    draw.rectangle([50, 50, 200, 150], fill='red', outline='black', width=2)
    draw.ellipse([250, 50, 400, 150], fill='blue', outline='black', width=2)
    draw.polygon([(450, 50), (550, 50), (500, 150)], fill='green', outline='black')
    
    # Add text
    try:
        draw.text((50, 200), "Test Image", fill='black')
        draw.text((50, 250), "Red Rectangle, Blue Circle, Green Triangle", fill='black')
    except:
        pass
    
    return img


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark vLLM vs Transformers performance"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL of the FastAPI server (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--image",
        default=None,
        help="Path to test image (will create one if not provided)",
    )
    parser.add_argument(
        "--task",
        default="Describe this image in detail",
        help="Task prompt for inference",
    )
    parser.add_argument(
        "--requests",
        type=int,
        default=3,
        help="Number of requests to run (default: 3)",
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("EyeMate Backend Performance Benchmark")
    print("=" * 60)
    
    # Check server health
    print("\n📊 Checking server status...")
    health = check_server_health(args.url)
    print(f"✅ Server Status: {health.get('status')}")
    print(f"   Message: {health.get('message')}")
    print(f"   Device: {health.get('device')}")
    if 'engine' in health:
        print(f"   Engine: {health.get('engine')}")
    
    # Prepare test image
    if args.image:
        image_path = args.image
    else:
        print("\n🎨 Creating test image...")
        test_img = create_test_image()
        image_path = "/tmp/eyemate_test_image.jpg"
        test_img.save(image_path)
        print(f"   Saved to: {image_path}")
    
    # Run benchmark
    print(f"\n⏱️  Running benchmark with {args.requests} request(s)...")
    results = run_inference_test(args.url, image_path, args.task, args.requests)
    
    # Display results
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total requests: {args.requests}")
    print(f"Successful: {len(results['timings'])}")
    print(f"\nTiming Statistics:")
    print(f"  Average: {results['avg_time']:.3f}s")
    print(f"  Min:     {results['min_time']:.3f}s")
    print(f"  Max:     {results['max_time']:.3f}s")
    print(f"  Total:   {results['total_time']:.3f}s")
    
    if args.requests > 1:
        throughput = args.requests / results['total_time']
        print(f"\nThroughput: {throughput:.2f} requests/second")
    
    # Show sample result
    if results['results']:
        print(f"\n📝 Sample Response:")
        sample = results['results'][0]
        if 'result' in sample and 'description' in sample['result']:
            desc = sample['result']['description']
            print(f"   {desc[:200]}..." if len(desc) > 200 else f"   {desc}")
    
    print("\n" + "=" * 60)
    print("\n💡 Performance Tips:")
    print("   - vLLM should be 2-5x faster than standard Transformers")
    print("   - First request may be slower (model warmup)")
    print("   - For production, enable VLLM_ENABLE_PREFIX_CACHING=true")
    print("   - Monitor GPU memory with: watch -n 1 nvidia-smi")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
