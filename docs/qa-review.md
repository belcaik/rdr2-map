# Independent QA review

## Scope and isolation

R07 QA owns `frontend/tests/`, `frontend/playwright.config.ts`, and this report. Tests use a disposable directory created with `mkdtemp`, their own SQLite database, API port 3903, and Vite port 5177. Browser requests to external hosts are blocked. The test runner refuses to execute the legacy importer until explicit `--db` support exists. It never uses the personal database or downloaded source media.

## Initial red evidence

`CHROME_PATH=/path/to/chromium npm run test:e2e --prefix frontend` was executed before implementation. It exited 1 because the importer lacked `--db`; the safety guard stopped the server before opening any database. This is an infrastructure red, not evidence that a behavioral assertion ran.

## Initially planned behavioral checks

- Local photos, ordered gallery, keyboard arrows/Escape, mobile layout, safe Markdown/HTML and no hidden remote image requests.
- Found progress survives reload, full reimport, partial reimport, with exact API progress values including `found_at` compared before/after.
- Partial import retains all eight markers and all three categories.
- Switching from the second image of a multi-photo point to a single-photo point or no-photo point never retains the old photo/index.
- Confirmed absence, uninspected discovery, failed discovery, pending download, failed download and missing local file are distinguishable.

At the initial checkpoint these checks had not run against the integrated implementation. Final results appear below. Synthetic screenshots do not establish real-source coordinate alignment.

## Independent review and corrections

QA reviewed UI code and added actual Canvas draw-image observations, symbol equality,
found opacity, category filters/counts, focus restoration, keyboard selection and
swipe/progress isolation. Focus restoration initially failed and was corrected. A
StrictMode cleanup could reopen search results; restoration now runs only on close.
Native search Escape is handled without clearing/reopening results.

Backend's independent scraper review reproduced missing-icon false completeness,
null MIME crashing the batch, and excessive full-dataset checkpoint writes. The
researcher fixed these with red/green tests, batched checkpoints and interruption
flush. Researcher's backend review found repeated icon queries and stale HTTP caching;
request-local icon maps and revalidation now address both.

Late agent continuation hit provider quota. The orchestrator integrated fixes and
completed final browser/visual runs; these are not attributed to an independent
agent. Initial E2E infrastructure-red and later genuine focus failures remain recorded.

## Real RDR2 inspection

`frontend/tests/inspect-real.mjs` ran against a disposable migrated/imported copy on
API3904/web5178 using existing local tiles. Source data was obtained earlier through
an ordinary browser by the research agent, without bypass. Desktop1440x1000 and
mobile390x844 screenshots are ignored local artifacts, not redistributed game assets.

- Blazing Star743: actual category symbol, formatted source description and local photo.
- Bone56: actual ordered two-photo gallery and enlarged second image.
- Bounty91: confirmed no-photo state.
- Mount Hagen158, Armadillo681, Saint Denis682: visually inspected at zoom3/5.
  Zoom5 tile URLs were checked; corresponding map labels/landmarks align with the
  original EPSG3857 coordinates. No calibration/transform changes were made.
- Photos load only on selection. Mobile fits horizontally; details scroll internally.
- Text/background contrast calculations: minimum4.81:1 in retained error text;
  new detail/control pairs7.69–13.50:1. Visible focus and44px primary controls checked.

Observed latest run:6,150 points, one Canvas,99 DOM elements with mobile detail open,
initial ready2,220ms; hide/show category roundtrip419ms; zero JS errors and no horizontal
overflow. Earlier shared-load runs ranged1.48–3.48s startup and0.42–0.97s filter cycle.
These are observations, not fixed performance budgets. No clustering was justified.

Photos in the real sample remain JPEG (239–971KB each). Seventy-four icons plus five
photos occupy2,737,989 bytes. Full-photo storage was not measured. Checkpoint testing
on6,149 points/488 synthetic assets reduced writes from at least1.47GB to61.1MB across
20 checkpoints, retaining an interruption-safe final flush.

## Visual artifacts

Local files under `artifacts/real/`: `detail-743-desktop.png`, `detail-56-desktop.png`,
`detail-91-desktop.png`, `bone-gallery.png`, `blazing-mobile.png`,
`control-{158,681,682}-z{3,5}.png`, `measurements.json`. Synthetic E2E screenshots are
under `frontend/test-results/`; they do not establish real extraction.

## Final automated acceptance

The full offline suite passed from both the working tree and a clean Git archive of
`8e07a5b` installed with `npm ci` in root/backend/frontend plus a fresh Python3.11
virtual environment and pinned pipeline requirements. All npm installs reported zero
known vulnerabilities. The existing local Chromium executable was provided through
`CHROME_PATH`; CI installs its own Playwright Chromium. Remote GitHub CI was not run.

| Check | Result |
| --- | --- |
| Generated contract drift | PASS |
| ESLint and TypeScript | PASS |
| Shared valid/invalid Python/TypeScript cases | 22 PASS |
| SQLite migration/import/media/API tests | 7 PASS |
| Python normalization/media/resume/source tests | 15 PASS |
| Production backend/frontend build | PASS |
| Offline Playwright desktop/mobile/touch/filter/persistence/zoom-pan | 6 PASS (13.9s clean run) |
| Compiled importer with local demo files | PASS |
| Startup script and empty DB initialization | PASS |
| Git index check for databases/downloads/secrets | PASS; tracked empty legacy decoy removed without deleting local file |

The hit-testing test initially clicked before the first Canvas frame and later
started a drag during zoom animation. It now waits for rendered content, observes
zoom animation completion and exercises keyboard pan before pointer selection.
This is synchronization with visible behavior, not a skipped assertion or a disabled
interaction. All other assertions, including exact progress equality, remain enabled.

The real-data inspection was performed separately with downloaded source media;
it is not part of CI. It confirmed 74 local symbols and the six-point sample rather
than asserting that every public photo was downloaded. Premium source omissions,
obsolete legacy symbol fallback and full-photo storage limits remain explicit.
