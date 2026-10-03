import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const sourceRoot = new URL("../../src/userscript/", import.meta.url);
const defaultWorkerPath = new URL("../../bilikit-remux.worker.js", import.meta.url);
const sourceParts = [
  "entry-prefix.js",
  "download-workspace.js",
  "entry-suffix.js"
];
const networkMarker = "  /* @bilikit-module:network-hooks */";
const progressMarker = "  /* @bilikit-module:download-progress */";
const workerPattern = /(^[ \t]*const DOWNLOAD_WORKER_SOURCE = )("(?:\\.|[^"])*")(;[ \t]*$)/m;

export async function readUserscriptMetadata() {
  return readFile(new URL("metadata.txt", sourceRoot), "utf8");
}

export function readUserscriptVersion(metadata) {
  const version = String(metadata || "").match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
  if (!version) throw new Error("src/userscript/metadata.txt 缺少 @version");
  return version;
}

async function bundleModule(entryPoint, globalName) {
  const result = await esbuild({
    entryPoints: [fileURLToPath(new URL(entryPoint, sourceRoot))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName,
    target: "es2022"
  });
  return result.outputFiles[0].text;
}

export async function buildPrimaryBody({ workerPath = defaultWorkerPath, version } = {}) {
  const [parts, workerSource, networkHookBundle, downloadProgressBundle] = await Promise.all([
    Promise.all(sourceParts.map((name) => readFile(new URL(name, sourceRoot), "utf8"))),
    readFile(workerPath, "utf8"),
    bundleModule("core/network-hooks.mjs", "BiliKitNetworkHookModule"),
    bundleModule("core/download-progress.mjs", "BiliKitDownloadProgressModule")
  ]);
  const combined = parts.join("");
  if (combined.split(networkMarker).length !== 2) throw new Error("userscript 源码必须恰好包含一个 network-hooks 构建标记");
  if (combined.split(progressMarker).length !== 2) throw new Error("userscript 源码必须恰好包含一个 download-progress 构建标记");
  const body = combined
    .replace(networkMarker, networkHookBundle)
    .replace(progressMarker, downloadProgressBundle)
    .replace(/const VERSION = "[^"]+";/, `const VERSION = ${JSON.stringify(version || "")};`);
  if (!workerPattern.test(body)) throw new Error("源码中缺少 DOWNLOAD_WORKER_SOURCE 生成标记");
  const withWorker = body.replace(workerPattern, (_match, prefix, _old, suffix) => (
    prefix + JSON.stringify(workerSource) + suffix
  ));
  return { body: withWorker, sourceParts, workerSource };
}
