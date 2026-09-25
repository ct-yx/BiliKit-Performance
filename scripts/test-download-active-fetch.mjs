import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../bilikit-performance.user.js", import.meta.url), "utf8");
const identityStart = script.indexOf("  function normalizedDownloadBvid");
const identityEnd = script.indexOf("  function readDownloadMeta", identityStart);
const requestStart = script.indexOf("  function parseDownloadRequestIdentity");
const requestEnd = script.indexOf("  function parseDownloadPayload", requestStart);
if ([identityStart, identityEnd, requestStart, requestEnd].some((value) => value < 0)) {
  throw new Error("无法定位下载主动获取测试所需的函数");
}

const context = {
  URL,
  location: { href: "https://www.bilibili.com/video/BV1pb8o6yE8f/" },
  MEDIA_PLAYURL_API_RE: /\/(?:x\/player\/(?:wbi\/)?playurl|pgc\/player\/(?:web\/)?(?:v2\/)?playurl|pugv\/player\/web\/playurl)(?:[/?#]|$)/i
};
vm.runInNewContext(
  `${script.slice(identityStart, identityEnd)}\n${script.slice(requestStart, requestEnd)}\nthis.testApi = { downloadPlayurlTemplateFromUrl, downloadRequestMatchesPage, downloadPlayurlParams };`,
  context
);

const { downloadPlayurlTemplateFromUrl, downloadRequestMatchesPage, downloadPlayurlParams } = context.testApi;
const signedUrl = "https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1pb8o6yE8f&avid=117163016850592&cid=41301577497&qn=120&fnval=4048&wts=1234567890&w_rid=signature";
const template = downloadPlayurlTemplateFromUrl(signedUrl);
if (!template || template.params.wts || template.params.w_rid) {
  throw new Error(`签名参数未被隔离：${JSON.stringify(template)}`);
}
if (!downloadRequestMatchesPage(template, {
  videoId: "BV1pb8o6yE8f",
  bvid: "BV1pb8o6yE8f",
  cid: "41301577497"
})) {
  throw new Error("当前视频的 playurl 模板未通过身份校验");
}
if (downloadRequestMatchesPage(template, {
  videoId: "BV1F6eb6MEZz",
  bvid: "BV1F6eb6MEZz",
  cid: "42026798571"
})) {
  throw new Error("其他视频的 playurl 模板错误地通过了身份校验");
}
if (downloadPlayurlTemplateFromUrl("https://example.com/x/player/wbi/playurl?bvid=BV1pb8o6yE8f&cid=41301577497")) {
  throw new Error("非 B 站官方播放接口未被拒绝");
}
const params = downloadPlayurlParams({
  videoId: "BV1pb8o6yE8f",
  bvid: "BV1pb8o6yE8f",
  aid: "117163016850592",
  cid: "41301577497"
}, null);
if (params.bvid !== "BV1pb8o6yE8f" || params.avid !== "117163016850592" || params.cid !== "41301577497" || params.fnval !== "4048") {
  throw new Error(`官方播放参数构造错误：${JSON.stringify(params)}`);
}

console.log("主动获取测试通过：只接受官方 playurl，隔离签名参数，并绑定当前 BVID/CID。");
