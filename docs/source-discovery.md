# RDR2 source discovery

Inspected 2026-09-21 with ordinary headless Chrome and Selenium. No stealth, login,
proxy, cookie import or protection bypass was used. Search access reported a robots
restriction; the ordinary browser returned HTTP 200 and displayed the public map.
Temporary research evidence is `/tmp/rdr2-source-audit/` (not committed): capture.json,
window.json, locations.json, sprite.json, responses.json, details.json and screenshots
`detail-743.png`, `detail-56.png`, `detail-91.png`. These are local evidence, not fixtures.

## Data and coverage

The observed response is `https://rdr2map.com/api/v1/maps/1/data`.
`window.mapData` supplies map, categories, groups and configuration; the response
contains the location array including media. No pagination or additional detail
request was observed for the checked locations. Extraction consumes the full response,
not rendered markers or the viewport. Source numeric IDs remain numeric and unchanged.

The response contained 6,149 locations and 74 categories. Counts for all 64 nonpremium
categories agree with their returned locations. Ten premium categories (558–567)
state another 750 locations but return none in the public response. No attempt was
made to obtain protected data. `coverage.complete` is false; omissions enumerate
these differences. A sample is also explicitly partial. Photo/tile completion is
independent from waypoint enumeration.

The existing January 2026 capture in the legacy extractor contains 5,721 locations,
including original media arrays. Earlier extraction discarded these associations.
`--legacy-capture` can normalize those original records while using a current
verified sprite capture. Titles are not identities: Armadillo has IDs 681 and 5022;
Saint Denis includes IDs 682, 5012 and 5001.

## Symbols

Observed CSS: `https://cdn.mapgenie.io/css/themes/icons/rdr2-icons.css` with a cache
query. Filter symbols use icomoon from `https://cdn.mapgenie.io/fonts/rdr2/icons/icomoon.ttf`.
Computed `::before` values include bounty U+E97B, cigarette_card U+E973 and bone U+E97C.
The map independently loads a sprite and rectangle manifest:

- `https://media.mapgenie.io/v2/assets/prod/games/rdr2/markers/markers.png?v=1`
- `https://media.mapgenie.io/v2/assets/prod/games/rdr2/markers/markers.json?v=1`

All 74 category.icon names have manifest entries. The producer crops these observed
rectangles to local PNG files; it does not bundle remote CSS or substitute emoji.
Typical markers are 33×44 pixels, pixelRatio 1. `cigarette_card` is x33,y0,w33,h44;
`bounty` is x0,y0,w33,h44. Source URLs and sprite rectangles remain in asset metadata.
The `.png` sprite URL actually returned WebP. Decoded content determines local MIME
and extension. Photos remain their original valid JPEG/WebP/PNG encoding.

## Photos and descriptions

Locations include `media[]`: id, type, URL, MIME hint, title, attribution and order.
All 414 media URLs in this capture use `media.mapgenie.io/storage/media/`.
5,741 points have an empty array, 402 have one item, and six have two. Empty arrays
mean inspected/no photos; an absent array means uninspected. Invalid arrays record
failed discovery. Unsupported media types are reported. Icon fields never become photos.

| Category / symbol | Waypoint | Media | Browser detail evidence |
| --- | --- | --- | --- |
| Cigarette Card / cigarette_card | Blazing Star, 743 | 82008 | One matching img; formatted set, link and reward list |
| Dinosaur Bone / bone | Dinosaur Bone #6, 56 | 81495, 81496 | Two matching img elements in array order |
| Bounty Poster / bounty | Ellie Anne Swan, 91 | none | Empty media array and no popup img |

Blazing Star was identified from current data, not inferred from a previous screenshot.
Its photograph URL is `https://media.mapgenie.io/storage/media/26867457-32f0-470e-abdd-146c67cee395.jpg`.
The inspected popups had no srcset or data-src; media loaded when details opened.
The synthetic fixture separately tests relative URLs, HTML data-src/srcset and Markdown
images. Their gallery association goes through the same local pipeline; UI rendering
must strip embedded images to prevent remote requests. Media order ties preserve source
array order. Captions and attribution remain attached to relationships even when files
are deduplicated by content.

## Coordinates and tiles

Map ID1, slug rdr2. Coordinates are artificial web map latitude/longitude, not Earth
positions or native game xyz. The contract retains x=latitude,y=longitude with identity
transform and EPSG3857. This preserves the current local implementation.

Observed MapLibre raster sources use tileSize256 and XYZ with templates:

