"use strict";

const CHANNEL = "bilikit-performance-edge-bridge-v2";
const REQUEST_TIMEOUT = 15 * 60 * 1000;
const CHUNK_BYTES = 512 * 1024;
const activeDownloads = new Map();

function allowedHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return host === "bilibili.com"
    || host.endsWith(".bilibili.com")
    || host === "bilivideo.com"
    || host.endsWith(".bilivideo.com")
    || host === "bilivideo.cn"
    || host.endsWith(".bilivideo.cn")
    || host === "bilivideo.net"
    || host.endsWith(".bilivideo.net")
    || host === "edge.mountaintoys.cn"
    || host === "www.biliplus.com"
    || host === "www.jijidown.com";
}

function send(context, message) {
  if (!context || context.closed) return false;
  try {
    context.port.postMessage({ channel: CHANNEL, ...message });
    return true;
  } catch {
    closeContext(context);
    return false;
  }
}

function closeContext(context) {
  if (!context || context.closed) return;
  context.closed = true;
  for (const state of context.requests.values()) {
    state.canceled = true;
    state.controller.abort();
    void cancelResponseReader(state);
    clearTimeout(state.timer);
  }
  for (const downloadId of context.downloads.values()) {
    activeDownloads.delete(downloadId);
    void chrome.downloads.cancel(downloadId).catch(() => {});
  }
  for (const requestState of context.downloadRequests.values()) requestState.canceled = true;
  context.requests.clear();
  context.downloads.clear();
  context.downloadRequests.clear();
}

function normalizeHeaders(headers) {
  const result = {};
  if (!headers || typeof headers !== "object") return result;
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    const lower = String(key).toLowerCase();
    if (["host", "origin", "cookie", "content-length", "user-agent", "referer"].includes(lower)) continue;
    result[String(key)] = String(value);
  }
  return result;
}

function headersToText(headers) {
  const lines = [];
  headers?.forEach?.((value, key) => lines.push(`${key}: ${value}`));
  return lines.join("\r\n");
}

function responseTotal(response) {
  const contentRange = response.headers.get("content-range")?.match(/\/([0-9]+)$/);
  if (contentRange) return Number(contentRange[1]) || 0;
  return Number(response.headers.get("content-length")) || 0;
}

function bytesToBase64(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let offset = 0; offset < view.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...view.subarray(offset, Math.min(offset + 0x8000, view.byteLength)));
  }
  return btoa(binary);
}

