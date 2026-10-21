#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

echo "=========================================================="
echo "      📺 EVEDIS // WIRELESS EXTENDED DISPLAY SYSTEM       "
echo "        Created by Sringesh V. (reachsringesh@gmail.com)  "
echo "=========================================================="

# 1. Verify Node.js installation
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed."
  echo "👉 Please install Node.js from https://nodejs.org or via 'brew install node'"
  exit 1
fi

echo "🟢 Node.js detected: $(node --version)"

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

# 4. Auto-open browser in background
(
  sleep 1.2
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:4040/host"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:4040/host"
  fi
) &

# 5. Start the EVEDIS Host Server
echo "🚀 Starting EVEDIS Host Controller on http://localhost:4040..."
echo "💡 Press Ctrl+C at any time to stop the server."
echo ""
node server/index.js
