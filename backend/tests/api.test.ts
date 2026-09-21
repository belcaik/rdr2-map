import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { openDatabase } from "../src/db/schema";
import { importDataset } from "../src/db/importer";
import { createApp } from "../src/app";
import { safeFile } from "../src/media/files";

test("API retains partial scope, local MIME and ordered associations; rejects corrupt assets and escapes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-api-"));
  const db = openDatabase(join(dir, "map.db"));
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  try {
    const source = join(dir, "source"),
      root = join(dir, "media"),
      filename = join(source, "dataset.json");
    execFileSync(process.execPath, ["scripts/demo.mjs", source], {
      cwd: resolve(__dirname, "../.."),
    });
    const original = JSON.parse(await readFile(filename, "utf8"));
    await importDataset(db, filename, root);
    server = createApp(db, root, join(dir, "tiles")).listen(0, "127.0.0.1");
    await new Promise<void>((done) => server!.once("listening", done));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = "http://127.0.0.1:" + address.port;
    const json = async (path: string) =>
      fetch(base + path).then((r) => r.json());
    const detail = await json("/api/markers/1001");
    assert.deepEqual(
      detail.images.map((a: any) => a.id),
      ["photo-one", "photo-two"],
    );
    assert.equal(detail.category_icon_asset.id, "icon-card");
    const categories = await json("/api/markers/categories");
    assert.equal(categories[0].icon_asset.kind, "category-icon");
    assert.equal(
      (await json("/api/markers?bbox=29,44,31,46&category_ids=1&limit=1"))
        .length,
      1,
    );
    assert.equal(
      (
        await fetch(base + "/api/progress/1001", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"found":true}',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/progress/1001", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"found":"false"}',
        })
      ).status,
      400,
    );
    for (const [id, mime] of [
      ["icon-card", "image/png"],
      ["photo-one", "image/jpeg"],
      ["photo-two", "image/webp"],
    ])
      assert.equal(
        (await fetch(base + "/api/assets/" + id)).headers.get("content-type"),
        mime,
      );
    const beforeAsset = await fetch(base + "/api/assets/icon-card");
    assert.equal(beforeAsset.headers.get("cache-control"), "no-cache");
    const partial = structuredClone(original);
    partial.assets[0].sourceUrl = "https://rdr2map.com/synthetic/updated-icon";
    partial.waypoints = partial.waypoints.slice(0, 1);
    partial.categories = partial.categories.slice(0, 1);
    await writeFile(filename, JSON.stringify(partial));
    await importDataset(db, filename, root);
    assert.equal((await json("/api/markers/categories")).length, 3);
    const refreshed = await json("/api/markers/1001");
    assert.equal(
      refreshed.category_icon_asset.sourceUrl,
      "https://rdr2map.com/synthetic/updated-icon",
    );
    assert.equal((await json("/api/markers")).length, 8);
    assert.equal((await json("/api/progress"))[0].marker_id, 1001);
    const image = original.assets.find((a: any) => a.id === "photo-two");
    await rm(join(root, image.path));
    assert.equal((await fetch(base + "/api/assets/photo-two")).status, 404);
    assert.equal((await fetch(base + "/api/assets/photo-failed")).status, 404);
    await symlink("/etc/passwd", join(root, "escape"));
    await assert.rejects(safeFile(root, "escape"), /outside/);
    await assert.rejects(safeFile(root, "../source/dataset.json"), /outside/);
    const bad = structuredClone(original),
      asset = bad.assets[0],
      html = Buffer.from("<html>not an image</html>");
    asset.sha256 = createHash("sha256").update(html).digest("hex");
    asset.path = "icons/" + asset.sha256 + ".png";
    asset.bytes = html.length;
    await writeFile(join(source, asset.path), html);
    await writeFile(filename, JSON.stringify(bad));
    await assert.rejects(importDataset(db, filename, root));
    assert.equal(
      (db.prepare("SELECT count(*) n FROM import_runs").get() as { n: number })
        .n,
      2,
    );
    await writeFile(
      join(source, original.assets[0].path),
      Buffer.from("corrupt"),
    );
    await writeFile(filename, JSON.stringify(original));
    await assert.rejects(importDataset(db, filename, root), /hash mismatch/);
    assert.equal(
      (await fetch(base + "/api/progress/reset", { method: "POST" })).status,
      200,
    );
    assert.deepEqual(await json("/api/progress"), []);
  } finally {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
