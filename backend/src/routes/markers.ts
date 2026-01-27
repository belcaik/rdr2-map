import { Router } from "express";
import { getDb } from "../db";
import type { Category, MarkerWithCategory } from "../types";

const router = Router();

// GET /api/markers/categories - Get all categories with marker counts
// NOTE: This route MUST be before /:id to avoid "categories" being matched as an ID
router.get("/categories", (_req, res) => {
  const db = getDb();

  const categories = db
    .prepare(
      `
    SELECT
      c.id,
      c.title,
      c.icon,
      c.group_id,
      c.visible,
      COUNT(m.id) as marker_count
    FROM categories c
    LEFT JOIN markers m ON c.id = m.category_id
    GROUP BY c.id
    ORDER BY c.group_id, c.title
  `,
    )
    .all() as (Category & { marker_count: number })[];

  res.json(categories);
});

// GET /api/markers - Get all markers with category info
router.get("/", (_req, res) => {
  const db = getDb();

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
      c.title as category_title,
      c.icon as category_icon
    FROM markers m
    JOIN categories c ON m.category_id = c.id
    ORDER BY c.title, m.name
  `,
    )
    .all() as MarkerWithCategory[];

  res.json(markers);
});

// GET /api/markers/:id - Get single marker
router.get("/:id", (req, res) => {
  const db = getDb();
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
      c.title as category_title,
      c.icon as category_icon
    FROM markers m
    JOIN categories c ON m.category_id = c.id
    WHERE m.id = ?
  `,
    )
    .get(id) as MarkerWithCategory | undefined;

  if (!marker) {
    res.status(404).json({ error: "Marker not found" });
    return;
  }

  res.json(marker);
});

export default router;
