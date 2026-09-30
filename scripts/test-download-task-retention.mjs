import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const source = await readUserscriptSource();
const progressSource = await readFile(new URL("../src/userscript/core/download-progress.mjs", import.meta.url), "utf8");
const taskStart = source.indexOf("  function makeDownloadTask(");
const taskEnd = source.indexOf("  function removeDownloadCancel(", taskStart);
if (taskStart < 0 || taskEnd < 0) throw new Error("无法定位下载任务创建逻辑");
const taskBody = source.slice(taskStart, taskEnd);
if (/DOWNLOAD_TASKS\.length\s*=\s*16/.test(taskBody) || /DOWNLOAD_TASKS\.length\s*=s*DOWNLOAD_TASKS\.slice/.test(taskBody)) {
  throw new Error("创建批量任务时仍会截断任务集合");
}
if (!/DOWNLOAD_TASKS\.unshift\(task\)/.test(taskBody)) {
  throw new Error("下载任务没有加入完整任务集合");
}
const displayLimit = source.match(/const DOWNLOAD_TASK_DISPLAY_LIMIT\s*=\s*(\d+)/)?.[1];
if (!displayLimit || Number(displayLimit) < 30) {
  throw new Error(`任务列表显示上限不足以覆盖常见合集：${displayLimit || "未找到"}`);
}
const renderStart = source.indexOf("  function renderDownloadTasks(");
const renderEnd = source.indexOf("  function saveMergedBlobWithBrowser(", renderStart);
const renderBody = source.slice(renderStart, renderEnd);
if (!/DOWNLOAD_TASKS\.slice\(0,\s*DOWNLOAD_TASK_VISIBLE_LIMIT\)/.test(renderBody)) {
  throw new Error("任务列表没有把显示上限与完整任务集合分离");
}
if (!/DOWNLOAD_TASK_VISIBLE_LIMIT\s*\+=\s*DOWNLOAD_TASK_DISPLAY_LIMIT/.test(renderBody) ||
  !/再显示/.test(renderBody)) {
  throw new Error("超过首屏显示上限的任务无法通过任务列表继续访问");
}

const context = {
  Date,
  Math,
  Promise,
  DOWNLOAD_TASKS: [],
  DOWNLOAD_WORKSPACE_ROOT: null,
  renderDownloadTasks() {}
};
vm.runInNewContext(
  `const DOWNLOAD_TASK_DISPLAY_LIMIT = ${displayLimit};\n${taskBody}\nthis.createTask = makeDownloadTask;`,
  context
);
let oldest = null;
for (let index = 0; index < 35; index += 1) {
  const task = context.createTask("merge", `C${String(index + 1).padStart(2, "0")}`);
  task.batchIndex = index + 1;
  task.retry = () => index + 1;
  task.cancelFunctions.push(() => index + 1);
  if (index === 0) oldest = task;
}
if (context.DOWNLOAD_TASKS.length !== 35 || context.DOWNLOAD_TASKS.at(-1) !== oldest) {
  throw new Error("超过 30 项时旧合集任务从任务集合中丢失");
}
if (typeof oldest.retry !== "function" || oldest.cancelFunctions.length !== 1 || oldest.batchIndex !== 1) {
  throw new Error("旧任务的重试、取消或身份数据没有保留");
}
if (!/for\s*\(const task of visible\)/.test(progressSource)) {
  throw new Error("全局进度统计没有遍历完整任务集合");
}

console.log("下载任务保留测试通过：35 项合集任务完整保留，旧任务仍可重试/取消，全局统计不受界面分页影响。");
