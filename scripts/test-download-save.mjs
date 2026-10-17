import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const browserSaveStart = script.indexOf("  function saveDownloadBlobWithBrowser(");
const browserSaveEnd = script.indexOf("  function saveMergedBlobWithBrowser(", browserSaveStart);
const dispatchStart = script.indexOf("  function saveMergedDownload(", browserSaveEnd);
const dispatchEnd = script.indexOf("  function gmRequestArrayBuffer(", dispatchStart);
if ([browserSaveStart, browserSaveEnd, dispatchStart, dispatchEnd].some((offset) => offset < 0)) {
  throw new Error("无法定位公共 Blob 保存逻辑");
}

const browserSave = script.slice(browserSaveStart, browserSaveEnd);
if (!browserSave.includes("link.download = fileName")) throw new Error("公共 Blob 保存函数没有使用目标文件名");
if (!browserSave.includes("link.click()")) throw new Error("公共 Blob 保存函数没有触发浏览器保存");

const dispatch = script.slice(dispatchStart, dispatchEnd);
if (!dispatch.includes('if (task.mode === "merge")')) throw new Error("合并任务没有独立保存分支");
const mergeBranch = dispatch.slice(dispatch.indexOf('if (task.mode === "merge")'), dispatch.indexOf('if (fromUser || typeof GM_download'));
if (!mergeBranch.includes("saveMergedBlobWithBrowser(task)")) throw new Error("合并任务没有调用原生 Blob 保存");
if (mergeBranch.includes("GM_download({")) throw new Error("合并 Blob 仍然经过 GM_download，可能回退为 UUID 文件名");

const audioStart = script.indexOf("  async function runSeparateAudioDownload(");
const audioEnd = script.indexOf("  function mergeDownloadStats(", audioStart);
const audioFlow = script.slice(audioStart, audioEnd);
if (audioStart < 0 || audioEnd < 0 || !audioFlow.includes('saveDownloadBlobWithBrowser(task, task.fileName, "已保存音乐")')) {
  throw new Error("仅下载音频没有通过公共浏览器保存函数使用自动文件名");
}

console.log("下载保存测试通过：合并与音频 Blob 共用原生 download 保存函数并保留各自文件名。");
