import express from "express";
import cors from "cors";
import { extname, join } from "node:path";
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
  staticRoot?: string,
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
    try {
      const result = db.prepare("SELECT 1 AS ready").get() as { ready: number };
      if (result.ready !== 1) throw new Error("database is not ready");
      res.json({ status: "ok", database: "ready", schemaVersion: 1 });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });
  if (staticRoot) {
    app.use("/assets", express.static(join(staticRoot, "assets")));
    app.use(express.static(staticRoot));
    app.get("*", (req, res, next) => {
      if (extname(req.path) || ["/api", "/assets", "/tiles"].some((prefix) => req.path === prefix || req.path.startsWith(prefix + "/"))) {
        next();
        return;
      }
      res.sendFile(join(staticRoot, "index.html"), (error) => error && next(error));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
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
