/*
 * BiliKit Edge adapter, MAIN world.
 *
 * 这里只实现页面侧的兼容接口和请求状态机。网络权限、浏览器下载和
 * Service Worker 生命周期全部留在扩展桥接之后，避免把页面 fetch、媒体
 * 分块、JSON 响应和下载状态混在一个隐式回退链路里。
 */
(function installBiliKitEdgeAdapter() {
  "use strict";

  if (globalThis.__BILIKIT_EDGE_ADAPTER__) return;
  globalThis.__BILIKIT_EDGE_ADAPTER__ = true;

  const CHANNEL = "bilikit-performance-edge-bridge-v2";
  const REQUEST_TIMEOUT = 15 * 60 * 1000;
  const XHR_PROGRESS_INTERVAL = 500;
  const TASK_RENDER_INTERVAL = 500;
  const PAGE_ORIGIN = location.origin;
  const xhrRequests = new Map();
  const downloadRequests = new Map();
  const queuedRequests = new Map();
  let bridgeReady = false;
  let bridgeRetryTimer = 0;
  let bridgeRetryDelay = 50;
  let sequence = 0;
  let taskRenderTimer = 0;
  let taskRenderRequestedAt = 0;
  let pendingTaskRenderer = null;

  function nextId(prefix) {
    sequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  function safeCall(callback, value) {
    if (typeof callback !== "function") return;
    try {
      callback(value);
    } catch (error) {
      setTimeout(() => { throw error; }, 0);
    }
  }

  function postWindow(message) {
    try {
      window.postMessage({ channel: CHANNEL, direction: "to-bridge", ...message }, PAGE_ORIGIN);
      return true;
    } catch {
      return false;
    }
  }

  function announceBridgePing() {
    postWindow({ type: "bridge-ping" });
  }

  function scheduleBridgeRetry() {
    if (bridgeReady || bridgeRetryTimer) return;
    bridgeRetryTimer = setTimeout(() => {
      bridgeRetryTimer = 0;
      if (bridgeReady) return;
      announceBridgePing();
      bridgeRetryDelay = Math.min(2000, bridgeRetryDelay * 2);
      scheduleBridgeRetry();
    }, bridgeRetryDelay);
  }

  function flushQueuedRequests() {
    for (const [requestId, packet] of queuedRequests) {
      const state = xhrRequests.get(requestId) || downloadRequests.get(requestId);
      queuedRequests.delete(requestId);
      if (!state || state.settled) continue;
      state.sent = true;
      if (postWindow(packet)) continue;
      state.sent = false;
      if (xhrRequests.has(requestId)) failXhr(state, "扩展桥接不可用");
      else finishDownload(state, "onerror", { type: "download-error", message: "扩展桥接不可用" });
    }
  }

  function markBridgeReady() {
    bridgeReady = true;
    bridgeRetryDelay = 50;
    if (bridgeRetryTimer) {
      clearTimeout(bridgeRetryTimer);
      bridgeRetryTimer = 0;
    }
    flushQueuedRequests();
  }

  function markBridgeDisconnected() {
    bridgeReady = false;
    queuedRequests.clear();
    for (const state of [...xhrRequests.values()]) failXhr(state, "扩展桥接已断开");
    for (const state of [...downloadRequests.values()]) {
      finishDownload(state, "onerror", { type: "download-error", message: "扩展桥接已断开" });
    }
    scheduleBridgeRetry();
  }

  function sendRequest(state, packet) {
    if (state.settled) return false;
    const message = { ...packet, requestId: state.requestId };
    if (!bridgeReady) {
      queuedRequests.set(state.requestId, message);
      state.queued = true;
      announceBridgePing();
      scheduleBridgeRetry();
      return true;
    }
    state.sent = true;
    if (postWindow(message)) return true;
    state.sent = false;
    if (xhrRequests.has(state.requestId)) failXhr(state, "扩展桥接不可用");
    else finishDownload(state, "onerror", { type: "download-error", message: "扩展桥接不可用" });
    return false;
  }

  function sendCancel(state, type) {
    queuedRequests.delete(state.requestId);
    state.queued = false;
    if (!state.sent || !bridgeReady) return;
    postWindow({ type, requestId: state.requestId });
  }

  function headerObject(headers) {
    if (!headers || typeof headers !== "object") return {};
    const result = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value == null) continue;
      result[String(key)] = String(value);
    }
    return result;
  }

  function removeResponseHeader(headers, name) {
    const pattern = new RegExp(`^\\s*${name}\\s*:.*(?:\\r?\\n|$)`, "gim");
    return String(headers || "").replace(pattern, "").trim();
  }

  function responseHeaderValue(headers, name) {
    return String(headers || "").match(new RegExp(`^\\s*${name}\\s*:\\s*(.*?)\\s*$`, "im"))?.[1] || "";
  }

  function normalizeCompletedResponseLength(state) {
    const meta = state.meta;
    const status = Number(meta?.status);
    if (!meta || ![200, 206].includes(status)) return "";
    const headers = String(meta.responseHeaders || "");
    const contentLength = responseHeaderValue(headers, "content-length").trim();
    const declared = /^\d+$/.test(contentLength) ? Number(contentLength) : null;
    const contentEncoding = responseHeaderValue(headers, "content-encoding")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const encodedBody = contentEncoding.some((value) => value !== "identity");
    const contentRange = responseHeaderValue(headers, "content-range").trim();
    const range = contentRange.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);

    if (status === 200 && encodedBody) {
      if (contentRange && (!range || Number(range[1]) !== 0 || range[3] === "*" || Number(range[2]) + 1 !== Number(range[3]))) {
        return "媒体响应只包含不完整的 Content-Range";
      }
      // Fetch 将 gzip/br 等响应透明解码后才交给 ReadableStream；长度、编码和
      // 字节范围头仍可能描述线上压缩表示，因此不再把这些头交给媒体消费者。
      meta.responseHeaders = removeResponseHeader(
        removeResponseHeader(removeResponseHeader(headers, "content-length"), "content-encoding"),
        "content-range"
      );
      state.total = state.receivedBytes;
      return "";
    }

    if (status === 200 && contentRange && !range) return "媒体响应只包含不完整的 Content-Range";
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const expected = end - start + 1;
      if (!Number.isSafeInteger(expected) || expected <= 0 || expected !== state.receivedBytes) {
        return `媒体分段长度与 Content-Range 不一致（应为 ${expected} 字节，实际收到 ${state.receivedBytes} 字节）`;
      }
      if (status === 200 && (start !== 0 || range[3] === "*" || end + 1 !== Number(range[3]))) {
        return "媒体响应只包含不完整的 Content-Range";
      }
    }

    if (declared !== null && declared !== state.receivedBytes) {
      return `媒体资源长度与响应声明不一致（声明 ${declared} 字节，实际收到 ${state.receivedBytes} 字节）`;
    }
    return "";
  }

  function decodeBytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function concatChunks(chunks, total) {
    const size = Number(total);
    const chunkBytes = chunks.reduce((sum, item) => sum + item.byteLength, 0);
    if (!Number.isSafeInteger(size) || size < 0 || chunkBytes !== size) {
      throw new Error("扩展媒体缓冲区长度不一致");
    }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      output.set(view, offset);
      offset += view.byteLength;
    }
    return output.buffer;
  }

  function responseObject(state, body) {
    const meta = state.meta || { status: 0, statusText: "", responseHeaders: "" };
    const responseType = String(state.details.responseType || "").toLowerCase();
    const bytes = body instanceof ArrayBuffer ? body : new Uint8Array(body || []).buffer;
    if (responseType === "arraybuffer") {
      return { ...meta, readyState: 4, response: bytes, responseText: "" };
    }
    const text = new TextDecoder().decode(new Uint8Array(bytes));
    let response = text;
    if (responseType === "json") {
      try {
        response = text ? JSON.parse(text) : null;
      } catch {
        response = null;
      }
    }
    return { ...meta, readyState: 4, response, responseText: text };
  }

  function buildRequestDetails(details) {
    const output = {
      method: String(details?.method || "GET").toUpperCase(),
      url: String(details?.url || ""),
      headers: headerObject(details?.headers),
      responseType: String(details?.responseType || ""),
      timeout: Math.min(Math.max(Number(details?.timeout) || REQUEST_TIMEOUT, 1000), REQUEST_TIMEOUT),
      referrer: `${location.origin}/`,
      bilikitBridge: Boolean(details?.bilikitBridge)
    };
    if (typeof details?.data === "string") output.body = details.data;
    return output;
  }

  function finishXhr(state, callbackName, value) {
    if (state.settled) return;
    state.settled = true;
    clearTimeout(state.timeoutId);
    clearTimeout(state.progressTimer);
    queuedRequests.delete(state.requestId);
    xhrRequests.delete(state.requestId);
    safeCall(state.details[callbackName], value);
  }

  function failXhr(state, message, callbackName = "onerror") {
    finishXhr(state, callbackName, {
      status: 0,
      statusText: String(message || "请求失败"),
      error: String(message || "请求失败")
    });
  }

  function failXhrTransfer(state, message) {
    sendCancel(state, "xhr-cancel");
    failXhr(state, message);
  }

  function emitXhrProgress(state) {
    state.progressTimer = 0;
    state.lastProgressAt = Date.now();
    const progress = state.pendingProgress;
    state.pendingProgress = null;
    if (progress) safeCall(state.details.onprogress, progress);
  }

  function queueXhrProgress(state) {
    state.pendingProgress = {
      loaded: state.loaded,
      total: state.total,
      lengthComputable: state.total > 0
    };
    const elapsed = Date.now() - state.lastProgressAt;
    if (elapsed >= XHR_PROGRESS_INTERVAL) emitXhrProgress(state);
    else if (!state.progressTimer) {
      state.progressTimer = setTimeout(() => emitXhrProgress(state), XHR_PROGRESS_INTERVAL - elapsed);
    }
  }

  function timeoutXhr(state) {
    if (state.settled) return;
    state.timedOut = true;
    sendCancel(state, "xhr-cancel");
    failXhr(state, "请求超时", "ontimeout");
  }

  function startXhr(details) {
    const requestId = nextId("xhr");
    const state = {
      requestId,
      details: details || {},
      chunks: [],
      receivedBytes: 0,
      loaded: 0,
      total: 0,
      nextChunkSequence: 0,
      meta: null,
      settled: false,
      sent: false,
      queued: false,
      timedOut: false,
      timeoutId: 0,
      progressTimer: 0,
      lastProgressAt: 0,
      pendingProgress: null
    };
    xhrRequests.set(requestId, state);
    state.timeoutId = setTimeout(() => timeoutXhr(state), Math.min(Math.max(Number(details?.timeout) || REQUEST_TIMEOUT, 1000), REQUEST_TIMEOUT));
    sendRequest(state, { type: "xhr-start", details: buildRequestDetails(details) });
    return {
      abort() {
        if (state.settled) return;
        sendCancel(state, "xhr-cancel");
        failXhr(state, "已取消", "onabort");
      }
    };
  }

  function handleXhrBridgeEvent(message) {
    const state = xhrRequests.get(String(message.requestId || ""));
    if (!state || state.settled) return;
    if (message.type === "xhr-ready") {
      if (state.meta) return;
      state.meta = {
        status: Number(message.status) || 0,
        statusText: String(message.statusText || ""),
        responseHeaders: String(message.responseHeaders || "")
      };
      state.total = Number(message.total) || 0;
      safeCall(state.details.onreadystatechange, { ...state.meta, readyState: 2 });
      return;
    }
    if (message.type === "xhr-progress") {
      state.loaded = Math.max(state.loaded, Number(message.loaded) || 0);
      state.total = Math.max(state.total, Number(message.total) || 0);
      queueXhrProgress(state);
      return;
    }
    if (message.type === "xhr-chunk") {
      const sequenceNumber = Number(message.sequence);
      if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber !== state.nextChunkSequence) {
        failXhrTransfer(state, "扩展媒体传输顺序错误");
        return;
      }
      let bytes;
      try {
        bytes = decodeBytes(message.data);
      } catch {
        failXhrTransfer(state, "扩展媒体分块编码无效");
        return;
      }
      state.nextChunkSequence += 1;
      state.chunks.push(bytes);
      state.receivedBytes += bytes.byteLength;
      const chunkLoaded = Number(message.loaded);
      if (message.loaded != null && (!Number.isSafeInteger(chunkLoaded) || chunkLoaded !== state.receivedBytes)) {
        failXhrTransfer(state, "扩展媒体累计字节数不一致");
        return;
      }
      state.loaded = state.receivedBytes;
      state.total = Math.max(state.total, Number(message.total) || 0);
      queueXhrProgress(state);
      return;
    }
    if (message.type === "xhr-json") {
      state.meta = {
        status: Number(message.status || state.meta?.status) || 0,
        statusText: String(message.statusText || state.meta?.statusText || ""),
        responseHeaders: String(message.responseHeaders || state.meta?.responseHeaders || "")
      };
      const response = message.response;
      let responseText = "";
      try {
        responseText = typeof response === "string" ? response : JSON.stringify(response);
      } catch {
      }
      finishXhr(state, "onload", { ...state.meta, readyState: 4, response, responseText });
      return;
    }
    if (message.type === "xhr-load") {
      const reportedBytes = Number(message.loaded);
      if (!Number.isSafeInteger(reportedBytes) || reportedBytes !== state.receivedBytes) {
        failXhrTransfer(state, "扩展媒体传输不完整");
        return;
      }
      const lengthError = normalizeCompletedResponseLength(state);
      if (lengthError) {
        failXhr(state, lengthError);
        return;
      }
      state.loaded = state.receivedBytes;
      if (state.pendingProgress) {
        state.pendingProgress = {
          loaded: state.receivedBytes,
          total: state.total,
          lengthComputable: state.total > 0
        };
        emitXhrProgress(state);
      }
      try {
        finishXhr(state, "onload", responseObject(state, concatChunks(state.chunks, state.receivedBytes)));
      } catch (error) {
        failXhr(state, error instanceof Error ? error.message : "扩展媒体缓冲区长度不一致");
      }
      return;
    }
    if (message.type === "xhr-timeout") {
      failXhr(state, "请求超时", "ontimeout");
      return;
    }
    if (message.type === "xhr-abort") {
      failXhr(state, "已取消", "onabort");
      return;
    }
    if (message.type === "xhr-error") failXhr(state, message.message || "跨域请求失败");
  }

  function finishDownload(state, callbackName, message) {
    if (state.settled) return;
    state.settled = true;
    clearTimeout(state.timeoutId);
    queuedRequests.delete(state.requestId);
    downloadRequests.delete(state.requestId);
    safeCall(state.details[callbackName], message);
  }

  function handleDownloadBridgeEvent(message) {
    const state = downloadRequests.get(String(message.requestId || ""));
    if (!state || state.settled) return;
    if (message.type === "download-progress") {
      safeCall(state.details.onprogress, {
        loaded: Math.max(0, Number(message.loaded) || 0),
        total: Math.max(0, Number(message.total) || 0),
        lengthComputable: Number(message.total) > 0
      });
      return;
    }
    if (message.type === "download-load") finishDownload(state, "onload", message);
    else if (message.type === "download-abort") finishDownload(state, "onabort", message);
    else if (message.type === "download-error") finishDownload(state, "onerror", message);
  }

  function startDownload(details) {
    const requestId = nextId("download");
    const url = String(details?.url || "");
    if (/^blob:/i.test(url)) {
      let settled = false;
      const finish = (callbackName, message) => {
        if (settled) return;
        settled = true;
        safeCall(details?.[callbackName], message);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = String(details?.name || "download");
          link.rel = "noopener";
          link.style.display = "none";
          document.body?.appendChild(link);
          link.click();
          link.remove();
          finish("onload", { type: "download-load", requestId });
        } catch (error) {
          finish("onerror", { type: "download-error", requestId, message: error instanceof Error ? error.message : "页面下载不可用" });
        }
      }, 0);
      return {
        abort() {
          clearTimeout(timer);
          finish("onabort", { type: "download-abort", requestId, message: "已取消" });
        }
      };
    }
    const state = {
      requestId,
      details: details || {},
      settled: false,
      sent: false,
      queued: false,
      timeoutId: 0
    };
    downloadRequests.set(requestId, state);
    state.timeoutId = setTimeout(() => {
      if (state.settled) return;
      sendCancel(state, "download-cancel");
      finishDownload(state, "onerror", { type: "download-error", message: "浏览器下载超时" });
    }, REQUEST_TIMEOUT);
    sendRequest(state, {
      type: "download-start",
      details: {
        url: String(details?.url || ""),
        name: String(details?.name || "download"),
        saveAs: Boolean(details?.saveAs),
        headers: headerObject(details?.headers)
      }
    });
    return {
      abort() {
        if (state.settled) return;
        sendCancel(state, "download-cancel");
        finishDownload(state, "onabort", { type: "download-abort", message: "已取消" });
      }
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.direction !== "to-main" || typeof message.type !== "string") return;
    if (message.type === "bridge-ready") {
      markBridgeReady();
      return;
    }
    if (message.type === "bridge-disconnected") {
      markBridgeDisconnected();
      return;
    }
    if (message.type.startsWith("xhr-")) {
      handleXhrBridgeEvent(message);
      return;
    }
    if (message.type.startsWith("download-")) handleDownloadBridgeEvent(message);
  });

  function scheduleTaskRender(render) {
    if (typeof render !== "function") return;
    pendingTaskRenderer = render;
    if (taskRenderTimer) return;
    const delay = Math.max(0, TASK_RENDER_INTERVAL - (Date.now() - taskRenderRequestedAt));
    taskRenderTimer = setTimeout(() => {
      taskRenderTimer = 0;
      const callback = pendingTaskRenderer;
      pendingTaskRenderer = null;
      if (!callback) return;
      taskRenderRequestedAt = Date.now();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
      else callback();
    }, delay);
  }

  function installDownloadWorkspaceStyles() {
    if (typeof document === "undefined") return;
    const install = () => {
      if (document.getElementById("bilikit-edge-download-workspace-style")) return true;
      const parent = document.head || document.documentElement;
      if (!parent) return false;
      const style = document.createElement("style");
      style.id = "bilikit-edge-download-workspace-style";
      style.textContent = ".bk-dw-task{content-visibility:auto;contain-intrinsic-size:150px}.bk-dw-episode{content-visibility:auto;contain-intrinsic-size:48px}";
      parent.appendChild(style);
      return true;
    };
    if (install() || typeof MutationObserver !== "function") return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  // 给构建后的扩展核心使用私有入口，避免与 Tampermonkey 全局 API 互相抢占。
  globalThis.__BILIKIT_EDGE_ADAPTER__ = true;
  globalThis.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__ = startXhr;
  globalThis.__BILIKIT_EDGE_GM_DOWNLOAD__ = startDownload;
  globalThis.__BILIKIT_EDGE_SCHEDULE_TASK_RENDER__ = scheduleTaskRender;
  installDownloadWorkspaceStyles();
  announceBridgePing();
  scheduleBridgeRetry();
})();
