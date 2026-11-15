import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/userscript/entry-prefix.js", import.meta.url), "utf8");
const start = source.indexOf("  function installHomeFeedLayoutStability() {");
const end = source.indexOf("\n  function installHomeFeedAdHiding", start);
if (start < 0 || end < 0) throw new Error("找不到首页布局稳定性模块测试接缝");

const card = {
  className: "feed-card",
  offsetWidth: 240,
  isConnected: true,
  getBoundingClientRect: () => ({ top: 100, left: 20, width: 240, height: 180 }),
  setAttribute() { throw new Error("布局稳定性模块不应写入卡片属性"); },
  removeAttribute() { throw new Error("布局稳定性模块不应移除卡片属性"); }
};
const root = {
  isConnected: true,
  children: [card]
};
const observers = [];
const spacingStyle = {
  dataset: {},
  textContent: "",
  isConnected: false,
  remove() { this.isConnected = false; }
};
class FakeResizeObserver {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  unobserve() {}
  disconnect() {}
}
class FakeMutationObserver {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  disconnect() {}
}
const runtime = {
  frame(callback) { callback(); return { cancel() {} }; },
  listen() { return () => {}; },
  addCleanup() { return () => {}; }
};
const windowMock = {};
const documentMock = {
  querySelector: () => root,
  head: { appendChild(node) { node.isConnected = true; } },
  documentElement: { appendChild(node) { node.isConnected = true; } },
  createElement() { return spacingStyle; }
};
const context = {
  window: windowMock,
  document: documentMock,
  ResizeObserver: FakeResizeObserver,
  MutationObserver: FakeMutationObserver,
  getComputedStyle: () => ({ display: "block" }),
  isHomePage: () => true,
  getRuntimeCoordinator: () => runtime,
  getHomeFeedCoordinator: () => ({ subscribe(callback) {
    callback({ root, rootChanged: true, addedNodes: [card], reason: "subscribe" });
    return () => {};
  } }),
  getHomeFeedLayoutCoordinator: () => ({
    getStats: () => ({ deferredCount: 0 }),
    onResume: () => () => {}
  }),
  console
};

vm.runInNewContext(`
  ${source.slice(start, end)}
  globalThis.installHomeFeedLayoutStability = installHomeFeedLayoutStability;
`, { ...context, globalThis: context });

context.installHomeFeedLayoutStability();
for (const observer of observers) observer.callback?.([{ target: card }]);

if (windowMock.__BILIKIT_LAYOUT_WRITES__) throw new Error("布局稳定性模块产生了布局写入");
const stats = windowMock.__BILIKIT_HOME_LAYOUT_STATS__;
if (!stats || stats.mode !== "native-passive" || stats.writes !== 0) {
  throw new Error("首页布局稳定性模块没有保持 native-passive 模式");
}
if (stats.stableFrames < 2) throw new Error("首页布局稳定性模块没有等待布局稳定帧");
if (!spacingStyle.textContent.includes("margin-top:0!important") || !spacingStyle.textContent.includes(".container.is-version8 > .bili-feed-card") || !spacingStyle.isConnected) {
  throw new Error("首页布局稳定性模块没有安装原生网格间距保护规则");
}

console.log("首页布局稳定性测试通过：混合楼层与尺寸观察不会写入卡片布局属性，并等待稳定帧后仅更新诊断。");
