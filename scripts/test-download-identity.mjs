import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../bilikit-performance.user.js", import.meta.url), "utf8");
const start = script.indexOf("  function normalizedDownloadBvid");
const end = script.indexOf("  function readDownloadMeta", start);
if (start < 0 || end < 0) throw new Error("无法定位下载身份解析函数");

const context = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1pb8o6yE8f/" }
};
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { parseDownloadPageUrl, normalizedDownloadVideoId };`,
  context
);

const { parseDownloadPageUrl, normalizedDownloadVideoId } = context.testApi;
const first = parseDownloadPageUrl("https://www.bilibili.com/video/BV1pb8o6yE8f/?spm_id_from=333.788.videopod.sections&vd_source=test&p=2");
const sameVideo = parseDownloadPageUrl("https://www.bilibili.com/video/bv1pb8o6yE8f/?vd_source=another&p=2");
const otherVideo = parseDownloadPageUrl("https://www.bilibili.com/video/BV1F6eb6MEZz/?spm_id_from=333.788");
const avVideo = parseDownloadPageUrl("https://www.bilibili.com/video/av123456/?spm_id_from=333.788");

if (first.videoId !== "BV1pb8o6yE8f" || first.bvid !== "BV1pb8o6yE8f") {
  throw new Error(`URL 中的 BV 标识解析错误：${JSON.stringify(first)}`);
}
if (first.routeKey !== sameVideo.routeKey) throw new Error("跟踪参数或大小写变化不应改变同一视频路由键");
if (first.routeKey === otherVideo.routeKey) throw new Error("切换到其他视频后路由键仍相同");
if (avVideo.videoId !== "av123456" || normalizedDownloadVideoId("AV123456") !== "av123456") {
  throw new Error("AV 标识兼容解析错误");
}
const caseChanged = parseDownloadPageUrl("https://www.bilibili.com/video/BV1PB8O6YE8F/?p=2");
if (caseChanged.videoId === first.videoId || caseChanged.routeKey === first.routeKey) {
  throw new Error("BV 正文大小写变化不应被当成同一视频");
}

const identityStart = script.indexOf("  function normalizedDownloadBvid");
const identityEnd = script.indexOf("  function buildDownloadSnapshotFromPlayinfo", identityStart);
const staleContext = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1pb8o6yE8f/?spm_id_from=333.788" },
  window: {
    __INITIAL_STATE__: {
      videoData: {
        bvid: "BV1F6eb6MEZz",
        cid: "42026798571",
        pages: [{ page: 1, cid: "42026798571", duration: 568 }]
      }
    }
  },
  document: {
    title: "旧视频",
    querySelector: () => null,
    querySelectorAll: () => []
  }
};
vm.runInNewContext(
  `${script.slice(identityStart, identityEnd)}\nthis.identityApi = { currentDownloadPageIdentity, resolveDownloadIdentity };`,
  staleContext
);
const stalePage = staleContext.identityApi.currentDownloadPageIdentity();
const staleResponse = staleContext.identityApi.resolveDownloadIdentity({
  dash: { duration: 568 },
  timelength: 568000,
  last_play_cid: "42026798571"
});
const currentResponse = staleContext.identityApi.resolveDownloadIdentity(
  { dash: { duration: 6000 }, timelength: 6000000 },
  "https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1pb8o6yE8f&cid=41301577497"
);
if (stalePage.videoId !== "BV1pb8o6yE8f" || stalePage.cid !== "") {
  throw new Error(`URL 未覆盖旧页面状态：${JSON.stringify(stalePage)}`);
}
if (staleResponse.ok || staleResponse.reason !== "current-video-id-not-confirmed") {
  throw new Error(`旧视频播放数据未被拒绝：${JSON.stringify(staleResponse)}`);
}
if (!currentResponse.ok || currentResponse.identity.videoId !== "BV1pb8o6yE8f" || currentResponse.identity.cid !== "41301577497") {
  throw new Error(`当前 URL/CID 播放请求未被接受：${JSON.stringify(currentResponse)}`);
}

const playerContext = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1pb8o6yE8f/?spm_id_from=333.788" },
  window: {
    __INITIAL_STATE__: { bvid: "BV1pb8o6yE8f", videoData: { bvid: "BV1pb8o6yE8f", pages: [] } },
    player: { getManifest: () => ({ bvid: "BV1pb8o6yE8f", aid: 117163016850592, cid: 41301577497, p: 1 }) }
  },
  document: {
    title: "播放器状态测试",
    querySelector: () => null,
    querySelectorAll: () => []
  }
};
vm.runInNewContext(
  `${script.slice(identityStart, identityEnd)}\nthis.playerApi = { currentDownloadPageIdentity };`,
  playerContext
);
const playerPage = playerContext.playerApi.currentDownloadPageIdentity();
if (playerPage.cid !== "41301577497" || playerPage.page !== 1 || playerPage.bvid !== "BV1pb8o6yE8f") {
  throw new Error(`播放器 manifest 未补齐当前 CID：${JSON.stringify(playerPage)}`);
}

const avContext = {
  URL,
  location: { href: "https://www.bilibili.com/video/av117163016850592/?spm_id_from=333.788&p=2" },
  window: {
    __INITIAL_STATE__: {
      aid: 117163016850592,
      bvid: "BV1pb8o6yE8f",
      videoData: {
        aid: 117163016850592,
        bvid: "BV1pb8o6yE8f",
        pages: [
          { page: 1, cid: "41301577496", duration: 6000 },
          { page: 2, cid: "41301577497", duration: 6000 }
        ]
      }
    },
    player: { getManifest: () => ({ bvid: "BV1pb8o6yE8f", aid: 117163016850592, cid: 41301577497, p: 2 }) }
  },
  document: {
    title: "AV 路由测试",
    querySelector: () => null,
    querySelectorAll: () => []
  }
};
vm.runInNewContext(
  `${script.slice(identityStart, identityEnd)}\nthis.avApi = { currentDownloadPageIdentity, resolveDownloadIdentity };`,
  avContext
);
const avPage = avContext.avApi.currentDownloadPageIdentity();
if (avPage.videoId !== "av117163016850592" || avPage.aid !== "117163016850592" || avPage.bvid !== "BV1pb8o6yE8f" || avPage.cid !== "41301577497" || avPage.page !== 2) {
  throw new Error(`AV URL 或分 P 未解析到播放器当前身份：${JSON.stringify(avPage)}`);
}
const avResponse = avContext.avApi.resolveDownloadIdentity(
  { bvid: "BV1pb8o6yE8f", aid: 117163016850592, cid: "41301577497", dash: { duration: 6000 } },
  "https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1pb8o6yE8f&avid=117163016850592&cid=41301577497"
);
if (!avResponse.ok || avResponse.identity.videoId !== "av117163016850592" || avResponse.identity.aid !== "117163016850592" || avResponse.identity.page !== 2) {
  throw new Error(`AV 与 BV 播放响应未被识别为同一视频：${JSON.stringify(avResponse)}`);
}

console.log("下载身份 URL 测试通过：跟踪参数不影响同一视频，切换 BV/AV 会产生新身份。");
