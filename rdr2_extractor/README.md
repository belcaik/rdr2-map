# RDR2 extraction and media enrichment

`python -m rdr2_extractor.pipeline` is the canonical dataset v1 producer. Run it from
repository root. It discovers public data with ordinary Chrome, normalizes source
IDs and associations, downloads verified category symbols and photos, validates,
and atomically exports `dataset.json` and `report.json`. It never opens the app DB.

```sh
python3.11 -m venv .venv
.venv/bin/pip install -r rdr2_extractor/requirements-pipeline.txt
.venv/bin/python -m rdr2_extractor.pipeline --output data/sample --sample 6
.venv/bin/python -m rdr2_extractor.pipeline --output data/sample --resume
.venv/bin/python -m rdr2_extractor.pipeline --output data/sample --phase validate
.venv/bin/python -m unittest discover -s rdr2_extractor/tests
```

Chrome/Chromium must be installed for live discovery/download. Selenium manages its
compatible driver. Offline normalize/validate/tests need no browser. No stealth,
credentials or external agent service is required. If public source access fails,
supply a legitimate capture with `--capture path/to/capture.json`.

`--phase discover` records mapData, full public location response, sprite manifest
and allowlisted network evidence. `--phase normalize` exports without downloads;
`--phase download` runs the full pipeline; `--phase validate` verifies dataset and
local file hashes/MIME/dimensions. `--sample 0` selects every captured public point.
`--categories 36 29 33` limits category IDs. Resume reuses the original selection,
validates cached files, skips valid files and retries failed/corrupt downloads.

The six-point sample includes Blazing Star743, Dinosaur Bone56 (two photos), Bounty91,
Mount Hagen158, Armadillo681 and Saint Denis682. Categories keep all captured icons
unless filtered explicitly. Public enumeration excludes protected premium points,
which is reported as partial coverage rather than inferred completeness.

## Existing installations

Keep the existing database and tiles. Enrichment downloads no tiles, and an import
upserts records without resetting progress; see [migration](../docs/migration.md).
To reuse original point data from an old extraction while adding verified symbols:

```sh
.venv/bin/python -m rdr2_extractor.pipeline --phase discover --output data/source
.venv/bin/python -m rdr2_extractor.pipeline --capture data/source/capture.json --legacy-capture path/to/extracted_data.json --sample 0 --output data/enriched
```

`--legacy-capture` reads `raw_data.mapData`, including the original media arrays.
It does not use the lossy old normalized `image_url` field. Unknown discovery stays
uninspected, distinct from confirmed none and failed discovery.

The legacy `main.py` accepts only `--tiles-only`; it is retained for maintaining
existing tile layouts. Its older optional dependencies are in `requirements.txt`.
Run from `rdr2_extractor/`: `venv/bin/python main.py --tiles-only --zoom-levels 2 3`.
Existing local files stay in place. This utility is independent of dataset/media
extraction and is not needed to add icons/photos.

Modules: browser handles capture/transport; normalize handles relationships;
media handles validation/storage/retries; contract mirrors shared TypeScript
validation; pipeline coordinates phases. Tests use synthetic data and temporary
roots. See [source evidence](../docs/source-discovery.md) and
[data contract](../docs/data-contract.md) for provenance and limitations.
