#!/usr/bin/env bash
# resume-doctor startup script
# Starts the FastAPI PDF extraction backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo ""
echo "  ⚕  Resume Doctor — Backend Launcher"
echo "  ─────────────────────────────────────"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "  ✗ python3 not found. Install it first."
  exit 1
fi

# Check / create venv
VENV="$BACKEND_DIR/.venv"
if [ ! -d "$VENV" ]; then
  echo "  → Creating virtualenv..."
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

# Install deps
echo "  → Installing dependencies..."
pip install -q -r "$BACKEND_DIR/requirements.txt"

echo ""
echo "  ✓ Backend starting on http://localhost:8765"
echo "  ✓ Load the frontend resume-doctor.jsx in claude.ai artifacts"
echo "  ✓ Make sure Ollama is running: ollama serve"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# Launch
cd "$BACKEND_DIR"
uvicorn server:app --host 0.0.0.0 --port 8765 --reload