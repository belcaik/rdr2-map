import { Router } from "express";
import { readFile } from "node:fs/promises";
import { safeFile } from "../media/files";
export function tilesRouter(root: string) {
  const router = Router();
  router.get("/info", async (_req, res) => {
    try {
      res.json(
        JSON.parse(
          await readFile(await safeFile(root, "tile_index.json"), "utf8"),
        ),
      );
    } catch {
      res.json({ format: "jpg", minZoom: 2, maxZoom: 6 });
    }
  });
  router.get("/:z/:x/:y.jpg", async (req, res) => {
    const { z, x, y } = req.params;
    if (![z, x, y].every((value) => /^\d+$/.test(value)) || Number(z) > 22) {
      res.sendStatus(404);
      return;
    }
    try {
      const file = await safeFile(root, `zoom_${z}/${x}_${y}.jpg`);
      res
        .set("Cache-Control", "public, max-age=86400")
        .type("jpeg")
        .sendFile(file);
    } catch {
      res.status(404).json({ error: "Tile not found" });
    }
  });
  return router;
}
