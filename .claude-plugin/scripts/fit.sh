#!/usr/bin/env bash
set -euo pipefail

VERSION="${FITCODING_VERSION:-latest}"
INSTALL_DIR="${HOME}/.fitcoding/bin"
BIN="${INSTALL_DIR}/fitcoding"

detect_target() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "${os}-${arch}" in
    Darwin-arm64)        echo "aarch64-apple-darwin" ;;
    Darwin-x86_64)       echo "x86_64-apple-darwin" ;;
    Linux-x86_64)        echo "x86_64-unknown-linux-gnu" ;;
    *)
      echo "fitcoding: unsupported platform ${os}/${arch}" >&2
      exit 1
      ;;
  esac
}

ensure_binary() {
  if [ -x "${BIN}" ]; then
    return
  fi
  local target url
  target="$(detect_target)"
  if [ "${VERSION}" = "latest" ]; then
    url="https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-${target}.tar.gz"
  else
    url="https://github.com/AndrewWayne/FitCoding/releases/download/${VERSION}/fitcoding-${target}.tar.gz"
  fi
  echo "Downloading FitCoding binary for ${target}..." >&2
  mkdir -p "${INSTALL_DIR}"
  local tmp
  tmp="$(mktemp -t fitcoding-XXXXXX.tar.gz)"
  curl -fsSL "${url}" -o "${tmp}"
  tar -xzf "${tmp}" -C "${INSTALL_DIR}"
  rm -f "${tmp}"
  chmod +x "${BIN}"
}

dispatch() {
  case "${1:-}" in
    "")
      # /fit → spawn detached so the slash command returns immediately.
      nohup "${BIN}" launch >/dev/null 2>&1 &
      disown || true
      echo "FitCoding window launching..."
      ;;
    "board")
      exec "${BIN}" board
      ;;
    *)
      echo "Usage: /fit          (start a 30s exercise)" >&2
      echo "       /fit board    (print today's scoreboard)" >&2
      exit 1
      ;;
  esac
}

ensure_binary
dispatch "$@"
