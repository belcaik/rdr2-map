#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python_bin=${PYTHON:-python3.11}
"$python_bin" -m venv .venv
.venv/bin/python -m pip install -r rdr2_extractor/requirements-pipeline.txt
printf '%s\n' 'Activate: source .venv/bin/activate' 'Run: python -m rdr2_extractor.pipeline --output data/sample --sample 6'
