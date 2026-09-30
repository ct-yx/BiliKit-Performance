import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function downloadAllowedUrl");
const end = script.indexOf("  function currentDownloadBatchRouteKey", start);
if (start < 0 || end < 0) throw new Error("无法定位番剧下载函数范围");

const playState = {
  data: {
    arc: { bvid: "BV1BangumiTest", aid: 26361000, cid: 49053680 },
    supplement: {
      ogv_episode_info: { ep_id: 232466, show_title: "2", long_title: "第二集" },
      ogv_season_info: { season_id: 24588, season_title: "工作细胞 第一季" }
    },
    timelength: 141000,
    dash: { duration: 141 }
  }
};

const seasonResult = {
  season_id: 24588,
  season_title: "工作细胞 第一季",
  episodes: [
    { ep_id: 232465, index: "1", aid: 26360999, bvid: "BV1BangumiE01", cid: 49053679, show_title: "1", long_title: "花粉过敏", duration: 140000 },
    { ep_id: 232466, index: "2", aid: 26361000, bvid: "BV1BangumiTest", cid: 49053680, show_title: "2", long_title: "第二集", duration: 141000 },
    { ep_id: 232467, index: "3", aid: 26361001, bvid: "BV1BangumiE03", cid: 49053681, show_title: "3", long_title: "擦伤", duration: 142000 }
  ],
  section: [{ title: "幕后花絮", episodes: [{ ep_id: 999001, aid: 999001, bvid: "BVBehindTheScenes", cid: 999001, title: "花絮" }] }]
};
const seasonTabs = [
  { season_id: 24588, season_title: "第一季", episodes: seasonResult.episodes },
  { season_id: 37889, season_title: "第一季（中配）", episodes: [
    { ep_id: 3788901, index: "1", aid: 3788901, bvid: "BV1BangumiS2E01", cid: 5788901, show_title: "1", long_title: "中配第一集", duration: 150000 },
    { ep_id: 3788902, index: "2", aid: 3788902, bvid: "BV1BangumiS2E02", cid: 5788902, show_title: "2", long_title: "中配第二集", duration: 151000 }
  ] },
  { season_id: 36174, season_title: "第二季", episodes: [
    { ep_id: 3617401, index: "1", aid: 3617401, bvid: "BV1BangumiS3E01", cid: 6617401, show_title: "1", long_title: "第二季第一集", duration: 160000 },
    { ep_id: 3617402, index: "2", aid: 3617402, bvid: "BV1BangumiS3E02", cid: 6617402, show_title: "2", long_title: "第二季第二集", duration: 161000 }
  ] },
  { season_id: 38994, season_title: "第二季（中配）", episodes: [
    { ep_id: 3899401, index: "1", aid: 3899401, bvid: "BV1BangumiS4E01", cid: 7899401, show_title: "1", long_title: "中配第二季第一集", duration: 170000 },
    { ep_id: 3899402, index: "2", aid: 3899402, bvid: "BV1BangumiS4E02", cid: 7899402, show_title: "2", long_title: "中配第二季第二集", duration: 171000 }
  ] },
  { season_id: 38939, season_title: "剧场版", episodes: [
    { ep_id: 3893901, index: "1", aid: 3893901, bvid: "BV1BangumiS5E01", cid: 8893901, show_title: "剧场版", long_title: "剧场版", duration: 720000 }
  ] }
];
const seasonResults = new Map(seasonTabs.map((season) => [String(season.season_id), season]));

