# Extractor setup

Use Python 3.11 or 3.12 and the pipeline requirements from repository root:

```sh
python3.11 -m venv .venv
.venv/bin/pip install -r rdr2_extractor/requirements-pipeline.txt
.venv/bin/python -m rdr2_extractor.pipeline --help
```

Alternatively, `PYTHON=python3.11 ./rdr2_extractor/setup.sh` performs those installation
steps without changing your Python version manager. Install Chrome/Chromium for live
public capture; normalize/validate and tests work offline. `run.sh` selects the root
`.venv`, an existing `rdr2_extractor/venv`, or system python3 in that order.

See [README](README.md) for extraction, resumable enrichment and optional tile
maintenance. The older `requirements.txt` belongs to that tile utility; it is not
required by the dataset producer. Pipeline configuration uses CLI arguments.
