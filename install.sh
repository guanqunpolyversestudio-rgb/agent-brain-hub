#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# OpenClaw Brain Hub — curl installer
# Usage: curl -fsSL https://raw.githubusercontent.com/guanqunpolyversestudio-rgb/agent-brain-hub/main/install.sh | bash
# ─────────────────────────────────────────────

REPO_URL="https://github.com/guanqunpolyversestudio-rgb/agent-brain-hub"
INSTALL_DIR="$HOME/.openclaw_brain"
LEGACY_INSTALL_DIR="$HOME/.brain-hub"

if [[ ":$PATH:" == *":/opt/homebrew/bin:"* ]]; then
  SYMLINK_PATH="/opt/homebrew/bin/openclaw_brain"
else
  SYMLINK_PATH="/usr/local/bin/openclaw_brain"
fi

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

clone_or_update_repo() {
  local target_dir="$1"

  if [ -d "$target_dir/.git" ]; then
    echo "Updating existing installation at $target_dir..."
    cd "$target_dir"
    git pull --ff-only
  elif [ -d "$target_dir" ]; then
    local backup_dir="${target_dir}.backup.$(date +%Y%m%d%H%M%S)"
    echo "Found non-git directory at $target_dir."
    echo "Moving it to $backup_dir..."
    mv "$target_dir" "$backup_dir"
    echo "Cloning repository to $target_dir..."
    git clone "$REPO_URL" "$target_dir"
    cd "$target_dir"
  else
    echo "Cloning repository to $target_dir..."
    git clone "$REPO_URL" "$target_dir"
    cd "$target_dir"
  fi
}

# ── Clone or update repo ──
if [ ! -d "$INSTALL_DIR" ] && [ -d "$LEGACY_INSTALL_DIR/.git" ]; then
  echo "Migrating existing installation from $LEGACY_INSTALL_DIR to $INSTALL_DIR..."
  mv "$LEGACY_INSTALL_DIR" "$INSTALL_DIR"
fi

clone_or_update_repo "$INSTALL_DIR"

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
  WRAPPER="$INSTALL_DIR/bin/openclaw_brain"
  mkdir -p "$INSTALL_DIR/bin"
  cat > "$WRAPPER" << 'WRAPPER_EOF'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec npx tsx "$DIR/cli/index.ts" "$@"
WRAPPER_EOF
  chmod +x "$WRAPPER"
  CLI_ENTRY="$WRAPPER"
fi

chmod +x "$CLI_ENTRY"

if [ -L "$SYMLINK_PATH" ] || [ -e "$SYMLINK_PATH" ]; then
  echo "Removing existing $SYMLINK_PATH..."
  if [ -w "$(dirname "$SYMLINK_PATH")" ]; then
    rm -f "$SYMLINK_PATH"
  else
    sudo rm -f "$SYMLINK_PATH"
  fi
fi

if [ -w "$(dirname "$SYMLINK_PATH")" ]; then
  ln -s "$CLI_ENTRY" "$SYMLINK_PATH"
else
  sudo ln -s "$CLI_ENTRY" "$SYMLINK_PATH"
fi
echo

# ── Done ──
echo "=============================="
echo "  Installation complete!"
echo "=============================="
echo
echo "Usage:"
echo "  openclaw_brain list                  # List public brains"
echo "  openclaw_brain push -n MyBrain -a me # Push a brain to the hub"
echo "  openclaw_brain pull <brain-id>       # Pull a brain from the hub"
echo "  openclaw_brain diff <a> <b>          # Compare two brains"
echo "  openclaw_brain merge <brain-ref>     # Merge a brain with yours"
echo "  openclaw_brain launch <brain-ref>    # Launch an instance"
echo
echo "Server (optional):"
echo "  Default server: https://openclaw-brain-hub.fly.dev"
echo "  Self-host: cd $INSTALL_DIR && npm run server"
echo
echo "Set a custom or local server URL:"
echo "  export BRAIN_HUB_URL=https://your-server.example.com"
echo "  export BRAIN_HUB_URL=http://localhost:3000"
echo
