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
| R03 | research: rdr2_extractor/**, docs/source-discovery.md | R02 | hecha | Normalize and download/resume real icons/photos, validate, report, Python tests |
| R04 | backend: backend/src/**, backend/tests/**, docs/migration.md | R02 | hecha | Backup, migrate/repeat/value compare, unknown schema, upserts, local assets/API tests |
| R05 | orchestrator: frontend/src/** | R02 | hecha | Cached symbols, safe detail/gallery, keyboard, mobile, errors |
| R06 | orchestrator: root/docs/config/CI/adapters | R02–R05 | hecha | Executable commands and one instruction source |
| R07 | QA: frontend/tests/**, frontend/playwright.config.ts; orchestrator integration | R03–R05 | hecha | Offline E2E, real data visual checks, scale |
| R08 | QA independent review, orchestrator fixes/handoff | R06–R07 | hecha | Findings resolved or explicit external limitations |

Each implementation uses the R02 checkpoint SHA as base, Dataset v1 and
docs/data-contract.md. Tests use temporary DB/data and dedicated ports; personal DB
is read-only. Handoffs report files, decisions, commands/results, limitations and work
remaining. States: pendiente, en curso, bloqueada, revisión, hecha.

## Acceptance evidence

R02 checkpoint `50d54e5` gated parallel implementation. R03 integrated `068b019`,
R04 `d695292`, R05 `c428b22`; review corrections `a0d0528`, canonical cleanup `720059c`,
docs/QA `8e07a5b`. Final lockfile installation and complete `npm run check` succeeded
from a clean Git archive of `8e07a5b`: 22 cross-language contract cases, seven backend
tests, 15 Python tests and six offline browser tests. License-only metadata was then
corrected in `81e2004`; no runtime behavior changed.

Real evidence: 74 extracted symbols, five photos including two-photo waypoint56,
three source categories and three far-apart coordinate controls at zoom3/5. Existing
SQLite copy migration preserved every legacy value; full+partial imports preserved
exact progress dates and absent data. Personal DB remains untouched. Screenshots,
measurements, red/green history and limits are in docs/qa-review.md and source-discovery.md.

R08 involved independent cross-reviews by real subagents. Provider quota prevented
late follow-up turns; final corrections/reruns were completed by the orchestrator.
Premium coverage and full-photo storage remain declared external/scope limits, not
completed extraction claims. All source/media artifacts and databases remain ignored.
