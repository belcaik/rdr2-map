import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function repositoryRoot() {
  if (process.env.APP_ROOT) return process.env.APP_ROOT;
  let current = __dirname;
  while (dirname(current) !== current) {
    if (
      existsSync(resolve(current, "schemas/dataset.schema.json")) &&
      existsSync(resolve(current, "frontend/package.json"))
    ) return current;
    current = dirname(current);
  }
  return process.cwd();
}
export const repoRoot = repositoryRoot();
const configuredPath = (value: string, fallback: string) =>
  value ? (value.startsWith("/") ? resolve(value) : resolve(process.cwd(), value)) : resolve(repoRoot, fallback);
export const configuration = () => ({
  dbPath: configuredPath(process.env.DB_PATH || "", "backend/data/rdr2.db"),
  dataRoot: configuredPath(process.env.DATA_ROOT || "", "data"),
  tilesRoot: configuredPath(process.env.TILES_DIR || "", "rdr2_extractor/data/tiles"),
  staticRoot: process.env.STATIC_ROOT ? configuredPath(process.env.STATIC_ROOT, "") : undefined,
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
});
