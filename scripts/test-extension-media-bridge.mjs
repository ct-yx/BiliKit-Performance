import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/extension/main-adapter.js", import.meta.url), "utf8");
const outbound = [];
const listeners = new Map();

class TestHeaders {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  }

  get(key) {
    return this.values.get(String(key).toLowerCase()) || null;
  }
}

const windowObject = {
  addEventListener(type, listener) {
    listeners.set(type, listener);
  },
  postMessage(message) {
    outbound.push(message);
  }
};

const context = {
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  atob,
  setTimeout,
  clearTimeout,
  location: { origin: "https://www.bilibili.com" },
  window: windowObject
};
context.globalThis = context;
vm.runInNewContext(source, context);

const receive = (message) => listeners.get("message")({
  source: windowObject,
  origin: context.location.origin,
  data: { channel: "bilikit-performance-edge-bridge-v2", direction: "to-main", ...message }
});
receive({ type: "bridge-ready" });

const requestApi = context.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__;
if (typeof requestApi !== "function") throw new Error("扩展适配器没有暴露请求入口");

function waitForOutbound(type, requestId) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 1000;
    const poll = () => {
      const index = outbound.findIndex((item) => item.type === type && (!requestId || item.requestId === requestId));
      if (index >= 0) {
        resolve(outbound.splice(index, 1)[0]);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`未收到扩展桥接消息：${type}`));
        return;
      }
      setTimeout(poll, 0);
    };
    poll();
  });
}

function request(details) {
  return new Promise((resolve, reject) => requestApi({
    method: "GET",
    url: "https://xy123x.bilivideo.com/video.m4s",
    responseType: "arraybuffer",
    ...details,
    onload: resolve,
    onerror: reject
  }));
}

const completePromise = request();
const completeStart = await waitForOutbound("xhr-start");
if (completeStart.details.responseType.toLowerCase() !== "arraybuffer") throw new Error("媒体请求丢失 arraybuffer responseType");
receive({ type: "xhr-ready", requestId: completeStart.requestId, status: 200, statusText: "OK", responseHeaders: "content-length: 5\r\ncontent-type: video/mp4", total: 5 });
receive({ type: "xhr-chunk", requestId: completeStart.requestId, sequence: 0, data: new TextEncoder().encode("hello").buffer, loaded: 5, total: 5 });
receive({ type: "xhr-load", requestId: completeStart.requestId, loaded: 5 });
const complete = await completePromise;
if (!(complete.response instanceof ArrayBuffer) || complete.response.byteLength !== 5) throw new Error("媒体响应分块拼接结果错误");

const incompletePromise = request();
const incompleteStart = await waitForOutbound("xhr-start");
receive({ type: "xhr-ready", requestId: incompleteStart.requestId, status: 200, statusText: "OK", responseHeaders: "content-length: 5", total: 5 });
receive({ type: "xhr-chunk", requestId: incompleteStart.requestId, sequence: 0, data: new TextEncoder().encode("bad").buffer, loaded: 3, total: 5 });
receive({ type: "xhr-load", requestId: incompleteStart.requestId, loaded: 3 });
const incomplete = await incompletePromise.then(
  () => null,
  (error) => error
);
if (incomplete?.error !== "媒体资源长度与响应声明不一致（声明 5 字节，实际收到 3 字节）") {
  throw new Error(`未编码的短响应必须阻止封装：${incomplete?.error || "响应被错误标记为成功"}`);
}

const partialRangePromise = request().then(
  () => null,
  (error) => error
);
const partialRangeStart = await waitForOutbound("xhr-start");
receive({
  type: "xhr-ready",
  requestId: partialRangeStart.requestId,
  status: 206,
  responseHeaders: "content-length: 3\r\ncontent-range: bytes 0-4/5",
  total: 5
});
receive({ type: "xhr-chunk", requestId: partialRangeStart.requestId, sequence: 0, data: new Uint8Array([1, 2, 3]).buffer, loaded: 3, total: 5 });
receive({ type: "xhr-load", requestId: partialRangeStart.requestId, loaded: 3 });
const partialRange = await partialRangePromise;
if (partialRange?.error !== "媒体分段长度与 Content-Range 不一致（应为 5 字节，实际收到 3 字节）") {
  throw new Error(`206 分段长度不符没有被拦截：${partialRange?.error || "响应被错误标记为成功"}`);
}

