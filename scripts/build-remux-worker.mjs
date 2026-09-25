import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputPath = new URL("../bilikit-remux.worker.js", import.meta.url);
const userscriptPath = new URL("../bilikit-performance.user.js", import.meta.url);
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

const userscript = await readFile(userscriptPath, "utf8");
const declarationPattern = /^([ \t]*const DOWNLOAD_WORKER_SOURCE = )("(?:\\.|[^"\\])*")(;[ \t]*)$/gm;
const declarations = [...userscript.matchAll(declarationPattern)];
if (declarations.length !== 1) {
  throw new Error("Expected exactly one DOWNLOAD_WORKER_SOURCE declaration in bilikit-performance.user.js");
}
const embeddedUserscript = userscript.replace(
  declarationPattern,
  (_match, prefix, _previousSource, suffix) => prefix + JSON.stringify(workerSource) + suffix
);
await writeFile(outputPath, workerSource);
await writeFile(userscriptPath, embeddedUserscript);
console.log(`Built bilikit-remux.worker.js: ${bundle.byteLength} bytes minified, ${gzipSync(bundle).byteLength} bytes gzip`);
console.log("Embedded the worker into bilikit-performance.user.js");
