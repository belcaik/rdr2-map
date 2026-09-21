import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const legacyColumns: Record<string, string[]> = {
  categories: ["id", "title", "icon", "group_id", "visible"],
  markers: ["id", "name", "category_id", "coord_x", "coord_y", "description"],
  user_progress: ["marker_id", "found", "found_at"],
};
const legacyTypes: Record<string, string[]> = {
  categories: ["INTEGER", "TEXT", "TEXT", "INTEGER", "INTEGER"],
  markers: ["INTEGER", "TEXT", "INTEGER", "REAL", "REAL", "TEXT"],
  user_progress: ["INTEGER", "INTEGER", "TEXT"],
};
const addedColumns: Record<string, string[]> = {
  categories: ["icon_asset_id", "icon_reason", "group_name"],
  markers: [
    "map_id",
    "source_url",
    "description_format",
    "image_discovery",
    "discovery_error",
  ],
};
function structure(db: Database.Database): "empty" | "legacy" | "current" {
  const version = db.pragma("user_version", { simple: true });
  const tables = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[]
  )
    .map((x) => x.name)
    .sort();
  if (version === 0 && tables.length === 0) return "empty";
  const expected = Object.keys(legacyColumns)
    .concat(
      version === 1 ? ["assets", "maps", "marker_images", "import_runs"] : [],
    )
    .sort();
  if (
    (version !== 0 && version !== 1) ||
    JSON.stringify(tables) !== JSON.stringify(expected)
  )
    throw new Error("Unknown database schema; refusing migration");
  for (const [table, columns] of Object.entries(legacyColumns)) {
    const actual = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
      type: string;
      pk: number;
    }[];
    const names = columns.concat(
      version === 1 ? addedColumns[table] || [] : [],
    );
    if (
      JSON.stringify(actual.map((x) => x.name)) !== JSON.stringify(names) ||
      actual.some(
        (column, index) =>
          index < columns.length && column.type !== legacyTypes[table][index],
      ) ||
      actual[0].pk !== 1
    )
      throw new Error("Unknown database schema: " + table);
  }
  if (version === 1) {
    const expectedColumns: Record<string, string[]> = {
      assets: ["id", "payload"],
      maps: ["id", "payload"],
      marker_images: [
        "marker_id",
        "asset_id",
        "position",
        "caption",
        "attribution",
      ],
      import_runs: ["id", "run_id", "imported_at", "payload"],
    };
    for (const [table, names] of Object.entries(expectedColumns)) {
      const actual = (
        db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      ).map((column) => column.name);
      if (JSON.stringify(actual) !== JSON.stringify(names))
        throw new Error("Unknown database schema: " + table);
    }
  }
  if ((db.pragma("foreign_key_check") as unknown[]).length)
    throw new Error("Database has invalid foreign keys");
  return version === 1 ? "current" : "legacy";
}
export function legacySnapshot(db: Database.Database) {
  const rows = Object.fromEntries(
    Object.entries(legacyColumns).map(([table, columns]) => [
      table,
      db
        .prepare(
          `SELECT ${columns.join(",")} FROM ${table} ORDER BY ${columns[0]}`,
        )
        .all(),
    ]),
  );
  return {
    counts: Object.fromEntries(
      Object.entries(rows).map(([key, value]) => [key, value.length]),
    ),
    digest: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
  };
}
function createLegacy(db: Database.Database) {
  db.exec(`CREATE TABLE categories(id INTEGER PRIMARY KEY,title TEXT NOT NULL,icon TEXT NOT NULL,group_id INTEGER,visible INTEGER DEFAULT 1);
    CREATE TABLE markers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category_id INTEGER NOT NULL,coord_x REAL NOT NULL,coord_y REAL NOT NULL,description TEXT,FOREIGN KEY(category_id) REFERENCES categories(id));
    CREATE TABLE user_progress(marker_id INTEGER PRIMARY KEY,found INTEGER DEFAULT 0,found_at TEXT,FOREIGN KEY(marker_id) REFERENCES markers(id));`);
}
function addMedia(db: Database.Database) {
  db.exec(`CREATE TABLE assets(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE maps(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
    ALTER TABLE categories ADD COLUMN icon_asset_id TEXT REFERENCES assets(id);
    ALTER TABLE categories ADD COLUMN icon_reason TEXT DEFAULT 'Legacy category icon has not been inspected';
    ALTER TABLE categories ADD COLUMN group_name TEXT;
    ALTER TABLE markers ADD COLUMN map_id TEXT NOT NULL DEFAULT '1';
    ALTER TABLE markers ADD COLUMN source_url TEXT;
    ALTER TABLE markers ADD COLUMN description_format TEXT NOT NULL DEFAULT 'markdown';
    ALTER TABLE markers ADD COLUMN image_discovery TEXT NOT NULL DEFAULT 'uninspected';
    ALTER TABLE markers ADD COLUMN discovery_error TEXT;
    UPDATE markers SET source_url='https://rdr2map.com/?locationIds=' || id;
    CREATE TABLE marker_images(marker_id INTEGER NOT NULL REFERENCES markers(id),asset_id TEXT NOT NULL REFERENCES assets(id),position INTEGER NOT NULL,caption TEXT,attribution TEXT,PRIMARY KEY(marker_id,position));
    CREATE TABLE import_runs(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL,imported_at TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_markers_category ON markers(category_id);
    CREATE INDEX IF NOT EXISTS idx_progress_found ON user_progress(found);
    PRAGMA user_version=1;`);
}
function connect(filename: string) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("foreign_keys=ON");
  db.pragma("busy_timeout=5000");
  return db;
}
export function openDatabase(filename: string): Database.Database {
  const db = connect(filename);
  try {
    const kind = structure(db);
    if (kind === "legacy")
      throw new Error(
        "Legacy database requires explicit migration: npm run migrate -- --db " +
          filename,
      );
    if (kind === "empty")
      db.transaction(() => {
        createLegacy(db);
        addMedia(db);
      })();
    db.pragma("journal_mode=WAL");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
export async function migrateDatabase(
  filename: string,
  options: { beforeCommit?: () => void } = {},
) {
  const db = connect(filename);
  try {
    const kind = structure(db);
    if (kind === "empty") {
      db.transaction(() => {
        createLegacy(db);
        addMedia(db);
      })();
      const snapshot = legacySnapshot(db);
      return {
        status: "created",
        backupPath: null,
        before: snapshot,
        after: snapshot,
      };
    }
    const before = legacySnapshot(db);
    if (kind === "current")
      return { status: "current", backupPath: null, before, after: before };
    const backupPath =
      filename +
      ".backup-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      randomUUID() +
      ".sqlite";
    await db.backup(backupPath);
    const backup = new Database(backupPath, { readonly: true });
    try {
      if (legacySnapshot(backup).digest !== before.digest)
        throw new Error(
          "Database changed during backup; stop the application and retry",
        );
    } finally {
      backup.close();
    }
    const after = db
      .transaction(() => {
        if (legacySnapshot(db).digest !== before.digest)
          throw new Error(
            "Database changed before migration; stop the application and retry",
          );
        addMedia(db);
        options.beforeCommit?.();
        const snapshot = legacySnapshot(db);
        if (snapshot.digest !== before.digest)
          throw new Error("Migration changed legacy data; rolled back");
        if ((db.pragma("foreign_key_check") as unknown[]).length)
          throw new Error("Migration foreign key failure");
        return snapshot;
      })
      .immediate();
    return { status: "migrated", backupPath, before, after };
  } finally {
    db.close();
  }
}
