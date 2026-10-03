import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function downloadActiveErrorMessage", start);
if (start < 0 || end < 0) throw new Error("无法定位批量下载函数");

const context = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1j2YC6iE4i/?p=2" },
  signQuery: (params) => new URLSearchParams(params).toString(),
  ensureKeys: async () => true,
  normalizeDownloadSnapshot: (source) => ({
    ...source,
    videos: Array.isArray(source?.videos) ? source.videos : [],
    audios: Array.isArray(source?.audios) ? source.audios : []
  })
};
const playurlRequests = [];
const fallbackVideoTrack = {
  id: 80,
  baseUrl: "https://xy123x.bilivideo.com/fallback-video.m4s",
  codecs: "avc1.640028",
  mimeType: "video/mp4",
  height: 1080,
  width: 1920,
  bandwidth: 4_000_000
};
const fallbackAudioTrack = {
  id: 30280,
  baseUrl: "https://xy123x.bilivideo.com/fallback-audio.m4s",
  codecs: "mp4a.40.2",
  mimeType: "audio/mp4",
  bandwidth: 128_000
};
context.downloadRequestJson = async (url) => {
  const parsed = new URL(url);
  playurlRequests.push(parsed.pathname);
  if (parsed.pathname === "/x/player/wbi/playurl") {
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: { dash: { video: [], audio: [] } } })
    };
  }
  if (parsed.pathname === "/x/player/playurl") {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          arc: { bvid: "BV1j2YC6iE4i", aid: 10001, cid: 202 },
          timelength: 120000,
          dash: { video: [fallbackVideoTrack], audio: [fallbackAudioTrack] }
        }
      })
    };
  }
  throw new Error(`意外的播放接口：${parsed.pathname}`);
};
vm.runInNewContext(
  `const DOWNLOAD_MAX_MERGE_CONCURRENCY = 4;\nlet DOWNLOAD_PLAYURL_TEMPLATE = { origin: "https://api.bilibili.com", pathname: "/x/player/wbi/playurl", params: { bvid: "BV1j2YC6iE4i", cid: "202", qn: "80" }, videoId: "BV1j2YC6iE4i", bvid: "BV1j2YC6iE4i", aid: "10001", cid: "202" };\n${script.slice(start, end)}\nthis.testApi = { mergeDownloadEpisodeCatalog, isDownloadCatalogEntryValid, selectBatchVideoTrack, selectBatchAudioTrack, estimateDownloadMemoryBytes, calculateDownloadMergeBudget, buildBatchDownloadPlayurlRequest, fetchBatchDownloadSnapshot };`,
  context
);

const {
  mergeDownloadEpisodeCatalog,
  isDownloadCatalogEntryValid,
  selectBatchVideoTrack,
  selectBatchAudioTrack,
  estimateDownloadMemoryBytes,
  calculateDownloadMergeBudget,
  buildBatchDownloadPlayurlRequest,
  fetchBatchDownloadSnapshot
} = context.testApi;

const fallbackPage = {
  downloadScope: "episodes",
  videoId: "BV1j2YC6iE4i",
  bvid: "BV1j2YC6iE4i",
  aid: "10001",
  cid: "202",
  page: 2,
  title: "普通视频分 P 回退测试"
};
const fallbackResult = await fetchBatchDownloadSnapshot(fallbackPage, new AbortController().signal);
if (playurlRequests.join(",") !== "/x/player/wbi/playurl,/x/player/playurl") {
  throw new Error(`WBI 空 DASH 没有按预期回退到普通 playurl：${playurlRequests.join(",")}`);
}
if (fallbackResult.source !== "batch-legacy-endpoint" || fallbackResult.snapshot.videos.length !== 1 || fallbackResult.snapshot.audios.length !== 1) {
  throw new Error(`普通视频播放接口回退没有返回可用轨道：${JSON.stringify({ source: fallbackResult.source, snapshot: fallbackResult.snapshot })}`);
}

const collectionRequest = await buildBatchDownloadPlayurlRequest({
  downloadScope: "collection",
  videoId: "BV1CollectionItem",
  bvid: "BV1CollectionItem",
  aid: "20001",
  cid: "90001",
  page: 1
});
if (!collectionRequest.url.includes("bvid=BV1CollectionItem") || !collectionRequest.url.includes("cid=90001") || collectionRequest.url.includes("BV1j2YC6iE4i")) {
  throw new Error(`合集播放请求复用了当前页模板身份：${collectionRequest.url}`);
}

