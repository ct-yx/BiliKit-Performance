import { execFileSync } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = new URL("../../extension/", import.meta.url);
const packageRoot = new URL("../../dist/edge-extension/", import.meta.url);
const archiveEntries = [
  "manifest.json",
  "content-main.js",
  "content-bridge.js",
  "service-worker.js",
  "icons"
];
const requiredEntries = new Set([
  "manifest.json",
  "content-main.js",
  "content-bridge.js",
  "service-worker.js",
  "icons/",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png"
]);

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    throw new Error(`${command} ${args[0]} 执行失败${detail ? `：${detail}` : ""}`, { cause: error });
  }
}

function listArchiveEntries(archivePath) {
  return run("unzip", ["-Z1", archivePath]).trim().split(/\r?\n/).filter(Boolean);
}

export function validateExtensionArchive(archivePath) {
  const entries = listArchiveEntries(archivePath);
  const entrySet = new Set(entries);
  if (!entrySet.has("manifest.json")) {
    throw new Error("Edge 扩展 ZIP 根目录缺少 manifest.json；请从 extension/ 目录内容打包，而不是打包 extension/ 目录本身");
  }
  if (entrySet.has("extension/manifest.json") || entries.some((entry) => entry.startsWith("extension/"))) {
    throw new Error("Edge 扩展 ZIP 多嵌套了一层 extension/ 目录");
  }
  for (const entry of requiredEntries) {
    if (!entrySet.has(entry)) throw new Error(`Edge 扩展 ZIP 缺少必要文件：${entry}`);
  }
  for (const entry of entries) {
    if (entry.startsWith("/") || entry.split("/").includes("..")) {
      throw new Error(`Edge 扩展 ZIP 含有不安全路径：${entry}`);
    }
  }
  run("unzip", ["-tq", archivePath]);
  return entries;
}

export async function packageEdgeExtension(version) {
  const extensionPath = fileURLToPath(extensionRoot);
  const packagePath = fileURLToPath(packageRoot);
  await mkdir(packageRoot, { recursive: true });

  const archiveName = `BiliKit-Performance-edge-v${version}.zip`;
  const archivePath = join(packagePath, archiveName);
  const temporaryArchivePath = join(packagePath, `.${archiveName}.${process.pid}.tmp.zip`);

  try {
    run("zip", ["-q", "-X", "-r", temporaryArchivePath, ...archiveEntries], { cwd: extensionPath });
    validateExtensionArchive(temporaryArchivePath);
    await rename(temporaryArchivePath, archivePath);
  } catch (error) {
    await rm(temporaryArchivePath, { force: true });
    throw error;
  }

  return { archivePath };
}
