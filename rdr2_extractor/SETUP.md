# Extractor setup

Use Python 3.11+ and the pipeline requirements from repository root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r rdr2_extractor/requirements-pipeline.txt
.venv/bin/python -m rdr2_extractor.pipeline --help
```

Install Chrome/Chromium for live public capture; normalize/validate and tests work
offline. `run.sh` selects the root `.venv`, an existing `rdr2_extractor/venv`, or
system python3 in that order. It forwards all arguments to the canonical pipeline.
No pyenv version mutation or activation is required.

See [README](README.md) for extraction, resumable enrichment and separate legacy
tile maintenance. Legacy `setup.sh`/`requirements.txt` provision the old tile utility;
they are not dependencies of the dataset producer.
