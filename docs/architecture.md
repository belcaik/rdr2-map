# Architecture

`rdr2_extractor.pipeline` owns capture, normalization, bounded media downloads,
validation and export. Its modules are `browser`, `normalize`, `media`, `contract`.
The old extractor entrypoint only retains the independent tile download operation.
Media enrichment neither downloads nor replaces existing tiles.

`schemas/dataset.schema.json` is the cross-language boundary. Generated declarations
live beside it; `shared/validate.ts` and `rdr2_extractor/contract.py` enforce relations.
Source identities survive unchanged as numeric IDs. A map is presentation metadata,
not part of progress identity.

Backend `db/schema.ts` recognizes and migrates legacy schemas; `db/importer.ts`
validates then merges metadata and galleries transactionally. `media/files.ts`
verifies file confinement, encoding, hash and dimensions. `app.ts` composes injected
DB/data/tile routes for isolated tests. Runtime defaults and environment overrides
are in `config.ts`; no network fetch is needed to serve downloaded media.

Frontend responsibilities are `map`, `categories`, `detail` and `progress`.
The map retains a single canvas, filters by viewport and caches category images.
A keyboard-searchable waypoint list is an alternative to pointer selection.
Details load on selection, with an identity-keyed gallery and native modal dialog.
The sanitized description omits inline image tags; extracted images use the gallery.
Category counts are computed in one pass over markers, not once per category.

There is one local progress store, without accounts, cloud or AI services. API and
web processes bind locally; generated/legacy data can be located independently
with DB_PATH, DATA_ROOT and TILES_DIR. Tests never use the default personal DB.
