import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../bilikit-performance.user.js", import.meta.url), "utf8");
const start = script.indexOf("  function downloadExtension");
const end = script.indexOf("  function runSeparateDownload", start);
if (start < 0 || end < 0) throw new Error("无法定位下载扩展名函数");

const context = {};
vm.runInNewContext(
  `${script.slice(start, end)}\nthis.testApi = { downloadExtension };`,
  context
);

const { downloadExtension } = context.testApi;
const cases = [
  [{ kind: "video", mimeType: "video/mp4", codecs: "avc1.640028" }, "mp4"],
  [{ kind: "audio", mimeType: "audio/mp4", codecs: "mp4a.40.2" }, "m4a"],
  [{ kind: "audio", mimeType: "audio/mp4", codecs: "ec-3" }, "m4a"],
  [{ kind: "audio", mimeType: "audio/mp4", codecs: "fLaC" }, "m4a"],
  [{ kind: "audio", mimeType: "audio/flac", codecs: "fLaC" }, "flac"],
  [{ kind: "audio", mimeType: "audio/ogg", codecs: "opus" }, "opus"],
  [{ kind: "audio", mimeType: "audio/mpeg", codecs: "mp3" }, "mp3"],
  [{ kind: "audio", mimeType: "audio/aac", codecs: "aac" }, "aac"],
  [{ kind: "audio", mimeType: "audio/eac3", codecs: "ec-3" }, "ec3"]
];

for (const [track, expected] of cases) {
  const actual = downloadExtension(track);
  if (actual !== expected) {
    throw new Error(`扩展名映射错误：${JSON.stringify(track)} -> ${actual}，应为 ${expected}`);
  }
}

console.log("下载扩展名测试通过：audio/mp4 使用 .m4a，原始音频容器按 MIME/编码映射。");