const partial200Promise = request().then(
  () => null,
  (error) => error
);
const partial200Start = await waitForOutbound("xhr-start");
receive({
  type: "xhr-ready",
  requestId: partial200Start.requestId,
  status: 200,
  responseHeaders: "content-length: 3\r\ncontent-range: bytes 0-2/5",
  total: 3
});
receive({ type: "xhr-chunk", requestId: partial200Start.requestId, sequence: 0, data: new Uint8Array([1, 2, 3]).buffer, loaded: 3, total: 3 });
receive({ type: "xhr-load", requestId: partial200Start.requestId, loaded: 3 });
const partial200 = await partial200Promise;
if (partial200?.error !== "媒体响应只包含不完整的 Content-Range") {
  throw new Error(`200 响应携带部分范围时必须阻止封装：${partial200?.error || "响应被错误标记为成功"}`);
}

const decodedPromise = request();
const decodedStart = await waitForOutbound("xhr-start");
receive({
  type: "xhr-ready",
  requestId: decodedStart.requestId,
  status: 200,
  statusText: "OK",
  responseHeaders: "content-length: 5\r\ncontent-encoding: gzip",
  total: 5
});
receive({ type: "xhr-chunk", requestId: decodedStart.requestId, sequence: 0, data: new TextEncoder().encode("abc").buffer, loaded: 3, total: 5 });
receive({ type: "xhr-load", requestId: decodedStart.requestId, loaded: 3 });
const decoded = await decodedPromise;
if (decoded.response.byteLength !== 3 || /content-length\s*:/i.test(decoded.responseHeaders) || /content-encoding\s*:/i.test(decoded.responseHeaders)) {
  throw new Error("透明解压后的完整响应应移除指向压缩字节的实体长度元数据");
}

const sequenceErrorPromise = request().then(
  () => null,
  (error) => error
);
const sequenceErrorStart = await waitForOutbound("xhr-start");
receive({ type: "xhr-ready", requestId: sequenceErrorStart.requestId, status: 200, responseHeaders: "" });
receive({ type: "xhr-chunk", requestId: sequenceErrorStart.requestId, sequence: 1, data: new Uint8Array([1]).buffer, loaded: 1, total: 1 });
const sequenceError = await sequenceErrorPromise;
if (sequenceError?.error !== "扩展媒体传输顺序错误") throw new Error("缺失的媒体块序号没有立即失败");
receive({ type: "xhr-load", requestId: sequenceErrorStart.requestId, loaded: 1 });

const malformedChunkPromise = request().then(
  () => null,
  (error) => error
);
const malformedChunkStart = await waitForOutbound("xhr-start");
receive({ type: "xhr-ready", requestId: malformedChunkStart.requestId, status: 200, responseHeaders: "" });
receive({ type: "xhr-chunk", requestId: malformedChunkStart.requestId, sequence: 0, data: "%%%", loaded: 1, total: 1 });
const malformedChunk = await malformedChunkPromise;
if (malformedChunk?.error !== "扩展媒体分块编码无效") throw new Error("损坏的媒体块没有作为请求错误结算");

