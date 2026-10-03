import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/userscript/download-workspace.js", import.meta.url), "utf8");

const mediaStart = source.indexOf("  function downloadAllowedUrl");
const mediaEnd = source.indexOf("  function taskStatusLabel", mediaStart);
const responseStart = source.indexOf("  function downloadResponseHeader");
const responseEnd = source.indexOf("  function probeDownloadResourceSize", responseStart);
if ([mediaStart, mediaEnd, responseStart, responseEnd].some((value) => value < 0)) {
  throw new Error("无法定位下载资源校验函数");
}

const context = {
  URL,
  ArrayBuffer,
  setTimeout,
  clearTimeout,
  location: { href: "https://www.bilibili.com/video/BV1Test/", origin: "https://www.bilibili.com" },
  DOWNLOAD_ALLOWED_HOSTS: ["bilivideo.com", "bilivideo.cn", "bilivideo.net", "edge.mountaintoys.cn"],
  DOWNLOAD_ALLOWED_PORTS: new Set(["", "443", "4483"])
};
const requests = [];
context.GM_xmlhttpRequest = (details) => {
  requests.push(details);
  setTimeout(() => details.onreadystatechange?.({
    readyState: 2,
    status: 206,
    responseHeaders: "Content-Range: bytes 0-0/4\r\nContent-Length: 1\r\n"
  }), 0);
  return { abort() {} };
};
vm.runInNewContext(
  `${source.slice(mediaStart, mediaEnd)}\n${source.slice(responseStart, responseEnd)}\nthis.testApi = { downloadAllowedUrl, normalizeDownloadTrack, isCompleteDownloadResponse, probeDownloadResourceSize };`,
  context
);

const api = context.testApi;
const failures = [];
const mediaHeaderUsages = (source.match(/headers: downloadMediaHeaders(?:\(\)|\(\{ Range: "bytes=0-0" \}\))/g) || []).length;
if (mediaHeaderUsages !== 3) {
  failures.push(`三个媒体请求都应使用统一 Origin/Referer 请求头，实际 ${mediaHeaderUsages} 处`);
}
const currentCdnUrl = "https://b-baaa1jd6155d3c4bi3ygwqsbok4b.edge.mountaintoys.cn:4483/video.mp4?sig=test";
if (!api.downloadAllowedUrl(currentCdnUrl)) {
  failures.push("当前 B 站播放地址使用的 edge.mountaintoys.cn CDN 被错误过滤");
}
const track = api.normalizeDownloadTrack({
  id: 80,
  baseUrl: currentCdnUrl,
  mimeType: "video/mp4",
  codecs: "avc1.640028"
}, "video", "1080P");
if (!track?.urls?.includes(currentCdnUrl)) {
  failures.push(`当前 CDN 地址没有进入可下载轨道：${JSON.stringify(track)}`);
}

const completeBody = new ArrayBuffer(4);
const complete200WithRange = {
  status: 200,
  response: completeBody,
  responseHeaders: "Content-Length: 4\r\nContent-Range: bytes 0-3/4\r\n"
};
if (!api.isCompleteDownloadResponse(complete200WithRange)) {
  failures.push("完整的 200 响应带 Content-Range 时不应被误判为不完整");
}

const probeTask = { status: "downloading", cancelFunctions: [] };
const probedSize = await api.probeDownloadResourceSize(currentCdnUrl, probeTask);
const probeRequest = requests[0];
if (probedSize !== 4 || probeRequest?.headers?.Origin !== "https://www.bilibili.com" || probeRequest?.headers?.Referer !== "https://www.bilibili.com/" || probeRequest?.headers?.Range !== "bytes=0-0") {
  failures.push(`媒体长度探测没有带完整请求头：${JSON.stringify({ probedSize, headers: probeRequest?.headers })}`);
}

if (failures.length) throw new Error(failures.join("；"));

console.log("下载运行时失败回归测试通过：当前 CDN 地址与完整响应均被正确识别。");
