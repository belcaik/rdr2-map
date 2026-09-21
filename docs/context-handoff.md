# Context handoff

## Scope and branch

P0 implementation on `feature/rdr2-local-media-p0`. Target base `817e768`, reference
read-only `72d14e7`; exact SHAs and remote observations are in docs/reference-port.md.
Existing user Canvas/filter/debounce/coordinate work was preserved and extended.
No push, merge, deployment or publication was performed.

Integrated checkpoints: `7ab251a` contract/strategy, `50d54e5` canonical fixture,
`d695292` migration/API, `068b019` source/media, `c428b22` UI,
`a0d0528` review/shared API/dependency corrections, `720059c` canonical entrypoint cleanup.
Later validation/documentation commits are visible in `git log`.

## Implemented

- Numeric RDR2 IDs unchanged; additive SQLite migration with backup, value digests,
  rollback/repeat/unknown-schema tests; import upserts and preserves absent metadata.
- Separate local sprite-derived icons and ordered JPEG/WebP/PNG photographs, resumable
  bounded downloads, explicit discovery/download/coverage states and reporting.
- Cached viewport Canvas symbols, matching category/detail icons, safe descriptions,
  keyboard search, ordered gallery with modal/keyboard/touch controls and state reset.
- Shared dataset schema/types/validators and API DTOs; responsibility-based modules;
  AGENTS common rules and minimal Claude adapter; offline CI and reproducible commands.

## Evidence and isolation

Real browser source: 6,149 public points, 74 category symbols; premium omissions
explicit. Blazing Star743 has one photograph; Bone56 has two; Bounty91 has none.
The six-point real sample has 74 icons/five JPEGs, 2,737,989 unique bytes. Files remain
ignored under `data/sample`; full metadata normalization is under `data/volume-check`.

The personal DB remained version0 and unchanged. A SQLite backup copy was migrated:
64 categories/5,721 markers/progress values all matched before/after. Full public
metadata plus partial photo enrichment yielded 6,150 points (one absent legacy point
retained), and exact progress values/dates remained equal to the original.
Temporary acceptance DB/media were used for local visual review, never as defaults.

Checks executed: contract generation check; lint; TypeScript; 22 Python/TS contract
cases; seven backend tests; 15 Python tests; production build. Compiled importer
accepted the generated demo in an isolated DB. Full E2E finalization and clean-install
verification are tracked in docs/qa-review.md; consult its final status.

Local screenshots and measurements: `artifacts/real/` (ignored). Inspected RDR2
controls158/681/682 at zoom3/5; no projection change. Browser reported one Canvas,
6,150 markers and no JS errors/mobile horizontal overflow. Measurements are recorded
in QA, not treated as universal performance guarantees.

## Coordination

Real subagents audited source, backend and QA in parallel; contract checkpoint gated
producer/API/UI work. Shared workspace used disjoint paths and root-only commits.
Backend independently reviewed scraper; researcher reviewed backend; QA reviewed UI
and wrote offline browser acceptance tests. Reviewer findings were corrected with
regressions. Late backend/research follow-ups hit provider quota, and QA was stopped
before final continuation; the orchestrator completed remaining fixes and runs.
Do not claim those final runs were independently executed by another provider.

## Limits and continuation

Public data omits 750 premium locations. No bypass was attempted. Full public photo
storage is not measured/downloaded in this run; use `--sample 0` when desired.
Old removed category tokens may have an explicit fallback. Tiles remain legacy XYZ
zoom2–6; current upstream extra zoom/layers are not silently enabled. Source screenshots,
assets, captures, DBs and environment-specific logs are intentionally not tracked.

Start with README and AGENTS. Use disposable DB/data/ports for further tests. The
personal DB still needs the explicit documented migration when its owner wants to
switch this installation; do not use it to test. There is no pending publication.
