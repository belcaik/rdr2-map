# Migration decision (R02)

Recognized legacy schema: `categories(id,title,icon,group_id,visible)`,
`markers(id,name,category_id,coord_x,coord_y,description)` and
`user_progress(marker_id,found,found_at)`, user_version 0. Zero is not empty.
The audited working DB has 64 categories and 5,721 markers with recorded progress.

Create a consistent SQLite backup before real migration. Add metadata columns and
asset/map/image/import tables in a transaction; preserve original primary keys,
category visibility, marker values and every progress value/date. Compare ordered
values before and after, reopen, repeat, and reject unknown structures/versions.
Test on synthetic legacy DBs and a backup copy, never the personal original.

Startup initializes truly empty DBs; recognized legacy requires the explicit
migration command. The importer requires a dataset path, validates the entire
contract and files before mutation, and uses upserts. No import deletes progress or
deactivates absent points/categories/maps/assets. Existing known media survives
uninspected captures and unsuccessful download retries. Reset remains an explicit
independent API action. Operational commands will be in docs/migration.md.
