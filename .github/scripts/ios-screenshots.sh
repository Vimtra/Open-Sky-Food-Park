#!/usr/bin/env bash
# Boots iOS Simulators on the CI Mac, installs the Simulator build of Open Sky, launches it
# and saves screenshots. Run from mobile/ after `flutter build ios --simulator`.
#   bash ../.github/scripts/ios-screenshots.sh <output dir>
# Owner: Claude A (see COLLAB.md).
set -euo pipefail

OUT="${1:-dist/screenshots}"
APP="build/ios/iphonesimulator/Runner.app"
BUNDLE_ID="com.openskyfoodpark.openSky"
mkdir -p "$OUT"

# Newest available simulator whose name matches the pattern (e.g. the latest "iPhone .. Pro Max").
pick_device() {
  xcrun simctl list devices available -j | python3 -c '
import json, re, sys
pattern = re.compile(sys.argv[1])
best = None
for runtime, devices in json.load(sys.stdin)["devices"].items():
    if "iOS" not in runtime:
        continue
    version = tuple(int(x) for x in re.findall(r"\d+", runtime.split("iOS")[-1]))
    for d in devices:
        if pattern.search(d["name"]):
            key = (version, d["name"])
            if best is None or key > best[0]:
                best = (key, d["udid"], d["name"])
if best:
    print(best[1], best[2], sep="\t")
' "$1"
}

shoot() {
  local label="$1" pattern="$2" found udid name
  found="$(pick_device "$pattern")"
  if [ -z "$found" ]; then
    echo "No simulator matches '$pattern', skipping $label"
    return 0
  fi
  udid="${found%%$'\t'*}"
  name="${found#*$'\t'}"
  echo "== $label on $name ($udid)"

  xcrun simctl boot "$udid" || true
  xcrun simctl bootstatus "$udid" -b
  # Clean, App-Store-style status bar.
  xcrun simctl status_bar "$udid" override --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularMode active --cellularBars 4 --wifiBars 3 || true
  xcrun simctl install "$udid" "$APP"

  xcrun simctl launch "$udid" "$BUNDLE_ID"
  sleep 2
  xcrun simctl io "$udid" screenshot "$OUT/${label}-1-launch.png"
  # Debug builds start slower on the Simulator; give the home screen and its photos time to load.
  sleep 28
  xcrun simctl io "$udid" screenshot "$OUT/${label}-2-home.png"

  xcrun simctl terminate "$udid" "$BUNDLE_ID" || true
  xcrun simctl shutdown "$udid" || true
}

shoot "iphone" 'iPhone [0-9]+ Pro Max$'
shoot "iphone-small" 'iPhone [0-9]+$'
shoot "ipad" 'iPad Pro .*13'

ls -l "$OUT"
