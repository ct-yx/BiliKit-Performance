import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/userscript/entry-prefix.js", import.meta.url), "utf8");
const start = source.indexOf("  function installHomeFeedAutoLoad(cfg) {");
const end = source.indexOf("\n  const homeFeedLoad = {", start);
if (start < 0 || end < 0) throw new Error("找不到首页自动加载函数测试接缝");

const timers = [];
const cleanups = [];
const listeners = new Map();
let now = 0;
const root = {
  isConnected: true,
  children: [{
    className: "feed-card",
    offsetWidth: 240,
    getBoundingClientRect: () => ({ top: 0, bottom: 180 })
  }]
};
const scroller = { scrollTop: 0, scrollHeight: 4000 };
const windowMock = {
  innerHeight: 600,
  scrollY: 0,
  __BILIKIT_HOME_AUTO_LOAD__: false,
  addEventListener(type, listener) {
    const list = listeners.get(type) || [];
    list.push(listener);
    listeners.set(type, list);
  },
  removeEventListener() {
  },
  dispatchEvent(event) {
    for (const listener of listeners.get(event.type) || []) listener(event);
  }
};
const documentMock = {
  visibilityState: "visible",
  scrollingElement: scroller,
  documentElement: scroller,
  querySelector: () => root,
  addEventListener() {
  },
  removeEventListener() {
  },
  dispatchEvent() {
  }
};
const runtime = {
  timeout(callback) {
    const handle = { canceled: false, cancel() { this.canceled = true; } };
    timers.push({ callback, handle });
    return handle;
  },
  frame(callback) {
    callback();
    return { cancel() {} };
  },
  listen(target, type, listener) {
    target.addEventListener(type, listener);
    return () => {};
  },
  addCleanup(cleanup) {
    cleanups.push(cleanup);
    return () => {};
  }
};
const context = {
  window: windowMock,
  document: documentMock,
  Date: { now: () => now },
  Event: class {
    constructor(type) {
      this.type = type;
      this.isTrusted = false;
    }
  },
  HOME_FEED_AUTO_LOAD_DELAY: 3000,
  HOME_FEED_AUTO_LOAD_ROWS_DEFAULT: 10,
  HOME_FEED_AUTO_LOAD_ROWS_MIN: 5,
  HOME_FEED_AUTO_LOAD_ROWS_MAX: 15,
  HOME_FEED_AUTO_LOAD_MAX_PROBES: 3,
  HOME_FEED_AUTO_LOAD_USER_INTENT_GRACE: 300,
  HOME_FEED_AUTO_LOAD_TIMEOUT: 8000,
  HOME_FEED_AUTO_LOAD_RETRY_DELAY: 800,
  HOME_FEED_AUTO_LOAD_DOM_SETTLE: 120,
  HOME_FEED_AUTO_LOAD_INTERNAL_SCROLL_GRACE: 500,
  HOME_FEED_CARD_RE: /(?:^|\s)(?:feed-card|floor-single-card|bili-feed-card|bili-video-card)(?:\s|$)/,
  clampHomeFeedNumber: (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback,
  isHomePage: () => true,
  isAppFeedActive: () => false,
  getRuntimeCoordinator: () => runtime,
  getHomeFeedCoordinator: () => ({ subscribe: () => () => {} }),
  getHomeFeedLayoutCoordinator: () => ({
    begin: () => null,
    afterResume: (callback) => callback(),
    end() {},
    getStats: () => ({ deferredCount: 0 })
  }),
  console
};

vm.runInNewContext(`
  const {
    HOME_FEED_AUTO_LOAD_DELAY,
    HOME_FEED_AUTO_LOAD_ROWS_DEFAULT,
    HOME_FEED_AUTO_LOAD_ROWS_MIN,
    HOME_FEED_AUTO_LOAD_ROWS_MAX,
    HOME_FEED_AUTO_LOAD_MAX_PROBES,
    HOME_FEED_AUTO_LOAD_USER_INTENT_GRACE,
    HOME_FEED_AUTO_LOAD_TIMEOUT,
    HOME_FEED_AUTO_LOAD_RETRY_DELAY,
    HOME_FEED_AUTO_LOAD_DOM_SETTLE,
    HOME_FEED_AUTO_LOAD_INTERNAL_SCROLL_GRACE,
    HOME_FEED_CARD_RE
  } = globalThis;
  const { clampHomeFeedNumber, isHomePage, isAppFeedActive, getRuntimeCoordinator, getHomeFeedCoordinator, getHomeFeedLayoutCoordinator } = globalThis;
  ${source.slice(start, end)}
  globalThis.installHomeFeedAutoLoad = installHomeFeedAutoLoad;
`, { ...context, globalThis: context });

context.installHomeFeedAutoLoad({ get: (key) => key === "autoLoad" ? true : 10 });

// 安装时的基线必须生效；无实际位移的首次 scroll 不能开启闲置计时。
windowMock.dispatchEvent({ type: "wheel", isTrusted: true });
windowMock.dispatchEvent({ type: "scroll", isTrusted: true });
if (timers.some((candidate) => !candidate.handle.canceled)) {
  throw new Error("无实际位移的首次 scroll 不应排队闲置任务");
}

function runNextTimer() {
  const item = timers.find((candidate) => !candidate.handle.canceled);
  if (!item) throw new Error("首页自动加载测试没有待执行定时器");
  item.handle.canceled = true;
  item.callback();
}

function completeCurrentBatch() {
  runNextTimer(); // idle timer -> first probe
  runNextTimer(); // first check -> schedule second probe
  runNextTimer(); // second probe
  runNextTimer(); // second check -> schedule third probe
  runNextTimer(); // third probe
  runNextTimer(); // third check -> DOM settle
  runNextTimer(); // complete batch
}

function simulateUserScroll(nextTop) {
  windowMock.dispatchEvent({ type: "wheel", isTrusted: true });
  scroller.scrollTop = nextTop;
  windowMock.dispatchEvent({ type: "scroll", isTrusted: true });
}

function simulateIdleCycle(nextTop) {
  simulateUserScroll(nextTop);
  now += 3000;
  completeCurrentBatch();
}

simulateIdleCycle(100);
const firstCycleStats = windowMock.__BILIKIT_HOME_AUTO_LOAD_STATS__;
if (firstCycleStats?.triggerCount !== 3 || !firstCycleStats.stopped) {
  throw new Error(`首页停留周期应完成三次探测后停止，当前为 ${firstCycleStats?.triggerCount}`);
}
// 没有新的用户输入时，B 站自身的可信 scroll 事件不能重新开启计时器。
scroller.scrollTop = 120;
windowMock.dispatchEvent({ type: "scroll", isTrusted: true });
now += 9000;
if (timers.some((candidate) => !candidate.handle.canceled)) {
  throw new Error("自动加载停止后，普通 scroll 事件不应重新排队闲置任务");
}

// 向上移动不能解锁下一轮；必须继续向下产生实际位移。
simulateUserScroll(80);
if (timers.some((candidate) => !candidate.handle.canceled)) {
  throw new Error("自动加载停止后，向上滚动不应解锁下一轮");
}

// 只有再次真实下滑并产生位移，才允许新的 3 秒闲置周期。
simulateUserScroll(220);
now += 3000;
completeCurrentBatch();
const stats = windowMock.__BILIKIT_HOME_AUTO_LOAD_STATS__;
if (stats?.triggerCount !== 6 || !stats.stopped) {
  throw new Error(`继续真实下滑后应重新允许三次探测，当前为 ${stats?.triggerCount}`);
}
console.log("首页自动加载停留周期与真实滚动解锁测试通过。");
