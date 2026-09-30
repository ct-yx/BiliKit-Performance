import { createBiliKitNetworkHookManager } from "../src/userscript/core/network-hooks.mjs";

const trace = [];
const host = {
  fetch(...args) {
    trace.push(["native-fetch", this === host, ...args]);
    return "fetch-result";
  },
  XMLHttpRequest: class NativeXHR {
    send(...args) { trace.push(["native-xhr", this instanceof NativeXHR, ...args]); }
  }
};
const history = {
  pushState(...args) { trace.push(["native-push", this === history, ...args]); return "push-result"; },
  replaceState(...args) { trace.push(["native-replace", this === history, ...args]); return "replace-result"; }
};
const originalFetch = host.fetch;
const originalXhr = host.XMLHttpRequest;
const originalPush = history.pushState;
const originalReplace = history.replaceState;
const manager = createBiliKitNetworkHookManager(host, history);

const removeFetchA = manager.addFetch("fetch-a", (next) => function(...args) {
  trace.push(["fetch-a", this === host]);
  return next.apply(this, args);
});
const removeFetchB = manager.addFetch("fetch-b", (next) => function(...args) {
  trace.push(["fetch-b", this === host]);
  return next.apply(this, args);
});
if (host.fetch.call(host, "/playurl", { method: "GET" }) !== "fetch-result") throw new Error("fetch 返回值没有保留");
if (trace.map((entry) => entry[0]).join(",") !== "fetch-b,fetch-a,native-fetch") throw new Error(`fetch Hook 顺序错误：${JSON.stringify(trace)}`);
if (trace.at(-1)[1] !== true || trace.at(-1)[2] !== "/playurl") throw new Error("fetch 的 this/参数没有保留");
trace.length = 0;
removeFetchA();
host.fetch.call(host, "/after-remove");
if (trace.map((entry) => entry[0]).join(",") !== "fetch-b,native-fetch") throw new Error("移除一个 fetch owner 破坏了剩余 Hook");
removeFetchB();
if (host.fetch !== originalFetch) throw new Error("移除所有 fetch owner 后没有恢复原函数");

let removeLatest = null;
for (let index = 0; index < 30; index += 1) {
  removeLatest = manager.addFetch("repeat-owner", (next) => function(...args) {
    trace.push(["repeat-owner"]);
    return next.apply(this, args);
  });
}
trace.length = 0;
host.fetch.call(host, "/repeat");
if (trace.filter((entry) => entry[0] === "repeat-owner").length !== 1) throw new Error("同 owner 重复注册形成了多层 fetch 包装");
removeLatest();

const removeXhr = manager.addXHR("xhr-owner", (BaseXHR) => class extends BaseXHR {
  send(...args) { trace.push(["xhr-owner"]); return super.send(...args); }
});
new host.XMLHttpRequest().send("body");
if (trace.slice(-2).map((entry) => entry[0]).join(",") !== "xhr-owner,native-xhr") throw new Error("XHR 包装链顺序错误");
removeXhr();
if (host.XMLHttpRequest !== originalXhr) throw new Error("移除 XHR owner 后没有恢复构造器");

const removeHistory = manager.addHistory("history-owner", "pushState", (next) => function(...args) {
  trace.push(["history-owner", this === history]);
  return next.apply(this, args);
});
const state = { route: 1 };
if (history.pushState.call(history, state, "", "/video/BV1") !== "push-result") throw new Error("pushState 返回值没有保留");
if (trace.slice(-2).map((entry) => entry[0]).join(",") !== "history-owner,native-push" || trace.at(-2)[1] !== true || trace.at(-1)[2] !== state) {
  throw new Error("history Hook 没有保留 this 或原始参数");
}
removeHistory();
if (history.pushState !== originalPush || history.replaceState !== originalReplace) throw new Error("移除 history owner 后未恢复原函数");

manager.addFetch("dispose-fetch", (next) => (...args) => next(...args));
manager.addXHR("dispose-xhr", (BaseXHR) => class extends BaseXHR {});
manager.addHistory("dispose-history", "replaceState", (next) => (...args) => next(...args));
manager.dispose();
if (host.fetch !== originalFetch || host.XMLHttpRequest !== originalXhr || history.pushState !== originalPush || history.replaceState !== originalReplace) {
  throw new Error("dispose 没有恢复所有原生对象");
}

console.log("网络 Hook 测试通过：owner 可独立移除、顺序和 this/参数保留、重复注册幂等、dispose 恢复原函数。");
