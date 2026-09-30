import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function currentDownloadBatchRouteKey", start);
if (start < 0 || end < 0) throw new Error("无法定位混合批量范围函数");

const context = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1o6tGzDErU/?p=2" }
};
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { downloadBatchEntryScope, downloadBatchScopeForEntries };`,
  context
);

const { downloadBatchEntryScope, downloadBatchScopeForEntries } = context.testApi;
const collectionEntry = {
  downloadScope: "collection",
  collectionIndex: 3,
  page: 2,
  bvid: "BV1CollectionVideo",
  cid: "30002",
  label: "C03_P02"
};
const episodeEntry = {
  downloadScope: "episodes",
  page: 2,
  bvid: "BV1o6tGzDErU",
  cid: "20002",
  label: "P02"
};
const selectedEntries = [collectionEntry, episodeEntry];

if (downloadBatchScopeForEntries(selectedEntries) !== "mixed") {
  throw new Error("同时选择合集视频和普通分 P 时没有得到 mixed 批量范围");
}
if (downloadBatchEntryScope(collectionEntry) !== "collection" || downloadBatchEntryScope(episodeEntry) !== "episodes") {
  throw new Error("混合批量条目没有保持各自的任务范围");
}
if (downloadBatchScopeForEntries([collectionEntry]) !== "collection") {
  throw new Error("仅合集条目不应被标记为 mixed");
}
if (downloadBatchScopeForEntries([episodeEntry]) !== "episodes") {
  throw new Error("仅普通分 P 不应被标记为 mixed");
}
if (downloadBatchScopeForEntries([]) !== "") {
  throw new Error("空选择不应产生批量范围");
}

// 直接执行真实批量控制流，并在下载器交接点记录任务。这样验证的不只是
// mixed 标记，还能证明合集视频、合集内部 P、普通视频 P 会生成独立任务。
const batchStart = script.indexOf("  async function runSelectedDownloadBatch(");
const batchEnd = script.indexOf("  function createUnifiedDownloadWorkspace", batchStart);
const scopeStart = script.indexOf("  function downloadBatchEntryScope(");
const scopeEnd = script.indexOf("  function downloadTrackCodecKey", scopeStart);
if (batchStart < 0 || batchEnd < 0 || scopeStart < 0 || scopeEnd < 0) {
  throw new Error("无法定位混合批量任务控制流");
}
const batchSource = script.slice(batchStart, batchEnd);
const instrumentedBatch = batchSource.replace(
  /if \(mode === "merge"\) enqueueMergeDownload\(model, video, audio, task, reasons\);\s*else runSeparateDownload\(model, video, audio, task, reasons\);/,
  "recordBatchTask({ model, video, audio, task, reasons });"
);
if (instrumentedBatch === batchSource) throw new Error("无法接入批量下载任务记录点");

const baseModel = {
  videoId: "BV1StandaloneVideo",
  bvid: "BV1StandaloneVideo",
  aid: "10010",
  page: 2,
  cid: "60002",
  title: "独立视频标题",
  duration: 90,
  routeKey: "BV1StandaloneVideo|p=2|cid=60002"
};
const selectedVideoTrack = { kind: "video", id: 80, codecs: "avc1.640028", height: 1080, bandwidth: 4_000_000 };
const selectedAudioTrack = { kind: "audio", codecs: "mp4a.40.2", bandwidth: 128_000 };
const handedOff = [];
const fetched = [];
const batchContext = {
  URL,
  AbortController,
  location: { href: "https://www.bilibili.com/video/BV1StandaloneVideo/?p=2" },
  navigator: { hardwareConcurrency: 8 },
  DOWNLOAD_CAPTURE_STATS: {},
  DOWNLOAD_BATCH_CONTEXT: null,
  isPlayPage: () => false,
  currentDownloadBatchRouteKey: (fallback) => fallback?.routeKey || "",
  cancelDownloadBatch: () => {},
  downloadBatchResolutionConcurrency: () => 2,
  createDownloadBatchResolutionGate: () => ({ acquire: async () => () => {}, cancel: () => {} }),
  isDownloadCollectionEntryValid: (entry) => !!entry?.bvid && !!entry?.cid,
  isDownloadCatalogEntryValid: (entry) => !!entry?.bvid && !!entry?.cid,
  makeDownloadCollectionPage: (entry, base) => ({ ...base, ...entry, videoId: entry.bvid }),
  resolveDownloadCollectionPage: async (entry) => ({
    ...entry,
    videoId: entry.bvid,
    bvid: entry.bvid,
    cid: entry.cid,
    page: entry.page,
    title: entry.title,
    duration: entry.duration
  }),
  makeDownloadEpisodePage: (entry, base) => ({ ...base, ...entry, videoId: base.videoId, bvid: base.bvid }),
  fetchBatchDownloadSnapshot: async (page) => {
    fetched.push({ bvid: page.bvid, cid: page.cid, page: page.page });
    return {
      snapshot: {
        videoId: page.videoId,
        bvid: page.bvid,
        aid: page.aid,
        cid: page.cid,
        page: page.page,
        title: page.title,
        duration: page.duration,
        videos: [selectedVideoTrack],
        audios: [selectedAudioTrack]
      }
    };
  },
  snapshotMatchesDownloadEpisode: () => false,
  selectBatchVideoTrack: () => ({ track: selectedVideoTrack, degraded: false, reason: "" }),
  selectBatchAudioTrack: () => ({ track: selectedAudioTrack, degraded: false, reason: "" }),
  selectDownloadTitle: (...values) => values.find((value) => typeof value === "string" && value.trim()) || "未命名视频",
  buildDownloadTaskTitle: (model) => `${model.videoId}_C${model.collectionIndex || 0}_P${model.page}`,
  makeDownloadTask: (mode, title) => {
    let resolveCompletion;
    const task = { mode, title, status: "queued", cancelFunctions: [], donePromise: new Promise((resolve) => { resolveCompletion = resolve; }), resolveCompletion };
    task.resolveCompletion = resolveCompletion;
    return task;
  },
  updateDownloadTask: (task, patch) => Object.assign(task, patch),
  removeDownloadCancel: (task, cancel) => {
    const index = task.cancelFunctions.indexOf(cancel);
    if (index >= 0) task.cancelFunctions.splice(index, 1);
  },
  runDownloadTaskError: (task, error) => {
    task.status = "error";
    task.message = error?.message || "任务失败";
    task.resolveCompletion?.(task);
  },
  recordBatchTask: (job) => {
    handedOff.push(job);
    job.task.status = "complete";
    job.task.resolveCompletion(job.task);
  }
};
const entriesForBatch = [
  { downloadScope: "collection", collectionIndex: 1, collectionPageCount: 1, page: 1, bvid: "BV1CollectionSingle", videoId: "BV1CollectionSingle", aid: "10011", cid: "70001", title: "合集单 P 视频", label: "C01", listOrder: 0 },
  { downloadScope: "collection", collectionIndex: 2, collectionPageCount: 3, page: 2, bvid: "BV1CollectionMulti", videoId: "BV1CollectionMulti", aid: "10012", cid: "71002", title: "合集多 P 视频", label: "C02_P02", listOrder: 1 },
  { downloadScope: "collection", collectionIndex: 2, collectionPageCount: 3, page: 3, bvid: "BV1CollectionMulti", videoId: "BV1CollectionMulti", aid: "10012", cid: "71003", title: "合集多 P 视频", part: "第三 P", label: "C02_P03", listOrder: 2 },
  { downloadScope: "episodes", page: 2, bvid: baseModel.bvid, videoId: baseModel.videoId, aid: baseModel.aid, cid: baseModel.cid, title: baseModel.title, label: "P02", listOrder: 3 }
];
vm.runInNewContext(
  `${script.slice(scopeStart, scopeEnd)}\n${instrumentedBatch}\nthis.runBatch = runSelectedDownloadBatch;`,
  batchContext
);
await batchContext.runBatch("merge", entriesForBatch, baseModel, selectedVideoTrack, selectedAudioTrack, "mixed");
if (handedOff.length !== entriesForBatch.length || fetched.length !== entriesForBatch.length) {
  throw new Error(`混合批次未为每个勾选项建立单独轨道解析/下载任务：${JSON.stringify({ handedOff: handedOff.length, fetched })}`);
}
const expectedIdentitySet = new Set([
  "BV1CollectionSingle:70001",
  "BV1CollectionMulti:71002",
  "BV1CollectionMulti:71003",
  "BV1StandaloneVideo:60002"
]);
const actualIdentitySet = new Set(handedOff.map(({ model }) => `${model.bvid}:${model.cid}`));
if (actualIdentitySet.size !== expectedIdentitySet.size || [...expectedIdentitySet].some((identity) => !actualIdentitySet.has(identity))) {
  throw new Error(`混合批次任务串用了 BV/CID 或丢失了合集内部 P：${JSON.stringify(handedOff.map(({ model }) => ({ bvid: model.bvid, cid: model.cid, page: model.page, scope: model.downloadScope })))}`);
}
if (handedOff.filter(({ task }) => task.batchScope === "collection").length !== 3 ||
  handedOff.filter(({ task }) => task.batchScope === "episodes").length !== 1 ||
  handedOff.some(({ task }) => task.status !== "complete")) {
  throw new Error("混合批次任务范围或独立完成状态错误");
}

console.log("混合批量测试通过：合集视频、合集内部 P 和普通分 P 可同批选择，且每项均按自己的 BVID/CID 创建独立任务。");
