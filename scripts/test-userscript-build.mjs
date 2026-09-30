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
