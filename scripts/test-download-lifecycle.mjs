import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [entryPrefix, entrySuffix, download] = await Promise.all([
  read("src/userscript/entry-prefix.js"),
  read("src/userscript/entry-suffix.js"),
  read("src/userscript/download-workspace.js")
]);

const registerStart = entrySuffix.indexOf("register(");
const registerEnd = entrySuffix.indexOf(");", registerStart);
const registration = entrySuffix.slice(registerStart, registerEnd);
if (registration.indexOf("downloadWorkspace") < 0 || registration.indexOf("noLogin") < 0 ||
  registration.indexOf("downloadWorkspace") > registration.indexOf("noLogin")) {
  throw new Error("下载工作台必须在免登录模块前初始化，才能捕获首份播放响应");
}
if (/if\s*\(isModuleEnabled\(downloadWorkspace\)\)\s+installDownloadCapture\(\)/.test(entrySuffix)) {
  throw new Error("下载捕获器仍在模块生命周期外预装");
}

const runAllStart = entryPrefix.indexOf("  function runAll()");
const runAllEnd = entryPrefix.indexOf("  const qrcode", runAllStart);
const runAll = entryPrefix.slice(runAllStart, runAllEnd);
if (!runAll.includes("state.dispose = moduleDisposeValue(m.init?.(makeCfg(m)))") &&
  !entryPrefix.includes("state.dispose = moduleDisposeValue(m.init?.(makeCfg(m)))")) {
  throw new Error("模块运行器没有保存 init 返回的清理函数");
}
if (!entryPrefix.includes("dispose?.()") || !runAll.includes("SETTINGS_EVENT")) {
  throw new Error("模块运行器没有在关闭或设置变化时执行生命周期清理");
}

const initStart = entryPrefix.indexOf("  function initDownloadWorkspace()");
const initEnd = entryPrefix.indexOf("  const downloadWorkspace", initStart);
const init = entryPrefix.slice(initStart, initEnd);
if (!/return\s*\(\)\s*=>/.test(init) || !/disposeCapture\?\.\(\)/.test(init) || !/disposeEntry\?\.\(\)/.test(init)) {
  throw new Error("下载工作台 init 没有统一返回捕获器和菜单入口的清理函数");
}

const captureStart = download.indexOf("  function installDownloadCapture()");
const captureEnd = download.indexOf("  function downloadCodecLabel", captureStart);
const capture = download.slice(captureStart, captureEnd);
if (!/networkHooks\.addFetch\("download-capture"/.test(capture) ||
  !/networkHooks\.addXHR\("download-capture"/.test(capture) ||
  !/networkHooks\.addHistory\("download-capture"/.test(capture) ||
  !/removeFetchHook\(\)/.test(capture) || !/removeXhrHook\(\)/.test(capture) ||
  !/removePushStateHook\(\)/.test(capture) || !/removeReplaceStateHook\(\)/.test(capture) ||
  !/return destroy;/.test(capture)) {
  throw new Error("下载捕获器没有按 owner 注册并在销毁时移除自己的网络 Hook");
}
if (!/runtime\.addCleanup\(destroy\)/.test(capture) || !/untrackRuntimeCleanup\(\)/.test(capture)) {
  throw new Error("下载捕获器没有接入运行时卸载清理");
}
if (!/const removeContextListener = runtime\.listen\(document, "contextmenu"/.test(download) ||
  !/removeContextListener\?\.\(\)/.test(download)) {
  throw new Error("播放器下载入口没有解除 contextmenu 监听");
}
if (!/target\?\.addEventListener\?\.\(type, listener, options\)/.test(entryPrefix) ||
  !/target\?\.removeEventListener\?\.\(type, listener, options\)/.test(entryPrefix) ||
  !/activeModuleCleanupScope \|\| cleanups/.test(entryPrefix) ||
  !/cleanupList\(state\.cleanups\)/.test(entryPrefix)) {
  throw new Error("模块级事件监听没有随模块关闭清理");
}

const themeStart = entryPrefix.indexOf("  function init$4(cfg)");
const themeEnd = entryPrefix.indexOf("  const themeSync", themeStart);
const themeInit = entryPrefix.slice(themeStart, themeEnd);
if (!themeInit.includes("runtime.listen(") || !themeInit.includes("runtime.createObserver(") ||
  !themeInit.includes("commentObserver?.disconnectAndForget()") || !themeInit.includes("return dispose;") ||
  themeInit.includes("new MutationObserver(")) {
  throw new Error("主题同步的监听器、评论观察器或 RAF 没有纳入可清理生命周期");
}

const commentStart = entryPrefix.indexOf("  function init$3(cfg)");
const commentEnd = entryPrefix.indexOf("  const commentLocation", commentStart);
const commentInit = entryPrefix.slice(commentStart, commentEnd);
if (!commentInit.includes("runtime.createObserver(") || !commentInit.includes("clearInterval(appPoll)") ||
  !commentInit.includes("disconnectAndForget()") || !commentInit.includes("injectedNodes.add(") ||
  !commentInit.includes("for (const node of injectedNodes) node.remove()") ||
  !commentInit.includes("return dispose;")) {
  throw new Error("评论增强模块关闭时没有释放轮询/观察器或移除自身节点");
}

const wakeStart = entryPrefix.indexOf("  function init$2()");
const wakeEnd = entryPrefix.indexOf("  const wakeLock", wakeStart);
const wakeInit = entryPrefix.slice(wakeStart, wakeEnd);
if (!wakeInit.includes('runtime.listen(document, "playing"') ||
  !wakeInit.includes('runtime.listen(document, "visibilitychange"') ||
  !wakeInit.includes("enabled = false;") || !wakeInit.includes("return dispose;")) {
  throw new Error("防睡眠模块没有在关闭时释放监听器和屏幕唤醒锁");
}

const panelStart = entryPrefix.indexOf("  function mountPanel()");
const panelEnd = entryPrefix.indexOf("  const CDN_SUFFIXES", panelStart);
const panel = entryPrefix.slice(panelStart, panelEnd);
if (!panel.includes('runtime.listen(document, "keydown"') || !panel.includes("runtime.createObserver(") ||
  !panel.includes("disconnectAndForget()") || !panel.includes("root2.remove()")) {
  throw new Error("设置面板的全局键盘监听或 FAB 观察器没有随 runtime 卸载");
}

const drawerStart = entrySuffix.indexOf("  function installSiteDrawer()");
const drawerEnd = entrySuffix.indexOf("  const drawerFrame", drawerStart);
const siteDrawer = entrySuffix.slice(drawerStart, drawerEnd);
const escapeStart = entrySuffix.indexOf("  function setupDrawerEscape()");
const revealStart = entrySuffix.indexOf("  function setupDrawerReveal()");
const mediaStart = entrySuffix.indexOf("  function setupDrawerMediaLifecycle()");
const drawerLifecycle = entrySuffix.slice(escapeStart, entrySuffix.indexOf("  setupDrawerLocationSync();", mediaStart));
if (!siteDrawer.includes('runtime.listen(document, "click"') || !siteDrawer.includes("runtime.addCleanup(") ||
  !drawerLifecycle.includes('runtime.listen(window, "keydown"') || !drawerLifecycle.includes("runtime.addCleanup(") ||
  !drawerLifecycle.includes('runtime.listen(window, "message"') || !drawerLifecycle.includes("focusTimers")) {
  throw new Error("站点抽屉入口、键盘监听、revealer 定时器或媒体消息监听没有完整清理");
}

console.log("下载生命周期测试通过：初始化顺序、模块清理、下载 Hook owner 移除和播放器菜单清理均符合预期。");
