import { gzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputPath = new URL("../bilikit-remux.worker.js", import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/remux.worker.js", import.meta.url))],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  legalComments: "none",
  banner: {
    js: "/*! Mediabunny 1.59.1 | Copyright (c) 2023-2026 Vanilagy | MPL-2.0 | https://github.com/Vanilagy/mediabunny */",
  },
});
const bundle = result.outputFiles[0].contents;
const workerSource = new TextDecoder().decode(bundle);

await writeFile(outputPath, workerSource);
console.log(`Built bilikit-remux.worker.js: ${bundle.byteLength} bytes minified, ${gzipSync(bundle).byteLength} bytes gzip`);
