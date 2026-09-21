import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { openDatabase } from "../src/db/schema";
import { importDataset } from "../src/db/importer";

test("repeat and partial imports retain progress, categories, media and reject invalid input atomically", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-import-"));
  try {
    execFileSync(process.execPath, ["scripts/demo.mjs", join(dir, "source")], {
      cwd: resolve(__dirname, "../.."),
    });
    const file = join(dir, "source/dataset.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    const db = openDatabase(join(dir, "map.db"));
    await importDataset(db, file, join(dir, "media"));
    db.prepare("INSERT INTO user_progress VALUES(1001,1,?)").run("2020-01-01");
    await importDataset(db, file, join(dir, "media"));
    const partial = structuredClone(data);
    partial.waypoints = partial.waypoints.slice(0, 1);
    partial.categories = partial.categories.slice(0, 1);
    partial.waypoints[0].images = [];
    partial.waypoints[0].imageDiscovery = "uninspected";
    await writeFile(file, JSON.stringify(partial));
    await importDataset(db, file, join(dir, "media"));
    assert.deepEqual(db.prepare("SELECT * FROM user_progress").get(), {
      marker_id: 1001,
      found: 1,
      found_at: "2020-01-01",
    });
    assert.equal(
      (db.prepare("SELECT count(*) n FROM markers").get() as { n: number }).n,
      8,
    );
    assert.equal(
      (db.prepare("SELECT count(*) n FROM categories").get() as { n: number })
        .n,
      3,
    );
    assert.equal(
      (
        db
          .prepare("SELECT count(*) n FROM marker_images WHERE marker_id=1001")
          .get() as { n: number }
      ).n,
      2,
    );
    partial.waypoints[0].categoryId = 999;
    await writeFile(file, JSON.stringify(partial));
    await assert.rejects(importDataset(db, file, join(dir, "media")), /Orphan/);
    assert.equal(
      (db.prepare("SELECT count(*) n FROM import_runs").get() as { n: number })
        .n,
      3,
    );
    db.close();
    const reopened = openDatabase(join(dir, "map.db"));
    assert.equal(
      (
        reopened.prepare("SELECT found_at FROM user_progress").get() as {
          found_at: string;
        }
      ).found_at,
      "2020-01-01",
    );
    reopened.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("database failure rolls back earlier category, asset and waypoint updates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-rollback-"));
  const db = openDatabase(join(dir, "map.db"));
  try {
    execFileSync(process.execPath, ["scripts/demo.mjs", join(dir, "source")], {
      cwd: resolve(__dirname, "../.."),
    });
    const file = join(dir, "source/dataset.json");
    await importDataset(db, file, join(dir, "media"));
    const data = JSON.parse(await readFile(file, "utf8"));
    data.categories[0].name = "Must roll back";
    data.waypoints[0].title = "Must roll back";
    db.exec(
      "CREATE TRIGGER fail_import BEFORE UPDATE ON markers WHEN NEW.id=1002 BEGIN SELECT RAISE(ABORT,'controlled import failure'); END;",
    );
    await writeFile(file, JSON.stringify(data));
    await assert.rejects(
      importDataset(db, file, join(dir, "media")),
      /controlled import failure/,
    );
    assert.equal(
      (
        db.prepare("SELECT title FROM categories WHERE id=1").get() as {
          title: string;
        }
      ).title,
      "Card",
    );
    assert.equal(
      (
        db.prepare("SELECT name FROM markers WHERE id=1001").get() as {
          name: string;
        }
      ).name,
      "Two photographs",
    );
    assert.equal(
      (db.prepare("SELECT count(*) n FROM import_runs").get() as { n: number })
        .n,
      1,
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("failed enrichment retains downloaded assets and gallery; layer change retains progress identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-enrichment-"));
  const db = openDatabase(join(dir, "map.db"));
  try {
    execFileSync(process.execPath, ["scripts/demo.mjs", join(dir, "source")], {
      cwd: resolve(__dirname, "../.."),
    });
    const file = join(dir, "source/dataset.json");
    await importDataset(db, file, join(dir, "media"));
    db.prepare("INSERT INTO user_progress VALUES(1001,1,?)").run("2020-01-01");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.maps[0].id = "visual-layer";
    data.coverage.scopeMapIds = ["visual-layer"];
    for (const point of data.waypoints) point.mapId = "visual-layer";
    data.waypoints[0].images = [];
    data.waypoints[0].imageDiscovery = "failed";
    data.waypoints[0].discoveryError = "timeout";
    for (const asset of data.assets)
      Object.assign(asset, { status: "failed", path: null, error: "timeout" });
    await writeFile(file, JSON.stringify(data));
    await importDataset(db, file, join(dir, "media"));
    assert.equal(
      JSON.parse(
        (
          db
            .prepare("SELECT payload FROM assets WHERE id='photo-one'")
            .get() as { payload: string }
        ).payload,
      ).status,
      "downloaded",
    );
    assert.equal(
      (
        db
          .prepare("SELECT count(*) n FROM marker_images WHERE marker_id=1001")
          .get() as { n: number }
      ).n,
      2,
    );
    assert.equal(
      (
        db.prepare("SELECT map_id FROM markers WHERE id=1001").get() as {
          map_id: string;
        }
      ).map_id,
      "visual-layer",
    );
    assert.deepEqual(db.prepare("SELECT * FROM user_progress").get(), {
      marker_id: 1001,
      found: 1,
      found_at: "2020-01-01",
    });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
