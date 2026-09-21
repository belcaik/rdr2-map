#!/usr/bin/env bash
set -euo pipefail
extractor_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$extractor_dir/.."
if [[ -x .venv/bin/python ]]; then
  exec .venv/bin/python -m rdr2_extractor.pipeline "$@"
elif [[ -x "$extractor_dir/venv/bin/python" ]]; then
  exec "$extractor_dir/venv/bin/python" -m rdr2_extractor.pipeline "$@"
else
  exec python3 -m rdr2_extractor.pipeline "$@"
fi
