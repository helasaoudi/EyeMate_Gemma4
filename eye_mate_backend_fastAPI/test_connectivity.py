#!/usr/bin/env python3
"""
Test script to verify EyeMate backend connectivity and health.
Run this to ensure your backend is accessible before connecting the mobile app.

Usage:
    python test_connectivity.py [backend_url]
    
Examples:
    python test_connectivity.py http://localhost:8000
    python test_connectivity.py http://100.68.87.28:8000
    python test_connectivity.py https://your-ngrok-url.ngrok.io
"""

import sys
import requests
from typing import Optional


def test_backend_health(base_url: str) -> bool:
    """Test if backend health endpoint is accessible."""
    health_url = f"{base_url.rstrip('/')}/health"
    
    print(f"\n🔍 Testing backend health...")
    print(f"   URL: {health_url}")
    
    try:
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status", "unknown")
            message = data.get("message", "No message")
            device = data.get("device", "unknown")
            
            print(f"   ✅ Health check passed!")
            print(f"   📊 Status: {status}")
            print(f"   💬 Message: {message}")
            print(f"   🖥️  Device: {device}")
            
            if status == "ready":
                print(f"   ✨ Backend is READY for inference!")
                return True
            elif status == "loading":
                print(f"   ⏳ Backend is still LOADING the model...")
                print(f"   💡 Wait a few minutes and try again.")
                return True
            else:
                print(f"   ⚠️  Backend has an ERROR.")
                return False
        else:
            print(f"   ❌ Health check failed with status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"   ❌ Connection timed out. Is the backend running?")
        return False
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection refused. Backend is not accessible at {base_url}")
        return False
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return False


def test_backend_info(base_url: str) -> bool:
    """Test if backend info endpoint is accessible."""
    info_url = f"{base_url.rstrip('/')}/".rstrip('/')
    
    print(f"\n🔍 Testing backend API info...")
    print(f"   URL: {info_url}")
    
    try:
        response = requests.get(info_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "No message")
            endpoints = data.get("endpoints", {})
            
            print(f"   ✅ API info retrieved!")
            print(f"   💬 {message}")
            print(f"   📡 Available endpoints:")
            for endpoint, desc in endpoints.items():
                print(f"      - {endpoint}: {desc}")
            return True
        else:
            print(f"   ❌ Failed with status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ⚠️  Could not get API info: {e}")
        return False


def test_cors(base_url: str) -> bool:
    """Test if CORS is properly configured."""
    health_url = f"{base_url.rstrip('/')}/health"
    
    print(f"\n🔍 Testing CORS configuration...")
    
    try:
        response = requests.options(health_url, headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
        }, timeout=5)
        
        cors_header = response.headers.get("Access-Control-Allow-Origin", "")
        
        if cors_header == "*" or "localhost" in cors_header:
            print(f"   ✅ CORS is configured correctly!")
            print(f"   🌐 Allow-Origin: {cors_header}")
            return True
        else:
            print(f"   ⚠️  CORS might not be configured properly")
            print(f"   🌐 Allow-Origin: {cors_header}")
            return False
            
    except Exception as e:
        print(f"   ⚠️  Could not test CORS: {e}")
        return False


def main():
    """Main test runner."""
    # Get backend URL from command line or use default
    if len(sys.argv) > 1:
        backend_url = sys.argv[1]
    else:
        backend_url = "http://localhost:8000"
    
    print("=" * 60)
    print("🧪 EyeMate Backend Connectivity Test")
    print("=" * 60)
    print(f"Backend URL: {backend_url}")
    print("=" * 60)
    
    # Run tests
    health_ok = test_backend_health(backend_url)
    info_ok = test_backend_info(backend_url)
    cors_ok = test_cors(backend_url)
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary")
    print("=" * 60)
    print(f"   Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"   API Info:     {'✅ PASS' if info_ok else '❌ FAIL'}")
    print(f"   CORS:         {'✅ PASS' if cors_ok else '⚠️  WARNING'}")
    print("=" * 60)
    
    if health_ok and info_ok:
        print("\n🎉 Backend is accessible and ready for mobile app connection!")
        print("\n📱 Next steps:")
        print("   1. Update your mobile app's .env file:")
        print(f"      EXPO_PUBLIC_BACKEND_URL={backend_url}")
        print("   2. Restart your Expo dev server")
        print("   3. Test image analysis from the mobile app")
    else:
        print("\n❌ Backend has connectivity issues. Please check:")
        print("   1. Is the backend running? (python main.py)")
        print("   2. Is the URL correct?")
        print("   3. Are there firewall rules blocking the connection?")
        print("   4. Check backend logs for errors")
    
    print("\n")
    
    # Exit with appropriate code
    sys.exit(0 if (health_ok and info_ok) else 1)


if __name__ == "__main__":
    main()
