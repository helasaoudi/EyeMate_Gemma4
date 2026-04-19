#!/usr/bin/env bash
# Fix transformers installation for Gemma 4 support

set -e

echo "🔧 Fixing transformers installation for Gemma 4 support..."
echo ""

# Activate venv
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$PROJECT_ROOT/.venv"

if [[ -d "$VENV_PATH" ]]; then
    source "$VENV_PATH/bin/activate"
    echo "✓ Virtual environment activated"
else
    echo "❌ Virtual environment not found at $VENV_PATH"
    echo "Creating it now..."
    python3 -m venv "$VENV_PATH"
    source "$VENV_PATH/bin/activate"
fi

echo ""
echo "📦 Installing/upgrading transformers..."
pip install --upgrade pip setuptools wheel

# Force reinstall transformers with all extras
pip install --upgrade --force-reinstall 'transformers>=4.51.0'

# Install vision dependencies
pip install --upgrade torch torchvision pillow

echo ""
echo "✅ Installation complete!"
echo ""
echo "🔍 Verifying installation..."
python3 check_env.py
