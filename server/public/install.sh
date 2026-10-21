#!/usr/bin/env bash
set -e

# ==============================================================
# EVEDIS - One-Line Zero-Setup Installer & Runner
# https://github.com/sringesh/EVEDIS
# ==============================================================

BOLD="\033[1m"
GREEN="\033[38;2;163;255;18m"
CYAN="\033[38;2;85;210;255m"
AMBER="\033[38;2;255;184;0m"
RED="\033[38;2;255;85;85m"
RESET="\033[0m"

echo -e "${GREEN}${BOLD}"
echo " ███████╗██╗   ██╗███████╗██████╗ ██╗███████╗"
echo " ██╔════╝██║   ██║██╔════╝██╔══██╗██║██╔════╝  WIRELESS EXTENDED DISPLAY"
echo " █████╗  ██║   ██║█████╗  ██║  ██║██║███████╗  Open Source • by Sringesh V."
echo " ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║  ██║██║╚════██║  https://github.com/sringesh/EVEDIS"
echo " ███████╗ ╚████╔╝ ███████╗██████╔╝██║███████║"
echo " ╚══════╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝╚══════╝"
echo -e "${RESET}"

echo -e "${CYAN}⚡ Setting up EVEDIS on your machine...${RESET}\n"

# 1. Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${AMBER}⚠️  Node.js was not detected on your machine.${RESET}"
  if [[ "$OSTYPE" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
    echo -e "${CYAN}📦 Installing Node.js via Homebrew...${RESET}"
    brew install node
  else
    echo -e "${RED}❌ Please install Node.js (v18+) from https://nodejs.org and run this command again.${RESET}"
    exit 1
  fi
fi

# 2. Check for Git
if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}❌ Git is required. Install Xcode Command Line Tools with: xcode-select --install${RESET}"
  exit 1
fi

# 3. Clone or update repository into ~/evedis
INSTALL_DIR="$HOME/evedis"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${CYAN}🔄 Updating existing EVEDIS installation in $INSTALL_DIR...${RESET}"
  cd "$INSTALL_DIR"
  git pull --quiet
else
  echo -e "${CYAN}📥 Cloning EVEDIS repository into $INSTALL_DIR...${RESET}"
  git clone --quiet https://github.com/sringesh/EVEDIS.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. Install dependencies
echo -e "${CYAN}📦 Installing project dependencies...${RESET}"
npm install --silent
cd server && npm install --silent && cd ..

# 5. Build macOS Virtual Display driver if on Mac
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo -e "${CYAN}⚙️  Building macOS CoreGraphics Virtual Display Driver...${RESET}"
  clang -framework CoreGraphics -framework Foundation macos-virtual-display/evedis_vdisplay.m -o macos-virtual-display/evedis-vdisplay
  chmod +x macos-virtual-display/evedis-vdisplay
fi

chmod +x evedis bin/evedis.js

# 6. Install global command into PATH so 'evedis open' works instantly everywhere
INSTALL_BIN=""
if [ -d "/opt/homebrew/bin" ] && [ -w "/opt/homebrew/bin" ]; then
  INSTALL_BIN="/opt/homebrew/bin"
elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
  INSTALL_BIN="/usr/local/bin"
else
  mkdir -p "$HOME/.local/bin"
  INSTALL_BIN="$HOME/.local/bin"
fi

if [ -n "$INSTALL_BIN" ]; then
  ln -sf "$INSTALL_DIR/evedis" "$INSTALL_BIN/evedis"
  ln -sf "$INSTALL_DIR/evedis" "$INSTALL_BIN/ed" 2>/dev/null || true
  ln -sf "$INSTALL_DIR/evedis" "$INSTALL_BIN/td" 2>/dev/null || true
fi

# 7. Also install persistent shell aliases into ~/.zshrc and ~/.bashrc
add_alias_if_missing() {
  local file="$1"
  if [ -f "$file" ]; then
    if ! grep -q "alias evedis=" "$file"; then
      echo "" >> "$file"
      echo "# EVEDIS Fast Command Shortcuts" >> "$file"
      echo "alias evedis=\"$INSTALL_DIR/evedis\"" >> "$file"
      echo "alias ed=\"$INSTALL_DIR/evedis ed\"" >> "$file"
      echo "alias td=\"$INSTALL_DIR/evedis td\"" >> "$file"
      echo "alias pd=\"$INSTALL_DIR/evedis td\"" >> "$file"
    fi
  elif [ "$file" = "$HOME/.zshrc" ]; then
    echo "# EVEDIS Fast Command Shortcuts" > "$file"
    echo "alias evedis=\"$INSTALL_DIR/evedis\"" >> "$file"
    echo "alias ed=\"$INSTALL_DIR/evedis ed\"" >> "$file"
    echo "alias td=\"$INSTALL_DIR/evedis td\"" >> "$file"
    echo "alias pd=\"$INSTALL_DIR/evedis td\"" >> "$file"
  fi
}

add_alias_if_missing "$HOME/.zshrc"
add_alias_if_missing "$HOME/.bashrc"

echo -e "\n${GREEN}✔ EVEDIS is installed and ready!${RESET}"
echo -e "${CYAN}Tip: From now on, you can type ${BOLD}evedis open${RESET}${CYAN} anywhere in Terminal to launch!${RESET}"
echo -e "${CYAN}Use ${BOLD}evedis clean${RESET}${CYAN} to terminate display and gather windows.${RESET}\n"
echo -e "${GREEN}🚀 Launching EVEDIS Host Server now...${RESET}\n"

# 8. Launch EVEDIS with auto-open browser
exec "$INSTALL_DIR/evedis" --open "$@"
