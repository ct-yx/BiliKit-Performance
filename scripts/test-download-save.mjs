import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../bilikit-performance.user.js", import.meta.url), "utf8");
const start = script.indexOf("  function saveMergedBlobWithBrowser");
const end = script.indexOf("  function gmRequestArrayBuffer", start);
if (start < 0 || end < 0) throw new Error("无法定位合并保存逻辑");

const section = script.slice(start, end);
if (!section.includes("task.mode === \"merge\"")) throw new Error("合并任务没有独立保存分支");
if (!section.includes("link.download = fileName")) throw new Error("合并任务没有使用目标文件名");
if (!section.includes("saveMergedBlobWithBrowser(task)")) throw new Error("合并任务没有调用原生 Blob 保存");
const mergeBranch = section.slice(section.indexOf('if (task.mode === "merge")'), section.indexOf('if (fromUser || typeof GM_download'));
if (mergeBranch.includes("GM_download({")) throw new Error("合并 Blob 仍然经过 GM_download，可能回退为 UUID 文件名");

console.log("下载保存测试通过：合并 Blob 使用浏览器原生 download 文件名，分轨仍可使用 GM_download。");