const requestedUrls = [];
let seasonFetchActive = 0;
let seasonFetchMaximum = 0;
const seasonTabButtons = seasonTabs.map((season, index) => ({
  textContent: season.season_title,
  innerText: season.season_title,
  getAttribute: (name) => name === "data-item-id" ? String(season.season_id) : "",
  classList: { contains: (name) => name === "SectionTabs_active__cms8S" && index === 0 }
}));
const seasonTabWrapper = {
  getAttribute: (name) => name === "data-active-id" ? "24588" : "",
  querySelectorAll: (selector) => selector === "button[data-item-id]" ? seasonTabButtons : []
};
const seasonSection = {
  querySelector: (selector) => selector === "h3" ? { textContent: "正片" } : null,
  querySelectorAll: (selector) => selector === "[data-active-id]" ? [seasonTabWrapper] : []
};
const context = {
  URL,
  AbortController,
  location: {
    href: "https://www.bilibili.com/bangumi/play/ep232466?from_spmid=666.25.episode.0",
    origin: "https://www.bilibili.com",
    pathname: "/bangumi/play/ep232466"
  },
  navigator: { hardwareConcurrency: 8 },
  DOWNLOAD_ALLOWED_HOSTS: ["bilivideo.com", "bilivideo.cn"],
  DOWNLOAD_MAX_MERGE_CONCURRENCY: 4,
  performance: { getEntriesByType: () => [] },
  MEDIA_PLAYURL_API_RE: /\/(?:x\/player\/(?:wbi\/)?playurl|pgc\/player\/(?:web\/)?(?:v2\/)?playurl|pugv\/player\/web\/playurl)(?:[/?#]|$)/i,
  DOWNLOAD_PLAYURL_TEMPLATE: null,
  signQuery: () => "",
  ensureKeys: async () => {},
  window: {
    __playinfo__: playState,
    __PLAYURL_HYDRATE_DATA__: null,
    __INITIAL_STATE__: {},
    fetch: async (url) => {
      requestedUrls.push(String(url));
      const seasonId = new URL(String(url)).searchParams.get("season_id") || "24588";
      seasonFetchActive += 1;
      seasonFetchMaximum = Math.max(seasonFetchMaximum, seasonFetchActive);
      await new Promise((resolve) => setTimeout(resolve, 2));
      seasonFetchActive -= 1;
      return { ok: true, status: 200, json: async () => ({ code: 0, result: seasonResults.get(seasonId) || seasonResult }) };
    }
  },
  document: {
    title: "工作细胞第2集-番剧-全集-高清独家在线观看-bilibili-哔哩哔哩",
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "section" ? [seasonSection] : []
  }
};

vm.runInNewContext(
  `${script.slice(start, end)}
this.testApi = {
  parseDownloadPageUrl,
  currentDownloadPageIdentity,
  fetchDownloadBangumiCatalog,
  fetchDownloadBangumiCatalogBundle,
  buildDownloadBangumiCatalogFromSeason,
  buildDownloadVideoList,
  buildDownloadVideoListGroups,
  setDownloadVideoListGroupSelection,
  downloadVideoListLabel,
  makeDownloadBangumiPage,
  downloadPlayurlParams,
  buildDownloadPlayurlRequest,
  buildBatchDownloadPlayurlRequest,
  buildBatchDownloadSnapshot,
  resolveDownloadIdentity,
  resolveDownloadPageForFetch,
  downloadBatchResolutionConcurrency,
  createDownloadBatchResolutionGate,
  calculateDownloadMergeBudget,
  buildDownloadFileName
};`,
  context
);

const api = context.testApi;
const ss = api.parseDownloadPageUrl("https://www.bilibili.com/bangumi/play/ss24588");
const ep = api.parseDownloadPageUrl(context.location.href);
if (ss.downloadScope !== "bangumi" || ss.seasonId !== "24588" || ss.epId) {
  throw new Error(`ss 番剧 URL 解析错误：${JSON.stringify(ss)}`);
}
if (ep.downloadScope !== "bangumi" || ep.epId !== "232466" || ep.seasonId) {
  throw new Error(`ep 番剧 URL 解析错误：${JSON.stringify(ep)}`);
}

const page = api.currentDownloadPageIdentity();
if (page.downloadScope !== "bangumi" || page.seasonId !== "24588" || page.epId !== "232466" || page.cid !== "49053680" || page.bvid !== "BV1BangumiTest") {
  throw new Error(`番剧当前页面身份读取错误：${JSON.stringify(page)}`);
}
if (page.filenameTitle !== "工作细胞 第一季") throw new Error(`番剧文件主标题错误：${JSON.stringify(page)}`);

const catalog = api.buildDownloadBangumiCatalogFromSeason(seasonResult, page);
if (catalog.length !== 3 || catalog.some((entry, index) => entry.episodeIndex !== index + 1)) {
  throw new Error(`番剧正片顺序或数量错误：${JSON.stringify(catalog)}`);
}
if (catalog.some((entry) => entry.bvid === "BVBehindTheScenes" || entry.epId === "999001")) {
  throw new Error("番剧目录错误地读取了 section 花絮");
}
if (catalog[1].duration !== 141 || catalog[1].durationLabel !== "02:21" || !catalog[1].current) {
  throw new Error(`番剧时长或当前集标记错误：${JSON.stringify(catalog[1])}`);
}

const fetchedCatalog = await api.fetchDownloadBangumiCatalog(page, new AbortController().signal);
if (fetchedCatalog.length !== 3 || requestedUrls.some((url) => url.includes("x/web-interface/view"))) {
  throw new Error(`番剧目录没有独立使用 season 接口：${JSON.stringify({ requestedUrls, fetchedCatalog })}`);
}

const multiCatalog = await api.fetchDownloadBangumiCatalogBundle(page, new AbortController().signal, catalog);
if (multiCatalog.length !== 10 || seasonFetchMaximum !== 2) {
  throw new Error(`多季度目录请求数量或并发错误：${JSON.stringify({ length: multiCatalog.length, seasonFetchMaximum, requestedUrls })}`);
}
const multiList = api.buildDownloadVideoList(multiCatalog, [], page);
if (multiList.length !== 10 || multiList.map((entry) => entry.label).join(",") !== "S01E01,S01E02,S01E03,S02E01,S02E02,S03E01,S03E02,S04E01,S04E02,S05E01") {
  throw new Error(`多季度列表顺序或标签错误：${JSON.stringify(multiList.map((entry) => ({ label: entry.label, seasonId: entry.seasonId, epId: entry.epId, cid: entry.cid })))}`);
}
const multiGroups = api.buildDownloadVideoListGroups(multiList);
if (multiGroups.length !== 5 || multiGroups.some((group, index) => group.kind !== "bangumi-season" || group.label !== `S${String(index + 1).padStart(2, "0")}`)) {
  throw new Error(`多季度父项错误：${JSON.stringify(multiGroups.map((group) => ({ kind: group.kind, label: group.label, size: group.children.length })))}`);
}
const seasonTwoGroupSelection = api.setDownloadVideoListGroupSelection(new Set(), multiGroups[1], true);
if (seasonTwoGroupSelection.size !== 2 || !multiGroups[1].children.every((entry) => seasonTwoGroupSelection.has(entry.listKey))) {
  throw new Error("多季度父项全选没有只选择当前季度的集");
}
const multiEntry = multiList.find((entry) => entry.label === "S02E01");
const multiPage = api.makeDownloadBangumiPage(multiEntry, page);
const multiParams = api.downloadPlayurlParams(multiPage, null);
if (multiParams.season_id !== "37889" || multiParams.ep_id !== "3788901" || multiParams.cid !== "5788901" || api.downloadVideoListLabel(multiEntry) !== "S02E01") {
  throw new Error(`多季度任务身份串用：${JSON.stringify({ multiEntry, multiParams })}`);
}
const multiFileName = api.buildDownloadFileName({ ...multiPage, bvid: "BV1BangumiS2E01" }, "merge", {
  kind: "video",
  id: 80,
  codecs: "avc1.640028",
  mimeType: "video/mp4",
  qualityLabel: "1080P"
}, {
  kind: "audio",
  id: 30280,
  codecs: "mp4a.40.2",
  mimeType: "audio/mp4",
  bandwidth: 128000
});
if (!multiFileName.includes("_BV1BangumiS2E01_S02E01_") || !multiFileName.endsWith("_video_audio.mp4")) {
  throw new Error(`多季度文件名没有使用 S02E01：${multiFileName}`);
}
const ordinaryBasePage = { ...page, downloadScope: "episodes", videoId: "BVOrdinary", bvid: "BVOrdinary", aid: "", seasonId: "", epId: "", cid: "101" };
const ordinaryList = api.buildDownloadVideoList([{ videoId: "BVOrdinary", bvid: "BVOrdinary", page: 1, cid: "101", part: "普通 P1", title: "普通视频" }], [], ordinaryBasePage);
if (ordinaryList.length !== 1 || ordinaryList[0].label !== "P01" || api.buildDownloadVideoListGroups(ordinaryList)[0].kind !== "episode") {
  throw new Error(`普通视频模式被季度逻辑污染：${JSON.stringify(ordinaryList)}`);
}

const list = api.buildDownloadVideoList(catalog, [], page);
if (list.length !== 3 || list.map((entry) => entry.label).join(",") !== "E01,E02,E03") {
  throw new Error(`番剧统一视频列表标签错误：${JSON.stringify(list)}`);
}
if (api.buildDownloadVideoListGroups(list).length !== 3) throw new Error("番剧条目不应被合并为合集父项");
if (list.find((entry) => entry.current)?.epId !== "232466") throw new Error("番剧当前项没有按 ep_id 选中");

const targetEntry = list[1];
const bangumiPage = api.makeDownloadBangumiPage(targetEntry, page);
if (bangumiPage.downloadScope !== "bangumi" || bangumiPage.seasonId !== "24588" || bangumiPage.epId !== "232466" || bangumiPage.cid !== "49053680") {
  throw new Error(`番剧任务页面身份错误：${JSON.stringify(bangumiPage)}`);
}

const params = api.downloadPlayurlParams(bangumiPage, null);
if (params.avid !== "26361000" || params.cid !== "49053680" || params.ep_id !== "232466" || params.season_id !== "24588" || params.bvid) {
  throw new Error(`PGC playurl 参数错误：${JSON.stringify(params)}`);
}
const request = await api.buildDownloadPlayurlRequest(bangumiPage, false);
const requestUrl = new URL(request.url);
if (requestUrl.pathname !== "/pgc/player/web/playurl" || request.source.includes("wbi")) {
  throw new Error(`番剧没有使用 PGC playurl：${JSON.stringify(request)}`);
}
for (const [key, expected] of Object.entries({ avid: "26361000", cid: "49053680", ep_id: "232466", season_id: "24588" })) {
  if (requestUrl.searchParams.get(key) !== expected) throw new Error(`PGC 参数 ${key} 错误：${requestUrl.href}`);
}

const videoTrack = {
  id: 80,
  baseUrl: "https://xy123x bilivideo.com/video.m4s".replace(" ", ""),
  codecs: "avc1.640028",
  mimeType: "video/mp4",
  height: 1080,
  width: 1920,
  bandwidth: 4_000_000
};
const audioTrack = {
  id: 30280,
  baseUrl: "https://xy123x.bilivideo.com/audio.m4s",
  codecs: "mp4a.40.2",
  mimeType: "audio/mp4",
  bandwidth: 128_000
};
const snapshot = api.buildBatchDownloadSnapshot({
  quality: 80,
  timelength: 141000,
  dash: { video: [videoTrack], audio: [audioTrack] }
}, bangumiPage, request.url);
if (snapshot.downloadScope !== "bangumi" || snapshot.epId !== "232466" || snapshot.seasonId !== "24588" || snapshot.cid !== "49053680") {
  throw new Error(`番剧播放响应没有保留独立身份：${JSON.stringify(snapshot)}`);
}
const fileName = api.buildDownloadFileName({
  ...snapshot,
  filenameTitle: "工作细胞 第一季",
  episodeIndex: 2,
  downloadScope: "bangumi",
  bvid: "BV1BangumiTest"
}, "merge", snapshot.videos[0], snapshot.audios[0]);
if (!fileName.includes("_BV1BangumiTest_E02_") || !fileName.endsWith("_video_audio.mp4")) {
  throw new Error(`番剧文件名没有使用 E02 和对应 BV：${fileName}`);
}

const resolvedIdentity = api.resolveDownloadIdentity({
  arc: { bvid: "BV1BangumiTest", aid: 26361000, cid: 49053680 },
  dash: { video: [videoTrack], audio: [audioTrack] },
  timelength: 141000
}, request.url);
if (!resolvedIdentity.ok || resolvedIdentity.identity.epId !== "232466" || resolvedIdentity.identity.seasonId !== "24588") {
  throw new Error(`番剧播放身份校验错误：${JSON.stringify(resolvedIdentity)}`);
}

const missingCidUrls = [];
context.window.fetch = async (url) => {
  missingCidUrls.push(String(url));
  return { ok: true, status: 200, json: async () => ({ code: 0, result: seasonResult }) };
};
const resolvedPage = await api.resolveDownloadPageForFetch({ ...page, cid: "" }, new AbortController().signal);
if (resolvedPage.cid !== "49053680" || missingCidUrls.some((url) => url.includes("x/web-interface/view"))) {
  throw new Error(`番剧缺失 CID 时没有从 season 接口补齐：${JSON.stringify({ resolvedPage, missingCidUrls })}`);
}

// 纯 ss 季目录页可能没有当前 ep_id/BVID/CID，但用户仍应能打开工作台并
// 选择目录中的任意集；工作台需要先用一集正片建立清晰度/音频选择基准。
context.location.href = "https://www.bilibili.com/bangumi/play/ss24588?from_spmid=666.25.series.0";
context.location.pathname = "/bangumi/play/ss24588";
context.window.__playinfo__ = null;
context.window.__PLAYURL_HYDRATE_DATA__ = null;
context.window.__INITIAL_STATE__ = {};
const seasonPage = api.currentDownloadPageIdentity();
if (seasonPage.downloadScope !== "bangumi" || seasonPage.epId || seasonPage.cid) {
  throw new Error(`纯 ss 季目录页不应伪造当前集身份：${JSON.stringify(seasonPage)}`);
}
const seasonResolvedPage = await api.resolveDownloadPageForFetch(seasonPage, new AbortController().signal);
if (seasonResolvedPage.epId !== "232465" || seasonResolvedPage.cid !== "49053679" || seasonResolvedPage.bvid !== "BV1BangumiE01") {
  throw new Error(`纯 ss 季目录页没有选出轨道基准集：${JSON.stringify(seasonResolvedPage)}`);
}

if (api.downloadBatchResolutionConcurrency("bangumi") !== 2) throw new Error("番剧解析并发没有固定为 2");
const gate = api.createDownloadBatchResolutionGate(2);
let active = 0;
let maximum = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  const release = await gate.acquire();
  active += 1;
  maximum = Math.max(maximum, active);
  await new Promise((resolve) => setTimeout(resolve, 2));
  active -= 1;
  release();
}));
if (maximum !== 2) throw new Error(`番剧远程闸门实际并发不是 2：${maximum}`);
if (api.calculateDownloadMergeBudget({ hardwareConcurrency: 8, deviceMemory: 16, largestEstimateBytes: 64 * 1024 * 1024 }).concurrency !== 4) {
  throw new Error("本地合并池没有保留最多 4 个并发上限");
}

console.log("番剧下载测试通过：单季度 E 标签、多季度 SxxExx、季度父项、PGC 身份隔离、普通模式分流和远程并发 2 均符合预期。");
