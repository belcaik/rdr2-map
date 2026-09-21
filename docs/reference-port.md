# Reference port audit

Target actually read: `817e768040d4b68e754d8fae462b48cf7fed86c7`, plus pre-existing
working changes in marker filtering, App, Map, CanvasMarkers, useDebounce and
coordinate utilities. Those changes are preserved and extended, not reverted.
GTA checkout actually read: `72d14e715cef67d3a0098c36380d480bdfe1a91f` (clean).
Remote HEADs separately checked: RDR2 `a6f8e47046c3bba11b0492c5858f4e50f915a33b`,
GTA `c1a176855abd8a242e86c616e2c52b4c746c2bef`. No reference files were modified.

| Capability | Existing RDR2 | GTA solution inspected | Decision | Risks | Destination | Acceptance |
|---|---|---|---|---|---|---|
| Capture/media | Monolithic extraction loses source media, icon/photo fallback | scraper/discover.py, browser.py, normalize.py, media.py, run.py | adapt phases and sprite metadata | Different endpoint, premium omissions, universal PNG wastes disk | rdr2_extractor/ | real icon/photo sample plus offline pipeline tests |
| Contract | Ad hoc JSON and duplicate types | schemas/dataset.schema.json, schemas/api.schema.json, shared/invariants.ts, scraper/contract.py | adapt schema; retain numeric IDs | Map-based progress identity, media completeness conflated | schemas/, shared/ | Python/TS same valid/invalid fixtures; generated types check |
| Migration | Version0 populated SQLite, destructive import | backend/src/db/schema.ts, importer.ts | do not port initializer; adapt transactions/upserts | Last-subset metadata hides maps; user progress loss | backend/src/db/ | value/date/backup/rollback/repeat/partial tests |
| Assets/API | Tiles only | backend/src/media/files.ts, backend/src/app.ts | adapt confinement, decoding and local serving | Symlinks, MIME spoofing, SVG and absent files | backend/src/media/, app.ts | corrupt/missing/path tests and HTTP MIME |
| Symbols/detail | Canvas colored dots; raw HTML popup | frontend/src/categories/, detail/, map/Map.tsx | adapt gallery reset and safe detail; retain viewport canvas | Raw HTML injection, repeated scans, DOM marker scale | frontend/src/{map,categories,detail}/ | symbol consistency, keyboard/reset/safe format |
| Coordinates | Identity EPSG3857 in current working tree | shared/coordinates.ts | do not port game calibration | RDR2 source config differs from GTA | existing coordinate helper | three independent RDR2 controls at multiple zooms |
| Quality | No tests/CI | scraper/tests/test_pipeline.py, backend/tests/integration.test.ts, frontend/tests/map.spec.ts, .github/workflows/ci.yml | adapt acceptance patterns, independent implementation | Fixtures are not live evidence | tests, scripts, CI | offline pipeline and browser checks |
| Agent context | Stale speculative CLAUDE.md | AGENTS.md, CLAUDE.md, README, docs/, root scripts | adapt single source and handoff | Publication permissions/session state do not transfer | AGENTS.md and docs | verified commands, minimal adapters |

Dataset schema is code adapted under the reference MIT license; LICENSE retains
its full notice. Other conceptual patterns are attributed above. External map assets
are separate from code licensing; see THIRD_PARTY_NOTICES.md.
