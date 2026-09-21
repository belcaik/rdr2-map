# RDR2 Map

A local RDR2 map using React/TypeScript/Leaflet, Express/SQLite and a Python extractor.
Category symbols and waypoint photographs are extracted from RDR2, stored locally,
and displayed in filters, canvas markers and a keyboard/touch gallery. Found progress
is independent of imports. Existing pan/zoom, category filters and found visibility remain.

## Install

Use Node 22.22.3+ within Node 22 and Python 3.11 or 3.12. The pipeline dependencies
are pinned separately from the optional legacy tile downloader. From the repo root:

```bash
npm ci
npm run install:all
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r rdr2_extractor/requirements-pipeline.txt
npx --prefix frontend playwright install chromium
```

A normal Chrome/Chromium installation is needed only for live extraction. Offline
fixtures and checks do not contact RDR2. To use an existing Chrome for Playwright,
export `CHROME_PATH=/absolute/path/to/chrome` instead of downloading its browser.

## Clean installation with synthetic data

```bash
npm run demo -- data/demo
npm run import -- data/demo/dataset.json --db data/demo/map.sqlite --data-root data/demo
DB_PATH="$PWD/data/demo/map.sqlite" DATA_ROOT="$PWD/data/demo" npm run dev:api
```

In another terminal:

```bash
VITE_TILE_SOURCE=none npm run dev:web -- --host 127.0.0.1
```

Open http://localhost:5173. Demo pictures/symbols are generated geometry, not game
assets. An empty installation also starts with zero points; extraction/import supplies data.

## Existing installation: preserve data and progress

The populated legacy DB is normally `backend/data/rdr2.db`, version 0. Stop the old
app. Follow [migration](docs/migration.md) to test a SQLite backup copy first, then:

```bash
npm run migrate -- --db backend/data/rdr2.db
npm run import -- data/sample/dataset.json --db backend/data/rdr2.db --data-root data
DB_PATH="$PWD/backend/data/rdr2.db" DATA_ROOT="$PWD/data" npm run dev:api
```

Migration creates a consistent backup and verifies all legacy values. Import requires
an explicit dataset path; it never resets progress or removes absent points/categories.
A later partial capture does not erase previously downloaded media. Progress reset
is a separate explicit API operation. See the migration document for restoration.

## Extract, enrich and resume

With the Python environment active, capture the public source and download a small
sample (Blazing Star, a two-photo bone, a point without photos and map controls):

```bash
python -m rdr2_extractor.pipeline --output data/sample --sample 6
python -m rdr2_extractor.pipeline --output data/sample --resume
python -m rdr2_extractor.pipeline --output data/sample --phase validate
```

Output includes `dataset.json`, `report.json`, local `icons/` and `images/`, plus
an ignored source capture. Resume keeps the original selection and verifies existing
files. To use all public points, choose a new output and `--sample 0`. Coverage stays
partial when the source omits premium categories. `--phase normalize` exports without
media downloads; `--phase discover` captures without normalization/downloads.

Reuse an allowed offline capture, without recapturing the site:

```bash
python -m rdr2_extractor.pipeline --capture data/sample/capture.json --output data/enriched --sample 6
```

For an old extraction whose `raw_data.mapData` contains source locations/media,
combine its data with the current sprite discovery:

```bash
python -m rdr2_extractor.pipeline --capture data/sample/capture.json --legacy-capture /absolute/path/to/extracted_data.json --output data/legacy-enriched --sample 0
npm run import -- data/legacy-enriched/dataset.json --db backend/data/rdr2.db --data-root data
```

No tile download is required for enrichment. Existing tiles remain in
`rdr2_extractor/data/tiles/zoom_Z/X_Y.jpg`. `TILES_DIR` can point elsewhere.
The retained optional tile command is documented in [extractor README](rdr2_extractor/README.md).
All downloaded assets and captures are excluded from Git; see [third-party notices](THIRD_PARTY_NOTICES.md).

## Run and configure

```bash
npm run dev:api
npm run dev:web -- --host 127.0.0.1
# Or start both local processes:
./start.sh
```

Backend defaults: port 3001, DB `backend/data/rdr2.db`, media `data/`, existing
extractor tiles. Export `PORT`, `DB_PATH`, `DATA_ROOT`, `TILES_DIR` to override; use
absolute filesystem paths when starting from a different directory. Backend does not
implicitly load `.env`. Frontend uses Vite's `VITE_API_BASE` (default
`http://localhost:3001/api`) and `VITE_TILE_SOURCE=local|none`.

## Checks

With the Python environment active:

```bash
npm run contracts:check
npm run lint
npm run types
npm test
npm run build
npm run test:e2e
```

`npm run check` runs the same sequence. E2E creates temporary data/DB and local
servers on 3903/5177, blocks external requests and never touches personal progress.
CI uses only synthetic assets. `npm run contracts` regenerates TypeScript declarations
from the JSON schema. [QA evidence](docs/qa-review.md) distinguishes offline tests,
real-source inspection, performance measurements and remaining external limitations.

## API and architecture

- `GET /api/markers` supports existing bbox/category_ids/limit/offset queries.
- `GET /api/markers/categories` returns counts and local category asset metadata.
- `GET /api/markers/:id` returns the ordered local gallery and discovery state.
- `GET /api/assets/:id` serves verified PNG/JPEG/WebP media.
- `GET /api/tiles/:z/:x/:y.jpg` serves existing local tiles.
- `GET /api/progress`, `POST /api/progress/:id` read/update found status.
- `POST /api/progress/reset` explicitly resets progress.

See [architecture](docs/architecture.md), [data contract](docs/data-contract.md),
[source discovery](docs/source-discovery.md), [reference decisions](docs/reference-port.md),
and [contributing](CONTRIBUTING.md). Agent instructions are centralized in AGENTS.md;
CLAUDE.md imports them, and other Markdown agents use [the same workflow](docs/agent-workflow.md).

Public source coverage excludes premium locations; no access bypass is attempted.
Uninspected/failed discovery, pending/failed download and missing local files remain
visible distinct states. This repository distributes code and synthetic fixtures,
not downloaded game media, a deployed site or cloud services.