function cancelResponseReader(state, reason) {
  if (!state.reader || state.readerCanceled) return Promise.resolve();
  state.readerCanceled = true;
  try {
    return Promise.resolve(state.reader.cancel(reason)).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

async function sendResponseChunks(context, requestId, response, state) {
  const total = responseTotal(response);
  const reader = response.body?.getReader?.();
  state.reader = reader || null;
  state.readerCanceled = false;
  let loaded = 0;
  let sequence = 0;
  let buffered = 0;
  let chunkBuffer = new Uint8Array(CHUNK_BYTES);
  const ensureActive = () => {
    if (context.closed || state.canceled) throw new Error("媒体读取已取消");
  };
  const append = (bytes) => {
    ensureActive();
    for (let offset = 0; offset < bytes.byteLength;) {
      ensureActive();
      const length = Math.min(CHUNK_BYTES - buffered, bytes.byteLength - offset);
      chunkBuffer.set(bytes.subarray(offset, offset + length), buffered);
      buffered += length;
      offset += length;
      if (buffered === CHUNK_BYTES) {
        loaded += buffered;
        if (!send(context, { type: "xhr-chunk", requestId, sequence, data: bytesToBase64(chunkBuffer), loaded, total })) {
          throw new Error("媒体分块无法发送到扩展桥接");
        }
        sequence += 1;
        chunkBuffer = new Uint8Array(CHUNK_BYTES);
        buffered = 0;
      }
    }
  };
  try {
    if (!reader) append(new Uint8Array(await response.arrayBuffer()));
    else {
      while (true) {
        ensureActive();
        const part = await reader.read();
        ensureActive();
        if (part.done) break;
        append(part.value instanceof Uint8Array ? part.value : new Uint8Array(part.value || []));
      }
    }
    if (buffered) {
      loaded += buffered;
      if (!send(context, { type: "xhr-chunk", requestId, sequence, data: bytesToBase64(chunkBuffer.subarray(0, buffered)), loaded, total })) {
        throw new Error("媒体分块无法发送到扩展桥接");
      }
    }
    ensureActive();
    return loaded;
  } catch (error) {
    await cancelResponseReader(state, error);
    throw error;
  } finally {
    state.reader = null;
    state.readerCanceled = false;
    try { reader?.releaseLock?.(); } catch {
    }
  }
}

async function handleXhr(context, message, state) {
  const details = message.details || {};
  let url;
  try {
    url = new URL(String(details.url || ""));
  } catch {
    send(context, { type: "xhr-error", requestId: message.requestId, message: "请求地址无效" });
    return;
  }
  if (!/^https?:$/.test(url.protocol) || !allowedHost(url.hostname)) {
    send(context, { type: "xhr-error", requestId: message.requestId, message: "扩展未授权此请求域名" });
    return;
  }
  const timeout = Math.min(Math.max(Number(details.timeout) || REQUEST_TIMEOUT, 1000), REQUEST_TIMEOUT);
  state.timer = setTimeout(() => {
    state.timedOut = true;
    state.controller.abort();
  }, timeout);
  try {
    const response = await fetch(url.href, {
      method: String(details.method || "GET").toUpperCase(),
      headers: normalizeHeaders(details.headers),
      body: typeof details.body === "string" ? details.body : undefined,
      credentials: "include",
      cache: "no-store",
      referrer: String(details.referrer || "https://www.bilibili.com/"),
      referrerPolicy: "strict-origin-when-cross-origin",
      signal: state.controller.signal
    });
    if (state.canceled) return;
    const total = responseTotal(response);
    if (!send(context, {
      type: "xhr-ready",
      requestId: message.requestId,
      status: response.status,
      statusText: response.statusText,
      responseHeaders: headersToText(response.headers),
      total
    })) return;
    if (String(details.responseType || "").toLowerCase() === "json") {
      const payload = await response.json();
      if (state.canceled) return;
      send(context, {
        type: "xhr-json",
        requestId: message.requestId,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: headersToText(response.headers),
        response: payload
      });
      return;
    }
    const loaded = await sendResponseChunks(context, message.requestId, response, state);
    if (!state.canceled) send(context, { type: "xhr-load", requestId: message.requestId, loaded });
  } catch (error) {
    if (state.timedOut) send(context, { type: "xhr-timeout", requestId: message.requestId });
    else if (state.canceled) send(context, { type: "xhr-abort", requestId: message.requestId });
    else send(context, { type: "xhr-error", requestId: message.requestId, message: error instanceof Error ? error.message : "跨域请求失败" });
  } finally {
    clearTimeout(state.timer);
  }
}

function startXhr(context, message) {
  const requestId = String(message.requestId || "");
  if (!requestId || context.requests.has(requestId) || context.closed) return;
  const state = { controller: new AbortController(), canceled: false, timedOut: false, timer: 0, reader: null, readerCanceled: false };
  context.requests.set(requestId, state);
  void handleXhr(context, message, state).finally(() => context.requests.delete(requestId));
}

function cancelXhr(context, message) {
  const requestId = String(message.requestId || "");
  const state = context.requests.get(requestId);
  if (!state) return;
  state.canceled = true;
  state.controller.abort();
  void cancelResponseReader(state);
}

async function startDownload(context, message) {
  const requestId = String(message.requestId || "");
  const details = message.details || {};
  if (!requestId || context.downloadRequests.has(requestId) || context.closed) return;
  const requestState = { canceled: false, downloadId: null };
  context.downloadRequests.set(requestId, requestState);
  let url;
  try {
    url = new URL(String(details.url || ""));
  } catch {
    context.downloadRequests.delete(requestId);
    send(context, { type: "download-error", requestId, message: "下载地址无效" });
    return;
  }
  if (!/^https?:$/.test(url.protocol) || !allowedHost(url.hostname)) {
    context.downloadRequests.delete(requestId);
    send(context, { type: "download-error", requestId, message: "扩展未授权此下载域名" });
    return;
  }
  try {
    const downloadId = await chrome.downloads.download({
      url: url.href,
      filename: String(details.name || "download"),
      saveAs: Boolean(details.saveAs),
      headers: Object.entries(normalizeHeaders(details.headers)).map(([name, value]) => ({ name, value }))
    });
    if (context.closed || requestState.canceled) {
      await chrome.downloads.cancel(downloadId).catch(() => {});
      context.downloadRequests.delete(requestId);
      return;
    }
    requestState.downloadId = downloadId;
    activeDownloads.set(downloadId, { context, requestId });
    context.downloads.set(requestId, downloadId);
    send(context, { type: "download-started", requestId, downloadId });
  } catch (error) {
    context.downloadRequests.delete(requestId);
    send(context, { type: "download-error", requestId, message: error instanceof Error ? error.message : "浏览器下载 API 不可用" });
  }
}

async function cancelDownload(context, message) {
  const requestId = String(message.requestId || "");
  const requestState = context.downloadRequests.get(requestId);
  if (requestState) requestState.canceled = true;
  const downloadId = context.downloads.get(requestId);
  context.downloads.delete(requestId);
  context.downloadRequests.delete(requestId);
  if (downloadId == null) {
    send(context, { type: "download-abort", requestId });
    return;
  }
  activeDownloads.delete(downloadId);
  try {
    await chrome.downloads.cancel(downloadId);
  } catch {
  }
  send(context, { type: "download-abort", requestId });
}

chrome.downloads.onChanged.addListener((delta) => {
  const record = activeDownloads.get(delta.id);
  if (!record) return;
  const { context, requestId } = record;
  if (delta.bytesReceived || delta.totalBytes) {
    send(context, {
      type: "download-progress",
      requestId,
      loaded: delta.bytesReceived?.current,
      total: delta.totalBytes?.current
    });
  }
  const state = delta.state?.current;
  if (state === "complete") {
    activeDownloads.delete(delta.id);
    context.downloads.delete(requestId);
    context.downloadRequests.delete(requestId);
    send(context, { type: "download-load", requestId, downloadId: delta.id });
  } else if (state === "interrupted") {
    activeDownloads.delete(delta.id);
    context.downloads.delete(requestId);
    context.downloadRequests.delete(requestId);
    send(context, { type: "download-error", requestId, message: delta.error?.current || "浏览器下载中断" });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== CHANNEL) return;
  const context = {
    port,
    closed: false,
    requests: new Map(),
    downloads: new Map(),
    downloadRequests: new Map()
  };
  port.onMessage.addListener((message) => {
    if (!message || message.channel !== CHANNEL || context.closed) return;
    if (message.type === "xhr-start") startXhr(context, message);
    else if (message.type === "xhr-cancel") cancelXhr(context, message);
    else if (message.type === "download-start") void startDownload(context, message);
    else if (message.type === "download-cancel") void cancelDownload(context, message);
  });
  port.onDisconnect.addListener(() => {
    closeContext(context);
  });
});
