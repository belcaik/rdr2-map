import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDatabase, openDatabase } from "../src/db/schema";

export function legacy(filename: string) {
  const db = new Database(filename);
  db.exec(`CREATE TABLE categories (id INTEGER PRIMARY KEY,title TEXT NOT NULL,icon TEXT NOT NULL,group_id INTEGER,visible INTEGER DEFAULT 1);
  CREATE TABLE markers (id INTEGER PRIMARY KEY,name TEXT NOT NULL,category_id INTEGER NOT NULL,coord_x REAL NOT NULL,coord_y REAL NOT NULL,description TEXT,FOREIGN KEY(category_id) REFERENCES categories(id));
  CREATE TABLE user_progress (marker_id INTEGER PRIMARY KEY,found INTEGER DEFAULT 0,found_at TEXT,FOREIGN KEY(marker_id) REFERENCES markers(id));
  INSERT INTO categories VALUES (1,'Legacy','card',1,0);
  INSERT INTO markers VALUES(1001,'Repeated title',1,30,45,'**Legacy**'),(999,'Repeated title',1,40,50,NULL);
  INSERT INTO user_progress VALUES(1001,1,'2020-03-01T10:11:12Z'),(999,0,'2019-01-01');`);
  return db;
}

test("legacy migration preserves every value, backs up WAL, reopens and repeats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-migration-"));
  try {
    const filename = join(dir, "legacy.db");
    const original = legacy(filename);
    original.pragma("journal_mode = WAL");
    original
      .prepare("UPDATE markers SET name=? WHERE id=999")
      .run("Uncheckpointed");
    const beforeMarkers = original
      .prepare("SELECT * FROM markers ORDER BY id")
      .all();
    const beforeCategories = original
      .prepare("SELECT * FROM categories ORDER BY id")
      .all();
    const before = original
      .prepare("SELECT * FROM user_progress ORDER BY marker_id")
      .all();
    assert.throws(() => openDatabase(filename), /migrat/i);
    const report = await migrateDatabase(filename);
    assert.equal(report.before.digest, report.after.digest);
    assert.ok(report.backupPath);
    const backup = new Database(report.backupPath!, { readonly: true });
    assert.equal(
      (
        backup.prepare("SELECT name FROM markers WHERE id=999").get() as {
          name: string;
        }
      ).name,
      "Uncheckpointed",
    );
    assert.deepEqual(
      backup.prepare("SELECT * FROM user_progress ORDER BY marker_id").all(),
      before,
    );
    const restoredPath = join(dir, "restored.db");
    await backup.backup(restoredPath);
    const restored = new Database(restoredPath);
    assert.deepEqual(
      restored.prepare("SELECT * FROM user_progress ORDER BY marker_id").all(),
      before,
    );
    assert.equal(restored.pragma("user_version", { simple: true }), 0);
    restored.close();
    backup.close();
    original.close();
    const migrated = openDatabase(filename);
    assert.deepEqual(
      migrated
        .prepare(
          "SELECT id,name,category_id,coord_x,coord_y,description FROM markers ORDER BY id",
        )
        .all(),
      beforeMarkers,
    );
    assert.deepEqual(
      migrated
        .prepare(
          "SELECT id,title,icon,group_id,visible FROM categories ORDER BY id",
        )
        .all(),
      beforeCategories,
    );
    assert.deepEqual(
      migrated.prepare("SELECT * FROM user_progress ORDER BY marker_id").all(),
      before,
    );
    migrated.close();
    assert.equal((await migrateDatabase(filename)).status, "current");
    const fresh = openDatabase(join(dir, "fresh.db"));
    fresh.close();
    const unknown = new Database(join(dir, "unknown.db"));
    unknown.exec("CREATE TABLE secret(value TEXT)");
    unknown.close();
    await assert.rejects(migrateDatabase(join(dir, "unknown.db")), /Unknown/);
    const failurePath = join(dir, "failure.db");
    legacy(failurePath).close();
    await assert.rejects(
      migrateDatabase(failurePath, {
        beforeCommit: () => {
          throw new Error("controlled failure");
        },
      }),
      /controlled failure/,
    );
    const failed = new Database(failurePath);
    assert.equal(failed.pragma("user_version", { simple: true }), 0);
    assert.deepEqual(
      failed.prepare("SELECT * FROM user_progress ORDER BY marker_id").all(),
      before,
    );
    failed.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
