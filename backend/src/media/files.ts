import {
  readFile,
  realpath,
  mkdir,
  writeFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Dataset } from "../../../shared/contract";

export async function safeFile(root: string, relative: string) {
  if (
    relative.startsWith("/") ||
    relative.split(/[\\/]/).some((part) => part === ".." || part === "")
  )
    throw new Error("Path outside data root");
  const base = await realpath(root),
    target = await realpath(resolve(base, relative));
  if (!target.startsWith(base + sep)) throw new Error("Path outside data root");
  return target;
}
export async function installFiles(
  data: Dataset,
  source: string,
  target: string,
) {
  const files = [...data.assets, ...data.tiles].filter(
    (a) => a.status === "downloaded",
  );
  // Verify the whole batch before publishing any file or changing SQLite.
  for (const item of files) {
    const filename = await safeFile(source, item.path!);
    if ((await stat(filename)).size > 20 * 1024 * 1024)
      throw new Error("Image exceeds 20 MiB");
    const bytes = await readFile(filename);
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
      throw new Error("Image hash mismatch");
    const decoder = sharp(bytes, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
    });
    const metadata = await decoder.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || ""))
      throw new Error("Unsupported image encoding");
    await decoder.raw().toBuffer();
    if (
      "mime" in item &&
      (item.mime !== "image/" + metadata.format ||
        item.bytes !== bytes.length ||
        item.width !== metadata.width ||
        item.height !== metadata.height)
    )
      throw new Error("Image metadata mismatch");
    if (
      !("mime" in item) &&
      (metadata.format !== "jpeg" ||
        metadata.width !== 256 ||
        metadata.height !== 256)
    )
      throw new Error("Expected 256px JPEG tile");
  }
  await mkdir(target, { recursive: true });
  const base = await realpath(target);
  for (const item of files) {
    const src = await safeFile(source, item.path!);
    const destination = resolve(base, item.path!);
    if (!destination.startsWith(base + sep))
      throw new Error("Destination outside data root");
    await mkdir(dirname(destination), { recursive: true });
    const parent = await realpath(dirname(destination));
    if (!parent.startsWith(base + sep))
      throw new Error("Destination outside data root");
    if (src === destination) continue;
    try {
      if (
        createHash("sha256")
          .update(await readFile(await safeFile(base, item.path!)))
          .digest("hex") === item.sha256
      )
        continue;
    } catch (error) {
      // A missing destination is expected on first import; other failures need attention.
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
    const temporary = destination + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, await readFile(src), { flag: "wx" });
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
