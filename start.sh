#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

# 1. Verify Node.js installation
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed."
  echo "👉 Please install Node.js from https://nodejs.org or via 'brew install node'"
  exit 1
fi

# 2. Check and install dependencies
if [ ! -d "server/node_modules" ] || [ ! -d "node_modules" ]; then
  echo "📦 Installing EVEDIS dependencies..."
  npm install
  cd server && npm install && cd ..
fi

# 3. macOS Virtual Display driver check & build
if [ "$(uname -s)" = "Darwin" ]; then
  if [ ! -f "macos-virtual-display/evedis-vdisplay" ]; then
    echo "⚙️ Compiling macOS Virtual Display Driver..."
    clang -framework CoreGraphics -framework Foundation macos-virtual-display/evedis_vdisplay.m -o macos-virtual-display/evedis-vdisplay
    chmod +x macos-virtual-display/evedis-vdisplay
  fi
fi

# 4. Start the EVEDIS Host Server with Auto-Display & Retro LCD Terminal
exec node server/index.js "$@"
