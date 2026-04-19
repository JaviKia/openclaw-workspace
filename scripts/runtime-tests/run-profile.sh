#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <profile-env-file> <sample-file>" >&2
  exit 1
fi

PROFILE_FILE="$1"
SAMPLE_FILE="$2"

cd /data/.openclaw/workspace

PROFILE_FILE="$(python3 - <<'PY' "$PROFILE_FILE"
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"
SAMPLE_FILE="$(python3 - <<'PY' "$SAMPLE_FILE"
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"

if [ ! -f "$PROFILE_FILE" ]; then
  echo "missing profile file: $PROFILE_FILE" >&2
  exit 1
fi

if [ ! -f "$SAMPLE_FILE" ]; then
  echo "missing sample file: $SAMPLE_FILE" >&2
  exit 1
fi

PRESET_OPENCLAW_RUNTIME_SESSION_KEY="${OPENCLAW_RUNTIME_SESSION_KEY-}"

set -a
# shellcheck disable=SC1090
. "$PROFILE_FILE"
set +a

if [ -n "$PRESET_OPENCLAW_RUNTIME_SESSION_KEY" ]; then
  export OPENCLAW_RUNTIME_SESSION_KEY="$PRESET_OPENCLAW_RUNTIME_SESSION_KEY"
fi

OPENCLAW_RUNTIME_AUDIO_INPUT_FILE="$SAMPLE_FILE" npm run start:headless
