#!/usr/bin/env bash
set -euo pipefail

VERSION="${FITCODING_VERSION:-latest}"
INSTALL_DIR="${HOME}/.fitcoding/bin"

# Set by detect_target.
TARGET=""
EXT=""
ARCHIVE=""
BIN=""

detect_target() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "${os}-${arch}" in
    Darwin-arm64)
      TARGET="aarch64-apple-darwin"; EXT=""; ARCHIVE="tar.gz" ;;
    Darwin-x86_64)
      TARGET="x86_64-apple-darwin"; EXT=""; ARCHIVE="tar.gz" ;;
    Linux-x86_64)
      TARGET="x86_64-unknown-linux-gnu"; EXT=""; ARCHIVE="tar.gz" ;;
    MINGW64_NT*-x86_64|MSYS_NT*-x86_64|CYGWIN_NT*-x86_64)
      TARGET="x86_64-pc-windows-msvc"; EXT=".exe"; ARCHIVE="zip" ;;
    *)
      echo "fitcoding: unsupported platform ${os}/${arch}" >&2
      exit 1
      ;;
  esac
  BIN="${INSTALL_DIR}/fitcoding${EXT}"
}

extract_archive() {
  local archive_path="$1" tmpdir="$2"
  case "${ARCHIVE}" in
    tar.gz)
      tar -xzf "${archive_path}" -C "${tmpdir}"
      ;;
    zip)
      if command -v unzip >/dev/null 2>&1; then
        unzip -q -o "${archive_path}" -d "${tmpdir}"
      elif command -v 7z >/dev/null 2>&1; then
        7z x -o"${tmpdir}" -y "${archive_path}" >/dev/null
      else
        echo "fitcoding: need 'unzip' or '7z' to extract Windows archive (Git Bash provides 'unzip')" >&2
        exit 1
      fi
      ;;
  esac
}

ensure_binary() {
  detect_target
  if [ -x "${BIN}" ]; then
    return
  fi
  local url
  if [ "${VERSION}" = "latest" ]; then
    url="https://github.com/AndrewWayne/FitCoding/releases/latest/download/fitcoding-${TARGET}.${ARCHIVE}"
  else
    url="https://github.com/AndrewWayne/FitCoding/releases/download/${VERSION}/fitcoding-${TARGET}.${ARCHIVE}"
  fi
  echo "Downloading FitCoding binary for ${TARGET}..." >&2
  mkdir -p "${INSTALL_DIR}"
  local tmp tmpdir
  tmp="$(mktemp -t fitcoding-XXXXXX.${ARCHIVE})"
  tmpdir="$(mktemp -d -t fitcoding-extract-XXXXXX)"
  trap "rm -rf '${tmp}' '${tmpdir}'" EXIT
  curl -fsSL "${url}" -o "${tmp}"
  extract_archive "${tmp}" "${tmpdir}"
  # Release archives may or may not have a top-level directory; locate the
  # binary by name regardless of nesting.
  local extracted
  extracted="$(find "${tmpdir}" -type f -name "fitcoding${EXT}" | head -n 1)"
  if [ -z "${extracted}" ]; then
    echo "fitcoding: archive at ${url} did not contain fitcoding${EXT}" >&2
    exit 1
  fi
  mv "${extracted}" "${BIN}"
  chmod +x "${BIN}" 2>/dev/null || true
}

dispatch() {
  case "${1:-}" in
    "")
      # /fit -> spawn detached so the slash command returns immediately.
      nohup "${BIN}" launch >/dev/null 2>&1 &
      disown 2>/dev/null || true
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
