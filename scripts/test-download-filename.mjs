import vm from "node:vm";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const script = await readUserscriptSource();
const start = script.indexOf("  function normalizeDownloadTitle");
const end = script.indexOf("  function updateDownloadTask", start);
const extensionStart = script.indexOf("  function downloadExtension");
const extensionEnd = script.indexOf("  function runSeparateDownload", extensionStart);
if ([start, end, extensionStart, extensionEnd].some((value) => value < 0)) throw new Error("无法定位下载文件名函数");

const context = {};
vm.runInNewContext(
  `${script.slice(start, end)}\n${script.slice(extensionStart, extensionEnd)}\nthis.testApi = { buildDownloadFileName, buildDownloadTaskTitle, buildDownloadAudioMetadata };`,
  context
);

const { buildDownloadFileName, buildDownloadTaskTitle, buildDownloadAudioMetadata } = context.testApi;
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
if (!splitAudio.endsWith("_未知作者.m4a") || /BV1pb8o6yE8f|P01|AAC|192kbps|audio/i.test(splitAudio)) {
  throw new Error(`音频单独下载名应只包含音乐名和作者：${splitAudio}`);
}
if (taskTitle.endsWith(".mp4")) throw new Error(`任务标题不应带扩展名：${taskTitle}`);

const collectionName = buildDownloadFileName({
  title: "合集主标题",
  bvid: "BV1NsVh6eE1o",
  collectionIndex: 2,
  page: 1
}, "merge", video, audio);
if (collectionName !== "合集主标题_BV1NsVh6eE1o_C02_1080P_AVC_AAC_video_audio.mp4") {
  throw new Error(`合集文件名错误：${collectionName}`);
}

const collectionItemName = buildDownloadFileName({
  title: "当前打开的合集视频",
  filenameTitle: "合集条目二",
  collectionTitle: "合集主标题",
  bvid: "BV1NsVh6eE1o",
  collectionIndex: 2,
  page: 1
}, "merge", video, audio);
if (!collectionItemName.startsWith("合集条目二_BV1NsVh6eE1o_C02_")) {
  throw new Error(`合集文件没有使用条目标题：${collectionItemName}`);
}
const nestedCollectionName = buildDownloadFileName({
  title: "合集条目二",
  bvid: "BV1NsVh6eE1o",
  collectionIndex: 2,
  collectionPageCount: 4,
  page: 2
}, "merge", video, audio);
if (!nestedCollectionName.includes("_C02_P02_1080P_AVC_AAC_video_audio.mp4")) {
  throw new Error(`合集内分 P 文件名没有使用 Cxx_Pyy：${nestedCollectionName}`);
}

const avName = buildDownloadFileName({ title: "AV 测试", videoId: "av123456", page: 2 }, "audio", null, {
  kind: "audio",
  codecs: "fLaC",
  mimeType: "audio/flac"
});
if (avName !== "AV_测试_未知作者.flac") throw new Error(`AV/FLAC 文件名错误：${avName}`);

const parsedMusicName = buildDownloadFileName({
  title: "【Hi-Res】70 80 90 经典歌曲合集",
  part: "周传雄《最好听10首合集》",
  ownerName: "IM音乐故事汇",
  bvid: "BV1j2YC6iE4i",
  page: 2
}, "audio", null, audio);
if (parsedMusicName !== "最好听10首合集_周传雄.m4a") {
  throw new Error(`音乐名/作者自动识别错误：${parsedMusicName}`);
}

const explicitMusicName = buildDownloadFileName({
  title: "视频回退标题",
  musicTitle: "海阔天空",
  artist: "Beyond",
  bvid: "BV1j2YC6iE4i",
  page: 2
}, "audio", null, audio);
if (explicitMusicName !== "海阔天空_Beyond.m4a") {
  throw new Error(`显式音乐元数据没有优先用于文件名：${explicitMusicName}`);
}

const fallbackMusicName = buildDownloadFileName({
  title: "视频回退标题",
  ownerName: "视频作者",
  bvid: "BV1j2YC6iE4i",
  page: 2
}, "audio", null, audio);
if (fallbackMusicName !== "视频回退标题_视频作者.m4a") {
  throw new Error(`音乐名无法识别时没有回退视频名称：${fallbackMusicName}`);
}

const audioMetadata = buildDownloadAudioMetadata({
  title: "视频回退标题",
  part: "周传雄《最好听10首合集》",
  ownerName: "IM音乐故事汇",
  videoId: "BV1j2YC6iE4i",
  bvid: "BV1j2YC6iE4i",
  page: 2,
  cid: "20002"
}, audio);
if (audioMetadata.title !== "最好听10首合集" || audioMetadata.artist !== "周传雄" ||
  !audioMetadata.comment.includes("BV1j2YC6iE4i") || !audioMetadata.comment.includes("P02")) {
  throw new Error(`音频元数据没有保留音乐身份和技术信息：${JSON.stringify(audioMetadata)}`);
}

const pagePrefixed = buildDownloadFileName({ title: "P2_哔哩哔哩_bilibili", bvid: "BV1j2YC6iE4i", page: 2 }, "merge", video, audio);
if (pagePrefixed !== "哔哩哔哩_bilibili_BV1j2YC6iE4i_P02_1080P_AVC_AAC_video_audio.mp4") {
  throw new Error(`分 P 标题前缀未清理：${pagePrefixed}`);
}

const pagePrefixedWithSpace = buildDownloadFileName({ title: "P 02 - 测试视频", bvid: "BV1j2YC6iE4i", page: 2 }, "video", video, null);
if (pagePrefixedWithSpace !== "测试视频_BV1j2YC6iE4i_P02_1080P_AVC_video.mp4") {
  throw new Error(`带空格的分 P 标题前缀未清理：${pagePrefixedWithSpace}`);
}

const actualPageTitle = buildDownloadFileName({
  title: "一口气看爽超火漫画！《因果之战》万业尸仙跨时空跨因果入侵！人类何去何从？",
  bvid: "BV1j2YC6iE4i",
  page: 2
}, "merge", { ...video, qualityLabel: "1080P 高清", codecs: "av01.0.08M.08" }, audio);
if (!actualPageTitle.startsWith("一口气看爽超火漫画_因果之战_万业尸仙跨时空跨因果入侵_人类何去何从_BV1j2YC6iE4i_P02_")) {
  throw new Error(`正文标题未进入下载文件名：${actualPageTitle}`);
}

console.log("下载文件名测试通过：统一下划线格式、轨道标签、分 P、编码和真实扩展名。");