const bridgeLoss = request().then(
  () => { throw new Error("检测到分块漏失的响应被误报成功"); },
  (error) => error
);
const bridgeLossStart = await waitForOutbound("xhr-start");
receive({ type: "xhr-ready", requestId: bridgeLossStart.requestId, status: 200, responseHeaders: "content-length: 5", total: 5 });
receive({ type: "xhr-chunk", requestId: bridgeLossStart.requestId, sequence: 0, data: new TextEncoder().encode("bad").buffer, loaded: 3, total: 5 });
receive({ type: "xhr-load", requestId: bridgeLossStart.requestId, loaded: 4 });
const bridgeLossError = await bridgeLoss;
if (bridgeLossError.error !== "扩展媒体传输不完整") throw new Error(`分块漏失没有被拦截：${bridgeLossError.error}`);

const first = request();
const second = request();
const firstStart = await waitForOutbound("xhr-start");
const secondStart = await waitForOutbound("xhr-start");
if (firstStart.requestId === secondStart.requestId) throw new Error("并发请求复用了 requestId");
const cancel = outbound.find((item) => item.type === "xhr-cancel" && item.requestId === firstStart.requestId);
if (cancel) throw new Error("未调用 abort 的请求意外被取消");
receive({ type: "xhr-error", requestId: firstStart.requestId, message: "单请求失败" });
const firstFailure = await first.then(() => null, (error) => error);
if (firstFailure?.error !== "单请求失败") throw new Error("单请求错误没有返回给对应调用者");
receive({ type: "xhr-ready", requestId: secondStart.requestId, status: 200, responseHeaders: "" });
receive({ type: "xhr-chunk", requestId: secondStart.requestId, sequence: 0, data: new Uint8Array([7]).buffer, loaded: 1, total: 1 });
receive({ type: "xhr-load", requestId: secondStart.requestId, loaded: 1 });
if ((await second).response.byteLength !== 1) throw new Error("另一个请求被并发错误污染");

let cancelCallbackCount = 0;
const abortHandle = requestApi({
  method: "GET",
  url: "https://xy123x.bilivideo.com/cancel",
  responseType: "arraybuffer",
  onabort: () => { cancelCallbackCount += 1; }
});
const cancelStart = await waitForOutbound("xhr-start");
abortHandle.abort();
const cancelMessage = await waitForOutbound("xhr-cancel", cancelStart.requestId);
if (!cancelMessage || cancelCallbackCount !== 1) throw new Error("单请求取消没有及时结算且只回调一次");

let timeoutCount = 0;
const timeoutHandle = requestApi({
  method: "GET",
  url: "https://xy123x.bilivideo.net/timeout",
  responseType: "arraybuffer",
  timeout: 1000,
  ontimeout: () => { timeoutCount += 1; }
});
const timeoutStart = await waitForOutbound("xhr-start");
await new Promise((resolve) => setTimeout(resolve, 1050));
if (timeoutCount !== 1) throw new Error("单请求超时没有及时结算");
receive({ type: "xhr-error", requestId: timeoutStart.requestId, message: "迟到的错误" });
if (timeoutCount !== 1) throw new Error("超时请求的迟到响应触发了重复回调");
timeoutHandle.abort();

const disconnected = request().then(
  () => null,
  (error) => error
);
const disconnectedStart = await waitForOutbound("xhr-start");
receive({ type: "bridge-disconnected" });
const disconnectedError = await disconnected;
if (disconnectedError?.error !== "扩展桥接已断开") throw new Error("端口断开后 pending 请求没有明确失败");
receive({ type: "xhr-load", requestId: disconnectedStart.requestId, loaded: 0 });

const queued = request();
const queuedPing = outbound.some((item) => item.type === "bridge-ping");
if (!queuedPing) throw new Error("桥接未就绪时没有发起握手");
receive({ type: "bridge-ready" });
const queuedStart = await waitForOutbound("xhr-start");
receive({ type: "xhr-ready", requestId: queuedStart.requestId, status: 200, responseHeaders: "" });
receive({ type: "xhr-json", requestId: queuedStart.requestId, response: { code: 0 } });
await queued;

console.log("扩展兼容层测试通过：媒体完整性、独立 requestId、并发隔离、取消/超时单次结算、端口断开清理和未就绪队列均正常。");
