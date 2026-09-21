import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type Database from "better-sqlite3";
import { validateDataset } from "../../../shared/validate";
import type { Asset } from "../../../shared/contract";
import { installFiles } from "../media/files";

export async function importDataset(
  db: Database.Database,
  filename: string,
  root: string,
) {
  const data = validateDataset(JSON.parse(await readFile(filename, "utf8")));
  await installFiles(data, dirname(filename), root);
  db.transaction(() => {
    for (const map of data.maps)
      db.prepare(
        "INSERT INTO maps VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      ).run(map.id, JSON.stringify(map));
    for (const asset of data.assets) {
      const row = db
        .prepare("SELECT payload FROM assets WHERE id=?")
        .get(asset.id) as { payload: string } | undefined;
      if (
        row &&
        (JSON.parse(row.payload) as Asset).status === "downloaded" &&
        asset.status !== "downloaded"
      )
        continue;
      db.prepare(
        "INSERT INTO assets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      ).run(asset.id, JSON.stringify(asset));
    }
    for (const category of data.categories) {
      const old = db
        .prepare(
          "SELECT c.icon_asset_id,a.payload FROM categories c LEFT JOIN assets a ON a.id=c.icon_asset_id WHERE c.id=?",
        )
        .get(category.id) as
        { icon_asset_id: string | null; payload: string | null } | undefined;
      const next = category.iconAssetId
        ? (db
            .prepare("SELECT payload FROM assets WHERE id=?")
            .get(category.iconAssetId) as { payload: string } | undefined)
        : undefined;
      const retain =
        old?.payload &&
        (JSON.parse(old.payload) as Asset).status === "downloaded" &&
        (!next || (JSON.parse(next.payload) as Asset).status !== "downloaded");
      db.prepare(
        `INSERT INTO categories(id,title,icon,group_id,icon_asset_id,icon_reason,group_name) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET title=excluded.title,icon=excluded.icon,group_id=excluded.group_id,group_name=excluded.group_name,
   icon_asset_id=COALESCE(excluded.icon_asset_id,categories.icon_asset_id),icon_reason=CASE WHEN excluded.icon_asset_id IS NULL AND categories.icon_asset_id IS NOT NULL THEN categories.icon_reason ELSE excluded.icon_reason END`,
      ).run(
        category.id,
        category.name,
        category.iconName || "",
        category.groupId,
        retain ? old!.icon_asset_id : category.iconAssetId,
        retain ? null : category.iconReason,
        category.group,
      );
    }
    for (const point of data.waypoints) {
      const existing = db
        .prepare("SELECT image_discovery FROM markers WHERE id=?")
        .get(point.id) as { image_discovery: string } | undefined;
      const retain =
        existing?.image_discovery === "present" &&
        ["uninspected", "failed"].includes(point.imageDiscovery);
      db.prepare(
        `INSERT INTO markers(id,name,category_id,coord_x,coord_y,description,map_id,source_url,description_format,image_discovery,discovery_error) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,coord_x=excluded.coord_x,coord_y=excluded.coord_y,description=excluded.description,map_id=excluded.map_id,source_url=excluded.source_url,description_format=excluded.description_format,
    image_discovery=CASE WHEN ? THEN markers.image_discovery ELSE excluded.image_discovery END,discovery_error=CASE WHEN ? THEN markers.discovery_error ELSE excluded.discovery_error END`,
      ).run(
        point.id,
        point.title,
        point.categoryId,
        point.coordinates.x,
        point.coordinates.y,
        point.description,
        point.mapId,
        point.sourceUrl,
        point.descriptionFormat,
        point.imageDiscovery,
        point.discoveryError,
        Number(retain),
        Number(retain),
      );
      if (!retain) {
        db.prepare("DELETE FROM marker_images WHERE marker_id=?").run(point.id);
        for (const image of point.images)
          db.prepare("INSERT INTO marker_images VALUES(?,?,?,?,?)").run(
            point.id,
            image.assetId,
            image.order,
            image.caption,
            image.attribution,
          );
      }
    }
    db.prepare(
      "INSERT INTO import_runs(run_id,imported_at,payload) VALUES(?,?,?)",
    ).run(
      data.runId,
      new Date().toISOString(),
      JSON.stringify({
        source: data.source,
        coverage: data.coverage,
        extractedAt: data.extractedAt,
      }),
    );
  })();
  return {
    waypoints: data.waypoints.length,
    categories: data.categories.length,
    assets: data.assets.length,
    coverage: data.coverage,
  };
}
