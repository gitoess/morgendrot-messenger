#!/usr/bin/env bash
# Erzeugt schlanke Deploy-Ordner auf dem Desktop (oder $1 = Zielverzeichnis).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HOME/Desktop}"
mkdir -p "$OUT"

copy_core() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$dest"
  for f in package.json package-lock.json tsconfig.json; do
    cp "$REPO_ROOT/$f" "$dest/"
  done
  cp -r "$REPO_ROOT/src" "$dest/"
  [[ -f "$REPO_ROOT/.env.example" ]] && cp "$REPO_ROOT/.env.example" "$dest/"
  cp "$REPO_ROOT/deploy/README-DEPLOY-BUNDLES.md" "$dest/"
}

HEADLESS="$OUT/Morgendrot-Raspi-headless"
LITE="$OUT/Morgendrot-Raspi-lite-ui"
ESP="$OUT/Morgendrot-ESP32-Tiny"

copy_core "$HEADLESS"
cp "$REPO_ROOT/deploy/README-DEPLOY-BUNDLES.md" "$HEADLESS/"

copy_core "$LITE"
cp -r "$REPO_ROOT/ui" "$LITE/"
cp -r "$REPO_ROOT/profiles" "$LITE/"

rm -rf "$ESP"
mkdir -p "$ESP"
cp "$REPO_ROOT/deploy/esp32-tiny-README.md" "$ESP/README.md"
cp "$REPO_ROOT/deploy/README-DEPLOY-BUNDLES.md" "$ESP/README-DEPLOY-BUNDLES-Auszug.md"
printf '%s\n' "ESP32: nur README.md – kein Node-Code auf dem Chip. Raspi-Paket nutzen." > "$ESP/WICHTIG.txt"

echo "Fertig: $HEADLESS , $LITE , $ESP"
