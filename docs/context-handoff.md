# Context handoff

## PR preparation (2026-09-21)

The user authorized commits and publication of a PR to `main`. Documentation fixes
were committed separately as `3dbb878` and `249bef0`, using Conventional Commits and
no coauthor trailers. Integrating `origin/main` at `a6f8e47` exposed an add/add README
conflict: retained the current operational commands and preserved main's explicit
MIT/source-only license pointer. No runtime files changed during integration.
With `source rdr2_extractor/venv/bin/activate`, ran
`CHROME_PATH=/home/belcaik/.cache/selenium/chrome/linux64/153.0.8010.52/chrome npm run check`
after resolution: the entire sequence passed, including all six E2E tests.
Earlier no-publication statements below describe their respective checkpoints.

## Photo inspection follow-up (2026-09-21)

The reported missing photographs were a selection/import mismatch, not a failed
download or gallery defect. `run.sh --output data/all-public` still defaults to
six points; the subsequent command imported `data/sample/dataset.json`. Both local
datasets contained six points and five downloaded photos. Read-only inspection of
the installed DB found 5,715 uninspected points, four present and two none. Its live
API returned waypoint56's two-photo gallery and served media-81495 with HTTP200
and 424,516 bytes. No application code or personal DB was changed in this follow-up.

Executed full enrichment with
`./rdr2_extractor/run.sh --capture data/all-public/capture.json --output data/public-enriched --sample 0`,
then `./rdr2_extractor/run.sh --output data/public-enriched --phase validate`.
Result: 6,149 points, 408 with photos, 5,741 confirmed none, 74 icons and 414 photos
downloaded, 159,170,950 stored bytes, no failures. This supersedes the earlier
full-photo storage limitation below. Capture reuse means no new enumeration was
performed; premium omissions and tile coverage are unchanged. Artifacts are ignored.

Imported that dataset with `npm run import -- data/public-enriched/dataset.json --db /tmp/rdr2-photo-check.I17uK3/map.sqlite --data-root /tmp/rdr2-photo-check.I17uK3/media`.
A Node HTTP harness used the compiled app on an ephemeral loopback port: all 6,149
temporary DB points were inspected, all 488 assets returned HTTP200 with expected
byte lengths, and waypoint56 returned two photos. An initial harness invocation
preceded import completion and saw an empty DB; it was rerun after successful import.
The personal DB remains at its original six-point enrichment; the final response
supplies the matching full-dataset import command for the installation.

Ran `source rdr2_extractor/venv/bin/activate` and `npm run check`: contracts, lint,
types, 22 parity cases, seven backend tests, 15 Python tests and build passed.
E2E could not launch its missing bundled browser. Repeated with
`CHROME_PATH=/home/belcaik/.cache/selenium/chrome/linux64/153.0.8010.52/chrome npm run test:e2e`:
all six passed. `git diff --check` passed. README instructions now pair full extraction
with the same import path and explain sample/mediaComplete/resume scope. No push or
PR publication was performed.

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
accepted the generated demo in an isolated DB. Six offline E2E tests passed; a clean Git-archive installation also passed the whole
`npm run check` sequence. Detailed final evidence is in docs/qa-review.md.

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

Final acceptance: R01–R08 are complete within documented public-source limits.
The worktree is committed; no downloaded assets or DBs are tracked. The reference
checkout changed independently during this long session; the port remains pinned to
its initially audited SHA, with the final observation recorded in reference-port.md.
