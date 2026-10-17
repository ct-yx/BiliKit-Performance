import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/extension/service-worker.js", import.meta.url), "utf8");
const runtimeListeners = [];
const downloadListeners = [];
const pendingDownloadStarts = new Map();
const canceledDownloadIds = [];
let mediaReadStarted = false;
let pendingMediaRead = null;
let mediaReaderCancelCount = 0;
const mediaParts = [new Uint8Array(300 * 1024).fill(3), new Uint8Array(300 * 1024).fill(7)];
const mediaStreamBytes = mediaParts.reduce((sum, part) => sum + part.byteLength, 0);
const port = {
  sent: [],
  messageListener: null,
  disconnectListener: null,
  postMessage(message) {
    this.sent.push(message);
  },
  onMessage: {
    addListener(listener) {
      port.messageListener = listener;
    }
  },
  onDisconnect: {
    addListener(listener) {
      port.disconnectListener = listener;
    }
  }
};

const makeResponse = (payload, options = {}) => {
  const headerEntries = Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]);
  return {
    status: options.status || 200,
    statusText: options.statusText || "OK",
    headers: {
      get(name) { return headerEntries.find(([key]) => key === String(name).toLowerCase())?.[1] || null; },
      forEach(callback) { for (const [key, value] of headerEntries) callback(value, key); }
    },
    async json() { return payload; },
    body: options.body || null
  };
};

const context = {
  URL,
  AbortController,
  btoa,
  setTimeout,
  clearTimeout,
  fetch: (url, options = {}) => {
    if (String(url).includes("media-stream")) {
      let index = 0;
      return Promise.resolve(makeResponse(null, {
        headers: { "content-length": String(mediaStreamBytes), "content-type": "video/mp4" },
        body: {
          getReader() {
            return {
              async read() {
                return index < mediaParts.length ? { done: false, value: mediaParts[index++] } : { done: true };
              },
              async cancel() {},
              releaseLock() {}
            };
          }
        }
      }));
    }
    if (String(url).includes("media-cancel")) {
      return Promise.resolve(makeResponse(null, {
        headers: { "content-type": "video/mp4" },
        body: {
          getReader() {
            return {
              read() {
                mediaReadStarted = true;
                return new Promise((resolve) => { pendingMediaRead = resolve; });
              },
              cancel() {
                mediaReaderCancelCount += 1;
                pendingMediaRead?.({ done: true });
                return Promise.resolve();
              },
              releaseLock() {}
            };
          }
        }
      }));
    }
    if (String(url).includes("slow")) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(makeResponse({ code: 0, data: { bvid: "BVslow", pages: [] } })), 40);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        }, { once: true });
      });
    }
    return Promise.resolve(makeResponse({ code: 0, data: { bvid: "BV1usLm6xEw7", pages: new Array(100).fill({ page: 1 }) } }));
  },
  chrome: {
    runtime: {
      onConnect: {
        addListener(listener) {
          runtimeListeners.push(listener);
        }
      }
    },
    downloads: {
      download(details) {
        return new Promise((resolve) => pendingDownloadStarts.set(details.url, resolve));
      },
      cancel(downloadId) {
        canceledDownloadIds.push(downloadId);
        return Promise.resolve();
      },
      onChanged: {
        addListener(listener) {
          downloadListeners.push(listener);
        }
      }
    }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context);

if (runtimeListeners.length !== 1 || downloadListeners.length !== 1) {
  throw new Error("Service Worker 事件监听器初始化失败");
}
runtimeListeners[0]({
  name: "bilikit-performance-edge-bridge-v2",
  ...port
});
if (typeof port.messageListener !== "function") throw new Error("未注册扩展端口消息监听器");

port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "json-large-1",
  details: {
    url: "https://api.bilibili.com/x/web-interface/view?bvid=BV1usLm6xEw7",
    method: "GET",
    responseType: "json",
    timeout: 15000
  }
});

await new Promise((resolve) => setTimeout(resolve, 0));
const messages = port.sent.filter((message) => message.requestId === "json-large-1");
if (!messages.some((message) => message.type === "xhr-ready")) throw new Error("JSON 请求缺少 xhr-ready");
const jsonMessage = messages.find((message) => message.type === "xhr-json");
if (!jsonMessage || jsonMessage.response?.data?.pages?.length !== 100) {
  throw new Error(`大合集 JSON 没有通过结构化消息返回：${JSON.stringify(messages.map((item) => item.type))}`);
}
if (messages.some((message) => message.type === "xhr-chunk" || message.type === "xhr-load")) {
  throw new Error("JSON 请求错误地退回媒体分块传输");
}

port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "json-slow-1",
  details: {
    url: "https://api.bilibili.com/x/web-interface/view?bvid=BVslow&slow=1",
    responseType: "json",
    timeout: 15000
  }
});
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "json-fast-2",
  details: {
    url: "https://api.bilibili.com/x/web-interface/view?bvid=BV1usLm6xEw7",
    responseType: "json",
    timeout: 15000
  }
});
await new Promise((resolve) => setTimeout(resolve, 0));
const fastMessages = port.sent.filter((message) => message.requestId === "json-fast-2");
if (!fastMessages.some((message) => message.type === "xhr-json")) throw new Error("快速 JSON 请求被慢请求阻塞");
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-cancel",
  requestId: "json-slow-1"
});
await new Promise((resolve) => setTimeout(resolve, 0));
const slowMessages = port.sent.filter((message) => message.requestId === "json-slow-1");
if (!slowMessages.some((message) => message.type === "xhr-abort")) throw new Error("取消慢请求没有单独返回 xhr-abort");
if (port.sent.some((message) => message.requestId === "json-slow-1" && message.type === "xhr-json")) {
  throw new Error("慢请求取消后仍污染了其它响应生命周期");
}

