# Dataset v1

The machine contract is `schemas/dataset.schema.json`; `npm run contracts` generates
TypeScript declarations. Python and TypeScript must validate schema and relationships.
Game ID is `rdr2`. Category and waypoint IDs remain positive safe integers, unchanged
from source and legacy SQLite. Progress identity is the waypoint ID, independent of
map/layer. Duplicate titles are never identity. Map IDs are strings (`"1"` for the
observed source map).

Coordinates preserve `x=latitude,y=longitude`, Leaflet EPSG3857, identity transform.
The existing local zoom 2–6 and XYZ JPEG tile route remain unchanged. Current source
supports more zoom levels; these are not silently imported into the local renderer.

Assets have distinct `category-icon` and `waypoint-image` kinds. Download state is
`pending/downloaded/failed`; discovery is `uninspected/none/present/failed`.
Downloaded paths are content-addressed `icons|images/<sha256>.png|jpg|webp`, with real
MIME, byte size and decoded dimensions. Paths are confined to the explicit data root.
Gallery relationships retain zero-based order, captions and attribution even when
files have identical content. Category `iconName` preserves the source token for
auditing, `groupId` the legacy group key and `group` the readable group name.

`coverage.complete` means waypoint enumeration only, for `scopeMapIds`. It does not
imply media or tile completion. `mediaComplete` and `tilesComplete` are independent.
The importer never deactivates absent data in v1, including on complete snapshots.
Uninspected enrichment must not erase known images or successfully downloaded assets.
All imports validate before mutation and merge maps/categories/assets by identity.

## API compatibility

Existing numeric IDs and snake_case marker/category/progress routes remain.
Categories add `icon_asset: Asset|null` and `icon_reason: string|null`.
Marker summaries add `category_icon_asset: Asset|null`, `icon_reason`,
`image_discovery`, `description_format`, `source_url` and `discovery_error`.
`GET /api/markers/:id` also returns `images: (Asset & {order,caption,attribution})[]`.
Media URLs are `/api/assets/:id`; remote source URLs are provenance, never image URLs.
Descriptions render through an allowlist sanitizer and omit embedded image tags;
the producer must extract their associations into the local gallery.

## Test boundaries

Agreed by the task: capture→dataset, dataset→SQLite/API, legacy→migrated DB,
asset→local HTTP and API→browser. Shared synthetic demo covers three symbols,
ordered and shared photos, none/uninspected/failed discovery, failed/pending download,
and unsafe Markdown/HTML. Real captures and personal progress are never fixtures.

API DTOs are shared by frontend/backend through `shared/api.ts`. For compatibility,
legacy SQLite visibility and GET-progress flags are 0/1; the progress update response
uses a boolean. Consumers accept this explicit union. Dataset identities and media
states remain strictly validated; this compatibility does not relax the dataset schema.
