import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function currentDownloadBatchRouteKey", start);
if (start < 0 || end < 0) throw new Error("无法定位下载元数据解析函数");

const viewData = {
  bvid: "BV1MetadataTest",
  aid: 10001,
  title: "官方视频标题",
  owner: { name: "官方作者" },
  duration: 321,
  pages: [{ page: 1, cid: "20001", part: "官方分 P 标题", duration: 321 }]
};
const viewRequests = [];
const context = {
  URL,
  AbortController,
  location: {
    href: "https://www.bilibili.com/",
    origin: "https://www.bilibili.com",
    pathname: "/"
  },
  DOWNLOAD_ALLOWED_HOSTS: ["bilivideo.com", "bilivideo.cn"],
  DOWNLOAD_MAX_MERGE_CONCURRENCY: 4,
  MEDIA_PLAYURL_API_RE: /\/x\/player\/wbi\/playurl/,
  DOWNLOAD_PLAYURL_TEMPLATE: null,
  signQuery: (params) => new URLSearchParams(params).toString(),
  ensureKeys: async () => {},
  canDownloadRequestJson: () => true,
  normalizeDownloadSnapshot: (source) => ({
    ...source,
    videos: Array.isArray(source?.videos) ? source.videos : [],
    audios: Array.isArray(source?.audios) ? source.audios : []
  }),
  document: { querySelector: () => null, querySelectorAll: () => [] },
  window: { __INITIAL_STATE__: {} },
  downloadRequestJson: async (url) => {
    const parsed = new URL(url);
    viewRequests.push(parsed.pathname);
    if (parsed.pathname === "/x/web-interface/view") {
      return { ok: true, status: 200, json: async () => ({ code: 0, data: viewData }) };
    }
    throw new Error(`意外请求：${parsed.pathname}`);
  }
};

vm.runInNewContext(
  `const DOWNLOAD_JSON_TIMEOUT = 15000;
const DOWNLOAD_BATCH_RESOLUTION_TIMEOUT = 45000;
${script.slice(start, end)}
this.testApi = {
  isGenericDownloadTitle,
  buildDownloadEpisodeCatalogFromView,
  resolveDownloadPageForFetch,
  resolveDownloadCollectionPage,
  buildBatchDownloadSnapshot
};`,
  context
);

const api = context.testApi;
if (!api.isGenericDownloadTitle("Bilibili 视频")) throw new Error("入口占位标题没有被识别");

const basePage = {
  downloadScope: "episodes",
  videoId: viewData.bvid,
  bvid: viewData.bvid,
  aid: String(viewData.aid),
  cid: viewData.pages[0].cid,
  page: 1,
  title: "Bilibili 视频",
  filenameTitle: "Bilibili 视频",
  part: "",
  ownerName: ""
};
const catalog = api.buildDownloadEpisodeCatalogFromView(viewData, basePage, viewData.bvid);
if (catalog.length !== 1 || catalog[0].title !== viewData.title || catalog[0].filenameTitle !== viewData.title || catalog[0].ownerName !== viewData.owner.name) {
  throw new Error(`官方 view 目录元数据没有进入列表：${JSON.stringify(catalog)}`);
}

const resolved = await api.resolveDownloadPageForFetch(basePage, new AbortController().signal);
if (resolved.title !== viewData.title || resolved.filenameTitle !== viewData.title || resolved.part !== viewData.pages[0].part || resolved.ownerName !== viewData.owner.name) {
  throw new Error(`快速 BV 解析没有补齐标题/分 P/作者：${JSON.stringify(resolved)}`);
}
if (viewRequests.filter((path) => path === "/x/web-interface/view").length !== 1) {
  throw new Error(`快速 BV 元数据没有只读取一次 view：${JSON.stringify(viewRequests)}`);
}

const snapshot = api.buildBatchDownloadSnapshot({
  arc: { bvid: viewData.bvid, aid: viewData.aid, cid: viewData.pages[0].cid },
  timelength: 321000,
  dash: { video: [], audio: [] }
}, resolved, `https://api.bilibili.com/x/player/wbi/playurl?bvid=${viewData.bvid}&cid=${viewData.pages[0].cid}`);
if (snapshot.title !== viewData.title || snapshot.filenameTitle !== viewData.title || snapshot.ownerName !== viewData.owner.name || snapshot.part !== viewData.pages[0].part) {
  throw new Error(`播放快照丢失官方元数据：${JSON.stringify(snapshot)}`);
}

const collectionPage = await api.resolveDownloadCollectionPage({
  videoId: viewData.bvid,
  bvid: viewData.bvid,
  aid: String(viewData.aid),
  cid: viewData.pages[0].cid,
  page: 1,
  collectionIndex: 1,
  title: "旧合集标题",
  ownerName: "旧作者"
}, basePage, new AbortController().signal);
if (collectionPage.title !== viewData.title || collectionPage.filenameTitle !== viewData.title || collectionPage.ownerName !== viewData.owner.name) {
  throw new Error(`收藏夹/合集 BV 解析没有复用官方元数据：${JSON.stringify(collectionPage)}`);
}

console.log("下载元数据测试通过：快速 BV、普通目录和合集条目均使用官方 view 标题、分 P 与作者。");
