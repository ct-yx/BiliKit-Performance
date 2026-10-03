import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const releasePath = new URL("../bilikit-performance.user.js", import.meta.url);
const workerPath = new URL("../bilikit-remux.worker.js", import.meta.url);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const build = () => execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
const readRelease = () => readFile(releasePath);

build();
const first = await readRelease();
build();
const second = await readRelease();
if (!first.equals(second)) throw new Error("userscript 连续构建输出不一致");

const worker = await readFile(workerPath);
const source = second.toString("utf8");
const earlyPriorityCall = source.indexOf('if (isHomeDocument()) installHomeFeedRequestPriority();');
const cleanupScopeDeclaration = source.indexOf('var activeModuleCleanupScope = null;');
if (earlyPriorityCall < 0 || cleanupScopeDeclaration < 0 || cleanupScopeDeclaration > earlyPriorityCall) {
  throw new Error("document-start 首页网络钩子必须使用无 TDZ 的 activeModuleCleanupScope 初始化");
}
if (source.includes('let activeModuleCleanupScope = null;')) {
  throw new Error("发布 userscript 不得用 let 声明 document-start 共享的 activeModuleCleanupScope");
}
if (source.includes('if (isBilibiliDocument()) installHomeFeedRequestPriority();')) {
  throw new Error("首页请求优先级钩子不得在所有 B 站页面 document-start 安装");
}
if (!source.includes("const HOME_FEED_AUTO_LOAD_MAX_PROBES = 3;")) {
  throw new Error("首页自动加载必须保留每周期三次探测上限");
}
if (!source.includes('stopAutoLoad("idle-cycle-complete");')) {
  throw new Error("首页自动加载完成当前停留周期后必须停止调度");
}
if (!source.includes('if (!moved || isInternalScroll || !hasUserIntent) return;')) {
  throw new Error("首页自动加载只能由实际用户滚动重新开启停留周期");
}
if (!source.includes('const bangumiPlaybackPage = /^\\/(?:bangumi|cheese)\\/play\\//i.test(location.pathname);')) {
  throw new Error("CDN 模块缺少番剧页面隔离标记");
}
const match = source.match(/const DOWNLOAD_WORKER_SOURCE = ("(?:\\.|[^"\\])*");/);
if (!match) throw new Error("发布 userscript 缺少内嵌 Worker");
const embedded = Buffer.from(JSON.parse(match[1]));
if (sha256(worker) !== sha256(embedded)) throw new Error("内嵌 Worker 与开发 Worker 内容不一致");
if (/@resource\s+.*(?:worker|remux)|GM_getResourceText/.test(source)) {
  throw new Error("发布 userscript 仍依赖外部 Worker 资源");
}
if (!/BEGIN GENERATED BILIKIT REMUX WORKER/.test(source) || !/MPL-2\.0/.test(embedded.toString("utf8"))) {
  throw new Error("Worker 生成标记或许可证来源缺失");
}

console.log(`userscript 构建测试通过：重复构建一致，Worker SHA-256 ${sha256(worker)} 已内嵌且无外部资源依赖。`);
