import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExtensionArchive } from "./lib/package-edge-extension.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const extensionRoot = resolve(root, "extension");
const requiredFiles = [
  "manifest.json",
  "content-main.js",
  "content-bridge.js",
  "service-worker.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png"
];
for (const file of requiredFiles) await readFile(resolve(extensionRoot, file));

const manifest = JSON.parse(await readFile(resolve(extensionRoot, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Edge 扩展必须使用 Manifest V3");
if (manifest.background?.service_worker !== "service-worker.js") throw new Error("缺少 Service Worker");
if (!manifest.permissions?.includes("downloads")) throw new Error("缺少 downloads 权限");
for (const pattern of ["*://*.bilivideo.net/*", "*://edge.mountaintoys.cn/*"]) {
  if (!manifest.host_permissions?.includes(pattern)) throw new Error(`扩展缺少媒体域名权限：${pattern}`);
}
if (!manifest.icons?.["128"] || manifest.action?.default_icon?.["16"] !== "icons/icon16.png") {
  throw new Error("扩展图标未配置或 action 图标路径错误");
}
if (!manifest.content_scripts?.some((item) => item.world === "MAIN" && item.js?.includes("content-main.js"))) {
  throw new Error("主世界脚本未配置");
}
if (!manifest.content_scripts?.some((item) => item.world === "ISOLATED" && item.js?.includes("content-bridge.js"))) {
  throw new Error("隔离世界桥接脚本未配置");
}
const archivePath = resolve(root, "dist", "edge-extension", `BiliKit-Performance-edge-v${manifest.version}.zip`);
const archiveEntries = validateExtensionArchive(archivePath);
if (archiveEntries.some((entry) => entry.startsWith("extension/"))) {
  throw new Error("Edge 扩展压缩包不应包含 extension/ 前缀");
}
const nestedArchivePath = join(tmpdir(), `bilikit-extension-nested-${process.pid}.zip`);
try {
  execFileSync("zip", ["-q", "-X", "-r", nestedArchivePath, "extension"], { cwd: root });
  try {
    validateExtensionArchive(nestedArchivePath);
    throw new Error("构建测试未拦截多嵌套 extension/ 目录的 ZIP");
  } catch (error) {
    if (!/根目录缺少 manifest\.json|多嵌套了一层 extension/.test(error.message)) throw error;
  }
} finally {
  await rm(nestedArchivePath, { force: true });
}
const main = await readFile(resolve(extensionRoot, "content-main.js"), "utf8");
if (!main.includes("__BILIKIT_EDGE_ADAPTER__") || !main.includes("__BILIKIT_EDGE_GM_XMLHTTPREQUEST__") || !main.includes("__BILIKIT_EDGE_GM_DOWNLOAD__") || !main.includes("__BILIKIT_EDGE_SCHEDULE_TASK_RENDER__") || !main.includes("bilikitBridge") || !main.includes("xhr-json") || !main.includes("BEGIN GENERATED BILIKIT REMUX WORKER")) {
  throw new Error("主世界产物缺少 Edge 适配器或 Worker 生成标记");
}
for (const marker of [
  "parseDownloadMusicIdentity",
  "buildDownloadAudioMetadata",
  "runSeparateAudioDownload",
  "type: \"remux-audio\"",
  "已保存音乐"
]) {
  if (!main.includes(marker)) throw new Error(`Edge 扩展产物缺少已验证的音频下载逻辑：${marker}`);
}
if (!main.includes('message.type === "audio-done"')) {
  throw new Error("Edge 扩展产物缺少音频 Worker 完成消息处理");
}
const embeddedWorkerMatch = main.match(/const DOWNLOAD_WORKER_SOURCE = ("(?:\\.|[^"\\])*");/s);
if (!embeddedWorkerMatch) throw new Error("Edge 扩展产物缺少可解析的内嵌音频 Worker");
let embeddedWorker = "";
try {
  embeddedWorker = JSON.parse(embeddedWorkerMatch[1]);
} catch {
  throw new Error("Edge 扩展产物的内嵌音频 Worker 不是有效的 JSON 字符串");
}
if (!embeddedWorker.includes("audio-done") || !embeddedWorker.includes("remux-audio") || !/extension\s*:\s*[\"']m4a[\"']/.test(embeddedWorker)) {
  throw new Error("Edge 扩展产物缺少音频 Worker 完成消息或 M4A 容器标记");
}
if (!main.includes('bilikit-performance-edge-bridge-v2') || !main.includes("queuedRequests") || !main.includes("markBridgeDisconnected")) {
  throw new Error("主世界产物未使用独立请求生命周期的扩展桥接协议");
}
if (!main.includes("responseHeaderValue") || !main.includes("媒体资源长度与响应声明不一致") || !main.includes("扩展媒体分块编码无效")) {
  throw new Error("主世界产物缺少严格媒体完整性与分块错误处理");
}
if (!main.includes("renderedEntries") || !main.includes("renderedGroups") || !main.includes("refreshListSelectionState")) {
  throw new Error("扩展视频列表缺少局部选择状态更新器");
}
if (!main.includes(".bk-dw-episode{content-visibility:auto")) {
  throw new Error("扩展视频列表未启用浏览器原生可见性隔离");
}
if (main.includes("for (const listKey of videoListState.selected)")) {
  throw new Error("扩展视频列表勾选仍会扫描整个 selected 集合");
}
const videoListStart = main.indexOf("const renderedEntries = new Map();");
const videoListEnd = main.indexOf("listHead.append(listHeading, listTools);", videoListStart);
const videoListBody = videoListStart >= 0 && videoListEnd >= 0 ? main.slice(videoListStart, videoListEnd) : "";
if ((videoListBody.match(/\blist\.replaceChildren\(\);/g) || []).length !== 1) {
  throw new Error("扩展视频列表仍存在多处整棵 DOM 重建入口");
}
const entryChange = videoListBody.match(/const renderDownloadVideoListEntry = [\s\S]*?checkbox\.addEventListener\("change", \(\) => \{[\s\S]*?refreshListSelectionState\(\{ entry \}\);[\s\S]*?\}\);/);
const groupChange = videoListBody.match(/const renderDownloadVideoListGroup = [\s\S]*?checkbox\.addEventListener\("change", \(\) => \{[\s\S]*?refreshListSelectionState\(\{ group \}\);[\s\S]*?\}\);/);
if (!entryChange?.[0].includes("refreshListSelectionState({ entry })") || entryChange[0].includes("refreshList();")) {
  throw new Error("单项视频勾选仍会调用 refreshList 全量重建");
}
const selectionUpdater = videoListBody.match(/const refreshListSelectionState = \(target = \{\}\) => \{[\s\S]*?\n    \};/);
if (!selectionUpdater || /videoListState\.(entries|groups)|downloadBatchScopeForEntries\(videoListState\.entries\)|updateListSummary\(\)/.test(selectionUpdater[0])) {
  throw new Error("单项选择状态更新仍会遍历整份视频目录");
}
if (selectionUpdater[0].includes(".children.reduce")) {
  throw new Error("选择状态更新仍会扫描合集全部子项");
}
const allSelect = videoListBody.match(/listButton\("全选", \(\) => \{[\s\S]*?\n    \}\);/);
const clearSelect = videoListBody.match(/listButton\("取消全选", \(\) => \{[\s\S]*?\n    \}\);/);
if (!allSelect?.[0].includes("refreshListSelectionState()") || allSelect[0].includes("refreshList();") || !clearSelect?.[0].includes("refreshListSelectionState()") || clearSelect[0].includes("refreshList();")) {
  throw new Error("全选/取消全选仍会重建 3331 项视频列表");
}
if (!entryChange[0].includes("groupRecord.selectedCount += checkbox.checked ? 1 : -1")
  || !groupChange?.[0].includes("groupRecord.selectedCount += checked ? 1 : -1")
  || !allSelect[0].includes("groupRecord.selectedCount = groupRecord.validCount")
  || !clearSelect[0].includes("groupRecord.selectedCount = 0")) {
  throw new Error("单项/全选/取消全选没有同步维护组选择计数");
}
if (/\bGM_xmlhttpRequest\b|\bGM_download\b/.test(main.slice(main.indexOf("// BEGIN GENERATED BILIKIT REMUX WORKER")))) {
  throw new Error("扩展核心仍直接调用全局 GM API，可能与 Tampermonkey 冲突");
}
const bridge = await readFile(resolve(extensionRoot, "content-bridge.js"), "utf8");
const worker = await readFile(resolve(extensionRoot, "service-worker.js"), "utf8");
if (!bridge.includes("chrome.runtime.connect") || !bridge.includes("connectPort") || !bridge.includes("scheduleReconnect")
  || !bridge.includes("forwardPortMessage") || !bridge.includes("port !== sourcePort")
  || !worker.includes("chrome.downloads") || !worker.includes("xhr-json") || !worker.includes("cancelResponseReader")) {
  throw new Error("Edge API 桥接产物不完整");
}
if (!bridge.includes('typeof message.data === "string"') || !bridge.includes("atob(") || !bridge.includes("[data]")) {
  throw new Error("扩展隔离桥接未转移媒体 ArrayBuffer");
}
for (const host of ["bilivideo.net", "edge.mountaintoys.cn"]) {
  if (!worker.includes(`host === "${host}"`)) throw new Error(`Service Worker 未允许媒体域名：${host}`);
}
console.log(`Edge 扩展构建测试通过：Manifest V3、MAIN world、隔离桥接、下载 Service Worker 和 ZIP 根目录结构均正常。`);
