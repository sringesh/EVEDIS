#!/bin/bash
set -e

echo "=========================================================="
echo "    🚀 INSTALLING EVEDIS // EXTENDED VIRTUAL DISPLAY      "
echo "        Created by Sringesh V. (reachsringesh@gmail.com)  "
echo "=========================================================="

TARGET_DIR="$HOME/evedis"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is required to run EVEDIS."
  echo "👉 Please install Node.js from https://nodejs.org or run 'brew install node'"
  exit 1
fi

# Check Git
if ! command -v git >/dev/null 2>&1; then
  echo "❌ Error: Git is required."
  echo "👉 Please install git or Xcode command line tools ('xcode-select --install')"
  exit 1
fi

# Clone or update
if [ -d "$TARGET_DIR" ]; then
  echo "📂 Updating existing EVEDIS installation at $TARGET_DIR..."
  cd "$TARGET_DIR"
  git pull origin main || true
else
  echo "📥 Cloning EVEDIS to $TARGET_DIR..."
  git clone https://github.com/sringesh/EVEDIS.git "$TARGET_DIR"
  cd "$TARGET_DIR"
fi

echo "📦 Installing dependencies..."
npm install
cd server && npm install && cd ..

chmod +x start.sh start.command 2>/dev/null || true

echo "✨ Installation complete!"
echo "🚀 Launching EVEDIS Host..."
./start.sh
