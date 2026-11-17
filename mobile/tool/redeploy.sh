#!/usr/bin/env bash
# Dev helper (Git Bash on Windows): build the debug APK, install it on the running emulator and launch it.
# Uses a short temp folder (Java's local sockets fail on very long temp paths). The SDK location comes
# from `flutter config --android-sdk`, set once to the SDK's 8.3 short path (see README).
set -e
mkdir -p /c/gtmp
export TMP='C:\gtmp' TEMP='C:\gtmp' TMPDIR='C:\gtmp'
export GRADLE_OPTS="-Djava.io.tmpdir=C:\\gtmp -Djdk.net.unixdomain.tmpdir=C:\\gtmp"
ADB="$(cygpath "${LOCALAPPDATA}")/Android/Sdk/platform-tools/adb.exe"
cd "$(dirname "$0")/.."
flutter build apk --debug > /c/gtmp/build.log 2>&1 || { grep -v '^\s*$' /c/gtmp/build.log | tail -30; exit 1; }
"$ADB" install -r build/app/outputs/flutter-apk/app-debug.apk | tail -1
"$ADB" shell am start -S -n com.openskyfoodpark.open_sky/.MainActivity > /dev/null
