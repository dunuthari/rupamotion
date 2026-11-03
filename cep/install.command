#!/bin/bash
# Ru Motion (CEP) installer for macOS: copies the panel and allows unsigned extensions.
DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/RuMotion"
echo "Installing Ru Motion to $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$DIR/RuMotion/." "$DEST/"
for v in 9 10 11 12 13; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo
echo "Done. Restart After Effects, then open Window > Extensions > Ru Motion."
