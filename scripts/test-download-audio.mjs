import { readFile } from "node:fs/promises";
import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const source = await readUserscriptSource();
const worker = await readFile(new URL("../src/remux.worker.js", import.meta.url), "utf8");

for (const name of [
  "buildDownloadAudioMetadata",
  "runSeparateAudioDownload",
  "saveDownloadBlobWithBrowser",
  "type: \"remux-audio\"",
  "audio-done"
]) {
  if (!source.includes(name) && !worker.includes(name)) {
    throw new Error(`音频下载兼容路径缺少：${name}`);
  }
}
if (!worker.includes("setMetadataTags") || !worker.includes("extension: \"m4a\"")) {
  throw new Error("音频 Worker 没有写入元数据或返回正确的 m4a 容器结果");
}
if (!/runSeparateAudioDownload[\s\S]*?remux-audio/.test(source)) {
  throw new Error("独立音频下载没有接入 remux-audio Worker");
}
if (!/runSeparateAudioDownload[\s\S]*?gmDownloadTrack/.test(source)) {
  throw new Error("独立音频封装失败后没有保留原始轨道回退");
}

console.log("独立音频下载测试通过：命名、元数据、m4a 封装和原始轨道回退路径均存在。");
