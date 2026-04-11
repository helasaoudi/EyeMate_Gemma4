#!/usr/bin/env bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$PROJECT_ROOT/.venv"

if [[ ! -d "$VENV_PATH" ]]; then
  echo "Virtual environment not found at $VENV_PATH" >&2
  echo "Create it first: python3 -m venv \"$VENV_PATH\"" >&2
  exit 1
fi

source "$VENV_PATH/bin/activate"

export HOST="0.0.0.0"
export PORT="8000"

python "$PROJECT_ROOT/main.py"
