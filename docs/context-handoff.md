# Context handoff

## GitHub publication follow-up (2026-09-21)

The user authorized PR-to-main and GHCR publication in this session.
[PR #2](https://github.com/belcaik/rdr2-map/pull/2) was published and merged as
`7c45eb487b04fb7c4c6f0ea470474745719de0dc`. The merge occurred externally while
checks were being observed; the agent did not issue that merge. The initial HTTPS
push lacked a Git credential; the existing verified SSH GitHub identity published
the branch without changing the remote URL. The follow-up documentation commit
arrived after the merge and is carried by a separate documentation PR.

Remote evidence, now distinct from the previous local-only checkpoint:

- [PR verification](https://github.com/belcaik/rdr2-map/actions/runs/35664776425)
  and [PR image build](https://github.com/belcaik/rdr2-map/actions/runs/35664776711)
  passed; the PR's publish job was skipped as intended.
- [Main verification](https://github.com/belcaik/rdr2-map/actions/runs/35664811789)
  and [GHCR publication](https://github.com/belcaik/rdr2-map/actions/runs/35664811729)
  passed. Both main runs have zero uploaded artifacts. Three existing npm caches
  predate these runs; none was created by the new workflows.
- [The package](https://github.com/users/belcaik/packages/container/package/rdr2-map)
  is publicly visible. `docker --config <new-empty-directory> pull
  ghcr.io/belcaik/rdr2-map:sha-7c45eb487b04fb7c4c6f0ea470474745719de0dc` succeeded
  anonymously. The package REST query required read:packages, unavailable on the
  local gh token; public page visibility and the anonymous pull establish access
  independently. No new token or credentials were installed.
- Published digest:
  `sha256:bcf1f9c67b80c04ecb93cf387bfd69b41f9ecdac2966509cf151f1700bcabf60`.
  Both the SHA tag and latest were published for AMD64. The image contains code,
  not the dataset, media or progress database.
- The ignored local environment now pins
  `ghcr.io/belcaik/rdr2-map@sha256:bcf1f9c67b80c04ecb93cf387bfd69b41f9ecdac2966509cf151f1700bcabf60`.
  Ran `SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman
  ./scripts/deploy.sh` without archive or dataset. Podman pulled from GHCR,
  recreated only RDR2, passed its actual healthcheck and retained active/enabled
  user systemd. API progress matched its pre-update value; GTA remained healthy.

Private command logs and pre-update configuration are ignored under
`artifacts/publication/`. Earlier statements below record the preceding LAN-only
checkpoint, rather than the current publication state. Future doc-only main pushes
may advance latest; the server deliberately keeps this verified digest.

## Container and LAN delivery (2026-09-21)

Branch `feat/docker-homeserver`, base `6717fa9ffdf4bcf9bd4c98bfaddafd2633203e87`.
The initial worktree was clean, local main and origin/main matched, and
`git ls-remote origin refs/heads/main` independently confirmed the same SHA.
This was not the empty-local-main situation from GTA. Planning is commit
`362ec1d`; runtime integration is `d558633`, `e1123b4`, `12be40b`; deployment and
workflow integration includes `b20ef8e`, `d60de06`, `f307082` and later checks/docs.
All commits remain local. No push, PR, merge, Actions execution, GHCR package
publication/visibility change or anonymous GHCR pull occurred in this session.
The existing repository was confirmed public with default branch main.

### Implementation and coordination

Three isolated worktrees started at the same base: runtime, deployment script,
and documentation/workflows, with exclusive file ownership. Lower-cost Luna was
requested; deploy and docs used Luna, while the full-history runtime worker
inherited the primary session model. Root integrated and reviewed their changes,
completed workflow implementation and script hardening, and was the sole remote
operator. The runtime worker independently reviewed the final script/workflows.
The deployment worker amended its initial commit; root resolved the resulting
add/add integration conflict by retaining its revised files, then ran the tests.

- One Node 22.22.3 image serves frontend/API/media; production has no scraper,
  host node_modules, TypeScript runner, dataset, DB or game assets in its layers.
  Runtime is UID/GID 1000, `/data` is writable, internal HTTP is 3001. Compiled
  entrypoints are `dist/backend/src/index.js` and `dist/backend/src/db/import.js`
  from `/app/backend`; generated JSON schemas ship with the compiled backend.
- `HOST`, `PORT`, `DB_PATH`, `DATA_ROOT`, `TILES_DIR`, `STATIC_ROOT` configure the
  API; `APP_ROOT=/app` identifies the container root without changing development
  DB defaults. Frontend defaults to `/api`; Vite's `WEB_HOST`, `WEB_PORT`,
  `API_TARGET` proxy is development-only. API/resource misses stay 404, SPA
  navigation works, SQLite failures return 503, empty DB health returns import guidance.
- Compose base has the scalar healthcheck shared by both engines. Podman override
  uses keep-id. Script validates literal configuration, strict SSH and dependencies
  before copying, transfers a filtered dataset without deletion, loads a unique
  archive or pulls, imports compiled JS, waits for real health, and enables user systemd.
- Public-only Actions jobs use standard Ubuntu 24.04 runners, bounded timeouts,
  concurrency cancellation, pinned official action commits and scoped package write
  permission. No artifact upload or cache: explicit setup-node/Buildx/QEMU cache
  disabling and `DOCKER_BUILD_RECORD_UPLOAD=false`. PR builds cannot publish;
  default-branch push/manual jobs publish full-SHA/latest tags. Manual multiarch
  includes AMD64; later automatic pushes return to AMD64. Current official billing
  sources and package visibility steps are linked from [deployment](deployment.md).

### Commands and local evidence

Private logs, screenshots, scripts and measured addresses are under ignored
`artifacts/deployment/`; private configuration is `.env.docker`. Nothing there
is required for CI. Isolated synthetic data/DB were under `/tmp/rdr2-container-qa`.

Executed:

```bash
source rdr2_extractor/venv/bin/activate
python -m rdr2_extractor.pipeline --output data/public-enriched --phase validate
CHROME_PATH=/home/belcaik/.cache/selenium/chrome/linux64/153.0.8010.52/chrome npm run check
python -m unittest discover -s scripts/tests -v
bash -n scripts/deploy.sh
shellcheck scripts/deploy.sh
actionlint .github/workflows/ci.yml .github/workflows/docker.yml
git diff --check
docker build -t localhost/rdr2-map:local .
docker compose --env-file .env.docker config -q
docker save -o /tmp/rdr2-map.tar localhost/rdr2-map:local
```

The actual browser path was the installed Selenium Chromium 153 binary; it is
shown above for reproducibility, not required in CI. `npm run check` passed contracts,
lint, types, 22 TS/Python parity cases, eight backend tests, 15 Python tests,
build and six offline E2E tests. Script tests: 11 passing, including empty options,
malicious dotenv, strict transports, space-containing local paths, preflight/health
failure order, archive-without-pull, shell syntax and actual rsync exclusion behavior.
ShellCheck 0.11.0 and actionlint 1.7.12 passed. Action release tags/commit targets
and manifests were fetched from official repositories before pinning.

Client had no rsync or passwordless sudo. Built upstream rsync 3.5.1 with
`./configure --prefix=/home/belcaik/.local --disable-md2man`, `make -j4`,
`make install`; verified the installed version. No server binary was borrowed.
Synthetic image tests verified all five downloaded demo assets, six missing-resource
404s, default empty startup without Compose, no tsx, Node/UID, compiled import,
reimport preserving found_at, and container recreation preserving progress.
Docker Compose's scalar healthcheck reached healthy at an isolated loopback port.
A Vite run with explicit WEB_HOST/WEB_PORT/API_TARGET correctly proxied eight demo
points. Only these dedicated QA containers/network were removed afterward.

### LAN evidence

SSH strict host-key checking passed. Observed server: x86_64 Ubuntu, Podman 4.9.3
rootless, podman-compose 1.0.6, SSH UID/GID 1000, `Linger=yes`, working user systemd,
remote rsync, free port 8081 and initially 11 GiB available (9.2 GiB after deployment
and retained backup/restore copy). Existing services were recorded before mutation.
No sudo, host restart, Caddy change or unrelated service change was performed.

Image ID `sha256:fcec6a1b68196e50db98ae6f6b9d9bd4cc9920b060a7cf9523b6c568134d1f31`,
293,594,734 bytes, was built from the runtime at `12be40b`, tagged
`localhost/rdr2-map:local`, saved locally and transferred over SSH. The tar was
loaded with Podman and only its temporary remote upload was removed.

```bash
SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman \
  ./scripts/deploy.sh --dry-run --image-archive /tmp/rdr2-map.tar --dataset data/public-enriched
SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman \
  ./scripts/deploy.sh --image-archive /tmp/rdr2-map.tar --dataset data/public-enriched
# After correcting the podman-compose ps compatibility issue, no repeat import:
SSH_HOST=baphomet DEPLOY_DIR=apps/rdr2-map CONTAINER_ENGINE=podman \
  ./scripts/deploy.sh --image-archive /tmp/rdr2-map.tar
rsync -a -e 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10' \
  rdr2_extractor/data/tiles/ baphomet:apps/rdr2-map/data/tiles/
```

The first deployment imported successfully but exited on its health-wait gate:
podman-compose 1.0.6 rejects `ps -q map`. Corrected to `ps -q`, added a regression,
and reran without import; final script reported success only after real health
and active/enabled systemd checks. An HTTP scan overlapping that deliberate
recreation was interrupted; the complete stable-server scan below passed.

Final installation: `apps/rdr2-map`, Compose `rdr2-map`, LAN port 8081, unit
`map-apps-rdr2-map.service` active/enabled, container `rdr2-map_map_1` healthy,
SQLite owner 1000:1000 mode 0644. The LAN address is supplied in the user delivery,
not committed. Imported 6,149 RDR2 points, 74 icons and 414 photos. All 488 assets
returned expected MIME/hash; HTML, JS/CSS and missing API/assets/tiles checks passed.
All 4,033 existing tile files matched local checksums with `rsync -anc`.

Browser validation used the real LAN origin: desktop 1440×1000 and mobile viewport
390×844; local map/tiles, two-photo gallery, modal and category filters worked.
No page errors, unexpected external requests, HTTP failures or horizontal overflow.
Point 56 was marked in the UI, read from another independent browser context,
and retained its exact found_at across `up -d --force-recreate map` and
`systemctl --user restart map-apps-rdr2-map.service`. The test row was then removed
with an exact-ID/timestamp guard to restore the originally absent row. LAN progress
is empty again. No physical phone or full homeserver reboot was tested.

Stopped only the RDR2 unit, copied all data plus environment/Compose/image reference
into its own `backups/verified-*`, and restarted it. Restored the copy under a
separate `restore-check-*` directory, compared every file, then ran a separate
rootless container on loopback 18081. Real health passed, SQLite integrity_check
was `ok`, point count was 6,149, progress rows zero, and a local photograph was
served. The first stdin-fed verification harness did not finish its assertions;
the standalone saved verifier completed and emitted `RESTORE_VERIFIED`. Verification
container was removed; backup and restore data remain under the RDR2 installation.
Exact private paths are in ignored `artifacts/deployment/restore-check.log`.

Every pre-existing server container retained its ID; GTA remained healthy on 8080.
The PC's personal DB was read only: schema 1, 6,150 markers and one progress row,
with identical before/after progress digest. Its progress was not migrated to LAN.
The deployment imported the full source dataset into a separate new database.

### Remaining publication steps

With destination-specific authorization, push/open PR, observe real CI and image
build results, then merge/publish GHCR, verify package visibility and anonymous
SHA pull, and update MAP_IMAGE (prefer digest for immutable content). None of these
remote results is implied by the local checks above. Revisit the current GitHub
billing policy before publication; no future pricing guarantee is made.

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