port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "media-stream-1",
  details: {
    url: "https://xy123x.bilivideo.com/media-stream.m4s",
    responseType: "arraybuffer",
    timeout: 15000
  }
});
for (let attempt = 0; attempt < 20 && !port.sent.some((message) => message.requestId === "media-stream-1" && message.type === "xhr-load"); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
const mediaStreamMessages = port.sent.filter((message) => message.requestId === "media-stream-1");
const mediaChunks = mediaStreamMessages.filter((message) => message.type === "xhr-chunk");
if (!mediaStreamMessages.some((message) => message.type === "xhr-ready")) throw new Error("媒体流没有先发送响应元数据");
if (mediaChunks.length !== 2 || mediaChunks.map((message) => message.sequence).join(",") !== "0,1") {
  throw new Error(`媒体流分块顺序或数量错误：${mediaChunks.map((message) => message.sequence).join(",")}`);
}
if (mediaChunks.map((message) => message.loaded).join(",") !== `${512 * 1024},${mediaStreamBytes}`) {
  throw new Error("媒体分块累计字节数与已发送内容不符");
}
const decodedMediaChunks = mediaChunks.map((message) => Uint8Array.from(atob(message.data), (character) => character.charCodeAt(0)));
if (decodedMediaChunks[0].byteLength !== 512 * 1024 || decodedMediaChunks[1].byteLength !== mediaStreamBytes - 512 * 1024
  || decodedMediaChunks[0][0] !== 3 || decodedMediaChunks[0].at(-1) !== 7 || decodedMediaChunks[1][0] !== 7) {
  throw new Error("媒体分块 Base64 编码或边界拼接错误");
}
if (!mediaStreamMessages.some((message) => message.type === "xhr-load" && message.loaded === mediaStreamBytes)) {
  throw new Error("媒体流终态字节数不一致");
}

port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "media-cancel-1",
  details: {
    url: "https://xy123x.bilivideo.com/media-cancel.m4s",
    responseType: "arraybuffer",
    timeout: 15000
  }
});
for (let attempt = 0; attempt < 20 && !mediaReadStarted; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
if (!mediaReadStarted) throw new Error("媒体响应流没有进入 reader.read()");
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-cancel",
  requestId: "media-cancel-1"
});
await new Promise((resolve) => setTimeout(resolve, 0));
if (mediaReaderCancelCount !== 1) throw new Error("取消媒体请求时没有停止正在等待的 ReadableStream reader");
if (!port.sent.some((message) => message.requestId === "media-cancel-1" && message.type === "xhr-abort")) {
  throw new Error("取消媒体 reader 后没有单独结算 xhr-abort");
}

const canceledUrl = "https://xy123x.bilivideo.com/cancel-race.m4s";
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "download-start",
  requestId: "download-cancel-race",
  details: { url: canceledUrl, name: "cancel-race.m4s" }
});
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "download-cancel",
  requestId: "download-cancel-race"
});
pendingDownloadStarts.get(canceledUrl)?.(42);
await new Promise((resolve) => setTimeout(resolve, 0));
if (!canceledDownloadIds.includes(42)) throw new Error("启动中的浏览器下载在取消后仍继续运行");
if (port.sent.some((message) => message.requestId === "download-cancel-race" && message.type === "download-started")) {
  throw new Error("已取消的启动请求仍上报 download-started");
}

const disconnectedUrl = "https://xy123x.bilivideo.com/disconnect-race.m4s";
port.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "download-start",
  requestId: "download-disconnect-race",
  details: { url: disconnectedUrl, name: "disconnect-race.m4s" }
});
port.disconnectListener();
pendingDownloadStarts.get(disconnectedUrl)?.(43);
await new Promise((resolve) => setTimeout(resolve, 0));
if (!canceledDownloadIds.includes(43)) throw new Error("端口断开时正在启动的浏览器下载没有被取消");

const disconnectPort = {
  sent: [],
  messageListener: null,
  disconnectListener: null,
  postMessage(message) { this.sent.push(message); },
  onMessage: { addListener(listener) { disconnectPort.messageListener = listener; } },
  onDisconnect: { addListener(listener) { disconnectPort.disconnectListener = listener; } }
};
runtimeListeners[0]({ name: "bilikit-performance-edge-bridge-v2", ...disconnectPort });
mediaReadStarted = false;
pendingMediaRead = null;
disconnectPort.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-start",
  requestId: "media-disconnect-1",
  details: {
    url: "https://xy123x.bilivideo.com/media-cancel.m4s",
    responseType: "arraybuffer",
    timeout: 15000
  }
});
for (let attempt = 0; attempt < 20 && !mediaReadStarted; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
if (!mediaReadStarted) throw new Error("端口断开用例没有进入媒体 reader");
disconnectPort.disconnectListener();
await new Promise((resolve) => setTimeout(resolve, 0));
if (mediaReaderCancelCount !== 2) throw new Error("端口断开后没有停止正在读取的媒体 reader");

console.log("扩展 JSON/Service Worker 测试通过：结构化 JSON、并发隔离、单请求取消和下载启动竞态清理均正常。");
