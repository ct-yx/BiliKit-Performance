import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function isFavoritesFixPage");
const end = script.indexOf("  function favoritesFixInstallStyle", start);
if (start < 0 || end < 0) throw new Error("无法定位收藏夹修复逻辑");

const context = {
  URL,
  location: { href: "https://space.bilibili.com/701944900/favlist?fid=2056261900&ftype=create&" },
  FAVORITES_FIX_CACHE_KEY: "bilikit:favorites-fix:v1",
  FAVORITES_FIX_CACHE_LIMIT: 240,
  FAVORITES_FIX_GENERIC_TITLE_RE: /^(?:已失效视频|视频去哪了呢？|该视频或许已被删除了|该视频或许已经被删除了|视频去哪了|)$/i,
  FAVORITES_FIX_LOADING_TITLE_RE: /^(?:正在加载数据(?:\.\.\.|…)?|加载中(?:\.\.\.|…)?|正在查询(?:\.\.\.|…)?|查询中(?:\.\.\.|…)?)$/i,
  FAVORITES_FIX_PLACEHOLDER_COVER_RE: /\/bfs\/archive\/(?:be27fd62c99036dce67efface486fb0a88ffed06|404|error)[^/]*\.(?:jpg|jpeg|png|webp)/i,
  FAVORITES_FIX_EXTERNAL_CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
  FAVORITES_FIX_TID_NAMES: { 27: "综合" },
  FAVORITES_FIX_HOVER_STATE: { panel: null, anchor: null, media: null, hideTimer: 0 },
  localStorage: (() => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  })()
};
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { isFavoritesFixPage, parseFavoritesFixUrl, favoritesFixIsRepairTarget, favoritesFixApplyCard, favoritesFixNormalizeId, favoritesFixNormalizePages, favoritesFixNormalizeMedia, favoritesFixMergeMedia, favoritesFixTitle, favoritesFixDisplayTitle, favoritesFixCardDetails, favoritesFixFailureReason, favoritesFixIsLoadingTitle, favoritesFixIsUnusableTitle, favoritesFixIsPlaceholderCover, favoritesFixHasPlaceholderCover, favoritesFixNormalizeExternalCover, favoritesFixNormalizeExternalMetadata, favoritesFixParseExternalPayload, favoritesFixExternalCheckFresh, favoritesFixCachedExternalUseful, favoritesFixCacheRecord, favoritesFixReadCache, favoritesFixWriteCache, favoritesFixMenuText, favoritesFixClearLoadingLabels, favoritesFixCardIdentityKeys, favoritesFixMediaIdentityKeys, favoritesFixFindMediaForCard, favoritesFixCategoryName, favoritesFixMediaForHover };`,
  context
);

const {
  isFavoritesFixPage,
  parseFavoritesFixUrl,
  favoritesFixIsRepairTarget,
  favoritesFixApplyCard,
  favoritesFixNormalizeId,
  favoritesFixNormalizePages,
  favoritesFixNormalizeMedia,
  favoritesFixMergeMedia,
  favoritesFixTitle,
  favoritesFixDisplayTitle,
  favoritesFixCardDetails,
  favoritesFixFailureReason,
  favoritesFixIsLoadingTitle,
  favoritesFixIsPlaceholderCover,
  favoritesFixHasPlaceholderCover,
  favoritesFixNormalizeExternalCover,
  favoritesFixParseExternalPayload,
  favoritesFixExternalCheckFresh,
  favoritesFixCacheRecord,
  favoritesFixReadCache,
  favoritesFixWriteCache,
  favoritesFixMenuText,
  favoritesFixClearLoadingLabels,
  favoritesFixCardIdentityKeys,
  favoritesFixMediaIdentityKeys,
  favoritesFixFindMediaForCard,
  favoritesFixCategoryName,
  favoritesFixMediaForHover,
  favoritesFixIsUnusableTitle,
  favoritesFixNormalizeExternalMetadata,
  favoritesFixCachedExternalUseful
} = context.testApi;

const makeModernCard = (title) => ({
  querySelector: (selector) => selector === ".bili-video-card__title a" ? { textContent: title } : null,
  querySelectorAll: (selector) => selector.includes(".bili-video-card__title") ? [{ textContent: title }] : [],
  classList: { contains: () => false }
});
if (!favoritesFixIsRepairTarget(makeModernCard("已失效视频"))) {
  throw new Error("失效收藏卡片未进入修复目标");
}
if (favoritesFixIsRepairTarget(makeModernCard("我都已经渡劫期了，才拉我进萌新群？1-40合集"))) {
  throw new Error("正常收藏卡片被错误加入修复目标");
}
if (favoritesFixIsRepairTarget(makeModernCard("视频去哪了呢？"))) {
  throw new Error("非标准失效占位不应直接加入新版修复目标");
}
const loadingTitle = { textContent: "正在加载数据..." };
const invalidMarker = { textContent: "已失效视频" };
const loadingTargetCard = {
  dataset: {},
  querySelector(selector) {
    if (selector === ".bili-video-card__title a") return loadingTitle;
    if (selector === ".bili-video-card__details") return { textContent: "已失效视频" };
    return null;
  },
  querySelectorAll(selector) {
    return selector.includes(".bili-video-card__title") ? [loadingTitle, invalidMarker] : [];
  }
};
if (!favoritesFixIsRepairTarget(loadingTargetCard)) {
  throw new Error("保留失效标记的加载中卡片未进入修复目标");
}
const normalCard = {
  dataset: {},
  querySelector: (selector) => selector === ".bili-video-card__title a" ? { textContent: "正常标题" } : null
};
if (favoritesFixApplyCard(normalCard, { title: "不应写入正常卡片" }, { showMenu: false }) !== false || Object.keys(normalCard.dataset).length) {
  throw new Error("正常收藏卡片仍被 applyCard 改写");
}

const makeTargetCard = (title = "已失效视频", imageSource = "https://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg") => {
  const titleContainer = {
    children: [],
    textContent: title,
    title: "已失效视频",
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; }
  };
  const titleEl = {
    children: [],
    textContent: title,
    parentElement: titleContainer,
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; }
  };
  const image = {
    src: imageSource,
    currentSrc: imageSource,
    alt: "",
    getAttribute(name) { return this[name] || ""; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    hasAttribute(name) { return !!this[name]; }
  };
  const coverLink = {
    href: "https://www.bilibili.com/video/BV1Target0001/",
    dataset: {},
    classList: { add() {}, remove() {} },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this, name); },
    getAttribute(name) { return this[name] || ""; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    getBoundingClientRect() { return { top: 20, right: 180, left: 20, bottom: 120, width: 160, height: 100 }; }
  };
  const card = {
    dataset: {},
    classList: { contains() { return false; }, add() {}, remove() {} },
    querySelector(selector) {
      if (selector === ".bili-video-card__title a") return titleEl;
      if (selector === ".bili-video-card__title") return titleContainer;
      if (selector.includes(".bili-video-card__cover a")) return coverLink;
      if (selector.includes(".bili-video-card__cover img")) return image;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes(".bili-video-card__title")) return [titleEl];
      return [];
    },
    removeAttribute(name) { delete this[name]; }
  };
  return { card, titleEl, titleContainer, image, coverLink };
};
const target = makeTargetCard();
const targetMedia = favoritesFixNormalizeMedia({ aid: 113809670807244, bvid: "BV1Target0001", title: "已失效视频" });
if (!favoritesFixApplyCard(target.card, targetMedia, { showMenu: false })) throw new Error("失效目标卡片没有进入兜底终态");
if (target.titleEl.textContent !== "查不到标题（113809670807244）【鼠标悬停查看简介】") throw new Error("AV 兜底标题错误");
if (!favoritesFixIsRepairTarget(target.card)) throw new Error("已接管的失效卡片未保持修复目标身份");
if (target.card.title !== undefined) throw new Error("失效卡片仍写入原生根节点 title");
if (target.titleEl.title !== undefined || target.titleContainer.title !== undefined) throw new Error("失效卡片仍残留标题容器原生 title");
if (target.coverLink.href !== "https://www.bilibili.com/video/BV1Target0001/") throw new Error("悬停面板改写了原生封面跳转");
if (target.coverLink.dataset.bilikitFavoritesHover !== "1") throw new Error("占位封面没有启用悬停资料面板");
if (!favoritesFixHasPlaceholderCover(target.image)) throw new Error("占位封面识别错误");
const recoveredTarget = makeTargetCard();
recoveredTarget.image.src = recoveredTarget.image.currentSrc = "https://i0.hdslb.com/bfs/archive/recovered.jpg";
const recoveredMedia = favoritesFixNormalizeMedia({ aid: 123, bvid: "BV1Recovered0001", title: "已恢复标题", cover: recoveredTarget.image.src });
favoritesFixApplyCard(recoveredTarget.card, recoveredMedia, { showMenu: false });
if (recoveredTarget.coverLink.dataset.bilikitFavoritesHover) throw new Error("真实封面错误启用了悬停资料面板");

const retainedIdentityCard = makeTargetCard();
const retainedIdentity = favoritesFixNormalizeMedia({
  aid: 113419348935120,
  bvid: "BV1fXSUYvEtu",
  title: "已失效视频",
  intro: "原始简介"
});
favoritesFixApplyCard(retainedIdentityCard.card, retainedIdentity, { showMenu: false });
const partialRecovered = favoritesFixNormalizeMedia({ title: "外部接口补全标题" });
favoritesFixApplyCard(retainedIdentityCard.card, partialRecovered, { showMenu: false });
if (retainedIdentityCard.card.__bkFavoritesMedia.aid !== "113419348935120" || retainedIdentityCard.card.__bkFavoritesMedia.bvid !== "BV1fXSUYvEtu" || retainedIdentityCard.card.__bkFavoritesMedia.title !== "外部接口补全标题") {
  throw new Error(`不完整外部资料覆盖了已有身份：${JSON.stringify(retainedIdentityCard.card.__bkFavoritesMedia)}`);
}
const hoverOwnerMedia = favoritesFixNormalizeMedia({ aid: 113419348935120, bvid: "BV1fXSUYvEtu", title: "悬停完整资料" });
const hoverOwner = { __bkFavoritesMedia: hoverOwnerMedia };
const hoverInnerCard = { __bkFavoritesMedia: null, closest: () => hoverOwner };
if (favoritesFixMediaForHover(hoverInnerCard) !== hoverOwnerMedia) {
  throw new Error("悬停事件没有从选项条目容器读取完整媒体资料");
}

if (!favoritesFixIsLoadingTitle("正在加载数据...")) throw new Error("加载占位文本未被识别");
if (favoritesFixIsLoadingTitle("已失效视频")) throw new Error("正常失效标题不应被识别为加载占位");

const loadingLeaf = {
  children: [],
  textContent: "正在加载数据...",
  setAttribute() {}
};
const stableTitleLeaf = {
  children: [],
  textContent: "已失效视频",
  setAttribute() {}
};
const fakeLoadingCard = {
  querySelectorAll: () => [loadingLeaf, stableTitleLeaf]
};
if (!favoritesFixClearLoadingLabels(fakeLoadingCard, "已失效视频") || loadingLeaf.textContent !== "已失效视频") {
  throw new Error("卡片内部的加载占位没有被一次性收口");
}

const info = parseFavoritesFixUrl("https://space.bilibili.com/701944900/favlist?fid=2056261900&pn=2&keyword=&order=mtime");
if (!info.supported || info.mid !== "701944900" || info.fid !== "2056261900" || info.page !== 2) {
  throw new Error(`收藏夹 URL 解析错误：${JSON.stringify(info)}`);
}
if (isFavoritesFixPage("/video/BV1abc", "www.bilibili.com") || !isFavoritesFixPage("/701944900/favlist", "space.bilibili.com")) {
  throw new Error("非收藏夹页面不应启动收藏夹修复");
}
if (favoritesFixNormalizeId("https://www.bilibili.com/video/BV1AbC234/?spm_id_from=test") !== "BV1AbC234") {
  throw new Error("BV/AV 页面地址识别错误");
}
if (favoritesFixNormalizeId("/video/av123456/?p=2") !== "av123456") {
  throw new Error("AV 页面地址识别错误");
}

const identityCard = {
  dataset: { bvid: "BV1Identity0001" },
  querySelectorAll(selector) {
    if (selector === "a[href]") return [{ getAttribute: () => "/video/av7654321/?from=fav" }];
    if (selector.startsWith("[")) return [{ getAttribute: (name) => name === "data-id" ? "7654321" : "" }];
    return [];
  }
};
const identityKeys = favoritesFixCardIdentityKeys(identityCard).map((id) => id.toLowerCase());
if (identityKeys[0] !== "bv1identity0001" || !identityKeys.includes("av7654321")) {
  throw new Error(`收藏卡片多身份读取错误：${JSON.stringify(identityKeys)}`);
}
const identityMedia = favoritesFixNormalizeMedia({ bvid: "BV1Identity0001", aid: 7654321, title: "身份匹配" });
const identityIndex = new Map();
for (const id of favoritesFixMediaIdentityKeys(identityMedia)) identityIndex.set(id.toLowerCase(), identityMedia);
if (favoritesFixFindMediaForCard(identityCard, identityIndex) !== identityMedia) {
  throw new Error("收藏卡片没有按 BV/AV 别名命中官方条目");
}
if (favoritesFixCategoryName(27) !== "综合") throw new Error("官方 tid=27 未显示分区名称");
if (!favoritesFixIsUnusableTitle("正在加载数据...") || favoritesFixIsUnusableTitle("一个真实标题")) {
  throw new Error("外部接口占位标题识别错误");
}
const loadingExternal = favoritesFixNormalizeExternalMetadata("jijidown", {
  title: "正在加载数据...",
  img: ""
});
if (loadingExternal.valid || loadingExternal.title) {
  throw new Error("慢速接口的加载占位被当成有效标题");
}
const loadingWithCover = favoritesFixNormalizeExternalMetadata("jijidown", {
  title: "正在加载数据...",
  img: "https://i0.hdslb.com/bfs/archive/recovered-cover.jpg"
});
if (!loadingWithCover.valid || loadingWithCover.title || !loadingWithCover.cover) {
  throw new Error("慢速接口的有效封面未能独立保留");
}
if (favoritesFixCachedExternalUseful({ title: "正在加载数据...", cover: "", external: { status: "hit" } })) {
  throw new Error("旧的加载占位缓存仍被当成有效命中");
}

const apiMedia = favoritesFixNormalizeMedia({
  id: "123456",
  aid: 123456,
  bvid: "BV1Test00001",
  title: "完整视频标题",
  cover: "https://i0.hdslb.com/bfs/archive/cover.jpg",
  intro: "视频简介",
  duration: 714,
  pages: [
    { page: 1, part: "第一集", cid: 9001, duration: 300 },
    { page: 2, part: "第二集", cid: 9002, duration: 414 }
  ],
  upper: { mid: 701944900, name: "测试 UP" },
  tname: "测试分区",
  pubtime: 1700000000,
  fav_time: 1700000100,
  attr: 1,
  cnt_info: { play: 12, danmaku: 3, collect: 4, thumb_up: 5, coin: 6, reply: 7 }
});
if (apiMedia.bvid !== "BV1Test00001" || apiMedia.aid !== "123456" || apiMedia.duration !== 714) {
  throw new Error(`收藏夹官方数据标准化错误：${JSON.stringify(apiMedia)}`);
}
if (apiMedia.pages.length !== 2 || apiMedia.pages[1].title !== "第二集" || apiMedia.pages[1].cid !== "9002" || apiMedia.pages[1].duration !== 414) {
  throw new Error(`多 P 标题、CID 或时长读取错误：${JSON.stringify(apiMedia.pages)}`);
}
if (apiMedia.tname !== "测试分区" || apiMedia.stats.coin !== 6 || apiMedia.pubTime !== 1700000000 || apiMedia.favTime !== 1700000100 || apiMedia.attr !== 1) {
  throw new Error(`收藏夹资料字段读取错误：${JSON.stringify(apiMedia)}`);
}
const bvidOnlyMedia = favoritesFixNormalizeMedia({ id: "BV1OnlyBvid0001", bvid: "BV1OnlyBvid0001", title: "已失效视频" });
if (bvidOnlyMedia.aid) throw new Error(`BV 标识被错误当作 AV 号：${JSON.stringify(bvidOnlyMedia)}`);
if (apiMedia.hidden !== false) throw new Error("普通收藏条目不应被标记为隐藏");
if (!favoritesFixNormalizeMedia({ bvid: "BV1Hidden0001", rights: { autoplay: 0 } }).hidden) {
  throw new Error("官方 rights.autoplay=0 未被识别为隐藏条目");
}
if (favoritesFixNormalizeMedia({ bvid: "BV1Invalid0001", attr: 9 }).hidden) {
  throw new Error("失效状态 attr=9 不应被当作隐藏条目");
}
const staleZeroCache = favoritesFixMergeMedia(
  { bvid: "BV1StaleZero0001", aid: 7654321, title: "已失效视频", tid: 27, cnt_info: {} },
  { stats: { play: 0, collect: 0, danmaku: 0, thumbUp: 0, coin: 0, reply: 0 } }
);
if (staleZeroCache.tname !== "综合" || staleZeroCache.stats.play !== null || staleZeroCache.stats.coin !== null) {
  throw new Error(`旧缓存 0 值未按未知统计处理：${JSON.stringify(staleZeroCache)}`);
}

const cachedCover = "https://i1.hdslb.com/bfs/archive/cached-cover.jpg";
const merged = favoritesFixMergeMedia(
  { bvid: "BV1Test00001", aid: 123456, title: "已失效视频", cover: "https://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg", duration: 0, pages: [] },
  { title: "缓存中的完整标题", cover: cachedCover, pages: apiMedia.pages }
);
if (merged.title !== "缓存中的完整标题" || merged.cover !== cachedCover || merged.pages.length !== 2) {
  throw new Error(`缓存合并或占位封面处理错误：${JSON.stringify(merged)}`);
}
if (!favoritesFixIsPlaceholderCover("https://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg")) {
  throw new Error("占位封面未被识别");
}

const biliplusRecovered = favoritesFixParseExternalPayload("biliplus", {
  code: 0,
  data: {
    "113963987698950": {
      title: "恢复后的完整标题",
      pic: "http://i2.hdslb.com/bfs/archive/recovered-cover.jpg",
      author: "恢复作者",
      mid: 12345
    }
  }
});
if (!biliplusRecovered?.valid || biliplusRecovered.title !== "恢复后的完整标题" || !biliplusRecovered.cover.startsWith("https://i2.hdslb.com/")) {
  throw new Error(`BiliPlus 标题/封面解析错误：${JSON.stringify(biliplusRecovered)}`);
}
const deletedPlaceholder = favoritesFixParseExternalPayload("jijidown", {
  id: 113419348935120,
  title: "该视频或许已经被删除了",
  img: ""
});
if (deletedPlaceholder?.valid) throw new Error("第三方删除占位结果不应被接受");
const jijidownRecovered = favoritesFixParseExternalPayload("jijidown", {
  id: 113963987698950,
  title: "Jijidown 恢复标题",
  img: "http://i2.hdslb.com/bfs/archive/jiji-cover.jpg",
  upid: 456,
  up: { author: "Jijidown 作者" }
});
if (!jijidownRecovered?.valid || jijidownRecovered.title !== "Jijidown 恢复标题" || jijidownRecovered.upper.name !== "Jijidown 作者") {
  throw new Error(`Jijidown 标题/封面解析错误：${JSON.stringify(jijidownRecovered)}`);
}
const externalMerged = favoritesFixMergeMedia(
  { bvid: "BV1TsNTeBEkU", aid: 113963987698950, title: "已失效视频", cover: "https://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg" },
  {},
  { ...biliplusRecovered, status: "hit", checkedAt: Date.now() }
);
if (externalMerged.title !== "恢复后的完整标题" || externalMerged.cover !== biliplusRecovered.cover || externalMerged.external?.status !== "hit") {
  throw new Error(`第三方元数据合并错误：${JSON.stringify(externalMerged)}`);
}
const identityRetained = favoritesFixMergeMedia(
  { title: "仅有标题的外部结果" },
  { aid: 113963987698950, bvid: "BV1TsNTeBEkU", intro: "已有简介" }
);
if (identityRetained.aid !== "113963987698950" || identityRetained.bvid !== "BV1TsNTeBEkU" || identityRetained.intro !== "已有简介") {
  throw new Error(`资料合并丢失已有 AV/BV 或简介：${JSON.stringify(identityRetained)}`);
}
if (!favoritesFixExternalCheckFresh({ status: "miss", source: "none", checkedAt: Date.now() })) {
  throw new Error("外部元数据未命中状态没有进入短期缓存");
}

const inferred = favoritesFixNormalizeMedia({
  bvid: "BV1Single0001",
  title: "已失效视频",
  pages: [{ page: 1, part: "唯一分 P 标题", cid: 7001, duration: 88 }]
});
if (favoritesFixTitle(inferred) !== "唯一分 P 标题（根据分 P 推断）") {
  throw new Error(`单 P 标题推断错误：${JSON.stringify(inferred)}`);
}
const unresolved = favoritesFixNormalizeMedia({ aid: 113809670807244, bvid: "BV1Unknown0001", title: "已失效视频" });
if (favoritesFixDisplayTitle(unresolved) !== "查不到标题（113809670807244）【鼠标悬停查看简介】") {
  throw new Error("未恢复视频的显示标题兜底错误");
}
const details = favoritesFixCardDetails({ ...apiMedia, title: "完整视频标题" });
for (const expected of ["简介：视频简介", "分区：测试分区", "发布时间：", "收藏时间：", "子P标题：", "播放数：12", "投币数：6", "回复数：7", "失效原因：其他原因删除或退回（1）"]) {
  if (!details.includes(expected)) throw new Error(`悬停资料缺少字段：${expected}`);
}
if (favoritesFixFailureReason({ attr: 9 }) !== "UP 主自己删除（9）" || favoritesFixFailureReason({ attr: null }) !== "未知") {
  throw new Error("失效原因格式化错误");
}

const cache = favoritesFixReadCache();
cache.entries["bv1test00001"] = favoritesFixCacheRecord(apiMedia);
favoritesFixWriteCache(cache);
const cached = favoritesFixReadCache().entries.bv1test00001;
if (cached?.bvid !== apiMedia.bvid || cached?.pages?.[1]?.cid !== "9002" || cached?.intro !== "视频简介" || cached?.tname !== "测试分区" || cached?.stats?.coin !== 6) {
  throw new Error(`收藏夹公开元数据缓存读写错误：${JSON.stringify(cached)}`);
}
const menuText = favoritesFixMenuText(apiMedia);
if (!menuText.includes("完整视频标题") || !menuText.includes("BV1Test00001") || !menuText.includes("时长：11:54")) {
  throw new Error(`收藏夹菜单信息不完整：${menuText}`);
}

const normalizedPages = favoritesFixNormalizePages([{ part: "P1", cid: "11", duration: "42" }, { title: "P2", id: "12", duration: 0 }]);
if (normalizedPages[0].cid !== "11" || normalizedPages[0].duration !== 42 || normalizedPages[1].title !== "P2") {
  throw new Error(`分 P 基础字段标准化错误：${JSON.stringify(normalizedPages)}`);
}

console.log("收藏夹修复测试通过：URL/身份解析、官方数据标准化、多 P 元数据、缓存合并、占位封面、单 P 标题推断和非收藏夹页面隔离均符合预期。");

if (!script.includes(".bk-favfix-hover-panel") || !script.includes("max-height:min(420px,calc(100vh - 24px))")) {
  throw new Error("悬停资料面板缺少视口内滚动和尺寸约束");
}
if (script.includes("\n.bili-video-card__details{position:relative}")) {
  throw new Error("收藏夹修复仍对正常卡片全局改写 details 布局");
}
if (script.includes("card.setAttribute(\"title\", favoritesFixCardDetails(media))")) {
  throw new Error("收藏夹修复仍使用卡片根节点原生 title 展示资料");
}
