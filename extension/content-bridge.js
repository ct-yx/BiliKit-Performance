"use strict";

const CHANNEL = "bilikit-performance-edge-bridge-v2";
const PAGE_ORIGIN = location.origin;
let port = null;
let reconnectTimer = 0;
let reconnectDelay = 50;

function decodeBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function postToMain(message, transfer = []) {
  window.postMessage({ ...message, channel: CHANNEL, direction: "to-main" }, PAGE_ORIGIN, transfer);
}

function forwardPortMessage(sourcePort, message) {
  if (port !== sourcePort || !message || message.channel !== CHANNEL) return;
  if (message.type === "xhr-chunk" && typeof message.data === "string") {
    try {
      const data = decodeBase64(message.data);
      postToMain({ ...message, data }, [data]);
    } catch {
      try {
        sourcePort.postMessage({ channel: CHANNEL, type: "xhr-cancel", requestId: message.requestId });
      } catch {
      }
      postToMain({
        type: "xhr-error",
        requestId: message.requestId,
        message: "扩展媒体分块编码无效"
      });
    }
    return;
  }
  postToMain(message);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = 0;
    connectPort();
    reconnectDelay = Math.min(2000, reconnectDelay * 2);
    if (!port) scheduleReconnect();
  }, reconnectDelay);
}

function handlePortDisconnect(disconnectedPort) {
  if (port !== disconnectedPort) return;
  port = null;
  postToMain({ type: "bridge-disconnected" });
  scheduleReconnect();
}

function connectPort() {
  if (port) return port;
  try {
    const nextPort = chrome.runtime.connect({ name: CHANNEL });
    port = nextPort;
    reconnectDelay = 50;
    nextPort.onMessage.addListener((message) => forwardPortMessage(nextPort, message));
    nextPort.onDisconnect.addListener(() => handlePortDisconnect(nextPort));
    postToMain({ type: "bridge-ready" });
    return nextPort;
  } catch {
    port = null;
    scheduleReconnect();
    return null;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
  const message = event.data;
  if (!message || message.channel !== CHANNEL || message.direction !== "to-bridge") return;
  if (message.type === "bridge-ping") {
    connectPort();
    return;
  }
  const activePort = connectPort();
  if (!activePort) {
    postToMain({ type: "bridge-disconnected" });
    return;
  }
  try {
    activePort.postMessage(message);
  } catch (error) {
    postToMain({ type: "bridge-disconnected" });
    handlePortDisconnect(activePort);
  }
});

connectPort();
