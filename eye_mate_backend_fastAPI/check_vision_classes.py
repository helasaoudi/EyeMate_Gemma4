#!/usr/bin/env python3
"""Check what vision classes are available in transformers"""

import transformers
print(f"transformers version: {transformers.__version__}")
print("\nSearching for vision-related classes...\n")

# Check all classes
vision_classes = []
for name in dir(transformers):
    if 'vision' in name.lower() or 'image' in name.lower() or 'Vision2Seq' in name:
        vision_classes.append(name)

if vision_classes:
    print("Vision-related classes found:")
    for cls in sorted(vision_classes):
        print(f"  - {cls}")
else:
    print("No vision classes found with 'vision' or 'image' in name")

# Check Auto classes specifically
print("\nChecking Auto classes for multimodal/vision:")
auto_classes = [name for name in dir(transformers) if name.startswith('Auto')]
for cls in sorted(auto_classes):
    if any(keyword in cls for keyword in ['Vision', 'Image', 'Multimodal', 'VLM']):
        print(f"  ✓ {cls}")

# Try specific imports
print("\nTrying specific imports:")
attempts = [
    "AutoModelForVision2Seq",
    "AutoModelForImageTextToText", 
    "Gemma2ForConditionalGeneration",
    "GemmaForCausalLM",
    "PaliGemmaForConditionalGeneration",
    "AutoModel",
]

for attempt in attempts:
    try:
        obj = getattr(transformers, attempt, None)
        if obj:
            print(f"  ✓ {attempt}: Available")
        else:
            print(f"  ✗ {attempt}: Not found in module")
    except Exception as e:
        print(f"  ✗ {attempt}: {e}")

# Check if we can load the model config
print("\nChecking model config for google/gemma-4-E4B-it:")
try:
    from transformers import AutoConfig
    config = AutoConfig.from_pretrained("google/gemma-4-E4B-it", trust_remote_code=True)
    print(f"  ✓ Config loaded: {type(config).__name__}")
    print(f"  Architecture: {config.architectures if hasattr(config, 'architectures') else 'unknown'}")
except Exception as e:
    print(f"  ✗ Failed: {e}")