- `https://tiles.mapgenie.io/games/rdr2/world/atlas-v1/{z}/{x}/{y}.jpg` (Default)
- `https://tiles.mapgenie.io/games/rdr2/world/atlas-dark-v1/{z}/{x}/{y}.jpg` (Detailed)

Map configuration min_zoom2, max_zoom8, tiles_max_zoom7. Bounds exist for z1–7 only;
max_zoom8 must not be used as a tile bounds key. Resolved MapLibre sources report
minzoom1/maxzoom7; their raster bounds are [-180,-85,180,85]. Existing local zoom2–6,
JPEG tile route and Default layer are preserved. No tiles are required or downloaded
by media enrichment. The existing tile downloader remains the tile-only maintenance
flow; the new pipeline is the canonical dataset/media producer.

| Visual control | ID | latitude | longitude |
| --- | --- | --- | --- |
| Mount Hagen | 158 | 70.013991991023 | -14.586833384272 |
| Armadillo | 681 | -15.693781231569 | -79.335021972655 |
| Saint Denis | 682 | 19.099610666803 | 110.58709473844 |
| Blazing Star | 743 | 59.444726031317 | -39.605712890625 |
| Dinosaur Bone #6 | 56 | 63.906817407694 | 77.750141323223 |

These are source controls for local visual QA, not a claim that all points have been
visually validated. No new calibrated transform is introduced.

## Reproducing extraction and enrichment

From repository root, with the pipeline dependencies installed:

```sh
python -m rdr2_extractor.pipeline --output data/sample --sample 6
python -m rdr2_extractor.pipeline --capture data/sample/capture.json --output data/all-public --sample 0 --phase normalize
python -m rdr2_extractor.pipeline --output data/sample --resume
python -m rdr2_extractor.pipeline --output data/sample --phase validate
python -m unittest discover -s rdr2_extractor/tests
```

The default six points include the three photo cases and three separated controls.
The actual sample downloaded 74 category icons and five photos with no failures,
2,737,989 bytes in distinct files; zero tiles were downloaded. Coverage was partial,
mediaComplete true, tilesComplete false. Downloads are serialized, bounded to 20 MiB
per encoded file and 40 million decoded pixels, with timeout, bounded retries,
Retry-After and atomic replacement. Resume verifies content hashes and decoded
metadata, repairs corrupt files and skips good files. SVG is rejected rather than
introducing remote script content. URLs must use observed public HTTPS hosts;
redirects are rejected. The app serves downloaded files locally.

The extractor architecture and media/browser primitives adapt GTA V Map commit
72d14e715cef67d3a0098c36380d480bdfe1a91f, under MIT copyright 2025 belcaik.
RDR2 source IDs, hosts, sprite locations, coordinates and coverage were independently
inspected. GTA-specific endpoints, layer assumptions and universal PNG conversion
were not ported. Code licensing does not grant redistribution rights to source assets.

## Observed scale and storage

Normalizing and validating the full 6,149-point public capture took 3.458 seconds
in this environment (single measured run, including Python JSON Schema relationship
checks, excluding source capture/network). It produced 488 asset records without
downloading the full photo set. No application response-time guarantee follows from
this producer measurement. The five sample photos remained JPEG, 238,771–970,625
bytes each, from 1919×1079 through 2560×1440; no PNG expansion or thumbnails were needed.
Full-dataset photo disk use remains unmeasured. Icons require one downloaded sprite
per run and local crops; resume uses already validated local files.

The canonical `--phase discover` CLI was also executed successfully, producing a
fresh capture with 6,149 points. Legacy enrichment normalization was exercised on
the existing January capture: 5,721 points and 317 photo relationships preserved;
73 symbols resolve against the current sprite. Legacy category 1462 has an obsolete
symbol token with no matching current sprite and retains an explicit fallback reason.
Legacy category counts were absent, so enumeration remains unverified/partial.

Independent review added regression coverage for missing Content-Type, oversized
image headers and icon fallbacks: these produce explicit failures and cannot claim
complete media. Browser fetches use an abort timer before the Selenium script timeout.
Dataset checkpoints are batched every 25 changed assets, with a final flush on normal
completion or Python interruption. A forced process kill can require retrying up to 24
recent downloads; content-addressed files remain safe and progress is never touched.

A checkpoint benchmark used the actual 6,149-waypoint/488-asset dataset shape with
synthetic image bytes and a temporary output root: 20 checkpoint writes totaling
61,135,646 bytes in 26.57 seconds under concurrent test load. The previous per-asset
strategy would rewrite at least 1,473,570,656 bytes for that shape. This benchmark
measures checkpoint/storage behavior, not full live extraction speed.
