#!/usr/bin/env bash
# Prepare a checkout or worktree: make sure Node matches .nvmrc, then install dependencies.
# Node is kept in ~/.local/share/aisf-node/<major> so every worktree shares one copy.
# Usage: scripts/setup.sh                    install deps
#        eval "$(scripts/setup.sh --env)"    put the right Node on PATH in this shell
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
major="$(tr -d '[:space:]v' < "$root/.nvmrc")"
home="${AISF_NODE_HOME:-$HOME/.local/share/aisf-node}/$major"

if [ ! -x "$home/bin/node" ]; then
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
  esac
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  base="https://nodejs.org/dist/latest-v$major.x"
  file="$(curl -fsSL "$base/SHASUMS256.txt" | awk -v s="-$os-$arch.tar.xz" 'index($2, s) { print $2 }')"
  echo "Installing Node $major ($file) into $home" >&2
  mkdir -p "$home"
  curl -fsSL "$base/$file" | tar -xJ -C "$home" --strip-components=1
fi

if [ "${1:-}" = "--env" ]; then
  echo "export PATH=\"$home/bin:\$PATH\""
  exit 0
fi

export PATH="$home/bin:$PATH"
cd "$root"
npm ci
