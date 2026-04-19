#!/usr/bin/env python3
"""Quick diagnostic to check transformers installation"""

import sys

print("=" * 60)
print("Environment Check")
print("=" * 60)

# Check Python version
print(f"\n✓ Python: {sys.version}")

# Check transformers
try:
    import transformers
    print(f"✓ transformers: {transformers.__version__}")
    
    # Check for required classes (API changed in 5.x)
    try:
        from transformers import AutoModelForImageTextToText
        print("✓ AutoModelForImageTextToText: Available (transformers 5.x)")
    except ImportError:
        try:
            from transformers import AutoModelForVision2Seq
            print("✓ AutoModelForVision2Seq: Available (transformers 4.x)")
        except ImportError as e:
            print(f"✗ Vision model class: NOT FOUND - {e}")
    
    try:
        from transformers import AutoProcessor
        print("✓ AutoProcessor: Available")
    except ImportError as e:
        print(f"✗ AutoProcessor: NOT FOUND - {e}")
        
except ImportError:
    print("✗ transformers: NOT INSTALLED")

# Check torch
try:
    import torch
    print(f"✓ torch: {torch.__version__}")
    print(f"  CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"  CUDA version: {torch.version.cuda}")
        print(f"  GPU count: {torch.cuda.device_count()}")
except ImportError:
    print("✗ torch: NOT INSTALLED")

# Check other deps
for pkg in ["pillow", "numpy", "fastapi", "uvicorn"]:
    try:
        mod = __import__(pkg.replace("-", "_"))
        version = getattr(mod, "__version__", "unknown")
        print(f"✓ {pkg}: {version}")
    except ImportError:
        print(f"✗ {pkg}: NOT INSTALLED")

print("\n" + "=" * 60)
print("DIAGNOSIS:")
print("=" * 60)

try:
    import transformers
    from packaging import version
    if version.parse(transformers.__version__) < version.parse("4.51.0"):
        print("⚠️  transformers is TOO OLD (need >= 4.51.0)")
        print("   Fix: pip install --upgrade 'transformers>=4.51.0'")
    else:
        # Check for vision classes (API changed in 5.x)
        has_vision = False
        try:
            from transformers import AutoModelForImageTextToText
            has_vision = True
            print("✅ Everything looks good! (transformers 5.x)")
        except ImportError:
            try:
                from transformers import AutoModelForVision2Seq
                has_vision = True
                print("✅ Everything looks good! (transformers 4.x)")
            except ImportError:
                pass
        
        if not has_vision:
            print("⚠️  transformers installed but missing vision classes")
            print("   Fix: pip install --upgrade --force-reinstall transformers")
except ImportError:
    print("⚠️  transformers NOT installed")
    print("   Fix: pip install 'transformers>=4.51.0'")
