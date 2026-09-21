import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function repositoryRoot() {
  let current = __dirname;
  while (dirname(current) !== current) {
    if (existsSync(resolve(current, "schemas/dataset.schema.json"))) return current;
    current = dirname(current);
  }
  return process.cwd();
}
export const repoRoot = repositoryRoot();
const fromRoot = (value: string) => resolve(repoRoot, value);
export const configuration = () => ({
  dbPath: fromRoot(process.env.DB_PATH || "backend/data/rdr2.db"),
  dataRoot: fromRoot(process.env.DATA_ROOT || "data"),
  tilesRoot: fromRoot(process.env.TILES_DIR || "rdr2_extractor/data/tiles"),
  staticRoot: process.env.STATIC_ROOT ? fromRoot(process.env.STATIC_ROOT) : undefined,
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
});
