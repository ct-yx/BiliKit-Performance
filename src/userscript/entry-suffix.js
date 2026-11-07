  const QUICK_DOWNLOAD_STYLE_ID = "bilikit-quick-download-style";
  const QUICK_DOWNLOAD_ENTRY_ID = "bilikit-quick-download-entry";
  const QUICK_DOWNLOAD_FLOAT_ID = "bilikit-quick-download-float";
  const QUICK_DOWNLOAD_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
  function quickDownloadBvid(value) {
    const raw = String(value || "").trim().replace(/^https?:\/\/[^/]+\/video\//i, "").split(/[/?#]/, 1)[0];
    if (!raw) return "";
    const withPrefix = /^BV/i.test(raw) ? `BV${raw.slice(2)}` : `BV${raw}`;
    return /^BV[0-9A-Za-z]+$/.test(withPrefix) ? withPrefix : "";
  }
  function quickDownloadEnsureStyle() {
    if (document.getElementById(QUICK_DOWNLOAD_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = QUICK_DOWNLOAD_STYLE_ID;
    style.textContent = `
.bk-quick-download-entry{display:flex!important;align-items:center;justify-content:center}
.bk-quick-download-entry .bk-quick-download-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:54px;height:44px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:inherit;line-height:1;white-space:nowrap}
.bk-quick-download-entry .bk-quick-download-button:hover{background:rgba(255,255,255,.12);color:var(--brand_blue,#00aeec)}
.bk-quick-download-button svg{width:20px;height:20px;display:block}
.bk-quick-download-button span{font-size:12px;line-height:1.1}
.bk-quick-download-float{position:fixed;right:24px;bottom:82px;z-index:99990;display:flex;align-items:center;justify-content:center}
.bk-quick-download-float[hidden],.bk-quick-download-entry[hidden]{display:none!important}
.bk-quick-download-float .bk-quick-download-button{display:flex;align-items:center;gap:6px;min-height:38px;padding:0 13px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(22,23,28,.92);box-shadow:0 3px 14px rgba(0,0,0,.3);color:#fff;cursor:pointer;font:13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.bk-quick-download-float .bk-quick-download-button:hover{transform:translateY(-2px);color:#00aeec}
.bk-quick-download-float .bk-quick-download-button:active{transform:scale(.95)}
.bk-quick-download-overlay{position:fixed;inset:0;z-index:2147483502;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.48);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility 0s linear .18s;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.bk-quick-download-overlay.open{opacity:1;visibility:visible;transition:opacity .18s ease}
.bk-quick-download-card{width:min(360px,calc(100vw - 32px));padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#1c1d22;color:#e3e5e7;box-shadow:0 16px 56px rgba(0,0,0,.45);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;transform:translateY(8px) scale(.98);transition:transform .18s ease}
.bk-quick-download-overlay.open .bk-quick-download-card{transform:none}
.bk-quick-download-head{display:flex;align-items:center;gap:10px}
.bk-quick-download-head h2{margin:0;font-size:17px;font-weight:600}
.bk-quick-download-close{margin-left:auto;width:30px;height:30px;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-size:18px;line-height:1;cursor:pointer}
.bk-quick-download-close:hover{border-color:#fb7299;color:#fb7299}
.bk-quick-download-help{margin:12px 0 16px;color:rgba(255,255,255,.56);font-size:13px}
.bk-quick-download-label{display:block;color:rgba(255,255,255,.78);font-size:13px}
.bk-quick-download-input{display:block;width:100%;height:40px;margin-top:7px;padding:0 11px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(255,255,255,.06);color:#e3e5e7;outline:none;font:inherit}
.bk-quick-download-input:focus{border-color:#fb7299}
.bk-quick-download-error{min-height:20px;margin:5px 0 0;color:#fb7299;font-size:12px}
.bk-quick-download-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:10px}
.bk-quick-download-actions button{min-height:36px;padding:0 14px;border-radius:9px;font:inherit;cursor:pointer}
.bk-quick-download-cancel{border:1px solid rgba(255,255,255,.18);background:transparent;color:#e3e5e7}
.bk-quick-download-confirm{border:0;background:#fb7299;color:#fff;font-weight:600}
.bk-quick-download-confirm:hover{filter:brightness(1.08)}
@media(prefers-reduced-motion:reduce){.bk-quick-download-overlay,.bk-quick-download-card,.bk-quick-download-float .bk-quick-download-button{transition:none!important}}
@media(prefers-color-scheme:light){.bk-quick-download-float .bk-quick-download-button{border-color:rgba(0,0,0,.12);background:rgba(255,255,255,.94);box-shadow:0 3px 14px rgba(0,0,0,.16);color:#18191c}.bk-quick-download-card{border-color:rgba(0,0,0,.1);background:#fff;color:#18191c;box-shadow:0 16px 56px rgba(0,0,0,.22)}.bk-quick-download-help{color:rgba(0,0,0,.54)}.bk-quick-download-label{color:rgba(0,0,0,.72)}.bk-quick-download-input{border-color:rgba(0,0,0,.14);background:rgba(0,0,0,.04);color:#18191c}.bk-quick-download-close{border-color:rgba(0,0,0,.12);background:rgba(0,0,0,.04);color:rgba(0,0,0,.56)}.bk-quick-download-cancel{border-color:rgba(0,0,0,.18);color:#18191c}}
`;
    (document.head || document.documentElement).appendChild(style);
  }
  function quickDownloadButton(label, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bk-quick-download-button${className ? ` ${className}` : ""}`;
    button.innerHTML = `${QUICK_DOWNLOAD_ICON}<span>${label}</span>`;
    button.setAttribute("aria-label", "打开 BiliKit 下载工作台");
    button.title = "输入 BV 号打开下载工作台";
    return button;
  }
  function installQuickDownloadEntry() {
    if (window.top !== window.self || window.__BILIKIT_QUICK_DOWNLOAD__) return;
    window.__BILIKIT_QUICK_DOWNLOAD__ = true;
    const runtime = getRuntimeCoordinator();
    let topEntry = null;
    let floatEntry = null;
    let overlay = null;
    let input = null;
    let error = null;
    let positionFrame = 0;
    const removeHomeEntries = () => {
      overlay?.remove();
      topEntry?.remove();
      floatEntry?.remove();
      document.getElementById(QUICK_DOWNLOAD_STYLE_ID)?.remove();
      overlay = null;
      topEntry = null;
      floatEntry = null;
      input = null;
      error = null;
    };
    const close = () => {
      if (!overlay) return;
      overlay.classList.remove("open");
      input?.blur();
    };
    const submit = () => {
      const bvid = quickDownloadBvid(input?.value);
      if (!bvid) {
        if (error) error.textContent = "请输入完整 BV 号，或输入 BV 后面的字母数字正文";
        input?.focus();
        return;
      }
      const open = window.__BILIKIT_OPEN_DOWNLOAD_WORKSPACE__;
      if (typeof open !== "function") {
        if (error) error.textContent = "下载工作台尚未准备好，请稍后重试";
        return;
      }
      close();
      open({
        videoId: bvid,
        bvid,
        title: "Bilibili 视频",
        filenameTitle: "Bilibili 视频",
        page: 1,
        duration: 0,
        downloadScope: "episodes",
        routeKey: `quick-bvid:${bvid}`,
        videos: [],
        audios: []
      });
    };
    const openDialog = () => {
      if (!isHomePage()) return;
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "bk-quick-download-overlay";
        const card = document.createElement("div");
        card.className = "bk-quick-download-card";
        const head = document.createElement("div");
        head.className = "bk-quick-download-head";
        const title = document.createElement("h2");
        title.textContent = "快速打开下载工作台";
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "bk-quick-download-close";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "关闭");
        closeButton.addEventListener("click", close);
        head.append(title, closeButton);
        const help = document.createElement("p");
        help.className = "bk-quick-download-help";
        help.textContent = "输入完整 BV 号，或只输入 BV 后面的字母数字正文。";
        const label = document.createElement("label");
        label.className = "bk-quick-download-label";
        label.textContent = "BV 号";
        input = document.createElement("input");
        input.className = "bk-quick-download-input";
        input.type = "text";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.placeholder = "例如 BV1xx411c7mD 或 1xx411c7mD";
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        });
        label.appendChild(input);
        error = document.createElement("p");
        error.className = "bk-quick-download-error";
        const actions = document.createElement("div");
        actions.className = "bk-quick-download-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "bk-quick-download-cancel";
        cancel.textContent = "取消";
        cancel.addEventListener("click", close);
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "bk-quick-download-confirm";
        confirm.textContent = "确认";
        confirm.addEventListener("click", submit);
        actions.append(cancel, confirm);
        card.append(head, help, label, error, actions);
        overlay.appendChild(card);
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) close();
        });
        document.body.appendChild(overlay);
      }
      if (error) error.textContent = "";
      if (input) input.value = "";
      overlay.classList.add("open");
      input?.focus();
    };
    const addTopEntry = () => {
      const main = document.querySelector(".right-entry__main");
      if (!main) return null;
      if (!topEntry?.isConnected) {
        topEntry = document.createElement("div");
        topEntry.id = QUICK_DOWNLOAD_ENTRY_ID;
        topEntry.className = "right-entry__item bk-quick-download-entry";
        const button = quickDownloadButton("下载");
        button.addEventListener("click", openDialog);
        topEntry.appendChild(button);
      }
      const upload = main.querySelector(".right-upload-entry");
      if (topEntry.parentElement !== main) main.insertBefore(topEntry, upload || null);
      return main;
    };
    const addFloatEntry = () => {
      if (!floatEntry?.isConnected) {
        floatEntry = document.createElement("div");
        floatEntry.id = QUICK_DOWNLOAD_FLOAT_ID;
        floatEntry.className = "bk-quick-download-float";
        const button = quickDownloadButton("下载");
        button.addEventListener("click", openDialog);
        floatEntry.appendChild(button);
        document.body.appendChild(floatEntry);
      }
      return floatEntry;
    };
    const position = () => {
      positionFrame = 0;
      if (!isHomePage()) {
        removeHomeEntries();
        return;
      }
      if (!document.body) return;
      quickDownloadEnsureStyle();
      const main = addTopEntry();
      const fallback = addFloatEntry();
      if (!main) {
        if (topEntry) topEntry.hidden = true;
        fallback.hidden = false;
        return;
      }
      // 先临时隐藏入口测量原有内容宽度，再把入口自身宽度加回去；这样
      // 溢出时不会因为隐藏入口后空间变宽而在“顶栏/悬浮”之间来回抖动。
      const entryWidth = topEntry.getBoundingClientRect().width || 54;
      topEntry.hidden = true;
      const baseWidth = main.scrollWidth;
      const fits = window.innerWidth >= 1100 && baseWidth + entryWidth <= main.clientWidth + 2;
      topEntry.hidden = !fits;
      fallback.hidden = fits;
    };
    const schedulePosition = () => {
      if (positionFrame) return;
      positionFrame = requestAnimationFrame(position);
    };
    const historyHooks = runtime.networkHooks();
    const removePush = historyHooks.addHistory("quick-download-home", "pushState", (next) => function(...args) {
      const result = next.apply(this, args);
      schedulePosition();
      return result;
    });
    const removeReplace = historyHooks.addHistory("quick-download-home", "replaceState", (next) => function(...args) {
      const result = next.apply(this, args);
      schedulePosition();
      return result;
    });
    const observer = runtime.createObserver(() => schedulePosition());
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
    runtime.listen(window, "resize", schedulePosition, { passive: true });
    runtime.listen(window, "popstate", schedulePosition);
    runtime.listen(window, "hashchange", schedulePosition);
    runtime.listen(document, "DOMContentLoaded", schedulePosition, { once: true });
    schedulePosition();
    runtime.addCleanup(() => {
      if (positionFrame) cancelAnimationFrame(positionFrame);
      removePush();
      removeReplace();
      observer?.disconnect();
      removeHomeEntries();
      delete window.__BILIKIT_QUICK_DOWNLOAD__;
    });
  }
  const UPDATE_REDIRECT_STATE_KEY = "bilikit:performance:update-redirect-v1";
  const UPDATE_CHANGELOG_URL = "https://ct-yx.github.io/BiliKit-Performance/changelog.html";
  const UPDATE_REDIRECT_ENABLED_KEY = "module.update-redirect.enabled";
  const UPDATE_REDIRECT_AUTO_OPEN_KEY = "module.update-redirect.cfg.autoOpen";
  function readUpdateRedirectState() {
    try {
      const raw = JSON.parse(localStorage.getItem(UPDATE_REDIRECT_STATE_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      return { version: String(raw.version || ""), pending: raw.pending === true };
    } catch {
      return null;
    }
  }
  function writeUpdateRedirectState(state) {
    try {
      localStorage.setItem(UPDATE_REDIRECT_STATE_KEY, JSON.stringify({
        version: String(state.version || ""),
        pending: state.pending === true
      }));
    } catch {
    }
  }
  function openUpdateChangelog(url) {
    try {
      if (typeof GM !== "undefined" && typeof GM.openInTab === "function") {
        const opened = GM.openInTab(url, { active: true, insert: true, setParent: true });
        if (opened && typeof opened.catch === "function") {
          void opened.catch(() => {
            try {
              if (typeof GM_openInTab === "function") {
                GM_openInTab(url, { active: true, insert: true, setParent: true });
                return;
              }
            } catch {
            }
            try {
              window.open(url, "_blank", "noopener,noreferrer");
            } catch {
            }
          });
        }
        return true;
      }
    } catch {
    }
    try {
      if (typeof GM_openInTab === "function") {
        GM_openInTab(url, { active: true, insert: true, setParent: true });
        return true;
      }
    } catch {
    }
    try {
      return Boolean(window.open(url, "_blank", "noopener,noreferrer"));
    } catch {
      return false;
    }
  }
  function installedScriptVersion() {
    let infoVersion = "";
    try {
      if (typeof GM_info !== "undefined") infoVersion = GM_info?.script?.version || "";
    } catch {
    }
    return String(infoVersion || VERSION || "").trim();
  }
  function installUpdateRedirect() {
    const currentVersion = installedScriptVersion();
    if (!currentVersion) return;
    let state = readUpdateRedirectState();
    if (!state?.version) {
      writeUpdateRedirectState({ version: currentVersion, pending: false });
      return;
    }
    if (state.version !== currentVersion) {
      state = { version: currentVersion, pending: true };
      writeUpdateRedirectState(state);
    }
    const check = () => {
      if (!isHomePage()) return;
      if (get(UPDATE_REDIRECT_ENABLED_KEY, true) === false || get(UPDATE_REDIRECT_AUTO_OPEN_KEY, true) === false) return;
      const latest = readUpdateRedirectState();
      if (!latest?.pending || latest.version !== currentVersion) return;
      // 先清除待跳转标记，避免刷新或多标签页重复打开。
      writeUpdateRedirectState({ version: currentVersion, pending: false });
      const target = new URL(UPDATE_CHANGELOG_URL);
      target.searchParams.set("from", "bilikit-update");
      target.searchParams.set("version", currentVersion);
      // 保留当前 Bilibili 页面，把更新日志放到新标签页。
      openUpdateChangelog(target.href);
    };
    check();
    const runtime = getRuntimeCoordinator();
    const historyHooks = runtime.networkHooks();
    const removePush = historyHooks.addHistory("update-redirect", "pushState", (next) => function(...args) {
      const result = next.apply(this, args);
      queueMicrotask(check);
      return result;
    });
    const removeReplace = historyHooks.addHistory("update-redirect", "replaceState", (next) => function(...args) {
      const result = next.apply(this, args);
      queueMicrotask(check);
      return result;
    });
    const removePopstate = runtime.listen(window, "popstate", check);
    const removeHashchange = runtime.listen(window, "hashchange", check);
    const removeSettings = runtime.listen(window, SETTINGS_EVENT, check);
    runtime.addCleanup(() => {
      removePush();
      removeReplace();
      removePopstate();
      removeHashchange();
      removeSettings();
    });
  }

  function installSiteDrawer() {
    if (window.__BILIKIT_SITE_DRAWER__) return;
    if (window.top !== window.self) return;
    window.__BILIKIT_SITE_DRAWER__ = true;
    const runtime = getRuntimeCoordinator();
    const homePage = isHomePage();
    const searchPage = isSearchPage();
    const playPage = isPlayPage();
    if (searchPage) installSearchPreconnect();
    let mode = get("feed.openMode", DEFAULT_OPEN_MODE);
    const syncMode = () => {
      mode = get("feed.openMode", DEFAULT_OPEN_MODE);
    };
    runtime.listen(window, SETTINGS_EVENT, syncMode);
    runtime.listen(window, "storage", (e) => {
      if (!e.key || e.key === KEY) syncMode();
    });
    runtime.listen(document, "click", (e) => {
      if (isPlayPage()) return;
      if (mode === "current") return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const hit = resolve(e.target);
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (mode === "newtab") {
        openBiliKitVideoTab(
          hit.url,
          get(NEW_TAB_HISTORY_FLATTEN_KEY, DEFAULT_NEW_TAB_HISTORY_FLATTEN)
        );
        return;
      }
      const web = mode === "drawer-web";
      openDrawer(hit.url, hit.cover, web, web && get("feed.drawerImmersive", true));
    }, true);
    let lastHoverCard = null;
    const onHover = (e) => {
      if (isPlayPage()) return;
      if (mode !== "drawer" && mode !== "drawer-web") return;
      const currentCard = e.target.closest("a[href], [data-bvid]");
      const previousCard = e.relatedTarget instanceof Element ? e.relatedTarget.closest("a[href], [data-bvid]") : null;
      if (!currentCard) {
        lastHoverCard = null;
        return;
      }
      if (previousCard === currentCard || lastHoverCard === currentCard) return;
      lastHoverCard = currentCard;
      if (!resolve(e.target)) return;
      preconnect();
    };
    // 搜索页已在加载早期预连接，不再为原生悬停预览和结果列表安装全局 mouseover 监听。
    // 首页已在 document-start 预连接首屏域名，不再为每次悬停执行一次命中查询。
    // 不改变 B 站原生预览，只移除 BiliKit 自身重复的预连接监听。
    if (!homePage && !searchPage && !playPage) runtime.listen(document, "mouseover", onHover, true);
    runtime.addCleanup(() => {
      if (window.__BILIKIT_SITE_DRAWER__) delete window.__BILIKIT_SITE_DRAWER__;
    });
  }
  const drawerFrame = window.top !== window.self ? readDrawerFrameName(window.name) : null;
  if (drawerFrame && !drawerMark(location.hash)) {
    try {
      const url = new URL(location.href);
      url.hash = drawerFrame.webFull ? DRAWER_WEB_MARK : DRAWER_MARK;
      History.prototype.replaceState.call(history, history.state, "", url.href);
    } catch {
    }
  }
  const inDrawer = window.top !== window.self && (!!drawerFrame || !!drawerMark(location.hash));
  const drawerToken = (drawerFrame == null ? void 0 : drawerFrame.token) || "";
  const drawerWebFull = (drawerFrame == null ? void 0 : drawerFrame.webFull) ?? location.hash === DRAWER_WEB_MARK;
  function setupMarkedNewTabHistoryFlatten() {
    if (!consumeHistoryFlattenTarget()) return;
    const runtime = getRuntimeCoordinator();
    const removeHook = runtime.networkHooks().addHistory("newtab-history-flatten", "pushState", (next) => function(...args) {
      const target = args[2];
      if (target != null && shouldFlattenVideoNavigation(location.href, String(target))) {
        nativeReplaceState.apply(history, args);
        return;
      }
      return next.apply(this, args);
    });
    runtime.addCleanup(removeHook);
  }
  setupMarkedNewTabHistoryFlatten();
  function postDrawer(type, extra = {}) {
    if (!drawerToken) return;
    try {
      window.parent.postMessage({ type, token: drawerToken, ...extra }, "*");
    } catch {
    }
  }
  let suspendDrawerMedia = (_preserveResume = true) => {
  };
  syncSharedSettings();
  installUpdateRedirect();
  try {
    localStorage.setItem("bilikit:alive.core", String(Date.now()));
  } catch {
  }
  function hideDrawerChrome() {
    if (!inDrawer) return;
    const ads = [".ad-report", ".video-page-special-card-small", ".video-page-game-card-small", ".slide-ad-exp", ".activity-m-v1", ".pop-live-small-mode", ".right-bottom-banner", ".eva-banner", ".gg-floor-module", ".video-card-ad-small"];
    const s = document.createElement("style");
    s.textContent = `#biliMainHeader,.bili-header,.fixed-header,.international-header{display:none!important}` + ads.join(",") + `{display:none!important}`;
    (document.head || document.documentElement).appendChild(s);
    getRuntimeCoordinator().addCleanup(() => s.remove());
  }
  hideDrawerChrome();
  function setupDrawerEscape() {
    if (!inDrawer) return;
    const runtime = getRuntimeCoordinator();
    runtime.listen(window, "keydown", (e) => {
      if (e.key !== "Escape" && e.code !== "Escape" || e.isComposing) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      const editing = e.composedPath().some((n) => n instanceof HTMLElement && (n.isContentEditable || n.matches("input,textarea,select")));
      if (editing) return;
      e.preventDefault();
      e.stopPropagation();
      postDrawer("bk-drawer-close");
    }, true);
  }
  setupDrawerEscape();
  function setupDrawerLocationSync() {
    if (!inDrawer) return;
    let lastUrl = "";
    let leavingDocument = false;
    let leavingPublicUrl = "";
    let leavingToken = "";
    let observedDocumentUrl = location.href;
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    const mark = drawerWebFull ? DRAWER_WEB_MARK : DRAWER_MARK;
    const notify = () => {
      const url = new URL(location.href);
      if (drawerMark(url.hash)) url.hash = "";
      const href = url.href;
      if (href === lastUrl) return;
      lastUrl = href;
      postDrawer("bk-drawer-location", { url: href });
    };
    const originalReplace = history.replaceState.bind(history);
    const markedUrl = (raw) => {
      if (raw == null) return raw;
      try {
        const url = new URL(String(raw), location.href);
        if (url.origin === location.origin) url.hash = mark;
        return url.href;
      } catch {
        return raw;
      }
    };
    const newDocumentToken = () => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
    };
    const replaceDocument = (raw, preserveWayBack, token = newDocumentToken(), webFull = drawerWebFull) => {
      if (leavingDocument) {
        if (!preserveWayBack && leavingPublicUrl && leavingToken) {
          postDrawer("bk-drawer-navigating", { url: leavingPublicUrl, nextToken: leavingToken });
        }
        return;
      }
      let expectedOrigin = location.origin;
      if (!preserveWayBack) {
        try {
          expectedOrigin = new URL(String(raw), location.href).origin;
        } catch {
        }
      }
      const publicUrl = safeDrawerVideoUrl(String(raw), expectedOrigin);
      if (!publicUrl || !/^[0-9a-z-]{8,}$/i.test(token)) {
        if (!preserveWayBack) postDrawer("bk-drawer-replace-failed", { nextToken: token });
        return;
      }
      const target = new URL(publicUrl);
      target.hash = webFull ? DRAWER_WEB_MARK : DRAWER_MARK;
      leavingDocument = true;
      leavingPublicUrl = publicUrl;
      leavingToken = token;
      if (preserveWayBack) {
        try {
          sessionStorage.setItem(DRAWER_DOCUMENT_NAV_KEY, publicUrl);
        } catch {
        }
      }
      suspendDrawerMedia(false);
      window.name = drawerFrameName({ token, webFull });
      try {
        location.replace(target.href);
        if (preserveWayBack) postDrawer("bk-drawer-navigating", { url: publicUrl, nextToken: token });
        if (!preserveWayBack) postDrawer("bk-drawer-replacing", { url: publicUrl, nextToken: token });
      } catch {
        leavingDocument = false;
        leavingPublicUrl = "";
        leavingToken = "";
        if (drawerToken) window.name = drawerFrameName({ token: drawerToken, webFull: drawerWebFull });
        if (preserveWayBack) {
          try {
            sessionStorage.removeItem(DRAWER_DOCUMENT_NAV_KEY);
          } catch {
          }
        } else postDrawer("bk-drawer-replace-failed", { nextToken: token });
      }
    };
    const onDocumentClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.composedPath().find((node) => node instanceof HTMLAnchorElement && !!node.href);
      if (!anchor || anchor.download || anchor.target && anchor.target !== "_self") return;
      const target = markedUrl(anchor.href);
      if (target == null || !shouldReplaceDrawerDocument(location.href, String(target))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      replaceDocument(String(target), true);
    };
    document.addEventListener("click", onDocumentClick, true);
    const removePushHook = networkHooks.addHistory("drawer-location-sync", "pushState", (_next) => (state, unused, url) => {
      const next = markedUrl(url);
      if (next != null && shouldReplaceDrawerDocument(location.href, String(next))) {
        replaceDocument(String(next), true);
        return;
      }
      const result = originalReplace(state, unused, next);
      queueMicrotask(notify);
      return result;
    });
    const removeReplaceHook = networkHooks.addHistory("drawer-location-sync", "replaceState", (_next) => (state, unused, url) => {
      const next = markedUrl(url);
      if (next != null && shouldReplaceDrawerDocument(location.href, String(next), true)) {
        replaceDocument(String(next), true);
        return;
      }
      const result = originalReplace(state, unused, next);
      queueMicrotask(notify);
      return result;
    });
    const removePopstate = runtime.listen(window, "popstate", notify);
    const removeHashchange = runtime.listen(window, "hashchange", notify);
    const locationTimer = setInterval(() => {
      if (!leavingDocument && shouldReplaceDrawerDocument(observedDocumentUrl, location.href, true)) {
        replaceDocument(location.href, true);
        return;
      }
      observedDocumentUrl = location.href;
      notify();
    }, 500);
    const onMessage = (e) => {
      var _a, _b;
      if (e.source !== window.parent || ((_a = e.data) == null ? void 0 : _a.token) !== drawerToken || ((_b = e.data) == null ? void 0 : _b.type) !== "bk-drawer-replace") return;
      if (typeof e.data.url !== "string" || typeof e.data.nextToken !== "string" || typeof e.data.webFull !== "boolean") return;
      replaceDocument(e.data.url, false, e.data.nextToken, e.data.webFull);
    };
    window.addEventListener("message", onMessage);
    notify();
    let untrackCleanup = () => {};
    const dispose = () => {
      removePushHook();
      removeReplaceHook();
      removePopstate();
      removeHashchange();
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("message", onMessage);
      clearInterval(locationTimer);
      untrackCleanup();
    };
    untrackCleanup = runtime.addCleanup(dispose);
  }
  function setupDrawerReveal() {
    if (!inDrawer) return;
    const runtime = getRuntimeCoordinator();
    const wantWeb = drawerWebFull;
    let readyDone = false;
    let webDone = !wantWeb;
    let clicked = false;
    let tries = 0;
    let timer = 0;
    let lateReadyTimer = null;
    let boundVideo = null;
    const focusTimers = [];
    const focusPlayer = () => {
      var _a;
      try {
        const box = document.querySelector(".bpx-player-container");
        if (box) {
          if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
          box.focus({ preventScroll: true });
        } else (_a = document.querySelector("video")) == null ? void 0 : _a.focus({ preventScroll: true });
      } catch {
      }
    };
    const onReady = () => {
      if (readyDone) return;
      readyDone = true;
      if (boundVideo) {
        boundVideo.removeEventListener("loadeddata", onReady);
        boundVideo.removeEventListener("canplay", onReady);
        boundVideo = null;
      }
      if (lateReadyTimer) {
        clearInterval(lateReadyTimer);
        lateReadyTimer = null;
      }
      postDrawer("bk-drawer-ready");
      focusPlayer();
      focusTimers.push(runtime.timeout(focusPlayer, 150), runtime.timeout(focusPlayer, 400));
    };
    timer = setInterval(() => {
      if (!readyDone) {
        const v = document.querySelector("video");
        if (v) {
          if (v.readyState >= 2) onReady();
          else if (boundVideo !== v) {
            if (boundVideo) {
              boundVideo.removeEventListener("loadeddata", onReady);
              boundVideo.removeEventListener("canplay", onReady);
            }
            boundVideo = v;
            v.addEventListener("loadeddata", onReady, { once: true });
            v.addEventListener("canplay", onReady, { once: true });
          }
        }
      }
      if (!webDone) {
        if (document.querySelector('.bpx-player-container[data-screen="web"]')) {
          webDone = true;
          postDrawer("bk-drawer-webfull");
        } else if (!clicked) {
          const btn = document.querySelector(".bpx-player-ctrl-web");
          if (btn) {
            btn.click();
            clicked = true;
          }
        }
      }
      if (readyDone && webDone) {
        clearInterval(timer);
        timer = 0;
      }
      else if (++tries > 60) {
        clearInterval(timer);
        timer = 0;
        postDrawer("bk-drawer-reveal-timeout");
        if (!readyDone) {
          let lateTries = 0;
          lateReadyTimer = setInterval(() => {
            const video = document.querySelector("video");
            if ((video == null ? void 0 : video.readyState) && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onReady();
            if (++lateTries > 120 && lateReadyTimer) {
              clearInterval(lateReadyTimer);
              lateReadyTimer = null;
            }
          }, 500);
        }
      }
    }, 150);
    runtime.addCleanup(() => {
      if (timer) clearInterval(timer);
      if (lateReadyTimer) clearInterval(lateReadyTimer);
      for (const handle of focusTimers) handle.cancel();
      if (boundVideo) {
        boundVideo.removeEventListener("loadeddata", onReady);
        boundVideo.removeEventListener("canplay", onReady);
      }
      boundVideo = null;
    });
  }
  setupDrawerReveal();
  function setupDrawerMediaLifecycle() {
    if (!inDrawer) return;
    const runtime = getRuntimeCoordinator();
    let parked = false;
    let cleaned = false;
    let pauseWatchdog = null;
    const resumeSet = /* @__PURE__ */ new Set();
    const mediaElements = () => {
      const found = [...document.querySelectorAll("video,audio")];
      document.querySelectorAll("iframe").forEach((child) => {
        try {
          if (child.contentDocument) found.push(...child.contentDocument.querySelectorAll("video,audio"));
        } catch {
        }
      });
      return found;
    };
    const pauseNow = (preserveResume) => {
      var _a;
      const media = mediaElements();
      if (preserveResume) {
        media.forEach((item) => {
          if (!item.paused && !item.ended) resumeSet.add(item);
        });
      }
      try {
        const player = window.player;
        (_a = player == null ? void 0 : player.pause) == null ? void 0 : _a.call(player);
      } catch {
      }
      media.forEach((item) => {
        try {
          item.pause();
        } catch {
        }
      });
    };
    const stopPauseWatchdog = () => {
      if (pauseWatchdog) {
        clearInterval(pauseWatchdog);
        pauseWatchdog = null;
      }
    };
    const suspend = (preserveResume = true) => {
      parked = true;
      if (!preserveResume) resumeSet.clear();
      pauseNow(preserveResume);
      stopPauseWatchdog();
      let left = 12;
      pauseWatchdog = setInterval(() => {
        pauseNow(preserveResume);
        if (--left <= 0) stopPauseWatchdog();
      }, 250);
      postDrawer("bk-drawer-suspended");
    };
    const resume = () => {
      stopPauseWatchdog();
      parked = false;
      const pending = [...resumeSet];
      resumeSet.clear();
      for (const media of pending) {
        if (!media.isConnected || media.ended) continue;
        try {
          void media.play().catch(() => {
          });
        } catch {
        }
      }
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      stopPauseWatchdog();
      resumeSet.clear();
      try {
        mediaElements().forEach((media) => {
          media.pause();
          media.removeAttribute("src");
          media.srcObject = null;
          media.load();
        });
      } catch {
      }
    };
    const onPlay = (e) => {
      if (!parked || !(e.target instanceof HTMLMediaElement)) return;
      resumeSet.add(e.target);
      try {
        e.target.pause();
      } catch {
      }
    };
    const onMessage = (e) => {
      var _a;
      if (e.source !== window.parent || ((_a = e.data) == null ? void 0 : _a.token) !== drawerToken) return;
      if (e.data.type === "bk-drawer-suspend") suspend();
      else if (e.data.type === "bk-drawer-resume") resume();
      else if (e.data.type === "bk-drawer-download-retry") void fetchCurrentDownloadPlayinfo(true);
    };
    runtime.listen(document, "play", onPlay, true);
    runtime.listen(window, "pagehide", cleanup);
    runtime.listen(window, "unload", cleanup);
    runtime.listen(window, "message", onMessage);
    suspendDrawerMedia = suspend;
    runtime.addCleanup(() => {
      cleanup();
      suspendDrawerMedia = (_preserveResume = true) => {};
    });
  }
  const updateRedirect = {
    id: "update-redirect",
    name: "更新跳转",
    description: "脚本更新后首次回到 Bilibili 首页时打开 Pages 更新日志",
    category: "系统",
    defaultEnabled: true,
    runAt: "start",
    settings: [
      {
        key: "autoOpen",
        type: "toggle",
        label: "更新后自动打开 Pages 更新日志",
        default: true,
        hint: "关闭后仍会记录当前版本；重新开启时，待处理的版本会在下一次回到首页时跳转"
      }
    ],
    init: () => {
    }
  };
  setupDrawerMediaLifecycle();
  setupDrawerLocationSync();
  suspendDrawerMedia(false);
  register(
    cdnPick,
    homeFeedLoad,
    themeSync,
    commentLocation,
    wakeLock,
    // 下载捕获器必须先于免登录网络钩子初始化：它需要读取首份 SSR/playurl
    // 响应，但仍由下载工作台自己的 init/dispose 生命周期统一管理。
    downloadWorkspace,
    noLogin,
    favoritesFix,
    updateRedirect,
    // 注册在 cdn-pick 之后：其 fetch/XHR 与 __playinfo__ hook 需叠在最外层（改请求；cdn-pick 改响应 host）
    wayBack
    // 视频页回退栈胶囊（顶层 + 抽屉 iframe）
  );
  installHomeFeedRequestPriority();
  installHomePreconnect();
  installHomeImageCdn();
  installHomeFeedLayoutStability();
  runAll();
  installSiteDrawer();
  installQuickDownloadEntry();
  mountPanel();

})();
