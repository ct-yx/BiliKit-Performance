import { createBiliKitDownloadProgressController } from "../src/userscript/core/download-progress.mjs";

const stats = {
  remuxModelReady: false,
  remuxSampleCount: 0,
  lastRemuxSampleMs: 0,
  activeTaskCount: 0,
  globalDownloadSpeedBytes: 0,
  globalLoadedBytes: 0,
  globalTotalBytes: 0,
  globalDownloadProgress: 0,
  globalRemuxProgress: 0,
  globalSaveProgress: 0,
  globalOverallProgress: 0,
  downloadEtaMs: 0,
  remuxEtaMs: 0,
  totalEtaMs: 0,
  effectiveMergeConcurrency: 0
};
const storageValues = new Map();
const storage = {
  getItem: (key) => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, String(value))
};
const tasks = [];
const mergeQueue = [];
const mergeRunningJobs = new Set();
const timers = [];
let getSetting = (_key, fallback) => fallback;

const controller = createBiliKitDownloadProgressController({
  getSetting: (key, fallback) => getSetting(key, fallback),
  getStats: () => stats,
  getTasks: () => tasks,
  getMergeQueue: () => mergeQueue,
  getMergeRunningJobs: () => mergeRunningJobs,
  getMergeConcurrency: () => stats.effectiveMergeConcurrency,
  getMaxMergeConcurrency: () => 4,
  storage,
  now: () => 1000,
  setTimeout: (fn) => {
    timers.push(fn);
    return timers.length;
  },
  clearTimeout: () => {},
  onRenderTasks: () => {}
});

const {
  downloadWorkspaceSetting,
  normalizeDownloadTaskProgress,
  updateDownloadPartProgress,
  collectDownloadProgressStats,
  recordDownloadRemuxSample,
  readDownloadRemuxModel,
  estimateDownloadRemuxMs,
  estimateDownloadTaskDownloadMs,
  estimateDownloadMergePoolEta,
  resetDownloadProgressSampling
} = controller;

const task = {
  mode: "merge",
  status: "downloading",
  downloadProgress: 0,
  remuxProgress: 0,
  saveProgress: 0,
  _downloadParts: [
    { loaded: 0, total: 1000, estimated: 1000 },
    { loaded: 0, total: 500, estimated: 500 }
  ],
  fileSizeEstimateBytes: 1500,
  inputBytes: 1500,
  mediaDuration: 60,
  qualityHeight: 1080
};
tasks.push(task);
updateDownloadPartProgress(task, 0, 500, 1000);
updateDownloadPartProgress(task, 1, 250, 500);
if (task.loadedBytes !== 750 || task.totalBytes !== 1500 || task.downloadProgress !== 0.5) {
  throw new Error("多轨字节进度汇总错误：" + JSON.stringify(task));
}

task.status = "remuxing";
task._downloadParts[0].loaded = 1000;
task._downloadParts[1].loaded = 500;
task.downloadProgress = 1;
task.remuxProgress = 0.5;
task.remuxStartedAt = 0;
task.saveProgress = 0;
normalizeDownloadTaskProgress(task);
collectDownloadProgressStats();
if (stats.globalDownloadProgress !== 1 || stats.globalRemuxProgress !== 0.5 || stats.globalOverallProgress <= 0.7) {
  throw new Error("合并阶段全局进度错误：" + JSON.stringify(stats));
}

const split = {
  mode: "tracks",
  status: "downloading",
  downloadProgress: 0,
  remuxProgress: 1,
  saveProgress: 0,
  _downloadParts: [{ loaded: 0, total: 2000, estimated: 2000 }],
  fileSizeEstimateBytes: 2000,
  mediaDuration: 20
};
tasks.push(split);
updateDownloadPartProgress(split, 0, 1000, 2000);
if (split.remuxProgress !== 1 || split.overallProgress !== 0.475) {
  throw new Error("分轨任务不应进入转码阶段：" + JSON.stringify(split));
}

getSetting = (key, fallback) => key.endsWith("refreshIntervalMs")
  ? 1
  : key.endsWith("remuxSampleMinMs")
    ? 3000
    : fallback;
