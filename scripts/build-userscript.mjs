import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const sourceRoot = new URL("../src/userscript/", import.meta.url);
const metadataPath = new URL("../src/userscript/metadata.txt", import.meta.url);
const releasePath = new URL("../bilikit-performance.user.js", import.meta.url);
const workerPath = new URL("../bilikit-remux.worker.js", import.meta.url);
const sourceParts = [
  "entry-prefix.js",
  "download-workspace.js",
  "entry-suffix.js"
];

export async function buildUserscript() {
  const metadata = await readFile(metadataPath, "utf8");
  const version = metadata.match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
  if (!version) throw new Error("src/userscript/metadata.txt 缺少 @version");
  const parts = await Promise.all(sourceParts.map((name) => readFile(new URL(name, sourceRoot), "utf8")));
  const workerSource = await readFile(workerPath, "utf8");
  const networkHookBundle = await esbuild({
    entryPoints: [fileURLToPath(new URL("core/network-hooks.mjs", sourceRoot))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName: "BiliKitNetworkHookModule",
    target: "es2022"
  });
  const downloadProgressBundle = await esbuild({
    entryPoints: [fileURLToPath(new URL("core/download-progress.mjs", sourceRoot))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName: "BiliKitDownloadProgressModule",
    target: "es2022"
  });
  const marker = "  /* @bilikit-module:network-hooks */";
  const progressMarker = "  /* @bilikit-module:download-progress */";
  const combined = parts.join("");
  if (combined.split(marker).length !== 2) throw new Error("userscript 源码必须恰好包含一个 network-hooks 构建标记");
  if (combined.split(progressMarker).length !== 2) throw new Error("userscript 源码必须恰好包含一个 download-progress 构建标记");
  const body = combined.replace(marker, networkHookBundle.outputFiles[0].text).replace(progressMarker, downloadProgressBundle.outputFiles[0].text).replace(
    /const VERSION = "[^"]+";/,
    `const VERSION = ${JSON.stringify(version)};`
  );
  const workerPattern = /(^[ \t]*const DOWNLOAD_WORKER_SOURCE = )("(?:\\.|[^"\\])*")(;[ \t]*$)/m;
  if (!workerPattern.test(body)) throw new Error("源码中缺少 DOWNLOAD_WORKER_SOURCE 生成标记");
  const withWorker = body.replace(workerPattern, (_match, prefix, _old, suffix) => (
    prefix + JSON.stringify(workerSource) + suffix
  ));
  await writeFile(releasePath, `${metadata.trimEnd()}\n\n${withWorker}`);
  return { version, sourceParts, bytes: Buffer.byteLength(withWorker) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await buildUserscript();
  console.log(`Built bilikit-performance.user.js from ${result.sourceParts.length} source parts: ${result.bytes} bytes`);
}
