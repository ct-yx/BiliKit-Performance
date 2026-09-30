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
  mountPanel();

})();
