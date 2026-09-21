import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  symlink,
  mkdir,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { installFiles } from "../src/media/files";
import { validateDataset } from "../../shared/validate";

test("all media are validated before publication and destination symlinks cannot escape", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-files-"));
  try {
    const source = join(dir, "source"),
      destination = join(dir, "destination"),
      outside = join(dir, "outside");
    execFileSync(process.execPath, ["scripts/demo.mjs", source], {
      cwd: resolve(__dirname, "../.."),
    });
    const data = validateDataset(
      JSON.parse(await readFile(join(source, "dataset.json"), "utf8")),
    );
    const last = data.assets.filter((a) => a.status === "downloaded").at(-1)!;
    const bytes = await readFile(join(source, last.path!));
    await writeFile(
      join(source, last.path!),
      Buffer.from("corrupt last photo"),
    );
    await assert.rejects(
      installFiles(data, source, destination),
      /hash mismatch/,
    );
    await assert.rejects(readdir(destination), { code: "ENOENT" });
    await writeFile(join(source, last.path!), bytes);
    await mkdir(outside);
    await mkdir(destination);
    await symlink(outside, join(destination, "icons"), "dir");
    await assert.rejects(installFiles(data, source, destination), /outside/);
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("wrong declared MIME or dimensions is rejected despite correct content hash", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rdr2-metadata-"));
  try {
    const source = join(dir, "source");
    execFileSync(process.execPath, ["scripts/demo.mjs", source], {
      cwd: resolve(__dirname, "../.."),
    });
    const data = validateDataset(
      JSON.parse(await readFile(join(source, "dataset.json"), "utf8")),
    );
    const badDimensions = structuredClone(data);
    badDimensions.assets[0].width = 123;
    await assert.rejects(
      installFiles(badDimensions, source, join(dir, "media")),
      /metadata mismatch/,
    );
    const badMime = structuredClone(data);
    badMime.assets[0].mime = "image/jpeg";
    await assert.rejects(
      installFiles(badMime, source, join(dir, "media")),
      /metadata mismatch/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