if (downloadWorkspaceSetting("refreshIntervalMs") !== 250 || downloadWorkspaceSetting("remuxSampleMinMs") !== 3000) {
  throw new Error("设置范围限制错误");
}
recordDownloadRemuxSample(task, 4000);
recordDownloadRemuxSample({ ...task, inputBytes: 2000 }, 5000);
recordDownloadRemuxSample({ ...task, inputBytes: 2500 }, 6000);
recordDownloadRemuxSample({ ...task, inputBytes: 3000 }, 7000);
const model = readDownloadRemuxModel();
if (!stats.remuxModelReady || stats.remuxSampleCount !== 3 || model.samples.length !== 3) {
  throw new Error("转码模型样本限制错误：" + JSON.stringify({ stats, model }));
}
const eta = estimateDownloadRemuxMs({ ...task, status: "queued", fileSizeEstimateBytes: 1500 });
if (!(eta > 0)) throw new Error("转码 ETA 未建立：" + eta);

const mergeJobs = [1, 2, 3].map((index) => ({
  task: {
    mode: "merge",
    status: "queued",
    downloadProgress: 0,
    remuxProgress: 0,
    saveProgress: 0,
    loadedBytes: 0,
    totalBytes: 0,
    fileSizeEstimateBytes: 1500,
    inputBytes: 1500,
    mediaDuration: 60,
    qualityHeight: 1080,
    _downloadParts: []
  },
  index
}));
const oneSlotEta = estimateDownloadMergePoolEta(mergeJobs, 1000, 1, 1);
const threeSlotEta = estimateDownloadMergePoolEta(mergeJobs, 1000, 3, 1);
if (!(oneSlotEta.totalEtaMs > threeSlotEta.totalEtaMs * 2 && oneSlotEta.remuxEtaMs > threeSlotEta.remuxEtaMs * 2)) {
  throw new Error("合并池 ETA 没有按有效并发槽缩短：" + JSON.stringify({ oneSlotEta, threeSlotEta }));
}

const lifecycleJobs = [
  { task: { ...mergeJobs[0].task, status: "queued" } },
  { task: { ...mergeJobs[0].task, status: "downloading", loadedBytes: 500 } },
  { task: { ...mergeJobs[0].task, status: "remuxing", remuxProgress: 0.5, remuxStartedAt: 0 } },
  { task: { ...mergeJobs[0].task, status: "saving", remuxProgress: 1 } }
];
const lifecycleEta = estimateDownloadMergePoolEta(lifecycleJobs, 1000, 1, 1);
const expectedLifecycleRemux = estimateDownloadRemuxMs(lifecycleJobs[0].task)
  + estimateDownloadRemuxMs(lifecycleJobs[1].task)
  + estimateDownloadRemuxMs(lifecycleJobs[2].task);
if (lifecycleEta.remuxEtaMs !== expectedLifecycleRemux || lifecycleEta.totalEtaMs <= lifecycleEta.remuxEtaMs) {
  throw new Error("合并池生命周期没有按排队、下载、封装、保存阶段计算：" + JSON.stringify({ lifecycleEta, expectedLifecycleRemux }));
}

const remuxingTask = { ...mergeJobs[0].task, status: "remuxing", remuxProgress: 0.5, remuxStartedAt: 0 };
if (estimateDownloadTaskDownloadMs(remuxingTask, 1000) !== 0) {
  throw new Error("已进入封装阶段的任务不应继续计入下载剩余时间");
}
const savingTask = { ...mergeJobs[0].task, status: "saving" };
const savingEta = estimateDownloadMergePoolEta([{ task: savingTask }], 1000, 1, 1);
if (savingEta.remuxEtaMs !== 0 || savingEta.totalEtaMs !== 0) {
  throw new Error("保存阶段不应继续估算下载或封装时间：" + JSON.stringify(savingEta));
}

mergeQueue.push(...mergeJobs);
stats.effectiveMergeConcurrency = 2;
collectDownloadProgressStats();
if (!(stats.remuxEtaMs > 0 && stats.remuxEtaMs < eta * 3)) {
  throw new Error("合并任务池 ETA 没有按并发槽位估算：" + JSON.stringify({ eta, stats }));
}
resetDownloadProgressSampling();

const serialized = JSON.stringify({ task, stats, model });
if (/https?:\/\/|token|cookie|sign|access_key/i.test(serialized)) {
  throw new Error("进度或转码模型不应包含媒体地址或签名字段");
}

console.log("下载进度测试通过：独立进度模块、阶段百分比、文件大小、ETA、生命周期与最近三条转码样本均符合预期。");
