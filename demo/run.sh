#!/usr/bin/env bash
# One-command way to start the real ZeroClaw daemon for the Carapace demo.
# Reads secrets from .secrets/demo-credentials.env (never committed) and
# points the agent at the already-deployed devnet program + policy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZEROCLAW_BIN="$REPO_ROOT/.zeroclaw-src/zeroclaw-master/target/release/zeroclaw"
CONFIG_DIR="$REPO_ROOT/demo/.zeroclaw-config"
SECRETS_FILE="$REPO_ROOT/.secrets/demo-credentials.env"

if [ ! -x "$ZEROCLAW_BIN" ]; then
  echo "ZeroClaw binary not found at $ZEROCLAW_BIN"
  echo "Build it first: see docs/SETUP.md"
  exit 1
fi

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Missing $SECRETS_FILE — create it with:"
  echo "  DISCORD_BOT_TOKEN=..."
  echo "  TELEGRAM_BOT_TOKEN=... (from @BotFather, optional)"
  echo "  OPENAI_API_KEY=..."
  echo "  CARAPACE_DELEGATE_SECRET_KEY=... (from manual/init-devnet-policy.js or manual/rotate-delegate.js)"
  exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS_FILE"

export ZEROCLAW_providers__models__openai__default__api_key="$OPENAI_API_KEY"
export ZEROCLAW_channels__discord__default__bot_token="$DISCORD_BOT_TOKEN"
export ZEROCLAW_channels__telegram__default__bot_token="$TELEGRAM_BOT_TOKEN"
export ZEROCLAW_plugins__entries__carapace_propose_intent__config__delegate_secret_key="$CARAPACE_DELEGATE_SECRET_KEY"
export ZEROCLAW_plugins__entries__carapace_execute_transfer__config__delegate_secret_key="$CARAPACE_DELEGATE_SECRET_KEY"

echo "Starting ZeroClaw daemon (Ctrl+C to stop)..."
exec "$ZEROCLAW_BIN" --config-dir "$CONFIG_DIR" daemon -v
