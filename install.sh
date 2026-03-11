#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# OpenClaw Brain Hub — curl installer
# Usage: curl -fsSL https://raw.githubusercontent.com/GuanqunHuang/agent-brain-hub/main/install.sh | bash
# ─────────────────────────────────────────────

REPO_URL="https://github.com/GuanqunHuang/agent-brain-hub"
INSTALL_DIR="$HOME/.brain-hub"
SYMLINK_PATH="/usr/local/bin/brain"

echo "=============================="
echo "  OpenClaw Brain Hub Installer"
echo "=============================="
echo

# ── Detect OS ──
OS="$(uname -s)"
case "$OS" in
  Darwin) OS_NAME="macOS" ;;
  Linux)  OS_NAME="Linux" ;;
  *)
    echo "❌ Unsupported OS: $OS"
    echo "   Only macOS and Linux are supported."
    exit 1
    ;;
esac

# ── Detect Architecture ──
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH_NAME="x64" ;;
  aarch64) ARCH_NAME="arm64" ;;
  arm64)   ARCH_NAME="arm64" ;;
  *)
    echo "❌ Unsupported architecture: $ARCH"
    echo "   Only x64 and arm64 are supported."
    exit 1
    ;;
esac

echo "Detected: $OS_NAME ($ARCH_NAME)"

# ── Check Node.js ──
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Please install Node.js >= 18: https://nodejs.org/"
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js version is too old: $(node -v)"
  echo "   Please upgrade to Node.js >= 18: https://nodejs.org/"
  exit 1
fi

echo "Node.js $(node -v) ✓"

# ── Check npm ──
if ! command -v npm &> /dev/null; then
  echo "❌ npm is not installed."
  exit 1
fi

echo "npm $(npm -v) ✓"
echo

# ── Clone or update repo ──
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation at $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "Cloning repository to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo

# ── Install dependencies ──
echo "Installing dependencies..."
npm install
echo

# ── Build (if TypeScript) ──
if [ -f "tsconfig.json" ]; then
  echo "Building project..."
  npm run build
  echo
fi

# ── Create symlink ──
echo "Creating symlink at $SYMLINK_PATH..."

CLI_ENTRY="$INSTALL_DIR/dist/cli/index.js"
if [ ! -f "$CLI_ENTRY" ]; then
  echo "⚠️  Built CLI entry not found at $CLI_ENTRY"
  echo "   Falling back to tsx runner..."
  # Create a wrapper script instead
  WRAPPER="$INSTALL_DIR/bin/brain"
  mkdir -p "$INSTALL_DIR/bin"
  cat > "$WRAPPER" << 'WRAPPER_EOF'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec npx tsx "$DIR/cli/index.ts" "$@"
WRAPPER_EOF
  chmod +x "$WRAPPER"
  CLI_ENTRY="$WRAPPER"
fi

if [ -L "$SYMLINK_PATH" ] || [ -e "$SYMLINK_PATH" ]; then
  echo "Removing existing $SYMLINK_PATH..."
  sudo rm -f "$SYMLINK_PATH"
fi

sudo ln -s "$CLI_ENTRY" "$SYMLINK_PATH"
echo

# ── Done ──
echo "=============================="
echo "  Installation complete!"
echo "=============================="
echo
echo "Usage:"
echo "  brain list                  # List public brains"
echo "  brain push -n MyBrain -a me # Push a brain to the hub"
echo "  brain pull <brain-id>       # Pull a brain from the hub"
echo "  brain diff <a> <b>          # Compare two brains"
echo "  brain merge <brain-ref>     # Merge a brain with yours"
echo "  brain launch <brain-ref>    # Launch an instance"
echo
echo "Server (optional):"
echo "  cd $INSTALL_DIR && npm run server"
echo
echo "Set a custom server URL:"
echo "  export BRAIN_HUB_URL=https://your-server.example.com"
echo
