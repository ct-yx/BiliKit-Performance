import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/extension/bridge.js", import.meta.url), "utf8");
const origin = "https://www.bilibili.com";
const windowListeners = new Map();
const pageMessages = [];
const ports = [];
const windowObject = {
  addEventListener(type, listener) {
    windowListeners.set(type, listener);
  },
  postMessage(message, targetOrigin, transfer = []) {
    pageMessages.push({ message, targetOrigin, transfer });
  }
};
const createPort = () => {
  const port = {
    sent: [],
    messageListener: null,
    disconnectListener: null,
    postMessage(message) { this.sent.push(message); },
    onMessage: { addListener(listener) { port.messageListener = listener; } },
    onDisconnect: { addListener(listener) { port.disconnectListener = listener; } }
  };
  ports.push(port);
  return port;
};
const context = {
  atob,
  setTimeout,
  clearTimeout,
  location: { origin },
  window: windowObject,
  chrome: {
    runtime: {
      connect({ name }) {
        assert.equal(name, "bilikit-performance-edge-bridge-v2");
        return createPort();
      }
    }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context);

assert.equal(ports.length, 1, "隔离桥接应创建一个 Service Worker 端口");
assert.equal(pageMessages[0]?.message.type, "bridge-ready", "端口建立后应通知 MAIN world");
const firstPort = ports[0];
const expectedBytes = Uint8Array.from([0, 17, 34, 128, 255]);
const binary = String.fromCharCode(...expectedBytes);
firstPort.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-chunk",
  requestId: "valid-media",
  sequence: 0,
  data: btoa(binary)
});
const validForward = pageMessages.at(-1);
assert.equal(validForward.message.type, "xhr-chunk");
assert.equal(validForward.targetOrigin, origin);
assert.equal(Object.prototype.toString.call(validForward.message.data), "[object ArrayBuffer]");
assert.deepEqual([...new Uint8Array(validForward.message.data)], [...expectedBytes]);
assert.equal(validForward.transfer[0], validForward.message.data, "媒体块应转移 ArrayBuffer 而非再次结构化复制");

firstPort.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-chunk",
  requestId: "invalid-media",
  sequence: 0,
  data: "%%%"
});
const canceledMessage = firstPort.sent.at(-1);
assert.equal(canceledMessage.channel, "bilikit-performance-edge-bridge-v2");
assert.equal(canceledMessage.type, "xhr-cancel", "Base64 解码失败时应取消后台媒体读取");
assert.equal(canceledMessage.requestId, "invalid-media");
assert.equal(pageMessages.at(-1).message.type, "xhr-error", "损坏的 Base64 应作为请求错误结算");
assert.equal(pageMessages.at(-1).message.requestId, "invalid-media");

firstPort.disconnectListener();
assert.equal(pageMessages.at(-1).message.type, "bridge-disconnected");
const messageCountBeforeStaleReply = pageMessages.length;
firstPort.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-load",
  requestId: "invalid-media",
  loaded: 0
});
assert.equal(pageMessages.length, messageCountBeforeStaleReply, "旧端口迟到消息不应穿透到 MAIN world");

await new Promise((resolve) => setTimeout(resolve, 80));
assert.equal(ports.length, 2, "Service Worker 端口断开后应自动重连");
const messageCountAfterReconnect = pageMessages.length;
firstPort.messageListener({
  channel: "bilikit-performance-edge-bridge-v2",
  type: "xhr-load",
  requestId: "invalid-media",
  loaded: 0
});
assert.equal(pageMessages.length, messageCountAfterReconnect, "重连后旧端口的迟到消息仍必须被忽略");

console.log("扩展隔离桥接测试通过：媒体 ArrayBuffer 转移、损坏块取消、断线重连和旧端口隔离均正常。");
