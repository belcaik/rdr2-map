# Task ledger

Initial target base: `817e768040d4b68e754d8fae462b48cf7fed86c7`.
Reference read-only checkout: `72d14e715cef67d3a0098c36380d480bdfe1a91f`.
Remote heads observed: target `a6f8e47046c3bba11b0492c5858f4e50f915a33b`,
reference `c1a176855abd8a242e86c616e2c52b4c746c2bef`.
Work branch: `feature/rdr2-local-media-p0`. One shared workspace, strictly disjoint
file ownership; only orchestrator stages/commits. No branch switching during work.

| ID | Owner / allowed paths | Depends | State | Acceptance/evidence |
|---|---|---|---|---|
| R01 | research (read only source/reference); backend (read only DB); QA (read only UI) | none | hecha | Live browser source; schema/version/counts; regression inventory returned |
| R02 | orchestrator: schemas/, shared/, fixtures/, root config, global docs | R01 | hecha | v1 machine contract, typed declarations, synthetic demo, additive migration strategy |
| R03 | research: rdr2_extractor/**, docs/source-discovery.md | R02 | revisión | Normalize and download/resume real icons/photos, validate, report, Python tests |
| R04 | backend: backend/src/**, backend/tests/**, docs/migration.md | R02 | revisión | Backup, migrate/repeat/value compare, unknown schema, upserts, local assets/API tests |
| R05 | orchestrator: frontend/src/** | R02 | revisión | Cached symbols, safe detail/gallery, keyboard, mobile, errors |
| R06 | orchestrator: root/docs/config/CI/adapters | R02–R05 | en curso | Executable commands and one instruction source |
| R07 | QA: frontend/tests/**, frontend/playwright.config.ts; orchestrator integration | R03–R05 | en curso | Offline E2E, real data visual checks, scale |
| R08 | QA independent review, orchestrator fixes/handoff | R06–R07 | en curso | Findings resolved or explicit external limitations |

Each implementation uses the R02 checkpoint SHA as base, Dataset v1 and
docs/data-contract.md. Tests use temporary DB/data and dedicated ports; personal DB
is read-only. Handoffs report files, decisions, commands/results, limitations and work
remaining. States: pendiente, en curso, bloqueada, revisión, hecha.
