import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function currentDownloadBatchRouteKey", start);
if (start < 0 || end < 0) throw new Error("无法定位合集目录函数");

const basePage = {
  videoId: "BV1NsVh6eE1o",
  bvid: "BV1NsVh6eE1o",
  aid: "10001",
  page: 1,
  cid: "38696912266",
  title: "合集主标题"
};
const state = {
  videoData: {
    bvid: basePage.bvid,
    ugc_season: {
      sections: [{
        episodes: [
          { bvid: "BV1NsVh6eE1o", aid: "10001", cid: "38696912266", title: "当前视频", page: { page: 1, part: "当前视频", duration: 714 } },
          { bvid: "BV1Other00001", aid: "10002", cid: "38696912267", title: "第二个视频", page: { page: 1, part: "第二个视频", duration: 120 } },
          { bvid: "BV1Other00002", aid: "10003", cid: "38696912268", title: "第三个视频", page: { page: 1, part: "第三个视频", duration: 95 } }
        ]
      }]
    }
  }
};

const context = {
  URL,
  AbortController,
  location: { href: "https://www.bilibili.com/video/BV1NsVh6eE1o/" },
  window: { __INITIAL_STATE__: state },
  document: { querySelectorAll: () => [] }
};
context.canDownloadRequestJson = () => typeof context.window?.fetch === "function";
context.downloadRequestJson = (url, options = {}) => context.window.fetch(url, options);
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { readDownloadCollectionCatalog, fetchDownloadCollectionCatalog, normalizeDownloadCollectionEntry, isConfirmedDownloadCollectionCatalog, resolveDownloadScopeMode, makeDownloadCollectionPage, resolveDownloadCollectionPage };`,
  context
);

const { readDownloadCollectionCatalog, fetchDownloadCollectionCatalog, normalizeDownloadCollectionEntry, isConfirmedDownloadCollectionCatalog, resolveDownloadScopeMode, makeDownloadCollectionPage, resolveDownloadCollectionPage } = context.testApi;
const catalog = readDownloadCollectionCatalog(basePage);
if (catalog.length !== 3) throw new Error(`合集条目数量错误：${JSON.stringify(catalog)}`);
if (catalog.map((entry) => entry.collectionIndex).join(",") !== "1,2,3") {
  throw new Error(`合集顺序错误：${JSON.stringify(catalog)}`);
}
if (catalog[0].bvid !== basePage.bvid || catalog[1].bvid === basePage.bvid) {
  throw new Error(`合集 BVID 隔离错误：${JSON.stringify(catalog)}`);
}
if (catalog[0].cid !== "38696912266" || catalog[1].cid !== "38696912267") {
  throw new Error(`合集 CID 读取错误：${JSON.stringify(catalog)}`);
}
if (catalog[0].duration !== 714 || catalog[1].durationLabel !== "02:00") {
  throw new Error(`合集时长读取错误：${JSON.stringify(catalog)}`);
}
if (!catalog[0].current || catalog[1].current) throw new Error("合集当前项标记错误");

const collectionPage = makeDownloadCollectionPage(catalog[1], basePage);
if (collectionPage.videoId !== catalog[1].videoId || collectionPage.cid !== catalog[1].cid) {
  throw new Error(`合集页面身份没有沿用条目 BV/CID：${JSON.stringify(collectionPage)}`);
}
if (collectionPage.title !== catalog[1].title || collectionPage.filenameTitle !== catalog[1].title || collectionPage.collectionTitle !== basePage.title) {
  throw new Error(`合集条目标题与文件标题没有按条目隔离：${JSON.stringify(collectionPage)}`);
}

// 真实播放器页的选集 DOM 只有 CID 和标题，没有 data-bvid；不能在官方
// view 接口确认前把同 BV 多 P 误显示成合集。
context.window.__INITIAL_STATE__ = {};
const domNodes = [
  { cid: "38696912266", title: "当前视频", active: false },
  { cid: "38476055028", title: "另一个视频", active: false }
].map((item) => ({
  getAttribute(name) { return name === "data-cid" ? item.cid : null; },
  querySelector() { return { textContent: item.title }; },
  classList: { contains(name) { return item.active && name === "bpx-state-multi-active-item"; } }
}));
context.document.querySelectorAll = (selector) => selector.includes("section-content") ? domNodes : [];
const provisional = readDownloadCollectionCatalog(basePage);
if (provisional.length !== 0 || isConfirmedDownloadCollectionCatalog(provisional)) {
  throw new Error(`仅有 CID 的 DOM 不应提前进入合集模式：${JSON.stringify(provisional)}`);
}
const cidOnlyEntry = normalizeDownloadCollectionEntry({ cid: basePage.cid, title: "当前视频" }, basePage, 0);
if (!cidOnlyEntry.current) {
  throw new Error(`仅凭 CID 的当前项标记错误：${JSON.stringify(cidOnlyEntry)}`);
}
context.window.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: 0,
    data: {
      bvid: basePage.bvid,
      aid: basePage.aid,
      ugc_season: { sections: [{ episodes: [
        { bvid: "BV1NsVh6eE1o", aid: "10001", cid: "38696912266", title: "当前视频", page: { part: "当前视频", duration: 714 } },
        { bvid: "BV1Other00001", aid: "10002", cid: "38476055028", title: "另一个视频", page: { part: "另一个视频", duration: 1171 } }
      ] }] }
    }
  })
});
const official = await fetchDownloadCollectionCatalog(basePage, {}, provisional);
if (official.length !== 2 || official[1].bvid !== "BV1Other00001" || official[1].duration !== 1171) {
  throw new Error(`官方 view 补齐合集身份错误：${JSON.stringify(official)}`);
}

// SSR/状态可能已经带有不同 BV，但只给每个条目的首个 CID；即便如此，
// 仍必须继续请求官方 view，补齐其中某个 BV 的内部多 P，而不能提前返回 Cxx。
const confirmedButIncomplete = [
  { collectionIndex: 1, bvid: basePage.bvid, aid: basePage.aid, cid: basePage.cid, title: "当前视频" },
  { collectionIndex: 2, bvid: "BV1Other00001", aid: "10002", cid: "38476055028", title: "多 P 合集视频" }
];
context.window.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: 0,
    data: {
      bvid: basePage.bvid,
      aid: basePage.aid,
      ugc_season: { sections: [{ episodes: [
        { bvid: basePage.bvid, aid: basePage.aid, cid: basePage.cid, title: "当前视频", pages: [
          { page: 1, cid: basePage.cid, part: "当前 P1", duration: 714 },
          { page: 2, cid: "38696912269", part: "当前 P2", duration: 120 }
        ] },
        { bvid: "BV1Other00001", aid: "10002", cid: "38476055028", title: "多 P 合集视频", pages: [
          { page: 1, cid: "38476055028", part: "条目 P1", duration: 1171 },
          { page: 2, cid: "38476055029", part: "条目 P2", duration: 901 }
        ] }
      ] }] }
    }
  })
});
const enriched = await fetchDownloadCollectionCatalog(basePage, {}, confirmedButIncomplete);
if (enriched.length !== 4 || !enriched.some((entry) => entry.collectionIndex === 2 && entry.page === 2 && entry.cid === "38476055029")) {
  throw new Error(`已确认但不完整的合集没有继续补齐内部多 P：${JSON.stringify(enriched)}`);
}

// 条目 CID 可能来自旧 DOM；官方 view 对该 BV 的 pages 映射才是最终依据。
context.window.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: 0,
    data: {
      bvid: "BV1Other00001",
      aid: "10002",
      title: "官方条目标题",
      pages: [{ page: 1, cid: "38476055028", part: "官方条目标题", duration: 1171 }]
    }
  })
});
const correctedPage = await resolveDownloadCollectionPage({
  ...catalog[1],
  cid: "旧的错误 CID"
}, basePage, {});
if (correctedPage.cid !== "38476055028" || correctedPage.title !== "官方条目标题") {
  throw new Error(`合集条目没有使用官方 view 的 CID/标题：${JSON.stringify(correctedPage)}`);
}

// 同一 BV 的多个合集内部 P 共用一次 view 元数据请求；每个叶子仍会
// 在批量阶段单独请求自己的 playurl/CID。
let sharedViewCount = 0;
context.window.fetch = async () => {
  sharedViewCount += 1;
  return {
    ok: true,
    status: 200,
    json: async () => ({ code: 0, data: {
      bvid: "BV1Other00001",
      aid: "10002",
      title: "多 P 视频",
      pages: [
        { page: 1, cid: "38476055028", part: "P1", duration: 1171 },
        { page: 2, cid: "38476055029", part: "P2", duration: 901 }
      ]
    } })
  };
};
const sharedViewCache = new Map();
const sharedViewControllers = new Set();
await Promise.all([
  resolveDownloadCollectionPage({ bvid: "BV1Other00001", aid: "10002", videoId: "BV1Other00001", collectionIndex: 2, page: 1, cid: "38476055028", title: "多 P 视频" }, basePage, {}, sharedViewCache, sharedViewControllers),
  resolveDownloadCollectionPage({ bvid: "BV1Other00001", aid: "10002", videoId: "BV1Other00001", collectionIndex: 2, page: 2, cid: "38476055029", title: "多 P 视频" }, basePage, {}, sharedViewCache, sharedViewControllers)
]);
if (sharedViewCount !== 1 || sharedViewCache.size !== 1) {
  throw new Error(`同 BV 多 P 重复请求 view：${JSON.stringify({ sharedViewCount, cacheSize: sharedViewCache.size })}`);
}

// 同 BV 多 P 的官方 view 只有 pages，没有 ugc_season；即便播放器 DOM
// 也提供多个 CID，也必须保持在“同 BV 分 P”模式。
context.window.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: 0,
    data: {
      bvid: basePage.bvid,
      aid: basePage.aid,
      pages: [
        { page: 1, cid: "38696912266", part: "P1", duration: 714 },
        { page: 2, cid: "38696912267", part: "P2", duration: 120 }
      ]
    }
  })
});
const sameBvidCollection = await fetchDownloadCollectionCatalog(basePage, {}, [
  { cid: "38696912266", title: "P1" },
  { cid: "38696912267", title: "P2" }
]);
if (sameBvidCollection.length !== 0) {
  throw new Error(`同 BV 多 P 不应自动切换为合集模式：${JSON.stringify(sameBvidCollection)}`);
}
if (resolveDownloadScopeMode([
  { bvid: basePage.bvid, cid: "38696912266" },
  { bvid: basePage.bvid, cid: "38696912267" }
], basePage) !== "episodes") {
  throw new Error("同 BV 多 P 的自动下载范围必须是 episodes");
}
if (resolveDownloadScopeMode([
  { bvid: basePage.bvid, cid: "38696912266" },
  { bvid: "BV1Other00001", cid: "38696912267" }
], basePage) !== "collection") {
  throw new Error("不同 BV 的确认目录必须自动切到 collection");
}
if (resolveDownloadScopeMode([
  { cid: "38696912266" },
  { cid: "38696912267" }
], basePage) !== "episodes") {
  throw new Error("只有 CID 的临时目录必须保持 episodes");
}

const sameBvidState = {
  videoData: {
    ugc_season: {
      sections: [{ episodes: [
        { bvid: "BV1NsVh6eE1o", cid: "1", page: { part: "P1" } },
        { bvid: "BV1NsVh6eE1o", cid: "2", page: { part: "P2" } }
      ] }]
    }
  }
};
context.window.__INITIAL_STATE__ = sameBvidState;
if (readDownloadCollectionCatalog(basePage).length !== 0) {
  throw new Error("同一 BV 的多个 P 不应进入合集模式");
}

const missingCid = normalizeDownloadCollectionEntry({
  collectionIndex: 4,
  bvid: "BV1MissingCid",
  title: "待补齐 CID"
}, basePage, 3);
if (missingCid.collectionIndex !== 4 || missingCid.cid !== "" || missingCid.bvid !== "BV1MissingCid") {
  throw new Error(`缺失 CID 的合集条目规范化错误：${JSON.stringify(missingCid)}`);
}

console.log("合集下载测试通过：不同 BV 隔离、顺序、CID、时长、当前项和缺失 CID 条目均符合预期。");
