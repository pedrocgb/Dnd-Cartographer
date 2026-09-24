import { createWriteStream } from "node:fs";
import { rm, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tempUploadPath } from "./paths";
import { validateImageFile, InvalidImageError } from "./validate";

/**
 * Streams an upload to a temp file and checks it's a real image under
 * `maxBytes`. Resolves the temp path; the caller converts and removes it.
 */
export async function receiveImageUpload(body: ReadableStream<Uint8Array>, maxBytes: number, what: string): Promise<string> {
  const tempPath = tempUploadPath(crypto.randomUUID());
  await mkdir(path.dirname(tempPath), { recursive: true });

  await pipeline(Readable.fromWeb(body as never), createWriteStream(tempPath));
  const { size } = await stat(tempPath);

  if (size > maxBytes) {
    await rm(tempPath, { force: true });
    throw new InvalidImageError(`File is ${(size / 1024 / 1024).toFixed(1)} MiB, over the ${maxBytes / 1024 / 1024} MiB ${what} limit.`);
  }

  try {
    await validateImageFile(tempPath, size);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }
  return tempPath;
}
