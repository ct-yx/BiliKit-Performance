import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildPrimaryBody, readUserscriptMetadata, readUserscriptVersion } from "./lib/primary-bundle.mjs";

const releasePath = new URL("../bilikit-performance.user.js", import.meta.url);

export async function buildUserscript() {
  const metadata = await readUserscriptMetadata();
  const version = readUserscriptVersion(metadata);
  const { body, sourceParts } = await buildPrimaryBody({ version });
  await writeFile(releasePath, `${metadata.trimEnd()}\n\n${body}`);
  return { version, sourceParts, bytes: Buffer.byteLength(body) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await buildUserscript();
  console.log(`Built bilikit-performance.user.js from ${result.sourceParts.length} source parts: ${result.bytes} bytes`);
}
