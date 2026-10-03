import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function currentDownloadBatchRouteKey", start);
if (start < 0 || end < 0) throw new Error("无法定位统一视频列表函数");

const context = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1o6tGzDErU/" },
  window: {}
};
context.canDownloadRequestJson = () => typeof context.window?.fetch === "function";
context.downloadRequestJson = (url, options = {}) => context.window.fetch(url, options);
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { buildDownloadVideoList, buildDownloadVideoListGroups, setDownloadVideoListGroupSelection, downloadVideoListLabel, expandDownloadCollectionCatalog, buildDownloadCollectionCatalogFromView, fetchDownloadCatalogBundle, createDownloadBatchResolutionGate };`,
  context
);

const { buildDownloadVideoList, buildDownloadVideoListGroups, setDownloadVideoListGroupSelection, buildDownloadCollectionCatalogFromView, fetchDownloadCatalogBundle, createDownloadBatchResolutionGate } = context.testApi;
const basePage = {
  videoId: "BV1o6tGzDErU",
  bvid: "BV1o6tGzDErU",
  aid: "10001",
  page: 2,
  cid: "20002",
  title: "混合列表主标题"
};
const collection = [
  {
    collectionIndex: 1,
    bvid: "BV1SingleVideo",
    aid: "10002",
    title: "合集中的单 P 视频",
    pages: [{ page: 1, cid: "20001", part: "合集中的单 P 视频", duration: 60 }]
  },
  {
    collectionIndex: 2,
    bvid: basePage.bvid,
    aid: basePage.aid,
    title: "当前视频的合集条目",
    pages: [
      { page: 1, cid: "20003", part: "1", duration: 120 },
      { page: 2, cid: basePage.cid, part: "2", duration: 130 },
      { page: 3, cid: "20004", part: "3", duration: 140 }
    ]
  },
  {
    collectionIndex: 3,
    bvid: "BV1ThirdVideo",
    aid: "10003",
    title: "另一个单 P 视频",
    pages: [{ page: 1, cid: "20005", part: "另一个单 P 视频", duration: 90 }]
  }
];
const list = buildDownloadVideoList([
  { ...basePage, page: 1, cid: "current-p1", part: "旧的 P1" },
  { ...basePage, page: 2, cid: basePage.cid, part: "旧的 P2" }
], collection, basePage);

if (list.map((entry) => entry.label).join(",") !== "C01,C02_P01,C02_P02,C02_P03,C03") {
  throw new Error(`混合视频列表标识错误：${JSON.stringify(list)}`);
}
if (list.length !== 5 || list.some((entry) => entry.downloadScope !== "collection")) {
  throw new Error(`混合页面没有统一为一个合集视频列表：${JSON.stringify(list)}`);
}
const current = list.find((entry) => entry.label === "C02_P02");
if (!current?.current || list.filter((entry) => entry.current).length !== 1) {
  throw new Error(`当前合集分 P 标记错误：${JSON.stringify(list)}`);
}
if (current.bvid !== basePage.bvid || current.cid !== basePage.cid || current.page !== 2) {
  throw new Error(`当前项没有保留独立 BVID/CID/page：${JSON.stringify(current)}`);
}
if (list.find((entry) => entry.label === "C01")?.page !== 1 || list.find((entry) => entry.label === "C03")?.page !== 1) {
  throw new Error(`单 P 合集条目被错误当成当前 BV 分 P：${JSON.stringify(list)}`);
}

// 混合合集里，某个合集视频本身也可能有多个 P；这些 P 与其它 C 条目
// 必须共存于同一个统一列表，且刷新/重建列表时不能丢失 Cxx_Pyy 标识。
const expandedCollection = [
  { collectionIndex: 1, bvid: "BV1SingleVideo", aid: "10002", title: "单 P 视频", page: 1, cid: "20001", collectionPageCount: 1 },
  { collectionIndex: 2, bvid: "BV1MultiVideo", aid: "10004", title: "多 P 视频", part: "第一 P", page: 1, cid: "21001", collectionPageCount: 2, collectionExpanded: true },
  { collectionIndex: 2, bvid: "BV1MultiVideo", aid: "10004", title: "多 P 视频", part: "第二 P", page: 2, cid: "21002", collectionPageCount: 2, collectionExpanded: true },
  { collectionIndex: 3, bvid: "BV1ThirdVideo", aid: "10003", title: "另一个单 P 视频", page: 1, cid: "20005", collectionPageCount: 1 }
];
const expandedList = buildDownloadVideoList([], expandedCollection, {
  videoId: "BV1MultiVideo",
  bvid: "BV1MultiVideo",
  aid: "10004",
  page: 2,
  cid: "21002",
  title: "多 P 视频"
});
if (expandedList.map((entry) => entry.label).join(",") !== "C01,C02_P01,C02_P02,C03") {
  throw new Error(`混合列表重建时丢失合集内部 P：${JSON.stringify(expandedList)}`);
}
if (expandedList.filter((entry) => entry.current).length !== 1 || !expandedList.find((entry) => entry.label === "C02_P02")?.current) {
  throw new Error(`合集内部当前 P 标记错误：${JSON.stringify(expandedList)}`);
}

const plainPages = buildDownloadVideoList([
  { ...basePage, page: 1, cid: "20006", part: "第一 P" },
  { ...basePage, page: 2, cid: basePage.cid, part: "第二 P" }
], [], basePage);
if (plainPages.map((entry) => entry.label).join(",") !== "P01,P02" || plainPages.some((entry) => entry.downloadScope !== "episodes")) {
  throw new Error(`普通同 BV 多 P 没有使用 P 列表：${JSON.stringify(plainPages)}`);
}
if (plainPages.filter((entry) => entry.current).length !== 1 || !plainPages.find((entry) => entry.label === "P02")?.current) {
  throw new Error(`普通分 P 当前项标记错误：${JSON.stringify(plainPages)}`);
}

// 使用 B 站 /x/web-interface/view 实际返回的 episode 形状：episode.page
// 是首个 P 的对象，episode.pages 才是该 BV 的完整分 P 目录。合集列表
// 必须同时展开单 P 视频和多 P 视频，且不同 BV 的同号 P 不能互相覆盖。
const actualShape = buildDownloadVideoList([], [
  {
    collectionIndex: 67,
    bvid: "BV1tGhbzdEg4",
    aid: "114957349883009",
    title: "【23小时VIP版】宗门让我联姻，我修成武道绝巅！！！",
    page: { page: 1, cid: "31435395006", part: "1", duration: 28423 },
    pages: [
      { page: 1, cid: "31435395006", part: "1", duration: 28423 },
      { page: 2, cid: "31435587870", part: "2", duration: 32443 },
      { page: 3, cid: "31435720748", part: "3", duration: 17541 }
    ]
  },
  {
    collectionIndex: 70,
    bvid: "BV1o6tGzDErU",
    aid: "114969882395784",
    title: "【完结文】转职人皇，开局召唤纣王帝辛~",
    page: { page: 1, cid: "31479368954", part: "1", duration: 34500 },
    pages: [
      { page: 1, cid: "31479368954", part: "1", duration: 34500 },
      { page: 2, cid: "31480218357", part: "2", duration: 34540 },
      { page: 3, cid: "31480482588", part: "3", duration: 34141 },
      { page: 4, cid: "31480743120", part: "4", duration: 29250 }
    ]
  },
  {
    collectionIndex: 71,
    bvid: "BV18NtJzfEXs",
    aid: "114969819512345",
    title: "【完结文】开局绑定无敌系统！",
    page: { page: 1, cid: "31493981952", part: "1", duration: 18132 },
    pages: [{ page: 1, cid: "31493981952", part: "1", duration: 18132 }]
  }
], {
  videoId: "BV1o6tGzDErU",
  bvid: "BV1o6tGzDErU",
  aid: "114969882395784",
  page: 2,
  cid: "31480218357",
  title: "【完结文】转职人皇，开局召唤纣王帝辛~"
});
if (actualShape.map((entry) => entry.label).join(",") !== "C67_P01,C67_P02,C67_P03,C70_P01,C70_P02,C70_P03,C70_P04,C71") {
  throw new Error(`真实 view 数据形状没有完整展开：${JSON.stringify(actualShape)}`);
}
const sameCid = actualShape.filter((entry) => entry.cid === "31480218357");
if (sameCid.length !== 1 || sameCid[0].bvid !== "BV1o6tGzDErU" || !sameCid[0].current) {
  throw new Error(`合集内部 P 的 BVID/CID/current 没有隔离：${JSON.stringify(sameCid)}`);
}
if (actualShape.filter((entry) => entry.current).length !== 1) {
  throw new Error(`混合集合展开后当前项不唯一：${JSON.stringify(actualShape.filter((entry) => entry.current))}`);
}

// 真实 /x/web-interface/view 的 ugc_season episode 也可能把单 P 的 pages
// 返回为数字，而把多 P 的 pages 返回为完整数组。数字不能伪造缺少 CID 的
// 分 P，但不能因此影响同一列表中的其它视频和已返回的多 P 展开。
const mixedPagesShape = buildDownloadCollectionCatalogFromView({
  ugc_season: {
    sections: [{ episodes: [
      {
        bvid: "BV1NumericSingle",
        aid: "12001",
        title: "数字 pages 的单 P 视频",
        page: { page: 1, cid: "51001", part: "单 P", duration: 60 },
        pages: 1
      },
      {
        bvid: "BV1ArrayMulti",
        aid: "12002",
        title: "数组 pages 的多 P 视频",
        page: { page: 1, cid: "52001", part: "P1", duration: 60 },
        pages: [
          { page: 1, cid: "52001", part: "P1", duration: 60 },
          { page: 2, cid: "52002", part: "P2", duration: 70 }
        ]
      }
    ] }]
  }
}, {
  videoId: "BV1NumericSingle",
  bvid: "BV1NumericSingle",
  aid: "12001",
  page: 1,
  cid: "51001",
  title: "数字 pages 的单 P 视频"
});
const mixedPagesList = buildDownloadVideoList([], mixedPagesShape, {
  videoId: "BV1NumericSingle",
  bvid: "BV1NumericSingle",
  aid: "12001",
  page: 1,
  cid: "51001",
  title: "数字 pages 的单 P 视频"
});
if (mixedPagesList.map((entry) => entry.label).join(",") !== "C01,C02_P01,C02_P02") {
  throw new Error(`数字/数组 pages 混合形状没有正确展开：${JSON.stringify(mixedPagesList)}`);
}
if (mixedPagesList.find((entry) => entry.label === "C02_P02")?.cid !== "52002") {
  throw new Error(`数组 pages 的第二个 P 没有保留自己的 CID：${JSON.stringify(mixedPagesList)}`);
}

// 用当前真实页面的 view 响应形状验证：一个合集条目列表可以同时包含
// 不同 BV 视频和其中某些 BV 的多个 P；普通 DOM P 目录即使带着旧 CID，
// 也不能在同 BV/同 page 上生成第二个重复任务。
const bundleData = {
  pages: [
    { page: 1, cid: "31479368954", part: "1", duration: 34500 },
    { page: 2, cid: "31480218357", part: "2", duration: 34540 },
    { page: 3, cid: "31480482588", part: "3", duration: 34141 },
    { page: 4, cid: "31480743120", part: "4", duration: 29250 }
  ],
  ugc_season: {
    sections: [{ episodes: [
      {
        bvid: "BV1o6tGzDErU",
        aid: "114969882395784",
        title: "当前合集视频",
        page: { page: 1, cid: "31479368954", part: "1", duration: 34500 },
        pages: [
          { page: 1, cid: "31479368954", part: "1", duration: 34500 },
          { page: 2, cid: "31480218357", part: "2", duration: 34540 },
          { page: 3, cid: "31480482588", part: "3", duration: 34141 },
          { page: 4, cid: "31480743120", part: "4", duration: 29250 }
        ]
      },
      {
        bvid: "BV1OtherVideo",
        aid: "114000000000000",
        title: "合集中的另一个视频",
        page: { page: 1, cid: "41001", part: "1", duration: 600 },
        pages: [{ page: 1, cid: "41001", part: "1", duration: 600 }]
      }
    ] }]
  }
};
const bundleCollection = buildDownloadCollectionCatalogFromView(bundleData, basePage);
const bundleList = buildDownloadVideoList([
  { ...basePage, page: 1, cid: "stale-dom-cid", part: "旧 P1" },
  { ...basePage, page: 2, cid: basePage.cid, part: "旧 P2" }
], bundleCollection, basePage);
if (bundleList.map((entry) => entry.label).join(",") !== "C01_P01,C01_P02,C01_P03,C01_P04,C02") {
  throw new Error(`真实 view 合集/分 P 混合列表错误：${JSON.stringify(bundleList)}`);
}
if (bundleList.filter((entry) => entry.bvid === basePage.bvid).length !== 4) {
  throw new Error(`当前 BV 的 4 个 P 没有完整保留：${JSON.stringify(bundleList)}`);
}
if (bundleList.filter((entry) => entry.bvid === basePage.bvid && entry.downloadScope === "episodes").length !== 0) {
  throw new Error(`合集内部 P 被重复加入普通 P 列表：${JSON.stringify(bundleList)}`);
}
if (bundleList.find((entry) => entry.label === "C01_P02")?.cid !== "31480218357") {
  throw new Error(`合集内部 P 没有使用自己的 CID：${JSON.stringify(bundleList)}`);
}

// 有些成功的 view 响应只包含当前 BV 的 pages，不包含 ugc_season；
// 已由页面 DOM 确认的不同 BV 目录不能在刷新时被清空，否则无法继续
// 同时选择合集视频和其中的分 P。
context.window.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ code: 0, data: { bvid: basePage.bvid, aid: basePage.aid, pages: bundleData.pages } })
});
const fallbackCollectionBundle = await fetchDownloadCatalogBundle(basePage, {}, [
  { ...basePage, page: 1, cid: "31479368954", part: "旧 P1" },
  { ...basePage, page: 2, cid: basePage.cid, part: "旧 P2" }
], [
  {
    collectionIndex: 1,
    bvid: basePage.bvid,
    aid: basePage.aid,
    title: basePage.title,
    pages: bundleData.pages
  },
  {
    collectionIndex: 2,
    bvid: "BV1OtherVideo",
    aid: "114000000000000",
    title: "接口未返回合集字段的其他视频",
    pages: [{ page: 1, cid: "41001", part: "1", duration: 600 }]
  }
]);
if (fallbackCollectionBundle.collection.length !== 5 ||
  fallbackCollectionBundle.collection.filter((entry) => entry.bvid === "BV1OtherVideo").length !== 1) {
  throw new Error(`view 缺少 ugc_season 时没有保留已确认合集目录：${JSON.stringify(fallbackCollectionBundle.collection)}`);
}

// 初始页面只确认到合集根条目/当前 P 时，后到的普通 P 目录也必须并入
// 同一个合集 BV；最终列表应能同时选择其它合集视频和当前 BV 的多个 P。
const partialCollection = [
  {
    collectionIndex: 1,
    bvid: "BV1OtherVideo",
    aid: "114000000000000",
    title: "合集中的另一个视频",
    page: 1,
    cid: "41001",
    collectionPageCount: 1,
    collectionExpanded: true
  },
  {
    collectionIndex: 2,
    bvid: basePage.bvid,
    aid: basePage.aid,
    title: basePage.title,
    page: 1,
    cid: bundleData.pages[0].cid,
    collectionPageCount: 1,
    collectionExpanded: true
  }
];
const simultaneousList = buildDownloadVideoList(bundleData.pages.map((page) => ({
  ...basePage,
  ...page,
  videoId: basePage.videoId,
  bvid: basePage.bvid,
  aid: basePage.aid,
  title: basePage.title,
  source: "view"
})), partialCollection, basePage);
if (simultaneousList.map((entry) => entry.label).join(",") !== "C01,C02_P01,C02_P02,C02_P03,C02_P04") {
  throw new Error(`合集根条目与当前 BV 分 P 没有统一展开：${JSON.stringify(simultaneousList)}`);
}
const selectedSimultaneously = simultaneousList.filter((entry) => ["C01", "C02_P01", "C02_P03"].includes(entry.label));
if (selectedSimultaneously.length !== 3 || new Set(selectedSimultaneously.map((entry) => entry.listKey)).size !== 3) {
  throw new Error(`合集视频和其中分 P 不能同时作为独立选择项：${JSON.stringify(selectedSimultaneously)}`);
}
if (selectedSimultaneously[0].bvid !== "BV1OtherVideo" ||
  selectedSimultaneously[1].bvid !== basePage.bvid ||
  selectedSimultaneously[1].cid !== bundleData.pages[0].cid ||
  selectedSimultaneously[2].cid !== bundleData.pages[2].cid) {
  throw new Error(`同时选择时没有保留每个条目的 BVID/CID：${JSON.stringify(selectedSimultaneously)}`);
}

// UI 按合集 BV 分组：父项全选该视频所有 P，子项仍可独立选择；普通分 P
// 保持同级，因此跨 BV 合集项和某个合集视频内部 P 能进入同一个批量。
const simultaneousGroups = buildDownloadVideoListGroups(simultaneousList);
const currentVideoGroup = simultaneousGroups.find((group) => group.videoId === basePage.videoId);
const otherVideoGroup = simultaneousGroups.find((group) => group.videoId === "BV1OtherVideo");
if (simultaneousGroups.length !== 1 + 1 || currentVideoGroup?.children.length !== 4 || otherVideoGroup?.children.length !== 1) {
  throw new Error(`统一视频列表的合集父子层级错误：${JSON.stringify(simultaneousGroups.map((group) => ({ key: group.key, label: group.label, children: group.children.length })))}`);
}
if (currentVideoGroup.label !== "C02" || currentVideoGroup.children.map((entry) => entry.label).join(",") !== "C02_P01,C02_P02,C02_P03,C02_P04") {
  throw new Error(`合集 BV 父项/内部 P 标识错误：${JSON.stringify(currentVideoGroup)}`);
}
let groupedSelection = setDownloadVideoListGroupSelection(new Set([otherVideoGroup.children[0].listKey]), currentVideoGroup, true);
if (groupedSelection.size !== 5 || !groupedSelection.has(otherVideoGroup.children[0].listKey)) {
  throw new Error(`选择合集视频父项未将该 BV 的所有 P 加入当前选择：${JSON.stringify([...groupedSelection])}`);
}
groupedSelection = setDownloadVideoListGroupSelection(groupedSelection, currentVideoGroup, false);
if (groupedSelection.size !== 1 || !groupedSelection.has(otherVideoGroup.children[0].listKey)) {
  throw new Error(`取消某个合集父项时误清除了其它视频选择：${JSON.stringify([...groupedSelection])}`);
}
const plainVideo = {
  videoId: "BV1PlainVideo",
  bvid: "BV1PlainVideo",
  aid: "10005",
  page: 1,
  cid: "60001",
  part: "普通视频",
  title: "不属于合集的普通视频",
  duration: 100
};
const mixedSourceList = buildDownloadVideoList([plainVideo], collection, basePage);
const mixedSourceGroups = buildDownloadVideoListGroups(mixedSourceList);
const selectedMixedItems = [
  mixedSourceGroups.find((group) => group.kind === "collection" && group.collectionIndex === 1).children[0],
  mixedSourceGroups.find((group) => group.kind === "collection" && group.collectionIndex === 2).children.find((entry) => entry.page === 3),
  mixedSourceGroups.find((group) => group.kind === "episode").children[0]
];
if (selectedMixedItems.map((entry) => entry.downloadScope).join(",") !== "collection,collection,episodes" ||
  new Set(selectedMixedItems.map((entry) => entry.listKey)).size !== 3) {
  throw new Error(`合集视频、其中 P 与同 BV 普通分 P 不能同时独立选择：${JSON.stringify(selectedMixedItems)}`);
}

// 工作台打开时一次复用当前 BV 的 view 响应，同时生成普通 pages 与合集叶子；
// 不应为两个目录并行发送两次相同的官方 view 请求。
let viewRequestCount = 0;
context.window = {
  fetch: async () => {
    viewRequestCount += 1;
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { bvid: basePage.bvid, aid: basePage.aid, ...bundleData } }) };
  }
};
const bundle = await fetchDownloadCatalogBundle(basePage, {}, [
  { ...basePage, page: 1, cid: "stale-dom-cid", part: "旧 P1" },
  { ...basePage, page: 2, cid: basePage.cid, part: "旧 P2" }
], []);
if (viewRequestCount !== 1 || bundle.catalog.length !== 4 || bundle.collection.length !== 5) {
  throw new Error(`合集与分 P目录没有复用单次 view 响应：${JSON.stringify({ viewRequestCount, catalog: bundle.catalog.length, collection: bundle.collection.length })}`);
}

// 全选 689 个叶子项时，官方身份解析有边界，但分轨在释放闸门后可以
// 立即进入下载管理器；验证闸门不会把下载阶段锁死。
const gate = createDownloadBatchResolutionGate(2);
const first = await gate.acquire();
const second = await gate.acquire();
let thirdReady = false;
const thirdPromise = gate.acquire().then((release) => {
  thirdReady = true;
  return release;
});
await Promise.resolve();
if (gate.active !== 2 || gate.queued !== 1 || thirdReady) throw new Error("合集身份解析闸门并发状态错误");
first();
const third = await thirdPromise;
if (!thirdReady || gate.active !== 2) throw new Error("合集身份解析槽位释放/补位错误");
second();
third();
if (gate.active !== 0 || gate.queued !== 0) throw new Error("合集身份解析闸门未完全释放");

console.log("统一视频列表测试通过：混合合集/分 P 展开、BVID/CID 隔离、Cxx_Pyy 标识和普通 P 回退均符合预期。");
