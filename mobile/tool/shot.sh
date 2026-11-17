#!/usr/bin/env bash
# Dev helper (Git Bash on Windows): screenshot the running emulator to $1 (PNG) and a 40% copy next to it.
# Usage: bash tool/shot.sh <out.png>
set -e
SDK="$(cygpath "${LOCALAPPDATA}")/Android/Sdk"
ADB="$SDK/platform-tools/adb.exe"
"$ADB" exec-out screencap -p > "$1"
python -c "
import sys
from PIL import Image
im = Image.open(sys.argv[1]); im.resize((im.width*2//5, im.height*2//5)).save(sys.argv[1].replace('.png', '-s.png'))
" "$1"
