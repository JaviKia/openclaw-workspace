#!/usr/bin/env bash
set -euo pipefail
cd /data/.openclaw/workspace
OPENCLAW_RUNTIME_TEST_INTERRUPT=1 npm run start:headless
