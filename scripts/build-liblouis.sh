#!/usr/bin/env bash
# Compiles a current liblouis release to WebAssembly and puts it in vendor/liblouis/.
# When that folder exists the app uses it instead of the old (3.2, 2017) liblouis-build
# npm package, which gives much better Grade 2 (contracted) braille.
#
# Needs Emscripten (emcc on PATH) or a running Docker. Commit vendor/liblouis/ afterwards so
# GitHub Actions deploys the same version.
#
# Usage: scripts/build-liblouis.sh [liblouis-version]    (default below)
set -euo pipefail

VERSION="${1:-3.39.0}"
EMSDK_IMAGE="emscripten/emsdk:6.0.13"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v emcc >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "emcc not found, building inside Docker ($EMSDK_IMAGE)"
    exec docker run --rm -v "$ROOT":/src -w /src -u "$(id -u):$(id -g)" "$EMSDK_IMAGE" \
      bash scripts/build-liblouis.sh "$VERSION"
  fi
  echo "Needs Emscripten (emcc) or a running Docker: https://emscripten.org/docs/getting_started/" >&2
  exit 1
fi

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1"
  else
    python3 -c 'import sys, urllib.request; sys.stdout.buffer.write(urllib.request.urlopen(sys.argv[1]).read())' "$1"
  fi
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
echo "Downloading liblouis $VERSION"
download "https://github.com/liblouis/liblouis/releases/download/v$VERSION/liblouis-$VERSION.tar.gz" | tar xz -C "$WORK"
SRC="$WORK/liblouis-$VERSION"

echo "Compiling"
(
  cd "$SRC"
  # --host marks this as a cross-compile, so configure doesn't add macOS-only flags when run
  # on a Mac. 16-bit characters (the default) are what src/lib/louis.worker.ts expects.
  emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared --enable-static \
    --without-yaml --disable-dependency-tracking >/dev/null
  emmake make -C gnulib >/dev/null
  emmake make -C liblouis >/dev/null
)

OUT="$ROOT/vendor/liblouis"
rm -rf "$OUT"
mkdir -p "$OUT/tables"

# One JS file with the WebAssembly embedded; defines createLiblouis() for the worker.
# liblouis keeps large buffers on the stack while compiling nested tables, so it needs far
# more than Emscripten's default 64 KB stack.
emcc -O2 "$SRC/liblouis/.libs/liblouis.a" "$SRC/gnulib/.libs/libgnu.a" -o "$OUT/liblouis.js" \
  -sMODULARIZE -sEXPORT_NAME=createLiblouis -sSINGLE_FILE \
  -sENVIRONMENT=worker,node -sALLOW_MEMORY_GROWTH -sFORCE_FILESYSTEM -sSTACK_SIZE=8MB \
  -sEXPORTED_FUNCTIONS=_lou_translateString,_lou_version,_lou_free,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,FS,stringToUTF16,setValue,getValue,HEAPU16

# All braille tables (not the hyphenation dictionaries). The app build copies only the ones
# listed in src/lib/braille-codes.json, plus what they include.
find "$SRC/tables" -maxdepth 1 -type f \( -name '*.ctb' -o -name '*.cti' -o -name '*.utb' -o -name '*.uti' \
  -o -name '*.dis' -o -name '*.tbl' \) -exec cp {} "$OUT/tables/" \;
cp "$SRC/COPYING.LESSER" "$OUT/LICENSE"
echo "$VERSION" > "$OUT/VERSION"

echo "Done: liblouis $VERSION in vendor/liblouis/ ($(du -sh "$OUT" | cut -f1))"
