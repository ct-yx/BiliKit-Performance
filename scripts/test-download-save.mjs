import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";
import vm from "node:vm";

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

// 回归：B 站页面有全局点击路由。Blob 保存锚点如果把 click 冒泡出去，
// 站点会把 blob:https://space.bilibili.com/<uuid> 当成站内地址重写，
// 形成 https://space.bilibili.comhttps://space.bilibili.com/<uuid> 并闪屏。
const events = [];
const fakeLink = {
  style: {},
  addEventListener(type, handler) {
    if (type === "click") this.clickHandler = handler;
  },
  click() {
    const event = {
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }
    };
    this.clickHandler?.(event);
    if (!event.propagationStopped) events.push("bilikit-site-router");
  },
  remove() {}
};
const browserSaveContext = {
  URL: {
    createObjectURL() { return "blob:https://space.bilibili.com/c8974f46-e2b0-4fa4-a801-be7e4bcd481e"; },
    revokeObjectURL() {}
  },
  document: {
    body: {
      appendChild() {}
    },
    createElement() { return fakeLink; }
  },
  setTimeout() {},
  setDownloadSaveProgress() {},
  updateDownloadTask() {}
};
vm.runInNewContext(`${browserSave}\nthis.saveDownloadBlobWithBrowser = saveDownloadBlobWithBrowser;`, browserSaveContext);
browserSaveContext.saveDownloadBlobWithBrowser({ blob: {}, fileName: "收藏视频.mp4" });
if (events.length) throw new Error(`Blob 保存事件冒泡到站点路由：${events.join(",")}`);

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