const base = {
  videoId: "BV1j2YC6iE4i",
  bvid: "BV1j2YC6iE4i",
  aid: "10001",
  page: 2,
  title: "同 BV 多 P 测试"
};
const domEntries = [
  { ...base, page: 1, cid: "101", part: "第一集", duration: 60 },
  { ...base, page: 2, cid: "202", part: "第二集", duration: 120 },
  { ...base, page: 3, cid: "303", part: "第三集", duration: 180 }
];
const viewEntries = [
  { ...base, page: 1, cid: "101", part: "第一集", duration: 60 },
  { ...base, page: 2, cid: "999", part: "第二集（官方）", duration: 121 },
  { ...base, page: 3, cid: "303", part: "第三集", duration: 180 },
  { ...base, videoId: "BV1otherVideo", bvid: "BV1otherVideo", page: 4, cid: "404" }
];
const catalog = mergeDownloadEpisodeCatalog(domEntries, viewEntries, base);
if (catalog.length !== 3) throw new Error(`不同 BV 的视频不应进入同 BV 选集：${JSON.stringify(catalog)}`);
const p1 = catalog.find((entry) => entry.page === 1);
const p2 = catalog.find((entry) => entry.page === 2);
const p3 = catalog.find((entry) => entry.page === 3);
if (!p1 || !p3 || p1.cidMismatch || p3.cidMismatch || !p1.cid || !p3.cid) {
  throw new Error(`正常 P 的官方目录合并错误：${JSON.stringify(catalog)}`);
}
if (!p2?.cidMismatch || p2.cid !== "999" || isDownloadCatalogEntryValid(p2)) {
  throw new Error(`DOM/官方 CID 冲突未被标记并阻断：${JSON.stringify(p2)}`);
}

const makeVideo = (id, codec, height = 1080, bandwidth = 8e6) => ({
  kind: "video", id, codecs: codec, height, bandwidth, mimeType: "video/mp4", qualityLabel: `${height}P`
});
const exact = selectBatchVideoTrack([
  makeVideo(80, "av01.0.08M.08"),
  makeVideo(80, "avc1.640028"),
  makeVideo(64, "avc1.640028")
], makeVideo(80, "avc1.640028"));
if (exact.track?.codecs !== "avc1.640028" || exact.degraded) throw new Error(`同清晰度同编码未优先匹配：${JSON.stringify(exact)}`);

const lower = selectBatchVideoTrack([makeVideo(64, "avc1.640028")], makeVideo(80, "avc1.640028"));
if (lower.track?.id !== 64 || !lower.degraded || !/较低清晰度/.test(lower.reason)) throw new Error(`视频清晰度降级规则错误：${JSON.stringify(lower)}`);

const minimum = selectBatchVideoTrack([makeVideo(32, "avc1.640028"), makeVideo(48, "av01.0.08M.08")], makeVideo(16, "avc1.640028"));
if (minimum.track?.id !== 32 || !minimum.degraded || !/最低可用/.test(minimum.reason)) throw new Error(`无更低清晰度时的最低轨选择错误：${JSON.stringify(minimum)}`);

const audio = selectBatchAudioTrack([
  { kind: "audio", codecs: "mp4a.40.2", bandwidth: 128000 },
  { kind: "audio", codecs: "mp4a.40.2", bandwidth: 192000 },
  { kind: "audio", codecs: "opus", bandwidth: 256000 }
], { kind: "audio", codecs: "mp4a.40.2", bandwidth: 180000 });
if (audio.track?.bandwidth !== 192000 || audio.degraded) throw new Error(`音频编码和码率匹配错误：${JSON.stringify(audio)}`);

const lowMemory = estimateDownloadMemoryBytes({ duration: 600, videos: [makeVideo(80, "avc1.640028", 720, 2e6)], audios: [{ bandwidth: 128000 }] });
const highMemory = estimateDownloadMemoryBytes({ duration: 600, videos: [makeVideo(80, "avc1.640028", 2160, 20e6)], audios: [{ bandwidth: 320000 }] });
if (!(highMemory > lowMemory)) throw new Error(`清晰度/码率没有反映到内存估算：${lowMemory}/${highMemory}`);

const normalBudget = calculateDownloadMergeBudget({
  hardwareConcurrency: 8,
  deviceMemory: 16,
  heapLimitBytes: 8 * 1024 ** 3,
  largestEstimateBytes: 300 * 1024 ** 2,
  maxDuration: 600,
  maxBitrate: 4e6,
  maxQualityHeight: 1080
});
const heavyBudget = calculateDownloadMergeBudget({
  hardwareConcurrency: 8,
  deviceMemory: 16,
  heapLimitBytes: 8 * 1024 ** 3,
  largestEstimateBytes: 2 * 1024 ** 3,
  maxDuration: 4 * 3600,
  maxBitrate: 20e6,
  maxQualityHeight: 2160
});
if (normalBudget.concurrency < 2) throw new Error(`普通任务没有启用合理并发：${JSON.stringify(normalBudget)}`);
if (heavyBudget.concurrency !== 1) throw new Error(`高画质长视频没有降为单并发：${JSON.stringify(heavyBudget)}`);

console.log("批量下载测试通过：同 BV 多 P/CID 校验、不同 BV 隔离、轨道降级、清晰度内存估算和动态合并并发均符合预期。");
