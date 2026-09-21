import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function repositoryRoot() {
  let current = __dirname;
  while (dirname(current) !== current) {
    if (
      existsSync(resolve(current, "schemas/dataset.schema.json")) &&
      existsSync(resolve(current, "frontend/package.json"))
    )
      return current;
    current = dirname(current);
  }
  throw new Error("Cannot locate repository root");
}
export const repoRoot = repositoryRoot();
export const configuration = () => ({
  dbPath: resolve(
    process.env.DB_PATH || resolve(repoRoot, "backend/data/rdr2.db"),
  ),
  dataRoot: resolve(process.env.DATA_ROOT || resolve(repoRoot, "data")),
  tilesRoot: resolve(
    process.env.TILES_DIR || resolve(repoRoot, "rdr2_extractor/data/tiles"),
  ),
});
