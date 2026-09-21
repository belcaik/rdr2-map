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

## LAN deployment (2026-09-21)

Base `6717fa9ffdf4bcf9bd4c98bfaddafd2633203e87`: clean local main, tracking
origin/main, independently matched by `git ls-remote origin refs/heads/main`.
Integration branch: `feat/docker-homeserver`. This user request extends the original
P0 scope to containers, CI and a separate LAN installation. Publication was subsequently authorized for PR #2 to main and GHCR;
see the latest handoff and PR checks for remote evidence. Contract v1 and personal progress stay intact.

| ID | Owner / exclusive paths | Depends | State | Acceptance |
|---|---|---|---|---|
| D01 | runtime worktree: backend/, frontend/, Dockerfile, Compose, env/ignore files | base | hecha | Same origin, SQLite health, resource 404, non-root clean image, compiled import |
| D02 | deploy worktree: scripts/deploy.sh, scripts/tests/test_deploy.py | base; D01 interface | hecha | Strict SSH, validated inputs, dry-run, archive/import/health, Docker and rootless Podman, systemd |
| D03 | CI/docs worktree: .github/workflows/, docs/deployment.md, README, AGENTS | base; D01/D02 interface | hecha | Public-only jobs, pinned actions, no artifact/cache costs, operational steps and recovery |
| D04 | root: integration, tasks/handoff, isolated QA and sole remote deploy owner | D01–D03 | hecha | Project checks, synthetic Docker, real LAN desktop/mobile, persistence, service restart, backup restoration, GTA intact |

Workers use isolated worktrees from the same base; integration owner reviews and
cherry-picks local commits. Runtime internal port is 3001; proposed external port
8081 was observed free. Import entrypoint is compiled JavaScript under
`/app/backend/dist/backend/src/db/import.js`. Image contains no dataset. Database,
media and tiles belong under `/data`. Final evidence belongs in the handoff.


D01–D04 accepted locally and on the LAN. Root completed workflow implementation,
script hardening and integration; independent runtime reviewer checked the final
script/workflows. Evidence and explicit remote-publication limits are in the
latest [handoff](context-handoff.md#container-and-lan-delivery-2026-09-21).
