# SQLite migration and restoration

The recognized legacy database has `categories`, `markers`, and `user_progress`
tables and `PRAGMA user_version=0`. Version zero does not mean empty. The default
runtime database is `backend/data/rdr2.db`; the old zero-byte `backend/rdr2.db`
was not used by the application. `DB_PATH` or `--db` always overrides the default.
Unknown versions, tables, or legacy column layouts are rejected before migration.

Stop the application before migrating a real installation. Test first on a copy
created through SQLite's backup API, including any pending WAL writes:

```bash
python3 - <<'PY'
import sqlite3
with sqlite3.connect('backend/data/rdr2.db') as source:
    with sqlite3.connect('/tmp/rdr2-migration-check.sqlite') as target:
        source.backup(target)
PY
npm run migrate -- --db /tmp/rdr2-migration-check.sqlite
```

The migration creates a uniquely named `.backup-*.sqlite` beside the input DB with
SQLite's backup API before changing the legacy schema. It applies additive columns
and media tables in one transaction. It retains original category fields,
visibility, marker coordinates/descriptions/IDs, and every progress row, including
`found=0` and the original `found_at`. IDs need no conversion. The report includes
before/after counts and a SHA-256 digest of all legacy column values, ordered by
primary key. Unequal digests abort the migration. Repeating migration reports
`current` without changing data or creating duplicate rows. Fresh databases are
initialized without a backup; startup refuses recognized legacy databases until
explicitly migrated.

After reviewing the copy's report, run against the intended installation:

```bash
npm run migrate -- --db backend/data/rdr2.db
npm run import -- /absolute/path/to/dataset.json --db backend/data/rdr2.db --data-root data
DB_PATH="$PWD/backend/data/rdr2.db" DATA_ROOT="$PWD/data" npm --prefix backend run dev
```

The importer validates the full dataset and every downloaded image before changing
SQLite. It verifies confinement, SHA-256, real PNG/JPEG/WebP encoding, dimensions and
size (20 MiB per file; 40 million decoded pixels). It preserves existing downloaded
assets when a later record reports failure or pending download, and known galleries
when discovery is failed or uninspected. It merges categories/maps and never deletes
absent markers, resources, categories or progress, including partial snapshots.
Import history records each run's source and coverage. Imports do not reset progress.
Content-addressed files may remain unreferenced after an interrupted import; automatic
media deletion is deliberately absent. Reimport safely reuses verified files.

Legacy media discovery starts as `uninspected`. Existing tile files stay in
`rdr2_extractor/data/tiles`; use `TILES_DIR` to point elsewhere. Media enrichment and
import do not download tiles or change the existing coordinate transform.

To restore, stop all processes using the database, preserve the failed DB for
inspection, and restore through SQLite rather than copying only its main file:

```bash
python3 - <<'PY'
import sqlite3
backup = 'backend/data/rdr2.db.backup-REPLACE-WITH-REPORTED-NAME.sqlite'
with sqlite3.connect(backup) as source:
    with sqlite3.connect('backend/data/rdr2.db') as target:
        source.backup(target)
PY
```

A restored legacy database requires the old application or a fresh explicit migration.
Do not delete WAL/SHM files while a process is connected. Tests create isolated temporary
DBs and verify WAL backup, restoration contents, reopen, repeat, rollback, unknown
schemas, partial imports and exact progress timestamps; they never touch personal data.
