import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/userscript/download-workspace.js", import.meta.url), "utf8");
const start = source.indexOf("  const DOWNLOAD_JSON_TIMEOUT");
const end = source.indexOf("  const DOWNLOAD_WORKER_SOURCE", start);
if (start < 0 || end < 0) throw new Error("无法定位下载 JSON 请求适配器");

const requests = [];
const fetchCalls = [];
let hangingFetchAborted = false;
const context = {
  AbortController,
  setTimeout,
  clearTimeout,
  window: {
    fetch: async (url) => {
      fetchCalls.push(String(url));
      throw new Error("页面 fetch 被拒绝");
    }
  },
  GM_xmlhttpRequest(details) {
    requests.push(details.url);
    if (String(details.url).includes("timeout-check")) {
      return {
        abort() {
          details.onabort?.();
        }
      };
    }
    setTimeout(() => details.onload({
      status: 200,
      statusText: "OK",
      response: { code: 0, result: { episodes: [] } }
    }), 0);
    return { abort() {} };
  }
};
vm.runInNewContext(
  `${source.slice(start, end)}\nthis.testApi = { canDownloadRequestJson, downloadRequestJson };`,
  context
);

if (!context.testApi.canDownloadRequestJson()) throw new Error("存在 GM_xmlhttpRequest 时请求适配器不应不可用");
const response = await context.testApi.downloadRequestJson("https://api.bilibili.com/pgc/view/web/season");
const payload = await response.json();
if (!response.ok || payload.code !== 0 || requests.length !== 1) {
  throw new Error(`页面 fetch 失败后没有正确回退 GM 请求：${JSON.stringify({ response, payload, requests })}`);
}

context.window.fetch = (url, options = {}) => {
  fetchCalls.push(String(url));
  return new Promise((resolve, reject) => {
    options.signal?.addEventListener?.("abort", () => { hangingFetchAborted = true; }, { once: true });
    void resolve;
    void reject;
  });
};
const hangingRequest = context.testApi.downloadRequestJson(
  "https://api.bilibili.com/pgc/player/web/playurl?ep_id=2",
  { timeout: 20 }
);
const hangingResult = await Promise.race([
  hangingRequest.then((value) => ({ type: "response", value }), (error) => ({ type: "error", error })),
  new Promise((resolve) => setTimeout(() => resolve({ type: "test-timeout" }), 250))
]);
if (hangingResult.type === "test-timeout") {
  throw new Error("页面 fetch 挂起时请求没有在超时后进入 GM/扩展回退");
}
if (hangingResult.type !== "response") {
  throw hangingResult.error instanceof Error ? hangingResult.error : new Error(String(hangingResult.error));
}
const hangingPayload = await hangingResult.value.json();
if (!hangingResult.value.ok || hangingPayload.code !== 0 || !hangingFetchAborted || requests.length !== 2) {
  throw new Error(`页面 fetch 超时回退错误：${JSON.stringify({ response: hangingResult.value, hangingPayload, hangingFetchAborted, requests })}`);
}

const timeoutResult = await context.testApi.downloadRequestJson(
  "https://api.bilibili.com/timeout-check",
  { timeout: 1000 }
).then(
  () => ({ type: "response" }),
  (error) => ({ type: "error", error })
);
if (timeoutResult.type !== "error" || timeoutResult.error?.message !== "请求超时") {
  throw new Error(`GM 请求超时被错误标记为取消：${timeoutResult.error?.message || timeoutResult.type}`);
}

console.log("下载 JSON 请求测试通过：页面 fetch 失败/挂起会回退 GM 请求，超时和取消状态可区分。");
