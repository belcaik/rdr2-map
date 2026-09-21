import { Router } from "express";
import type Database from "better-sqlite3";
import type { Asset } from "../../../shared/contract";
import type { Category, MarkerWithCategory } from "../types";

export function markersRouter(db: Database.Database) {
  const router = Router();
  const iconRows = db.prepare(
    "SELECT DISTINCT a.id,a.payload FROM assets a JOIN categories c ON c.icon_asset_id=a.id",
  );
  const iconsForRequest = () =>
    new Map(
      (iconRows.all() as { id: string; payload: string }[]).map((row) => [
        row.id,
        JSON.parse(row.payload) as Asset,
      ]),
    );
  const enrich = (
    row: MarkerWithCategory & { icon_asset_id: string | null },
    icons: Map<string, Asset>,
  ) => {
    const { icon_asset_id, ...result } = row;
    return {
      ...result,
      category_icon_asset: icon_asset_id
        ? (icons.get(icon_asset_id) ?? null)
        : null,
    };
  };

  // GET /api/markers/categories - Get all categories with marker counts
  // NOTE: This route MUST be before /:id to avoid "categories" being matched as an ID
  router.get("/categories", (_req, res) => {
    const categories = db
      .prepare(
        `
    SELECT
      c.id,
      c.title,
      c.icon,
      c.group_id,
      c.visible,
      c.icon_asset_id,
      c.icon_reason,
      COUNT(m.id) as marker_count
    FROM categories c
    LEFT JOIN markers m ON c.id = m.category_id
    GROUP BY c.id
    ORDER BY c.group_id, c.title
  `,
      )
      .all() as (Category & {
      marker_count: number;
      icon_asset_id: string | null;
    })[];

    const icons = iconsForRequest();
    res.json(
      categories.map((row) => {
        const { icon_asset_id, ...category } = row;
        return {
          ...category,
          icon_asset: icon_asset_id ? (icons.get(icon_asset_id) ?? null) : null,
        };
      }),
    );
  });

  // GET /api/markers - Get markers with optional filtering
  //   ?bbox=south,west,north,east   — bounding box in game coords (coord_x, coord_y)
  //   ?category_ids=1,2,3           — comma-separated category IDs
  //   ?limit=500&offset=0           — pagination
  router.get("/", (req, res) => {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Bounding box filter: ?bbox=south,west,north,east
    const bbox = req.query.bbox as string | undefined;
    if (bbox) {
      const parts = bbox.split(",").map(Number);
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        const [south, west, north, east] = parts;
        conditions.push("m.coord_x BETWEEN ? AND ?");
        params.push(south, north);
        conditions.push("m.coord_y BETWEEN ? AND ?");
        params.push(west, east);
      }
    }

    // Category filter: ?category_ids=1,2,3
    const categoryIds = req.query.category_ids as string | undefined;
    if (categoryIds) {
      const ids = categoryIds
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (ids.length > 0) {
        conditions.push(`m.category_id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Pagination: ?limit=N&offset=M
    let limitClause = "";
    const limit = parseInt(req.query.limit as string, 10);
    const offset = parseInt(req.query.offset as string, 10);
    if (!isNaN(limit) && limit > 0) {
      limitClause = ` LIMIT ?`;
      params.push(limit);
      if (!isNaN(offset) && offset > 0) {
        limitClause += ` OFFSET ?`;
        params.push(offset);
      }
    }

    const markers = db
      .prepare(
        `
    SELECT
      m.id,
      m.name,
      m.category_id,
      m.coord_x,
      m.coord_y,
      m.description,
      m.map_id,m.source_url,m.description_format,m.image_discovery,m.discovery_error,
      c.icon_asset_id,c.icon_reason,
      c.title as category_title,
      c.icon as category_icon
    FROM markers m
    JOIN categories c ON m.category_id = c.id
    ${where}
    ORDER BY c.title, m.name
    ${limitClause}
  `,
      )
      .all(...params) as (MarkerWithCategory & {
      icon_asset_id: string | null;
    })[];

    const icons = iconsForRequest();
    res.json(markers.map((row) => enrich(row, icons)));
  });

  // GET /api/markers/:id - Get single marker
  router.get("/:id", (req, res) => {
    const { id } = req.params;

    const marker = db
      .prepare(
        `
    SELECT
      m.id,
      m.name,
      m.category_id,
      m.coord_x,
      m.coord_y,
      m.description,
      m.map_id,m.source_url,m.description_format,m.image_discovery,m.discovery_error,
      c.icon_asset_id,c.icon_reason,
      c.title as category_title,
      c.icon as category_icon
    FROM markers m
    JOIN categories c ON m.category_id = c.id
    WHERE m.id = ?
  `,
      )
      .get(id) as
      (MarkerWithCategory & { icon_asset_id: string | null }) | undefined;

    if (!marker) {
      res.status(404).json({ error: "Marker not found" });
      return;
    }

    const images = (
      db
        .prepare(
          "SELECT a.payload,mi.position,mi.caption,mi.attribution FROM marker_images mi JOIN assets a ON a.id=mi.asset_id WHERE mi.marker_id=? ORDER BY mi.position",
        )
        .all(id) as {
        payload: string;
        position: number;
        caption: string | null;
        attribution: string | null;
      }[]
    ).map((row) => ({
      ...JSON.parse(row.payload),
      order: row.position,
      caption: row.caption,
      attribution: row.attribution,
    }));
    res.json({ ...enrich(marker, iconsForRequest()), images });
  });

  return router;
}
