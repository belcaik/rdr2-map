import express from "express";
import cors from "cors";
import type Database from "better-sqlite3";
import type { Asset } from "../../shared/contract";
import { markersRouter } from "./routes/markers";
import { progressRouter } from "./routes/progress";
import { tilesRouter } from "./routes/tiles";
import { safeFile } from "./media/files";
export function createApp(
  db: Database.Database,
  dataRoot: string,
  tilesRoot: string,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "8kb" }));
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api/markers", markersRouter(db));
  app.use("/api/progress", progressRouter(db));
  app.use("/api/tiles", tilesRouter(tilesRoot));
  app.get("/api/assets/:id", async (req, res) => {
    const row = db
      .prepare("SELECT payload FROM assets WHERE id=?")
      .get(req.params.id) as { payload: string } | undefined;
    const item: Asset | undefined = row ? JSON.parse(row.payload) : undefined;
    if (!item || item.status !== "downloaded" || !item.path || !item.mime) {
      res.status(404).json({ error: "Local image unavailable" });
      return;
    }
    try {
      res
        .type(item.mime)
        .set("Cache-Control", "no-cache")
        .sendFile(await safeFile(dataRoot, item.path));
    } catch {
      res.status(404).json({ error: "Local image missing" });
    }
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", schemaVersion: 1 });
  });
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error.message);
      res.status(500).json({ error: "Internal server error" });
    },
  );
  return app;
}
