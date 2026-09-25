import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../bilikit-performance.user.js", import.meta.url), "utf8");
const start = script.indexOf("  function downloadCodecLabel");
const end = script.indexOf("  function updateDownloadTask", start);
const extensionStart = script.indexOf("  function downloadExtension");
const extensionEnd = script.indexOf("  function runSeparateDownload", extensionStart);
if ([start, end, extensionStart, extensionEnd].some((value) => value < 0)) throw new Error("无法定位下载文件名函数");

const context = {};
vm.runInNewContext(
  `${script.slice(start, end)}\n${script.slice(extensionStart, extensionEnd)}\nthis.testApi = { buildDownloadFileName, buildDownloadTaskTitle };`,
  context
);

const { buildDownloadFileName, buildDownloadTaskTitle } = context.testApi;
const model = {
  title: "测试/视频: 这是一个很长的标题 - 带 + 符号",
  bvid: "BV1pb8o6yE8f",
  page: 1
};
const video = {
  kind: "video",
  qualityLabel: "1080P 高清",
  codecs: "avc1.640028",
  mimeType: "video/mp4",
  width: 1920,
  height: 1080
};
const audio = {
  kind: "audio",
  codecs: "mp4a.40.2",
  mimeType: "audio/mp4",
  bandwidth: 192000
};

const merged = buildDownloadFileName(model, "merge", video, audio);
const splitVideo = buildDownloadFileName(model, "video", video, null);
const splitAudio = buildDownloadFileName(model, "audio", null, audio);
const taskTitle = buildDownloadTaskTitle(model, "merge", video, audio);

for (const value of [merged, splitVideo, splitAudio, taskTitle]) {
  if (/\s|[-+\\/:*?"<>|]/.test(value)) throw new Error(`文件名仍含不兼容字符：${value}`);
  if (value.includes("__")) throw new Error(`文件名包含连续下划线：${value}`);
}
if (!merged.endsWith("_1080P_AVC_AAC_video_audio.mp4")) throw new Error(`合并文件名错误：${merged}`);
if (!splitVideo.endsWith("_1080P_AVC_video.mp4")) throw new Error(`视频分轨文件名错误：${splitVideo}`);
if (!splitAudio.endsWith("_AAC_192kbps_audio.m4a")) throw new Error(`音频分轨文件名错误：${splitAudio}`);
if (taskTitle.endsWith(".mp4")) throw new Error(`任务标题不应带扩展名：${taskTitle}`);

const avName = buildDownloadFileName({ title: "AV 测试", videoId: "av123456", page: 2 }, "audio", null, {
  kind: "audio",
  codecs: "fLaC",
  mimeType: "audio/flac"
});
if (!avName.includes("AV123456_P02_FLAC_audio.flac")) throw new Error(`AV/FLAC 文件名错误：${avName}`);

const pagePrefixed = buildDownloadFileName({ title: "P2_哔哩哔哩_bilibili", bvid: "BV1j2YC6iE4i", page: 2 }, "merge", video, audio);
if (pagePrefixed !== "哔哩哔哩_bilibili_BV1j2YC6iE4i_P02_1080P_AVC_AAC_video_audio.mp4") {
  throw new Error(`分 P 标题前缀未清理：${pagePrefixed}`);
}

const pagePrefixedWithSpace = buildDownloadFileName({ title: "P 02 - 测试视频", bvid: "BV1j2YC6iE4i", page: 2 }, "video", video, null);
if (pagePrefixedWithSpace !== "测试视频_BV1j2YC6iE4i_P02_1080P_AVC_video.mp4") {
  throw new Error(`带空格的分 P 标题前缀未清理：${pagePrefixedWithSpace}`);
}

console.log("下载文件名测试通过：统一下划线格式、轨道标签、分 P、编码和真实扩展名。");
