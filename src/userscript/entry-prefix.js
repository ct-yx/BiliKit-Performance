(function () {
  'use strict';

  if (window.__BILIKIT_PERFORMANCE_RUNTIME__?.installed) return;

  /* @bilikit-module:network-hooks */
  const createBiliKitNetworkHookManager = BiliKitNetworkHookModule.createBiliKitNetworkHookManager;

  const KEY = "bilikit:settings";
  const CK = "bilikit_settings";
  const SENSITIVE = /accessKey|token|secret|passwd|password/i;
  const SETTINGS_EVENT = "bilikit:settings-changed";
  const BILIKIT_THEME_EVENT = "bilikit:theme-changed";
  // document-start 会在模块声明完成前安装首页网络钩子，必须先完成初始化。
  let activeModuleCleanupScope = null;
  const EARLY_HOME_PRECONNECT_ORIGINS = [
    "https://s1.hdslb.com",
    "https://api.bilibili.com",
    "https://i0.hdslb.com",
    "https://i1.hdslb.com",
    "https://i2.hdslb.com",
    "https://api.vc.bilibili.com"
  ];
  // 这两个匹配器放在文件前部，保证 document-start 能在首页脚本捕获 fetch 之前安装调度器。
  const HOME_FEED_API_RE = /\/x\/web-interface\/wbi\/index\/top\/feed\/rcmd(?:[/?#]|$)/i;
  const HOME_AUX_API_RE = /(?:\/x\/web-interface\/index\/ogv\/rcmd|\/xlive\/web-interface\/v1\/webMain\/getMoreRecList|\/pugv\/app\/web\/floor\/switch|\/twirp\/comic\.v1\.MainStation\/Feed|\/link_setting\/v1\/link_setting\/get|\/x\/im\/web\/msgfeed\/unread|\/session_svr\/v1\/session_svr\/single_unread|\/x\/web-interface\/wbi\/search\/default|\/x\/web-show\/(?:wbi\/)?res\/locs|\/x\/vip\/ads\/materials|\/x\/kv-frontend\/namespace\/data)/i;
  const MEDIA_PLAYURL_API_RE = /\/(?:x\/player\/(?:wbi\/)?playurl|pgc\/player\/(?:web\/)?(?:v2\/)?playurl|pugv\/player\/web\/playurl)(?:[/?#]|$)/i;
  function isBilibiliDocument() {
    return /(?:^|\.)bilibili\.com$/i.test(location.hostname);
  }
  function isHomeDocument() {
    return (location.hostname === "www.bilibili.com" || location.hostname === "bilibili.com") && (location.pathname === "/" || location.pathname === "/index.html");
  }
  function isSearchDocument() {
    return location.hostname === "search.bilibili.com" && /^\/all(?:\/|$)/i.test(location.pathname);
  }
  function installEarlyHomePreconnect() {
    const home = isHomeDocument();
    const search = isSearchDocument();
    if (!home && !search || window.__BILIKIT_EARLY_PRECONNECT__) return;
    window.__BILIKIT_EARLY_PRECONNECT__ = true;
    const origins = home ? EARLY_HOME_PRECONNECT_ORIGINS : [
      "https://api.bilibili.com",
      "https://i0.hdslb.com",
      "https://i1.hdslb.com",
      "https://i2.hdslb.com"
    ];
    let headObserver = null;
    const attach = () => {
      const root = document.head;
      if (!root) {
        if (!headObserver && document.documentElement && typeof MutationObserver === "function") {
          const onHeadAvailable = () => {
            if (document.head) {
              headObserver.disconnect();
              headObserver = null;
              attach();
            }
          };
          headObserver = new MutationObserver(onHeadAvailable);
          headObserver.observe(document.documentElement, { childList: true });
          const onReadyState = () => attach();
          document.addEventListener("readystatechange", onReadyState, { once: true });
          getRuntimeCoordinator().addGlobalCleanup(() => {
            headObserver?.disconnect();
            headObserver = null;
            document.removeEventListener("readystatechange", onReadyState);
          });
          return;
        }
        const onReadyState = () => attach();
        document.addEventListener("readystatechange", onReadyState, { once: true });
        getRuntimeCoordinator().addGlobalCleanup(() => document.removeEventListener("readystatechange", onReadyState));
        return;
      }
      const existing = new Set([...document.querySelectorAll('link[rel~="preconnect"][href]')].map((link) => link.href.replace(/\/+$/, "")));
      for (const href of origins) {
        if (existing.has(href)) continue;
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        link.crossOrigin = "anonymous";
        root.appendChild(link);
        existing.add(href);
      }
    };
    attach();
  }
  installEarlyHomePreconnect();
  // 请求优先级必须早于 B 站首页 bundle；函数声明会提升，匹配器已在上方初始化。
  if (isBilibiliDocument()) installHomeFeedRequestPriority();
  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") ?? {};
    } catch {
      return {};
    }
  }
  function readCookie() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)bilikit_settings=([^;]*)/);
      if (!m || !m[1]) return null;
      return JSON.parse(decodeURIComponent(m[1]));
    } catch {
      return null;
    }
  }
  function toCookieStore(s) {
    const out = {};
    for (const k in s) if (!SENSITIVE.test(k)) out[k] = s[k];
    return out;
  }
  function writeCookie(s) {
    try {
      const v = encodeURIComponent(JSON.stringify(toCookieStore(s)));
      document.cookie = `${CK}=${v}; path=/; domain=.bilibili.com; max-age=31536000; SameSite=Lax`;
    } catch {
    }
  }
  let cache$1 = null;
  function load() {
    if (cache$1) return cache$1;
    const local = readLocal();
    const c = readCookie();
    cache$1 = c ? { ...local, ...c } : local;
    return cache$1;
  }
  try {
    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === KEY) cache$1 = null;
    });
  } catch {
  }
  /* @bilikit-module:download-progress */
  const createBiliKitDownloadProgressController = BiliKitDownloadProgressModule.createBiliKitDownloadProgressController;
  const DOWNLOAD_PROGRESS = createBiliKitDownloadProgressController({
    getSetting: (key, fallback) => get(`module.download-workspace.cfg.${key}`, fallback),
    getStats: () => DOWNLOAD_CAPTURE_STATS,
    getTasks: () => DOWNLOAD_TASKS,
    getMergeQueue: () => DOWNLOAD_MERGE_QUEUE,
    getMergeRunningJobs: () => DOWNLOAD_MERGE_RUNNING_JOBS,
    getMergeConcurrency: () => DOWNLOAD_CAPTURE_STATS.effectiveMergeConcurrency,
    getMaxMergeConcurrency: () => DOWNLOAD_MAX_MERGE_CONCURRENCY,
    onRenderTasks: () => {
      if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) renderDownloadTasks();
    }
  });
  const {
    downloadWorkspaceSetting,
    downloadClamp,
    downloadNow,
    formatDownloadBytes,
    formatDownloadSpeed,
    formatDownloadEta,
    downloadTaskNeedsRemux,
    downloadTaskIsActive,
    getDownloadTaskSize,
    getDownloadTaskLoaded,
    calculateDownloadTaskOverall,
    normalizeDownloadTaskProgress,
    updateDownloadPartProgress,
    resetDownloadPartProgress,
    setDownloadPartsComplete,
    setDownloadRemuxProgress,
    setDownloadSaveProgress,
    readDownloadRemuxModel,
    persistDownloadRemuxModel,
    recordDownloadRemuxSample,
    estimateDownloadRemuxMs,
    estimateDownloadTaskDownloadMs,
    scheduleDownloadPoolEta,
    estimateDownloadMergePoolEta,
    estimateDownloadMergeEtaMs,
    collectDownloadProgressStats,
    downloadProgressTick,
    ensureDownloadProgressTimer,
    resetDownloadProgressSampling
  } = DOWNLOAD_PROGRESS;
  function renderDownloadOverview() {
    const overview = DOWNLOAD_WORKSPACE_ROOT?.querySelector("[data-bk-download-overview]");
    if (!overview) return;
    const showOverview = downloadWorkspaceSetting("showOverview");
    overview.hidden = !showOverview;
    if (!showOverview) return;
    const showGlobalProgress = downloadWorkspaceSetting("showGlobalProgress");
    const entries = {
      speed: { value: formatDownloadSpeed(DOWNLOAD_CAPTURE_STATS.globalDownloadSpeedBytes), show: downloadWorkspaceSetting("showGlobalSpeed") },
      overall: { value: `${Math.round((DOWNLOAD_CAPTURE_STATS.globalOverallProgress || 0) * 100)}%`, show: showGlobalProgress },
      downloadEta: { value: formatDownloadEta(DOWNLOAD_CAPTURE_STATS.downloadEtaMs), show: downloadWorkspaceSetting("showGlobalEta") },
      totalEta: { value: formatDownloadEta(DOWNLOAD_CAPTURE_STATS.totalEtaMs), show: downloadWorkspaceSetting("showGlobalEta") }
    };
    for (const [key, item] of Object.entries(entries)) {
      const node = overview.querySelector(`[data-bk-overview="${key}"]`);
      if (!node) continue;
      node.hidden = !item.show;
      const value = node.querySelector(".bk-dw-overview-value");
      if (value) value.textContent = item.value;
    }
  }
  window.addEventListener(SETTINGS_EVENT, () => {
    resetDownloadProgressSampling();
    if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) renderDownloadTasks();
  });
  function save(s) {
    cache$1 = s;
    writeCookie(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      try {
        window.dispatchEvent(new Event(SETTINGS_EVENT));
        emitBiliKitThemeChange();
      } catch {
      }
      return true;
    } catch {
      return false;
    }
  }
  function syncSharedSettings() {
    const c = readCookie();
    const local = readLocal();
    if (c) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...local, ...c }));
      } catch {
      }
    } else if (Object.keys(local).length) {
      writeCookie(local);
    }
  }
  function get(key, fallback) {
    const s = load();
    return key in s ? s[key] : fallback;
  }
  function set(key, value) {
    const s = load();
    s[key] = value;
    return save(s);
  }
  const enabledKey = (id) => `module.${id}.enabled`;
  function isModuleEnabled(m) {
    return get(enabledKey(m.id), m.defaultEnabled !== false);
  }
  function setModuleEnabled(id, on) {
    set(enabledKey(id), on);
  }
  const cfgKey = (id, key) => `module.${id}.cfg.${key}`;
  function getField(m, key) {
    var _a;
    const field = (_a = m.settings) == null ? void 0 : _a.find((f) => f.key === key);
    return get(cfgKey(m.id, key), field ? field.default : void 0);
  }
  function setField(id, key, value) {
    return set(cfgKey(id, key), value);
  }
  let lastBiliKitTheme = null;
  function getBiliKitThemeMode() {
    const mode = get("module.theme-sync.cfg.mode", "auto");
    return mode === "dark" || mode === "light" ? mode : "auto";
  }
  function getBiliKitTheme() {
    const mode = getBiliKitThemeMode();
    if (mode !== "auto") return mode;
    try {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  function applyBiliKitTheme(element) {
    if (!element) return getBiliKitTheme();
    const theme = getBiliKitTheme();
    element.classList.toggle("bk-theme-light", theme === "light");
    element.classList.toggle("bk-theme-dark", theme === "dark");
    element.style.colorScheme = theme;
    return theme;
  }
  function emitBiliKitThemeChange(force = false) {
    const theme = getBiliKitTheme();
    if (!force && theme === lastBiliKitTheme) return theme;
    lastBiliKitTheme = theme;
    try {
      window.dispatchEvent(new CustomEvent(BILIKIT_THEME_EVENT, { detail: { theme, mode: getBiliKitThemeMode() } }));
    } catch {
      try {
        window.dispatchEvent(new Event(BILIKIT_THEME_EVENT));
      } catch {
      }
    }
    return theme;
  }
  try {
    const themeMedia = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (themeMedia) {
      const onThemeMediaChange = () => emitBiliKitThemeChange();
      if (typeof themeMedia.addEventListener === "function") themeMedia.addEventListener("change", onThemeMediaChange);
      else if (typeof themeMedia.addListener === "function") themeMedia.addListener(onThemeMediaChange);
    }
  } catch {
  }
  function makeCfg(m) {
    return {
      get: (key) => getField(m, key)
    };
  }
  const registry = [];
  function register(...mods) {
    for (const m of mods) {
      if (registry.some((x) => x.id === m.id)) {
        console.warn(`[BiliKit] 模块 id 重复，已忽略：${m.id}`);
        continue;
      }
      registry.push(m);
    }
  }
  function getModules() {
    return registry;
  }
  const moduleRuntimes = new Map();
  let moduleLifecycleInstalled = false;
  function cleanupList(list) {
    while (list?.length) {
      try { list.pop()(); } catch {
      }
    }
  }
  function trackCleanup(list, cleanup) {
    if (typeof cleanup !== "function") return () => {};
    list.push(cleanup);
    return () => {
      const index = list.indexOf(cleanup);
      if (index >= 0) list.splice(index, 1);
    };
  }
  function moduleDisposeValue(value) {
    if (typeof value === "function") return value;
    if (value && typeof value.dispose === "function") return () => value.dispose();
    return null;
  }
  function stopModule(m) {
    const state = moduleRuntimes.get(m.id);
    if (!state) return;
    state.pendingCancel?.();
    state.pendingCancel = null;
    if (!state.active) return;
    state.active = false;
    const dispose = state.dispose;
    state.dispose = null;
    try {
      dispose?.();
    } catch (error) {
      console.error(`[BiliKit] 模块「${m.id}」清理出错：`, error);
    }
    cleanupList(state.cleanups);
  }
  function startModule(m) {
    const state = moduleRuntimes.get(m.id) || { active: false, pendingCancel: null, dispose: null, cleanups: [] };
    moduleRuntimes.set(m.id, state);
    if (state.active || state.pendingCancel || !isModuleEnabled(m)) return;
    const go = () => {
      state.pendingCancel = null;
      if (!isModuleEnabled(m) || state.active) return;
      state.cleanups = [];
      const previousScope = activeModuleCleanupScope;
      activeModuleCleanupScope = state.cleanups;
      try {
        state.dispose = moduleDisposeValue(m.init?.(makeCfg(m)));
        state.active = true;
      } catch (error) {
        state.dispose = null;
        cleanupList(state.cleanups);
        console.error(`[BiliKit] 模块「${m.id}」初始化出错：`, error);
      } finally {
        activeModuleCleanupScope = previousScope;
      }
    };
    if (m.runAt === "idle" && document.readyState === "loading") {
      const runtime = getRuntimeCoordinator();
      state.pendingCancel = runtime.listen(document, "DOMContentLoaded", go, { once: true });
    } else {
      go();
    }
  }
  function syncModuleLifecycles() {
    for (const m of registry) {
      if (isModuleEnabled(m)) startModule(m);
      else stopModule(m);
    }
  }
  function runAll() {
    if (!moduleLifecycleInstalled) {
      moduleLifecycleInstalled = true;
      const runtime = getRuntimeCoordinator();
      runtime.listen(window, SETTINGS_EVENT, syncModuleLifecycles);
      runtime.addCleanup(() => {
        for (const m of registry) stopModule(m);
        moduleRuntimes.clear();
      });
    }
    syncModuleLifecycles();
  }
  const qrcode = function(typeNumber, errorCorrectionLevel) {
    const PAD0 = 236;
    const PAD1 = 17;
    let _typeNumber = typeNumber;
    const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null;
    let _moduleCount = 0;
    let _dataCache = null;
    const _dataList = [];
    const _this = {};
    const makeImpl = function(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = (function(moduleCount) {
        const modules = new Array(moduleCount);
        for (let row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (let col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      })(_moduleCount);
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }
      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    };
    const setupPositionProbePattern = function(row, col) {
      for (let r = -1; r <= 7; r += 1) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c += 1) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };
    const getBestMaskPattern = function() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i += 1) {
        makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    };
    const setupTimingPattern = function() {
      for (let r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = r % 2 == 0;
      }
      for (let c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = c % 2 == 0;
      }
    };
    const setupPositionAdjustPattern = function() {
      const pos = QRUtil.getPatternPosition(_typeNumber);
      for (let i = 0; i < pos.length; i += 1) {
        for (let j = 0; j < pos.length; j += 1) {
          const row = pos[i];
          const col = pos[j];
          if (_modules[row][col] != null) {
            continue;
          }
          for (let r = -2; r <= 2; r += 1) {
            for (let c = -2; c <= 2; c += 1) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };
    const setupTypeNumber = function(test) {
      const bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };
    const setupTypeInfo = function(test, maskPattern) {
      const data = _errorCorrectionLevel << 3 | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }
      _modules[_moduleCount - 8][8] = !test;
    };
    const mapData = function(data, maskPattern) {
      let inc = -1;
      let row = _moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (let col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col -= 1;
        while (true) {
          for (let c = 0; c < 2; c += 1) {
            if (_modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) == 1;
              }
              const mask2 = maskFunc(row, col - c);
              if (mask2) {
                dark = !dark;
              }
              _modules[row][col - c] = dark;
              bitIndex -= 1;
              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };
    const createBytes = function(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r += 1) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i += 1) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
        }
      }
      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }
      for (let i = 0; i < maxEcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }
      return data;
    };
    const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
      const buffer = qrBitBuffer();
      for (let i = 0; i < dataList.length; i += 1) {
        const data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }
      return createBytes(buffer, rsBlocks);
    };
    _this.addData = function(data, mode) {
      mode = mode || "Byte";
      let newData = null;
      switch (mode) {
        case "Numeric":
          newData = qrNumber(data);
          break;
        case "Alphanumeric":
          newData = qrAlphaNum(data);
          break;
        case "Byte":
          newData = qr8BitByte(data);
          break;
        case "Kanji":
          newData = qrKanji(data);
          break;
        default:
          throw "mode:" + mode;
      }
      _dataList.push(newData);
      _dataCache = null;
    };
    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + "," + col;
      }
      return _modules[row][col];
    };
    _this.getModuleCount = function() {
      return _moduleCount;
    };
    _this.make = function() {
      if (_typeNumber < 1) {
        let typeNumber2 = 1;
        for (; typeNumber2 < 40; typeNumber2++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
          const buffer = qrBitBuffer();
          for (let i = 0; i < _dataList.length; i++) {
            const data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
            data.write(buffer);
          }
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }
        _typeNumber = typeNumber2;
      }
      makeImpl(false, getBestMaskPattern());
    };
    _this.createTableTag = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      let qrHtml = "";
      qrHtml += '<table style="';
      qrHtml += " border-width: 0px; border-style: none;";
      qrHtml += " border-collapse: collapse;";
      qrHtml += " padding: 0px; margin: " + margin + "px;";
      qrHtml += '">';
      qrHtml += "<tbody>";
      for (let r = 0; r < _this.getModuleCount(); r += 1) {
        qrHtml += "<tr>";
        for (let c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += " border-width: 0px; border-style: none;";
          qrHtml += " border-collapse: collapse;";
          qrHtml += " padding: 0px; margin: 0px;";
          qrHtml += " width: " + cellSize + "px;";
          qrHtml += " height: " + cellSize + "px;";
          qrHtml += " background-color: ";
          qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
          qrHtml += ";";
          qrHtml += '"/>';
        }
        qrHtml += "</tr>";
      }
      qrHtml += "</tbody>";
      qrHtml += "</table>";
      return qrHtml;
    };
    _this.createSvgTag = function(cellSize, margin, alt, title) {
      let opts = {};
      if (typeof arguments[0] == "object") {
        opts = arguments[0];
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      alt = typeof alt === "string" ? { text: alt } : alt || {};
      alt.text = alt.text || null;
      alt.id = alt.text ? alt.id || "qrcode-description" : null;
      title = typeof title === "string" ? { text: title } : title || {};
      title.text = title.text || null;
      title.id = title.text ? title.id || "qrcode-title" : null;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let c, mc, r, mr, qrSvg = "", rect;
      rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
      qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
      qrSvg += ">";
      qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
      qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';
      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c)) {
            mc = c * cellSize + margin;
            qrSvg += "M" + mc + "," + mr + rect;
          }
        }
      }
      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += "</svg>";
      return qrSvg;
    };
    _this.createDataURL = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          const c = Math.floor((x - min) / cellSize);
          const r = Math.floor((y - min) / cellSize);
          return _this.isDark(r, c) ? 0 : 1;
        } else {
          return 1;
        }
      });
    };
    _this.createImgTag = function(cellSize, margin, alt) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let img = "";
      img += "<img";
      img += ' src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += ' width="';
      img += size;
      img += '"';
      img += ' height="';
      img += size;
      img += '"';
      if (alt) {
        img += ' alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += "/>";
      return img;
    };
    const escapeXml = function(s) {
      let escaped = "";
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charAt(i);
        switch (c) {
          case "<":
            escaped += "&lt;";
            break;
          case ">":
            escaped += "&gt;";
            break;
          case "&":
            escaped += "&amp;";
            break;
          case '"':
            escaped += "&quot;";
            break;
          default:
            escaped += c;
            break;
        }
      }
      return escaped;
    };
    const _createHalfASCII = function(margin) {
      const cellSize = 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r1, r2, p;
      const blocks = {
        "██": "█",
        "█ ": "▀",
        " █": "▄",
        "  ": " "
      };
      const blocksLastLineNoMargin = {
        "██": "▀",
        "█ ": "▀",
        " █": " ",
        "  ": " "
      };
      let ascii = "";
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = "█";
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = " ";
          }
          if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += " ";
          } else {
            p += "█";
          }
          ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
        }
        ascii += "\n";
      }
      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("▀");
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;
      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }
      cellSize -= 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r, p;
      const white = Array(cellSize + 1).join("██");
      const black = Array(cellSize + 1).join("  ");
      let ascii = "";
      let line = "";
      for (y = 0; y < size; y += 1) {
        r = Math.floor((y - min) / cellSize);
        line = "";
        for (x = 0; x < size; x += 1) {
          p = 1;
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }
          line += p ? white : black;
        }
        for (r = 0; r < cellSize; r += 1) {
          ascii += line + "\n";
        }
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      const length = _this.getModuleCount();
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? "black" : "white";
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    };
    return _this;
  };
  qrcode.stringToBytes = function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      bytes.push(c & 255);
    }
    return bytes;
  };
  qrcode.createStringToBytes = function(unicodeData, numChars) {
    const unicodeMap = (function() {
      const bin = base64DecodeInputStream(unicodeData);
      const read = function() {
        const b = bin.read();
        if (b == -1) throw "eof";
        return b;
      };
      let count = 0;
      const unicodeMap2 = {};
      while (true) {
        const b0 = bin.read();
        if (b0 == -1) break;
        const b1 = read();
        const b2 = read();
        const b3 = read();
        const k = String.fromCharCode(b0 << 8 | b1);
        const v = b2 << 8 | b3;
        unicodeMap2[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + " != " + numChars;
      }
      return unicodeMap2;
    })();
    const unknownChar = "?".charCodeAt(0);
    return function(s) {
      const bytes = [];
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          const b = unicodeMap[s.charAt(i)];
          if (typeof b == "number") {
            if ((b & 255) == b) {
              bytes.push(b);
            } else {
              bytes.push(b >>> 8);
              bytes.push(b & 255);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };
  const QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3
  };
  const QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
  };
  const QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  const QRUtil = (function() {
    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    const _this = {};
    const getBCHDigit = function(data) {
      let digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };
    _this.getBCHTypeInfo = function(data) {
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
      }
      return (data << 10 | d) ^ G15_MASK;
    };
    _this.getBCHTypeNumber = function(data) {
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
      }
      return data << 12 | d;
    };
    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };
    _this.getMaskFunction = function(maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return function(i, j) {
            return (i + j) % 2 == 0;
          };
        case QRMaskPattern.PATTERN001:
          return function(i, j) {
            return i % 2 == 0;
          };
        case QRMaskPattern.PATTERN010:
          return function(i, j) {
            return j % 3 == 0;
          };
        case QRMaskPattern.PATTERN011:
          return function(i, j) {
            return (i + j) % 3 == 0;
          };
        case QRMaskPattern.PATTERN100:
          return function(i, j) {
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN101:
          return function(i, j) {
            return i * j % 2 + i * j % 3 == 0;
          };
        case QRMaskPattern.PATTERN110:
          return function(i, j) {
            return (i * j % 2 + i * j % 3) % 2 == 0;
          };
        case QRMaskPattern.PATTERN111:
          return function(i, j) {
            return (i * j % 3 + (i + j) % 2) % 2 == 0;
          };
        default:
          throw "bad maskPattern:" + maskPattern;
      }
    };
    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    };
    _this.getLengthInBits = function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10;
          case QRMode.MODE_ALPHA_NUM:
            return 9;
          case QRMode.MODE_8BIT_BYTE:
            return 8;
          case QRMode.MODE_KANJI:
            return 8;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12;
          case QRMode.MODE_ALPHA_NUM:
            return 11;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 10;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 14;
          case QRMode.MODE_ALPHA_NUM:
            return 13;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 12;
          default:
            throw "mode:" + mode;
        }
      } else {
        throw "type:" + type;
      }
    };
    _this.getLostPoint = function(qrcode2) {
      const moduleCount = qrcode2.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          let sameCount = 0;
          const dark = qrcode2.isDark(row, col);
          for (let r = -1; r <= 1; r += 1) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }
            for (let c = -1; c <= 1; c += 1) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }
              if (r == 0 && c == 0) {
                continue;
              }
              if (dark == qrcode2.isDark(row + r, col + c)) {
                sameCount += 1;
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }
      for (let row = 0; row < moduleCount - 1; row += 1) {
        for (let col = 0; col < moduleCount - 1; col += 1) {
          let count = 0;
          if (qrcode2.isDark(row, col)) count += 1;
          if (qrcode2.isDark(row + 1, col)) count += 1;
          if (qrcode2.isDark(row, col + 1)) count += 1;
          if (qrcode2.isDark(row + 1, col + 1)) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }
      let darkCount = 0;
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount; row += 1) {
          if (qrcode2.isDark(row, col)) {
            darkCount += 1;
          }
        }
      }
      const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    };
    return _this;
  })();
  const QRMath = (function() {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i]] = i;
    }
    const _this = {};
    _this.glog = function(n) {
      if (n < 1) {
        throw "glog(" + n + ")";
      }
      return LOG_TABLE[n];
    };
    _this.gexp = function(n) {
      while (n < 0) {
        n += 255;
      }
      while (n >= 256) {
        n -= 255;
      }
      return EXP_TABLE[n];
    };
    return _this;
  })();
  const qrPolynomial = function(num, shift) {
    if (typeof num.length == "undefined") {
      throw num.length + "/" + shift;
    }
    const _num = (function() {
      let offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      const _num2 = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i += 1) {
        _num2[i] = num[i + offset];
      }
      return _num2;
    })();
    const _this = {};
    _this.getAt = function(index) {
      return _num[index];
    };
    _this.getLength = function() {
      return _num.length;
    };
    _this.multiply = function(e) {
      const num2 = new Array(_this.getLength() + e.getLength() - 1);
      for (let i = 0; i < _this.getLength(); i += 1) {
        for (let j = 0; j < e.getLength(); j += 1) {
          num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return qrPolynomial(num2, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }
      const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      const num2 = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i += 1) {
        num2[i] = _this.getAt(i);
      }
      for (let i = 0; i < e.getLength(); i += 1) {
        num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      }
      return qrPolynomial(num2, 0).mod(e);
    };
    return _this;
  };
  const QRRSBlock = (function() {
    const RS_BLOCK_TABLE = [
      // L
      // M
      // Q
      // H
      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],
      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],
      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],
      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],
      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],
      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],
      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],
      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],
      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],
      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],
      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],
      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],
      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],
      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],
      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],
      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],
      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],
      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],
      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],
      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],
      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],
      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],
      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],
      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],
      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],
      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],
      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],
      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],
      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],
      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],
      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];
    const qrRSBlock = function(totalCount, dataCount) {
      const _this2 = {};
      _this2.totalCount = totalCount;
      _this2.dataCount = dataCount;
      return _this2;
    };
    const _this = {};
    const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == "undefined") {
        throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
      }
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i += 1) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount));
        }
      }
      return list;
    };
    return _this;
  })();
  const qrBitBuffer = function() {
    const _buffer = [];
    let _length = 0;
    const _this = {};
    _this.getBuffer = function() {
      return _buffer;
    };
    _this.getAt = function(index) {
      const bufIndex = Math.floor(index / 8);
      return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
    };
    _this.put = function(num, length) {
      for (let i = 0; i < length; i += 1) {
        _this.putBit((num >>> length - i - 1 & 1) == 1);
      }
    };
    _this.getLengthInBits = function() {
      return _length;
    };
    _this.putBit = function(bit) {
      const bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }
      if (bit) {
        _buffer[bufIndex] |= 128 >>> _length % 8;
      }
      _length += 1;
    };
    return _this;
  };
  const qrNumber = function(data) {
    const _mode = QRMode.MODE_NUMBER;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const data2 = _data;
      let i = 0;
      while (i + 2 < data2.length) {
        buffer.put(strToNum(data2.substring(i, i + 3)), 10);
        i += 3;
      }
      if (i < data2.length) {
        if (data2.length - i == 1) {
          buffer.put(strToNum(data2.substring(i, i + 1)), 4);
        } else if (data2.length - i == 2) {
          buffer.put(strToNum(data2.substring(i, i + 2)), 7);
        }
      }
    };
    const strToNum = function(s) {
      let num = 0;
      for (let i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i));
      }
      return num;
    };
    const chatToNum = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      }
      throw "illegal char :" + c;
    };
    return _this;
  };
  const qrAlphaNum = function(data) {
    const _mode = QRMode.MODE_ALPHA_NUM;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const s = _data;
      let i = 0;
      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
          11
        );
        i += 2;
      }
      if (i < s.length) {
        buffer.put(getCode(s.charAt(i)), 6);
      }
    };
    const getCode = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      } else if ("A" <= c && c <= "Z") {
        return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
      } else {
        switch (c) {
          case " ":
            return 36;
          case "$":
            return 37;
          case "%":
            return 38;
          case "*":
            return 39;
          case "+":
            return 40;
          case "-":
            return 41;
          case ".":
            return 42;
          case "/":
            return 43;
          case ":":
            return 44;
          default:
            throw "illegal char :" + c;
        }
      }
    };
    return _this;
  };
  const qr8BitByte = function(data) {
    const _mode = QRMode.MODE_8BIT_BYTE;
    const _bytes = qrcode.stringToBytes(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _bytes.length;
    };
    _this.write = function(buffer) {
      for (let i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };
    return _this;
  };
  const qrKanji = function(data) {
    const _mode = QRMode.MODE_KANJI;
    const stringToBytes = qrcode.stringToBytes;
    !(function(c, code) {
      const test = stringToBytes(c);
      if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
        throw "sjis not supported.";
      }
    })("友", 38726);
    const _bytes = stringToBytes(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };
    _this.write = function(buffer) {
      const data2 = _bytes;
      let i = 0;
      while (i + 1 < data2.length) {
        let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
        if (33088 <= c && c <= 40956) {
          c -= 33088;
        } else if (57408 <= c && c <= 60351) {
          c -= 49472;
        } else {
          throw "illegal char at " + (i + 1) + "/" + c;
        }
        c = (c >>> 8 & 255) * 192 + (c & 255);
        buffer.put(c, 13);
        i += 2;
      }
      if (i < data2.length) {
        throw "illegal char at " + (i + 1);
      }
    };
    return _this;
  };
  const byteArrayOutputStream = function() {
    const _bytes = [];
    const _this = {};
    _this.writeByte = function(b) {
      _bytes.push(b & 255);
    };
    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };
    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (let i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };
    _this.writeString = function(s) {
      for (let i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i));
      }
    };
    _this.toByteArray = function() {
      return _bytes;
    };
    _this.toString = function() {
      let s = "";
      s += "[";
      for (let i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ",";
        }
        s += _bytes[i];
      }
      s += "]";
      return s;
    };
    return _this;
  };
  const base64EncodeOutputStream = function() {
    let _buffer = 0;
    let _buflen = 0;
    let _length = 0;
    let _base64 = "";
    const _this = {};
    const writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 63));
    };
    const encode = function(n) {
      if (n < 0) {
        throw "n:" + n;
      } else if (n < 26) {
        return 65 + n;
      } else if (n < 52) {
        return 97 + (n - 26);
      } else if (n < 62) {
        return 48 + (n - 52);
      } else if (n == 62) {
        return 43;
      } else if (n == 63) {
        return 47;
      } else {
        throw "n:" + n;
      }
    };
    _this.writeByte = function(n) {
      _buffer = _buffer << 8 | n & 255;
      _buflen += 8;
      _length += 1;
      while (_buflen >= 6) {
        writeEncoded(_buffer >>> _buflen - 6);
        _buflen -= 6;
      }
    };
    _this.flush = function() {
      if (_buflen > 0) {
        writeEncoded(_buffer << 6 - _buflen);
        _buffer = 0;
        _buflen = 0;
      }
      if (_length % 3 != 0) {
        const padlen = 3 - _length % 3;
        for (let i = 0; i < padlen; i += 1) {
          _base64 += "=";
        }
      }
    };
    _this.toString = function() {
      return _base64;
    };
    return _this;
  };
  const base64DecodeInputStream = function(str) {
    const _str = str;
    let _pos = 0;
    let _buffer = 0;
    let _buflen = 0;
    const _this = {};
    _this.read = function() {
      while (_buflen < 8) {
        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw "unexpected end of file./" + _buflen;
        }
        const c = _str.charAt(_pos);
        _pos += 1;
        if (c == "=") {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/)) {
          continue;
        }
        _buffer = _buffer << 6 | decode(c.charCodeAt(0));
        _buflen += 6;
      }
      const n = _buffer >>> _buflen - 8 & 255;
      _buflen -= 8;
      return n;
    };
    const decode = function(c) {
      if (65 <= c && c <= 90) {
        return c - 65;
      } else if (97 <= c && c <= 122) {
        return c - 97 + 26;
      } else if (48 <= c && c <= 57) {
        return c - 48 + 52;
      } else if (c == 43) {
        return 62;
      } else if (c == 47) {
        return 63;
      } else {
        throw "c:" + c;
      }
    };
    return _this;
  };
  const gifImage = function(width, height) {
    const _width = width;
    const _height = height;
    const _data = new Array(width * height);
    const _this = {};
    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };
    _this.write = function(out) {
      out.writeString("GIF87a");
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(128);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(255);
      out.writeByte(255);
      out.writeByte(255);
      out.writeString(",");
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);
      const lzwMinCodeSize = 2;
      const raster = getLZWRaster(lzwMinCodeSize);
      out.writeByte(lzwMinCodeSize);
      let offset = 0;
      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }
      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0);
      out.writeString(";");
    };
    const bitOutputStream = function(out) {
      const _out = out;
      let _bitLength = 0;
      let _bitBuffer = 0;
      const _this2 = {};
      _this2.write = function(data, length) {
        if (data >>> length != 0) {
          throw "length over";
        }
        while (_bitLength + length >= 8) {
          _out.writeByte(255 & (data << _bitLength | _bitBuffer));
          length -= 8 - _bitLength;
          data >>>= 8 - _bitLength;
          _bitBuffer = 0;
          _bitLength = 0;
        }
        _bitBuffer = data << _bitLength | _bitBuffer;
        _bitLength = _bitLength + length;
      };
      _this2.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };
      return _this2;
    };
    const getLZWRaster = function(lzwMinCodeSize) {
      const clearCode = 1 << lzwMinCodeSize;
      const endCode = (1 << lzwMinCodeSize) + 1;
      let bitLength = lzwMinCodeSize + 1;
      const table = lzwTable();
      for (let i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i));
      }
      table.add(String.fromCharCode(clearCode));
      table.add(String.fromCharCode(endCode));
      const byteOut = byteArrayOutputStream();
      const bitOut = bitOutputStream(byteOut);
      bitOut.write(clearCode, bitLength);
      let dataIndex = 0;
      let s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      while (dataIndex < _data.length) {
        const c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
        if (table.contains(s + c)) {
          s = s + c;
        } else {
          bitOut.write(table.indexOf(s), bitLength);
          if (table.size() < 4095) {
            if (table.size() == 1 << bitLength) {
              bitLength += 1;
            }
            table.add(s + c);
          }
          s = c;
        }
      }
      bitOut.write(table.indexOf(s), bitLength);
      bitOut.write(endCode, bitLength);
      bitOut.flush();
      return byteOut.toByteArray();
    };
    const lzwTable = function() {
      const _map = {};
      let _size = 0;
      const _this2 = {};
      _this2.add = function(key) {
        if (_this2.contains(key)) {
          throw "dup key:" + key;
        }
        _map[key] = _size;
        _size += 1;
      };
      _this2.size = function() {
        return _size;
      };
      _this2.indexOf = function(key) {
        return _map[key];
      };
      _this2.contains = function(key) {
        return typeof _map[key] != "undefined";
      };
      return _this2;
    };
    return _this;
  };
  const createDataURL = function(width, height, getPixel) {
    const gif = gifImage(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y));
      }
    }
    const b = byteArrayOutputStream();
    gif.write(b);
    const base64 = base64EncodeOutputStream();
    const bytes = b.toByteArray();
    for (let i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();
    return "data:image/gif;base64," + base64;
  };
  qrcode.stringToBytes;
  function md5(s) {
    function add32(a, b) {
      return a + b & 4294967295;
    }
    function cmn(q, a, b, x, sh, t) {
      a = add32(add32(a, q), add32(x, t));
      return add32(a << sh | a >>> 32 - sh, b);
    }
    function ff(a, b, c, d, x, s2, t) {
      return cmn(b & c | ~b & d, a, b, x, s2, t);
    }
    function gg(a, b, c, d, x, s2, t) {
      return cmn(b & d | c & ~d, a, b, x, s2, t);
    }
    function hh(a, b, c, d, x, s2, t) {
      return cmn(b ^ c ^ d, a, b, x, s2, t);
    }
    function ii(a, b, c, d, x, s2, t) {
      return cmn(c ^ (b | ~d), a, b, x, s2, t);
    }
    function cycle(x, k) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }
    function blk(str, i2) {
      const m = [];
      for (let j = 0; j < 64; j += 4) m[j >> 2] = str.charCodeAt(i2 + j) + (str.charCodeAt(i2 + j + 1) << 8) + (str.charCodeAt(i2 + j + 2) << 16) + (str.charCodeAt(i2 + j + 3) << 24);
      return m;
    }
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) cycle(state, blk(s, i - 64));
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
    tail[i >> 2] |= 128 << (i % 4 << 3);
    if (i > 55) {
      cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    cycle(state, tail);
    const hc = "0123456789abcdef";
    let out = "";
    for (const w of state) for (let j = 0; j < 4; j++) out += hc[w >> j * 8 + 4 & 15] + hc[w >> j * 8 & 15];
    return out;
  }
  const APPKEY = "4409e2ce8ffd12b8";
  const APPSEC = "59b43e04ad6965f34319062b478f83dd";
  function signAppQuery(params) {
    const p = { appkey: APPKEY, ...params };
    const sorted = Object.keys(p).sort().map((k) => `${k}=${encodeURIComponent(p[k])}`).join("&");
    return `${sorted}&sign=${md5(sorted + APPSEC)}`;
  }
  const PASSPORT = "https://passport.bilibili.com";
  async function postSigned(path, params) {
    const ts = String(Math.floor(Date.now() / 1e3));
    const body = signAppQuery({ ...params, local_id: "0", ts });
    const res = await fetch(PASSPORT + path, {
      method: "POST",
      credentials: "include",
      // 带 web 登录 cookie → SEC 视为可信会话
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("响应非 JSON（可能被风控拦截）");
    }
  }
  let root = null;
  let qrImg = null;
  let statusEl = null;
  let running = false;
  let pollTimer = null;
  function resetOverlayDom() {
    if (root) root.remove();
    root = qrImg = statusEl = null;
  }
  function closeOverlay() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    running = false;
    resetOverlayDom();
  }
  function openOverlay() {
    resetOverlayDom();
    root = document.createElement("div");
    const sr = root.attachShadow({ mode: "open" });
    sr.innerHTML = `<style>
    :host{ all:initial }
    .ov{ position:fixed; inset:0; z-index:2147483600; background:rgba(0,0,0,.55);
      display:flex; align-items:center; justify-content:center;
      font-family:-apple-system,"PingFang SC",sans-serif; -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
    .card{ width:300px; background:#1c1d22; color:#e3e5e7; border-radius:16px; padding:22px; text-align:center;
      box-shadow:0 16px 56px rgba(0,0,0,.5); }
    .title{ font-size:15px; font-weight:600; margin-bottom:4px } .title b{ color:#fb7299 }
    .hint{ font-size:12px; color:rgba(255,255,255,.45); margin-bottom:16px }
    .qr{ width:200px; height:200px; background:#fff; border-radius:10px; margin:0 auto; display:flex; align-items:center; justify-content:center; overflow:hidden }
    .qr img{ width:184px; height:184px; display:block }
    .status{ font-size:13px; color:rgba(255,255,255,.75); margin-top:16px; min-height:18px }
    .close{ margin-top:14px; cursor:pointer; color:rgba(255,255,255,.5); font-size:12px }
    .close:hover{ color:#fff }
    @media (prefers-color-scheme: light){
      .card{ background:#fff; color:#18191c; box-shadow:0 16px 56px rgba(0,0,0,.22) }
      .title b{ color:#d6336c } .hint{ color:rgba(0,0,0,.45) } .status{ color:rgba(0,0,0,.7) }
      .close{ color:rgba(0,0,0,.45) } .close:hover{ color:#000 }
    }
  </style>
  <div class="ov"><div class="card">
    <div class="title"><b>BiliKit</b> · 登录 App 推荐</div>
    <div class="hint">用手机哔哩哔哩 App 扫码</div>
    <div class="qr"><img alt=""></div>
    <div class="status">正在获取二维码…</div>
    <div class="close">取消</div>
  </div></div>`;
    qrImg = sr.querySelector("img");
    statusEl = sr.querySelector(".status");
    sr.querySelector(".close").addEventListener("click", closeOverlay);
    sr.querySelector(".ov").addEventListener("click", (e) => {
      if (e.target.classList.contains("ov")) closeOverlay();
    });
    document.body.appendChild(root);
  }
  function setStatus(t) {
    if (statusEl) statusEl.textContent = t;
  }
  function renderQR(url) {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    if (qrImg) qrImg.src = qr.createDataURL(6, 8);
    setStatus("等待扫码…");
  }
  function startTvLogin(onSuccess) {
    if (running || window.top !== window.self) return;
    running = true;
    openOverlay();
    (async () => {
      try {
        const auth = await postSigned("/x/passport-tv-login/qrcode/auth_code", {});
        if (!root) {
          running = false;
          return;
        }
        if (auth.code !== 0 || !auth.data) {
          setStatus(`获取二维码失败：${auth.code} ${auth.message || ""}`);
          running = false;
          return;
        }
        const { url, auth_code } = auth.data;
        renderQR(url);
        const started = Date.now();
        let polling = false;
        let failStreak = 0;
        pollTimer = setInterval(async () => {
          if (!root) {
            closeOverlay();
            return;
          }
          if (Date.now() - started > 18e4) {
            setStatus("二维码已过期，请重新登录");
            closeOverlay();
            return;
          }
          if (polling) return;
          polling = true;
          try {
            const poll = await postSigned("/x/passport-tv-login/qrcode/poll", { auth_code });
            failStreak = 0;
            if (poll.code === 0 && poll.data && poll.data.access_token) {
              const t = pollTimer;
              pollTimer = null;
              if (t) clearInterval(t);
              running = false;
              onSuccess(poll.data.access_token);
              setStatus("登录成功，即将刷新…");
              setTimeout(() => {
                resetOverlayDom();
                location.reload();
              }, 1e3);
            } else if (poll.code === 86038) {
              setStatus("二维码已失效，请重新登录");
              closeOverlay();
            } else if (poll.code === 86090) {
              setStatus("已扫码，请在手机上确认");
            } else if (poll.code === 86039) {
            } else {
              setStatus(`登录失败：${poll.code} ${poll.message || ""}`);
              closeOverlay();
            }
          } catch (_) {
            if (++failStreak >= 5) {
              setStatus("网络或风控异常，请稍后重试");
              closeOverlay();
            }
          } finally {
            polling = false;
          }
        }, 2e3);
      } catch (e) {
        setStatus("登录出错：" + e.message);
        running = false;
      }
    })();
  }
  const VERSION = "0.6.44";
  try {
    window.__BILIKIT_VERSION__ = VERSION;
    window.__BILIKIT_CDN_ENGINE_VERSION__ = VERSION;
  } catch {
  }
  const DEFAULT_OPEN_MODE = "newtab";
  const NEW_TAB_HISTORY_FLATTEN_KEY = "feed.newTabHistoryFlatten";
  const DEFAULT_NEW_TAB_HISTORY_FLATTEN = false;
  const WAYBACK_STACK_KEY = "bilikit-wayback-stack";
  const NEW_TAB_TARGET_PREFIX = "bilikit-newtab-flatten-";
  const NEW_TAB_TOKEN = /^[0-9a-z-]{8,}$/i;
  function isSafariUserAgent(userAgent, vendor) {
    return /Safari/i.test(userAgent) && /Apple Computer/i.test(vendor) && !/(?:Chrome|Chromium|CriOS|Edg|EdgiOS|Firefox|FxiOS|OPiOS)/i.test(userAgent);
  }
  function shouldUseSafariHistoryFlatten(enabled, userAgent, vendor) {
    return enabled && isSafariUserAgent(userAgent, vendor);
  }
  function newToken() {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }
  function newHistoryFlattenTargetName(token = newToken()) {
    return `${NEW_TAB_TARGET_PREFIX}${token}`;
  }
  function isHistoryFlattenTargetName(name) {
    if (!name.startsWith(NEW_TAB_TARGET_PREFIX)) return false;
    return NEW_TAB_TOKEN.test(name.slice(NEW_TAB_TARGET_PREFIX.length));
  }
  function openBiliKitVideoTab(url, enableHistoryFlatten) {
    const flatten = shouldUseSafariHistoryFlatten(
      enableHistoryFlatten,
      navigator.userAgent,
      navigator.vendor
    );
    if (!flatten) return window.open(url, "_blank", "noopener");
    let previousStack = null;
    try {
      previousStack = sessionStorage.getItem(WAYBACK_STACK_KEY);
      if (previousStack != null) sessionStorage.removeItem(WAYBACK_STACK_KEY);
    } catch {
    }
    try {
      return window.open(url, newHistoryFlattenTargetName());
    } finally {
      try {
        if (previousStack != null) sessionStorage.setItem(WAYBACK_STACK_KEY, previousStack);
      } catch {
      }
    }
  }
  function consumeHistoryFlattenTarget() {
    if (window.top !== window.self || !isHistoryFlattenTargetName(window.name)) return false;
    try {
      window.name = "";
    } catch {
    }
    return true;
  }
  const PANEL_ID = "bilikit-panel-root";
  const FEED_ID = "__feed__";
  const OPEN_ID = "__open__";
  const PREVIEW_ID = "__preview__";
  const ABOUT_ID = "__about__";
  const FEED_CAT = "推荐";
  const ABOUT_CAT = "关于";
  let selected = "";
  let navEl = null;
  let detailEl = null;
  let footEl = null;
  const STYLE = `
:host { all: initial; color-scheme: dark; }
* { box-sizing: border-box; font-family: -apple-system, "PingFang SC", sans-serif; }

.gear {
  position: fixed; right: 24px; bottom: 32px; z-index: 99990; /* 与 Feed 右下悬浮按钮同位对齐；低于抽屉遮罩(100000)：抽屉一开即被盖住 */
  width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,.1); background: rgba(22,23,28,.9); color: #fff;
  box-shadow: 0 3px 14px rgba(0,0,0,.3); opacity: .92;
  transition: opacity .18s ease, transform .16s ease, box-shadow .16s ease;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.gear:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 5px 16px rgba(0,0,0,.2); }
.gear:hover svg { transform: rotate(30deg); }
.gear:active { transform: scale(.94); }
.gear svg { width: 20px; height: 20px; display: block; transition: transform .16s ease; }
.overlay {
  position: fixed; inset: 0; z-index: 2147483501; background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; visibility: hidden; transition: opacity .2s ease, visibility 0s linear .2s;
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
}
.overlay.open { opacity: 1; visibility: visible; transition: opacity .2s ease; }

.card {
  width: min(660px, calc(100vw - 32px)); height: 560px; max-height: 90vh;
  display: flex; flex-direction: column;
  background: #1c1d22; color: #e3e5e7; border-radius: 18px;
  box-shadow: 0 16px 56px rgba(0,0,0,.5); overflow: hidden;
  transform: translateY(10px) scale(.98); transition: transform .2s ease;
}
.overlay.open .card { transform: none; }

.head { display: flex; align-items: baseline; gap: 10px; padding: 18px 22px 14px; border-bottom: 1px solid rgba(255,255,255,.06); flex: 0 0 auto; }
.head .title { font-size: 17px; font-weight: 600; letter-spacing: .2px; }
.head .brand { color: #fb7299; }
.head .close { margin-left: auto; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: rgba(255,255,255,.7); font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; transition: color .16s ease, border-color .16s ease, transform .12s ease; }
.head .close:hover { color: #fb7299; border-color: #fb7299; }
.head .close:active { transform: scale(.92); }

.main { flex: 1; display: flex; min-height: 0; }
.nav { width: 228px; flex: 0 0 auto; border-right: 1px solid rgba(255,255,255,.06); overflow: auto; padding: 12px 10px; }
.nav-cat { font-size: 12px; letter-spacing: .3px; color: rgba(255,255,255,.35); padding: 12px 8px 5px; }
.nav-cat:first-child { padding-top: 4px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 9px 9px; border-radius: 9px; cursor: pointer; }
.nav-item:hover { background: rgba(255,255,255,.05); }
.nav-item.sel { background: rgba(251,114,153,.16); }
.nm-wrap { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; }
.nav-item .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; color: rgba(255,255,255,.85); }
.nav-item.sel .nm { color: #fb7299; font-weight: 500; }
.gear-ico { flex: 0 0 auto; width: 13px; height: 13px; color: rgba(255,255,255,.38); display: flex; }
.gear-ico svg { width: 13px; height: 13px; display: block; }
.nav-item:hover .gear-ico, .nav-item.sel .gear-ico { color: #fb7299; }

.detail { flex: 1; min-width: 0; overflow: auto; padding: 26px; display: flex; flex-direction: column; }
.detail-title { font-size: 19px; font-weight: 600; }
.detail-desc { font-size: 14px; color: rgba(255,255,255,.5); margin-top: 7px; line-height: 1.55; }
.fields { margin-top: 22px; display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field.row { flex-direction: row; align-items: center; justify-content: space-between; gap: 14px; }
.field.row .flabel { flex: 1; }
/* 开关行：标签+开关一行（space-between），hint 由 .field 的列布局落到下一行，避免三者挤成一排 */
.field .toggle-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.field .toggle-head .flabel { flex: 1; }
.field .flabel { font-size: 14px; color: rgba(255,255,255,.8); line-height: 1.4; }
.field .hint { font-size: 13px; color: rgba(255,255,255,.4); line-height: 1.45; }
.field input[type=text], .field input[type=number], .field textarea, .field select {
  width: 100%; background: rgba(255,255,255,.06); color: #e3e5e7;
  border: 1px solid rgba(255,255,255,.14); border-radius: 9px; padding: 9px 12px;
  font-size: 14px; font-family: inherit; outline: none;
}
.field input[type=text], .field input[type=number], .field select { min-height: 38px; }
.field input[type=text]:focus, .field input[type=number]:focus, .field textarea:focus, .field select:focus { border-color: #fb7299; }
.field textarea { min-height: 72px; resize: vertical; line-height: 1.5; }

.empty { margin: auto; text-align: center; color: rgba(255,255,255,.3); font-size: 14px; padding: 24px; }
.empty .ei { font-size: 30px; opacity: .5; margin-bottom: 8px; }
.empty .es { margin-top: 3px; font-size: 13px; }

.sw { position: relative; flex: 0 0 auto; width: 44px; height: 24px; }
.sw.sm { width: 34px; height: 19px; }
.sw input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1; }
.sw .track { position: absolute; inset: 0; border-radius: 24px; background: rgba(255,255,255,.16); transition: background .16s ease; }
.sw .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .16s ease; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.sw.sm .track::after { width: 15px; height: 15px; }
.sw input:checked + .track { background: #fb7299; }
.sw input:checked + .track::after { transform: translateX(20px); }
.sw.sm input:checked + .track::after { transform: translateX(15px); }

/* 提示块：淡底圆角 + 图标，取代浮着的灰字。info 常规 / warn 品牌色调 */
.callout { display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.055); font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,.62); }
.callout .ci { flex: 0 0 auto; margin-top: 1px; opacity: .85; }
.callout .ci svg { display: block; width: 14px; height: 14px; }
.callout a { color: #fb7299; text-decoration: none; font-weight: 500; }
.callout a:hover { text-decoration: underline; }
.callout.warn { background: rgba(251,114,153,.13); color: rgba(255,255,255,.82); }
.callout.warn .ci { color: #fb7299; opacity: 1; }
/* 状态徽章：带色点的 pill */
.status { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; padding: 5px 12px; border-radius: 20px; background: rgba(255,255,255,.07); color: rgba(255,255,255,.6); }
.status .dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.35); flex: 0 0 auto; }
.status.on { background: rgba(251,114,153,.15); color: #fb7299; }
.status.on .dot { background: #fb7299; box-shadow: 0 0 0 3px rgba(251,114,153,.2); }
.feed-btn { align-self: flex-start; cursor: pointer; color: #fff; background: #fb7299; border: none; border-radius: 9px; padding: 9px 18px; font-size: 14px; font-family: inherit; font-weight: 500; }
.feed-btn.ghost { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #e3e5e7; }
.feed-btn:hover { filter: brightness(1.08); }

.foot { padding: 12px 22px 15px; font-size: 12px; color: rgba(255,255,255,.4); display: flex; align-items: center; gap: 12px; border-top: 1px solid rgba(255,255,255,.06); flex: 0 0 auto; }
.foot .legend { margin-left: auto; display: flex; align-items: center; gap: 5px; }
.foot .legend .gear-ico { width: 12px; height: 12px; color: #fb7299; }
.foot .legend .gear-ico svg { width: 12px; height: 12px; }
.reload { display: none; cursor: pointer; color: #fff; background: #fb7299; border: none; border-radius: 9px; padding: 6px 14px; font-size: 12px; font-family: inherit; font-weight: 500; }
.foot.dirty .reload { display: inline-block; }
.foot.dirty .note { color: #fb7299; }

/* 主题由 BiliKit 的 theme-sync.mode 显式控制；不能只看系统媒体查询。 */
:host(.bk-theme-light) {
  color-scheme: light;
}
:host(.bk-theme-light) .gear { background: rgba(255,255,255,.95); color: #18191c; border-color: rgba(0,0,0,.08); box-shadow: 0 3px 14px rgba(0,0,0,.14); }
:host(.bk-theme-light) .card { background: #fff; color: #18191c; box-shadow: 0 16px 56px rgba(0,0,0,.22); }
:host(.bk-theme-light) .head { border-bottom-color: rgba(0,0,0,.07); }
:host(.bk-theme-light) .head .brand { color: #d6336c; }
:host(.bk-theme-light) .head .close { border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.04); color: rgba(0,0,0,.55); }
:host(.bk-theme-light) .head .close:hover { color: #d6336c; border-color: #d6336c; }
:host(.bk-theme-light) .main .nav { border-right-color: rgba(0,0,0,.07); }
:host(.bk-theme-light) .nav-cat { color: rgba(0,0,0,.4); }
:host(.bk-theme-light) .nav-item:hover { background: rgba(0,0,0,.05); }
:host(.bk-theme-light) .nav-item.sel { background: rgba(214,51,108,.12); }
:host(.bk-theme-light) .nav-item .nm { color: rgba(0,0,0,.82); }
:host(.bk-theme-light) .nav-item.sel .nm { color: #d6336c; }
:host(.bk-theme-light) .nav-item:hover .gear-ico, :host(.bk-theme-light) .nav-item.sel .gear-ico, :host(.bk-theme-light) .foot .legend .gear-ico { color: #d6336c; }
:host(.bk-theme-light) .detail-desc { color: rgba(0,0,0,.5); }
:host(.bk-theme-light) .field .flabel { color: rgba(0,0,0,.75); }
:host(.bk-theme-light) .field .hint { color: rgba(0,0,0,.42); }
:host(.bk-theme-light) .field input[type=text], :host(.bk-theme-light) .field input[type=number], :host(.bk-theme-light) .field textarea, :host(.bk-theme-light) .field select { background: rgba(0,0,0,.04); color: #18191c; border-color: rgba(0,0,0,.14); }
:host(.bk-theme-light) .field input[type=text]:focus, :host(.bk-theme-light) .field input[type=number]:focus, :host(.bk-theme-light) .field textarea:focus, :host(.bk-theme-light) .field select:focus { border-color: #d6336c; }
:host(.bk-theme-light) .empty { color: rgba(0,0,0,.35); }
:host(.bk-theme-light) .sw .track { background: rgba(0,0,0,.16); }
:host(.bk-theme-light) .sw input:checked + .track { background: #d6336c; }
:host(.bk-theme-light) .callout { background: rgba(0,0,0,.04); color: rgba(0,0,0,.6); }
:host(.bk-theme-light) .callout.warn { background: rgba(214,51,108,.1); color: rgba(0,0,0,.75); }
:host(.bk-theme-light) .callout.warn .ci { color: #d6336c; }
:host(.bk-theme-light) .callout a { color: #d6336c; }
:host(.bk-theme-light) .status { background: rgba(0,0,0,.05); color: rgba(0,0,0,.55); }
:host(.bk-theme-light) .status .dot { background: rgba(0,0,0,.3); }
:host(.bk-theme-light) .status.on { background: rgba(214,51,108,.12); color: #d6336c; }
:host(.bk-theme-light) .status.on .dot { background: #d6336c; box-shadow: 0 0 0 3px rgba(214,51,108,.18); }
:host(.bk-theme-light) .feed-btn { background: #d6336c; }
:host(.bk-theme-light) .feed-btn.ghost { border-color: rgba(0,0,0,.2); color: #18191c; }
:host(.bk-theme-light) .foot { color: rgba(0,0,0,.45); border-top-color: rgba(0,0,0,.07); }
:host(.bk-theme-light) .reload { background: #d6336c; }
:host(.bk-theme-light) .foot.dirty .note { color: #d6336c; }
`;
  const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  const WARN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  function callout(html, variant = "info") {
    const c = el("div", "callout" + (variant === "warn" ? " warn" : ""));
    c.innerHTML = `<span class="ci">${variant === "warn" ? WARN_SVG : INFO_SVG}</span><span class="ctext">${html}</span>`;
    return c;
  }
  function markDirty() {
    if (footEl) footEl.classList.add("dirty");
  }
  function switchEl(checked, onChange, small = false) {
    const sw = el("span", "sw" + (small ? " sm" : ""));
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.checked = checked;
    const track = el("span", "track");
    inp.addEventListener("change", () => onChange(inp.checked));
    sw.append(inp, track);
    return sw;
  }
  function normalizeNumberField(value, f) {
    const fallback = Number(f.default);
    const min = Number.isFinite(Number(f.min)) ? Number(f.min) : -Infinity;
    const max = Number.isFinite(Number(f.max)) ? Number(f.max) : Infinity;
    const step = Number.isFinite(Number(f.step)) && Number(f.step) > 0 ? Number(f.step) : 1;
    const raw = Number(value);
    const base = Number.isFinite(raw) ? raw : fallback;
    const stepped = Math.round(base / step) * step;
    const bounded = Math.min(max, Math.max(min, stepped));
    return Number.isFinite(bounded) ? bounded : fallback;
  }
  function renderField(m, f) {
    const wrap = el("div");
    const cur = getField(m, f.key);
    if (f.type === "toggle") {
      wrap.className = "field";
      const head = el("div", "toggle-head");
      const lab = el("span", "flabel", f.label);
      const sw = switchEl(!!cur, (on) => {
        setField(m.id, f.key, on);
        markDirty();
      });
      head.append(lab, sw);
      wrap.append(head);
    } else if (f.type === "select") {
      wrap.className = "field";
      wrap.appendChild(el("span", "flabel", f.label));
      const sel = document.createElement("select");
      const presets = f.options.map((o) => o.value);
      for (const o of f.options) {
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
      }
      const CUSTOM = "__custom__";
      let input = null;
      if (f.allowCustom) {
        const opt = document.createElement("option");
        opt.value = CUSTOM;
        opt.textContent = "自定义…";
        sel.appendChild(opt);
        input = document.createElement("input");
        input.type = "text";
        if (f.customPlaceholder) input.placeholder = f.customPlaceholder;
        input.addEventListener("input", () => {
          setField(m.id, f.key, input.value);
          markDirty();
        });
      }
      const isPreset = presets.includes(cur);
      if (f.allowCustom && !isPreset && cur) {
        sel.value = CUSTOM;
        input.value = String(cur);
        input.style.display = "";
      } else {
        const useDefault = !isPreset;
        sel.value = useDefault ? f.default : String(cur);
        if (useDefault && String(cur) !== f.default) setField(m.id, f.key, f.default);
        if (input) input.style.display = "none";
      }
      sel.addEventListener("change", () => {
        if (sel.value === CUSTOM && input) {
          input.style.display = "";
          setField(m.id, f.key, input.value);
          input.focus();
        } else {
          if (input) input.style.display = "none";
          setField(m.id, f.key, sel.value);
        }
        markDirty();
      });
      wrap.appendChild(sel);
      if (input) wrap.appendChild(input);
    } else if (f.type === "number") {
      wrap.className = "field";
      wrap.appendChild(el("span", "flabel", f.label));
      const inp = document.createElement("input");
      inp.type = "number";
      inp.inputMode = "numeric";
      if (f.min != null) inp.min = String(f.min);
      if (f.max != null) inp.max = String(f.max);
      if (f.step != null) inp.step = String(f.step);
      inp.value = String(normalizeNumberField(cur, f));
      if (f.placeholder) inp.placeholder = f.placeholder;
      let committed = inp.value;
      const commit = () => {
        const value = normalizeNumberField(inp.value, f);
        inp.value = String(value);
        if (committed === inp.value) return;
        committed = inp.value;
        setField(m.id, f.key, value);
        markDirty();
      };
      inp.addEventListener("change", commit);
      inp.addEventListener("blur", commit);
      wrap.appendChild(inp);
    } else if (f.type === "textarea") {
      wrap.className = "field";
      wrap.appendChild(el("span", "flabel", f.label));
      const ta = document.createElement("textarea");
      ta.value = String(cur ?? "");
      if (f.placeholder) ta.placeholder = f.placeholder;
      ta.addEventListener("change", () => {
        setField(m.id, f.key, ta.value);
        markDirty();
      });
      wrap.appendChild(ta);
    } else {
      wrap.className = "field";
      wrap.appendChild(el("span", "flabel", f.label));
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = String(cur ?? "");
      if (f.placeholder) inp.placeholder = f.placeholder;
      inp.addEventListener("change", () => {
        setField(m.id, f.key, inp.value);
        markDirty();
      });
      wrap.appendChild(inp);
    }
    if (f.hint) wrap.appendChild(el("div", "hint", f.hint));
    return wrap;
  }
  function emptyState(main, sub) {
    const e = el("div", "empty");
    e.appendChild(el("div", "ei", "◔"));
    e.appendChild(el("div", null, main));
    if (sub) e.appendChild(el("div", "es", sub));
    return e;
  }
  function navItemModule(m) {
    const row = el("div", "nav-item" + (selected === m.id ? " sel" : ""));
    const wrap = el("div", "nm-wrap");
    wrap.appendChild(el("span", "nm", m.name));
    if (m.settings && m.settings.length) {
      const g = el("span", "gear-ico");
      g.innerHTML = GEAR_SVG;
      wrap.appendChild(g);
    }
    row.appendChild(wrap);
    const sw = switchEl(isModuleEnabled(m), (on) => {
      setModuleEnabled(m.id, on);
      markDirty();
    }, true);
    sw.addEventListener("click", (e) => e.stopPropagation());
    row.appendChild(sw);
    row.addEventListener("click", () => select(m.id));
    return row;
  }
  function navItemSpecial(id, name) {
    const row = el("div", "nav-item" + (selected === id ? " sel" : ""));
    const wrap = el("div", "nm-wrap");
    wrap.appendChild(el("span", "nm", name));
    const g = el("span", "gear-ico");
    g.innerHTML = GEAR_SVG;
    wrap.appendChild(g);
    row.appendChild(wrap);
    row.addEventListener("click", () => select(id));
    return row;
  }
  function renderNav() {
    if (!navEl) return;
    navEl.textContent = "";
    const cats = [];
    const byCat = /* @__PURE__ */ new Map();
    for (const m of getModules()) {
      const c = m.category || "其它";
      if (!byCat.has(c)) {
        byCat.set(c, []);
        cats.push(c);
      }
      byCat.get(c).push(m);
    }
    if (!cats.includes(FEED_CAT)) cats.push(FEED_CAT);
    for (const c of cats) {
      navEl.appendChild(el("div", "nav-cat", c));
      for (const m of byCat.get(c) || []) navEl.appendChild(navItemModule(m));
      if (c === "播放") navEl.appendChild(navItemSpecial(OPEN_ID, "打开方式"));
      if (c === FEED_CAT) {
        navEl.appendChild(navItemSpecial(FEED_ID, "App 推荐 Feed"));
        navEl.appendChild(navItemSpecial(PREVIEW_ID, "封面预览"));
      }
    }
    navEl.appendChild(el("div", "nav-cat", ABOUT_CAT));
    navEl.appendChild(navItemSpecial(ABOUT_ID, "关于 BiliKit Performance"));
  }
  function renderFeedDetail(d) {
    const loggedIn = !!get("feed.accessKey", "");
    d.appendChild(el("div", "detail-title", "App 推荐 Feed"));
    d.appendChild(el("div", "detail-desc", "首页换成手机 App 的推荐流（需另装 BiliKit Feed 脚本）"));
    const onHome = location.pathname === "/" || location.pathname === "/index.html";
    const feedAlive = Number(localStorage.getItem("bilikit:alive.feed") || 0);
    if (onHome && Date.now() - feedAlive > 8e3) {
      d.appendChild(callout('未检测到 <b>BiliKit Feed</b>，首页推荐流需要它。<a href="https://github.com/shiinayane/BiliKit" target="_blank" rel="noopener">前往安装</a>', "warn"));
    }
    const fields = el("div", "fields");
    const row = el("div", "field row");
    row.appendChild(el("span", "flabel", "登录状态"));
    const st = el("span", "status" + (loggedIn ? " on" : ""));
    const setStatus2 = (t) => {
      st.innerHTML = `<span class="dot"></span>${t}`;
    };
    setStatus2(loggedIn ? "已登录 · 个性化推荐" : "未登录 · 匿名（内容有限）");
    row.appendChild(st);
    fields.appendChild(row);
    const btn = el("button", "feed-btn" + (loggedIn ? " ghost" : ""), loggedIn ? "退出登录" : "扫码登录（TV）");
    btn.addEventListener("click", () => {
      if (loggedIn) {
        set("feed.accessKey", "");
        location.reload();
      } else {
        setStatus2("正在拉起二维码…");
        startTvLogin((accessKey) => {
          if (!set("feed.accessKey", accessKey)) console.error("[BiliKit] access_key 持久化失败：刷新后可能仍为匿名（浏览器隐私模式或存储已满）。");
        });
      }
    });
    fields.appendChild(btn);
    fields.appendChild(callout(loggedIn ? "退出后回到匿名推荐并刷新。" : "用手机哔哩哔哩扫码，获得个性化、不重复的 App 推荐。"));
    d.appendChild(fields);
  }
  function renderOpenDetail(d) {
    d.appendChild(el("div", "detail-title", "打开方式"));
    d.appendChild(el("div", "detail-desc", "全站（首页 / 搜索 / 收藏 / 历史 / 空间…）点视频时如何打开"));
    const fields = el("div", "fields");
    const modeRow = el("div", "field");
    modeRow.appendChild(el("span", "flabel", "视频打开方式"));
    const modeSel = document.createElement("select");
    for (const [val, label] of [["drawer", "抽屉"], ["drawer-web", "抽屉 · 网页全屏"], ["newtab", "新标签页"], ["current", "当前页"]]) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = label;
      modeSel.appendChild(o);
    }
    modeSel.value = get("feed.openMode", DEFAULT_OPEN_MODE);
    modeRow.appendChild(modeSel);
    fields.appendChild(modeRow);
    const immRow = el("div", "field");
    const immHead = el("div", "toggle-head");
    immHead.append(el("span", "flabel", "隐藏切换过程"), switchEl(get("feed.drawerImmersive", true), (on) => set("feed.drawerImmersive", on)));
    immRow.append(immHead, el("div", "hint", "开：等播放器铺满后再显示，看不到从普通页切到全屏的过程（加载稍久一点）。关：先显示、再当场铺满，会瞥见这下切换。"));
    fields.appendChild(immRow);
    const flattenRow = el("div", "field");
    const flattenHead = el("div", "toggle-head");
    flattenHead.append(
      el("span", "flabel", "Safari 左滑回到来源页"),
      switchEl(
        get(NEW_TAB_HISTORY_FLATTEN_KEY, DEFAULT_NEW_TAB_HISTORY_FLATTEN),
        (on) => set(NEW_TAB_HISTORY_FLATTEN_KEY, on)
      )
    );
    const safari = isSafariUserAgent(navigator.userAgent, navigator.vendor);
    flattenRow.append(
      flattenHead,
      el("div", "hint", safari ? "实验性：保留来源关系并把子标签里的跨视频 SPA 历史压成一层，让 Safari 两指左滑关闭视频标签并回到来源页。分 P、整页跳转仍保留原生历史。" : "仅 Safari 生效；Chrome、Edge、Firefox不会改变历史。实验性开关默认关闭。")
    );
    fields.appendChild(flattenRow);
    const syncModeRows = () => {
      immRow.style.display = modeSel.value === "drawer-web" ? "" : "none";
      flattenRow.style.display = modeSel.value === "newtab" ? "" : "none";
    };
    syncModeRows();
    modeSel.addEventListener("change", () => {
      set("feed.openMode", modeSel.value);
      syncModeRows();
    });
    fields.appendChild(callout("作用于「浏览 / 列表」页（首页 / 搜索 / 收藏 / 历史 / 空间 / 动态…）点视频。<br><b>新标签页（默认）</b>：首页原样保留，关掉视频标签即可完整结束这一播放上下文。<br><b>当前页</b>：顶层导航最利于回收；返回后恢复 Feed 卡片、游标和滚动位置。<br><b>抽屉</b>：不离开列表、切换最快，但会常驻最后一个完整视频文档。<br><b>视频播放页内</b>点相关视频走原生跳转，配合左下角「回程」胶囊一键跳回。"));
    d.appendChild(fields);
  }
  function renderPreviewDetail(d) {
    d.appendChild(el("div", "detail-title", "封面预览"));
    d.appendChild(el("div", "detail-desc", "鼠标悬停封面时的预览方式"));
    const fields = el("div", "fields");
    const row = el("div", "field");
    row.appendChild(el("span", "flabel", "预览方式"));
    const sel = document.createElement("select");
    for (const [val, label] of [["video", "真视频"], ["sprite", "雪碧图"], ["off", "关闭"]]) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = label;
      sel.appendChild(o);
    }
    sel.value = get("feed.previewMode", "video");
    sel.addEventListener("change", () => {
      set("feed.previewMode", sel.value);
      markDirty();
    });
    row.appendChild(sel);
    fields.appendChild(row);
    fields.appendChild(callout("<b>真视频</b>：悬停即拉低清视频、静音自动播，最接近手机 App 的秒开（比雪碧图费流量）。<br><b>雪碧图</b>：只拉缩略帧轮播，省流量、更轻。<br><b>关闭</b>：悬停不预览。"));
    d.appendChild(fields);
  }
  function renderAboutDetail(d) {
    d.appendChild(el("div", "detail-title", "关于 BiliKit Performance"));
    d.appendChild(el("div", "detail-desc", "面向 B 站首页、搜索与播放场景的 Edge / Chromium 性能优化脚本 · 作者 shiinayane · MIT"));
    const fields = el("div", "fields");
    const vrow = el("div", "field row");
    vrow.appendChild(el("span", "flabel", "版本"));
    const pill = el("span", "status on");
    pill.innerHTML = `<span class="dot"></span>Performance v${VERSION}`;
    vrow.appendChild(pill);
    fields.appendChild(vrow);
    const feedAlive = Date.now() - Number(localStorage.getItem("bilikit:alive.feed") || 0) < 15e3;
    const feedVer = localStorage.getItem("bilikit:feed.version") || "";
    const frow = el("div", "field row");
    frow.appendChild(el("span", "flabel", "Feed"));
    const fpill = el("span", "status" + (feedAlive && feedVer ? " on" : ""));
    fpill.innerHTML = `<span class="dot"></span>${feedAlive && feedVer ? `Feed v${feedVer}` : "未安装"}`;
    frow.appendChild(fpill);
    fields.appendChild(frow);
    fields.appendChild(callout(
      '<a href="https://github.com/ct-yx/BiliKit-Performance" target="_blank" rel="noopener">GitHub 仓库</a> · <a href="https://github.com/ct-yx/BiliKit-Performance/issues" target="_blank" rel="noopener">反馈 / 报 Bug</a> · <a href="https://raw.githubusercontent.com/ct-yx/BiliKit-Performance/main/bilikit-performance.user.js" target="_blank" rel="noopener">安装 / 更新脚本</a>'
    ));
    fields.appendChild(callout("<b>升级说明</b>：Performance 是独立脚本身份，旧版 BiliKit Core 不会自动升级；请先停用旧版，再安装新版，避免两个版本同时运行。"));
    d.appendChild(fields);
  }
  function renderDetail() {
    if (!detailEl) return;
    detailEl.textContent = "";
    if (selected === FEED_ID) {
      renderFeedDetail(detailEl);
      return;
    }
    if (selected === OPEN_ID) {
      renderOpenDetail(detailEl);
      return;
    }
    if (selected === PREVIEW_ID) {
      renderPreviewDetail(detailEl);
      return;
    }
    if (selected === ABOUT_ID) {
      renderAboutDetail(detailEl);
      return;
    }
    const m = getModules().find((x) => x.id === selected);
    if (!m) {
      detailEl.appendChild(emptyState("选择左侧一项"));
      return;
    }
    detailEl.appendChild(el("div", "detail-title", m.name));
    if (m.description) detailEl.appendChild(el("div", "detail-desc", m.description));
    const hasSettings = !!(m.settings && m.settings.length);
    if (hasSettings || m.note) {
      const fields = el("div", "fields");
      if (m.note) fields.appendChild(callout(m.note));
      if (m.settings) for (const f of m.settings) fields.appendChild(renderField(m, f));
      detailEl.appendChild(fields);
    } else {
      detailEl.appendChild(emptyState("此模块无额外配置", "开关在左侧列表"));
    }
  }
  function firstNavId() {
    const ms = getModules();
    return ms.length ? ms[0].id : FEED_ID;
  }
  function select(id) {
    selected = id;
    renderNav();
    renderDetail();
  }
  function mountPanel() {
    if (window.top !== window.self) return;
    const home = (location.hostname === "www.bilibili.com" || location.hostname === "bilibili.com") && (location.pathname === "/" || location.pathname === "/index.html");
    if (!home) return;
    const runtime = getRuntimeCoordinator();
    if (!document.body) {
      runtime.listen(document, "DOMContentLoaded", mountPanel, { once: true });
      return;
    }
    if (document.getElementById(PANEL_ID)) return;
    const root2 = el("div");
    root2.id = PANEL_ID;
    const syncPanelTheme = () => applyBiliKitTheme(root2);
    syncPanelTheme();
    runtime.listen(window, BILIKIT_THEME_EVENT, syncPanelTheme);
    const sr = root2.attachShadow({ mode: "open" });
    sr.innerHTML = `<style>${STYLE}</style>`;
    const gear = el("div", "gear");
    gear.title = "BiliKit Performance 设置";
    gear.setAttribute("aria-label", "BiliKit Performance 设置");
    gear.innerHTML = GEAR_SVG;
    const overlay = el("div", "overlay");
    const card = el("div", "card");
    const head = el("div", "head");
    head.innerHTML = `<span class="title"><span class="brand">BiliKit</span> Performance 设置</span>`;
    const close = el("span", "close", "×");
    head.appendChild(close);
    const main = el("div", "main");
    navEl = el("div", "nav");
    detailEl = el("div", "detail");
    main.append(navEl, detailEl);
    footEl = el("div", "foot");
    const note = el("span", "note", "改动需刷新页面生效");
    const reload = el("button", "reload", "刷新");
    reload.addEventListener("click", () => location.reload());
    const legend = el("div", "legend");
    const lg = el("span", "gear-ico");
    lg.innerHTML = GEAR_SVG;
    legend.append(lg, el("span", null, "有可调项"));
    footEl.append(note, reload, legend);
    card.append(head, main, footEl);
    overlay.appendChild(card);
    const open = () => {
      if (!selected || selected !== FEED_ID && selected !== OPEN_ID && selected !== PREVIEW_ID && selected !== ABOUT_ID && !getModules().some((m) => m.id === selected)) selected = firstNavId();
      renderNav();
      renderDetail();
      overlay.classList.add("open");
    };
    const closePanel = () => overlay.classList.remove("open");
    gear.addEventListener("click", open);
    close.addEventListener("click", closePanel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePanel();
    });
    runtime.listen(document, "keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
    sr.append(gear, overlay);
    document.body.appendChild(root2);
    runtime.addCleanup(() => {
      root2.remove();
    });
  }
  const CDN_SUFFIXES = [
    "bilivideo.com",
    "bilivideo.cn",
    "bilivideo.net",
    "acgvideo.com",
    "acgvideo.cn"
  ];
  const CDN_TARGET_SUFFIXES = ["bilivideo.com", "bilivideo.cn", "bilivideo.net", "acgvideo.com", "acgvideo.cn"];
  const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  const MEDIA_PATH_RE = /(?:^|\/)(?:upgcxcode|v1\/resource)\//i;
  const MEDIA_FILE_RE = /\.(?:m4s|mp4|flv|m3u8)(?:$|[?#])/i;
  const CDN_BODY_SIGNAL_RE = /bilivideo|acgvideo|akamaized\.net|szbdyd\.com|\/upgcxcode\/|\/v1\/resource\//i;
  const EDGE_MCDN_HOST_RE = /(?:^|\.)edge\.mountaintoys\.cn$/i;
  const DEFAULT_CDN_TARGET = "upos-sz-mirrorhw.bilivideo.com";
  // 境外出口优先使用当前可解析的海外阿里节点；不把国内节点策略硬套到境外。
  const DEFAULT_FOREIGN_CDN_TARGET = "upos-sz-mirroraliov.bilivideo.com";
  const LEGACY_DEFAULT_CDN_TARGET = "upos-sz-mirrorhwb.bilivideo.com";
  const ADAPTIVE_FORCE_TTL = 10 * 60 * 1e3;
  const CDN_REGION_CACHE_KEY = "bilikit:cdn-region:v2";
  const CDN_REGION_CACHE_TTL = 10 * 60 * 1e3;
  const NAV_PATH_RE = /\/x\/web-interface\/nav(?:[/?#]|$)/i;
  function normalizeRegionCode(value) {
    return String(value || "").trim().toUpperCase().replace(/^['\"]|['\"]$/g, "");
  }
  function classifyCdnRegion(ipRegion, legalRegion) {
    const code = normalizeRegionCode(ipRegion) || normalizeRegionCode(legalRegion);
    if (!code || /^(?:UNKNOWN|UN|N\/A|NULL|0|-)$/.test(code)) return "unknown";
    // 只把中国大陆代码视为 domestic；HK/TW/MO 或其它国家/地区均走 foreign。
    return /^(?:CN|CHN)$/.test(code) ? "domestic" : "foreign";
  }
  function isNavUrl(value) {
    try {
      return NAV_PATH_RE.test(new URL(value, location.href).pathname);
    } catch {
      return false;
    }
  }
  function readStorageJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function writeStorageJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
  function readCdnRegionCache() {
    const now = Date.now();
    // sessionStorage 优先保证当前标签页的实时结果；localStorage 让新标签页
    // 不必再次等待 nav 接口和测速，短 TTL 足以覆盖网络切换后的重新探测。
    for (const storage of [sessionStorage, localStorage]) {
      const cached = readStorageJson(storage, CDN_REGION_CACHE_KEY);
      if (!cached || now - Number(cached.at || 0) > CDN_REGION_CACHE_TTL) continue;
      if (!["domestic", "foreign"].includes(cached.region)) continue;
      return cached;
    }
    return null;
  }
  function writeCdnRegionCache(record) {
    const value = { ...record, at: Date.now() };
    writeStorageJson(sessionStorage, CDN_REGION_CACHE_KEY, value);
    writeStorageJson(localStorage, CDN_REGION_CACHE_KEY, value);
  }
  function normalizeCdnHost(value) {
    if (typeof value !== "string") return null;
    const host = value.trim().replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0].replace(/:\d+$/, "").toLowerCase();
    if (!host || host.length > 253) return null;
    const suffix = CDN_TARGET_SUFFIXES.find((s) => host.endsWith(`.${s}`));
    if (!suffix) return null;
    const prefix = host.slice(0, -(suffix.length + 1));
    if (!prefix || !prefix.split(".").every((label) => HOST_LABEL_RE.test(label))) return null;
    return host;
  }
  function parseCdnUrl(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const u = new URL(value, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u;
    } catch {
      return null;
    }
  }
  function isCdnHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (CDN_SUFFIXES.some((s) => host.endsWith(`.${s}`))) return true;
    if (host.endsWith(".akamaized.net") || host.endsWith(".szbdyd.com") || EDGE_MCDN_HOST_RE.test(host)) return true;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
    return /\.mcdn\.bilivideo\.(?:com|cn|net)$/.test(host);
  }
  function isMcdnProxyHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return EDGE_MCDN_HOST_RE.test(host) || /\.mcdn\.bilivideo\.(?:com|cn|net)$/.test(host);
  }
  function isMediaUrl(value) {
    const u = parseCdnUrl(value);
    return !!u && isCdnHost(u.hostname) && (MEDIA_PATH_RE.test(u.pathname) || MEDIA_FILE_RE.test(u.pathname + u.search));
  }
  function shouldRewriteCdnUrl(value, mode, targetHost) {
    const u = parseCdnUrl(value);
    if (!u || !isMediaUrl(value)) return false;
    const host = u.hostname.toLowerCase();
    if (host === targetHost) return false;
    // MCDN 的 :8000/:8082/:4483/:9102 端口和签名路径有专用代理规则，不能直接替换 Host。
    // edge.mountaintoys.cn 这类带 os=mcdn/mcdnid 的地址也属于同一代理族。
    if (isMcdnProxyHost(host)) return false;
    if (mode === "force") return true;
    if (host.endsWith(".akamaized.net") || host.endsWith(".szbdyd.com")) return true;
    if (/^upos-(?:sz|hz)-mirror[^.]+ov\.bilivideo\./.test(host)) return true;
    if (/^upos-(?:sz|hz)-mirror[^.]+bstar1\.bilivideo\./.test(host) || host === "upos-bstar1-mirrorakam.akamaized.net") return true;
    if (/^cn-hk-eq-\d{2}-\d{2}\.bilivideo\./.test(host)) return true;
    // B 站现在常把直连地址下发为 cn-*/hk-*/... 动态边缘主机；这些同样属于
    // 可替换的 bilivideo 直连节点，否则 smart 模式会出现 rewriteCount=0。
    if (CDN_SUFFIXES.some((suffix) => host.endsWith(`.${suffix}`))) return true;
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  }
  function swapHost(value, host) {
    const safeHost = normalizeCdnHost(host);
    if (!safeHost || typeof value !== "string") return value;
    return value.replace(/^(?:https?:)?\/\/[^/?#]+/i, `https://${safeHost}`);
  }
  function uniqueStrings(values) {
    return [...new Set(values.filter((value) => typeof value === "string" && value))];
  }
  function isDirectCdnMediaUrl(value) {
    const u = parseCdnUrl(value);
    return !!u && isMediaUrl(value) && !isMcdnProxyHost(u.hostname);
  }
  function fixEntry(e, targetHost, mode, stats) {
    if (!e || typeof e !== "object") return false;
    const primaryKey = ["baseUrl", "base_url", "url"].find((k) => typeof e[k] === "string");
    if (!primaryKey) return false;
    const originalPrimary = e[primaryKey];
    const primaryUrl = parseCdnUrl(originalPrimary);
    const originalBackups = [];
    for (const key of ["backupUrl", "backup_url"]) {
      if (Array.isArray(e[key])) originalBackups.push(...e[key]);
    }
    const mcdnPrimary = !!primaryUrl && isMcdnProxyHost(primaryUrl.hostname);
    const directBackup = mcdnPrimary
      ? originalBackups.find((url) => isDirectCdnMediaUrl(url)) || ""
      : "";
    if (!shouldRewriteCdnUrl(originalPrimary, mode, targetHost) && !directBackup) return false;
    // MCDN/edge.mountaintoys.cn 的签名包含 os、mcdnid、upsig 等参数，不能只替换 Host。
    // B 站通常已经在 backupUrl 中给出签名完整的 bilivideo 直连地址，直接提升它，
    // 并把原代理地址保留在回退列表中。
    const primary = directBackup || swapHost(originalPrimary, targetHost);
    if (primary === originalPrimary) return false;
    const fallbacks = uniqueStrings([originalPrimary, ...originalBackups]).filter((url) => url !== primary);
    for (const key of ["baseUrl", "base_url", "url"]) {
      if (typeof e[key] === "string") e[key] = primary;
    }
    for (const key of ["backupUrl", "backup_url"]) {
      if (Array.isArray(e[key])) e[key] = fallbacks;
    }
    if (stats) {
      stats.rewriteCount += 1;
      if (directBackup) stats.mcdnPromoteCount += 1;
      stats.lastSourceHost = parseCdnUrl(originalPrimary)?.hostname || "";
      stats.lastTargetHost = parseCdnUrl(primary)?.hostname || targetHost;
      stats.lastRewriteAt = Date.now();
    }
    return true;
  }
  function rewritePlayurl(root2, targetHost, mode, stats) {
    if (!root2 || typeof root2 !== "object") return false;
    if (root2.code !== void 0 && root2.code !== 0) return false;
    let hit = false;
    const seen = /* @__PURE__ */ new WeakSet();
    const rewriteDash = (dash) => {
      if (!dash || typeof dash !== "object") return;
      for (const list of [dash.video, dash.audio, dash.dolby && dash.dolby.audio]) {
        if (Array.isArray(list)) list.forEach((e) => {
          if (fixEntry(e, targetHost, mode, stats)) hit = true;
        });
      }
      if (dash.flac && dash.flac.audio && fixEntry(dash.flac.audio, targetHost, mode, stats)) hit = true;
    };
    const visit = (node, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
      seen.add(node);
      if (node.dash) rewriteDash(node.dash);
      if (Array.isArray(node.durl)) node.durl.forEach((e) => {
        if (fixEntry(e, targetHost, mode, stats)) hit = true;
      });
      if (Array.isArray(node.durls)) {
        node.durls.forEach((group) => {
          if (Array.isArray(group)) group.forEach((e) => {
            if (fixEntry(e, targetHost, mode, stats)) hit = true;
          });
          else if (group && Array.isArray(group.durl)) group.durl.forEach((e) => {
            if (fixEntry(e, targetHost, mode, stats)) hit = true;
          });
        });
      }
      for (const key of ["data", "result", "video_info", "playurl", "play_url", "playurl_info", "stream"]) {
        if (node[key]) visit(node[key], depth + 1);
      }
    };
    visit(root2);
    return hit;
  }
  function readAdaptiveForce(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "null");
      if (value && Date.now() - Number(value.at || 0) < ADAPTIVE_FORCE_TTL) return true;
      sessionStorage.removeItem(key);
    } catch {
    }
    return false;
  }
  function writeAdaptiveForce(key, reason) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), reason }));
      return true;
    } catch {
      return false;
    }
  }
  function init$5(cfg) {
    if (window.__BILIKIT_CDN_PICK__) return;
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    // 非播放页面仍可能消费首页/搜索页悬停预览的 playurl；只安装按 URL 精确匹配的
    // fetch/XHR 响应钩子，不安装全局 JSON.parse，不扫描普通信息流 JSON。
    const playbackPage = typeof isPlayPage === "function" && isPlayPage();
    const mediaPage = isBilibiliDocument();
    const configuredHost = cfg.get("targetHost");
    const migratedHost = configuredHost === LEGACY_DEFAULT_CDN_TARGET ? DEFAULT_CDN_TARGET : configuredHost;
    if (configuredHost === LEGACY_DEFAULT_CDN_TARGET) setField("cdn-pick", "targetHost", DEFAULT_CDN_TARGET);
    const domesticTargetHost = migratedHost === "" ? null : normalizeCdnHost(migratedHost || DEFAULT_CDN_TARGET);
    const foreignConfiguredHost = cfg.get("foreignTargetHost");
    const foreignTargetHost = foreignConfiguredHost === "" ? null : normalizeCdnHost(foreignConfiguredHost || DEFAULT_FOREIGN_CDN_TARGET);
    const regionPolicy = cfg.get("regionPolicy") || "auto";
    const requestedMode = cfg.get("mode") || "smart";
    const requestedAdaptive = cfg.get("adaptive") !== false;
    const isChromium = !!navigator.userAgentData || /(?:Edg|Chrome|Chromium)\//i.test(navigator.userAgent || "");
    const adaptiveKey = `bilikit:cdn-adaptive-force:${encodeURIComponent(location.pathname + location.search)}`;
    const adaptiveForced = isChromium && requestedAdaptive && readAdaptiveForce(adaptiveKey);
    const MODE = requestedMode === "force" || adaptiveForced ? "force" : "smart";
    const cachedRegion = regionPolicy === "auto" ? readCdnRegionCache() : null;
    const stats = {
      browser: isChromium ? "chromium" : "other",
      mode: MODE,
      configuredMode: requestedMode,
      adaptive: requestedAdaptive,
      adaptiveForced,
      regionPolicy,
      region: cachedRegion?.region || "unknown",
      regionSource: cachedRegion ? "cache" : "pending",
      ipRegion: cachedRegion?.ipRegion || "",
      legalRegion: cachedRegion?.legalRegion || "",
      regionReady: !!cachedRegion || regionPolicy !== "auto",
      enabled: mediaPage,
      reason: !mediaPage ? "non-bilibili-page" : cachedRegion || regionPolicy !== "auto" ? "" : "region-pending",
      targetHost: "",
      rewriteCount: 0,
      lastSourceHost: "",
      lastTargetHost: "",
      lastSource: "",
      lastRewriteAt: 0,
      directRewriteCount: 0,
      mcdnPromoteCount: 0
    };
    try {
      Object.defineProperty(window, "__BILIKIT_CDN_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    if (migratedHost !== "" && !domesticTargetHost || foreignConfiguredHost !== "" && !foreignTargetHost) {
      console.warn("[BiliKit] CDN 优选已禁用：自定义节点必须是 bilivideo/acgvideo 受信后缀下的纯主机名。");
      return;
    }
    window.__BILIKIT_CDN_PICK__ = true;
    const globalHookRecords = new Map();
    const mediaPatchRecords = [];
    const regionProbeTimers = [];
    let regionProbeTimeout = 0;
    let regionProbeController = null;
    let adaptiveReloadTimer = 0;
    let patchedJsonParse = null;
    let disposed = false;
    const selectTargetHost = () => {
      if (regionPolicy === "foreign") return foreignTargetHost;
      if (regionPolicy === "domestic") return domesticTargetHost;
      if (stats.region === "foreign") return foreignTargetHost;
      if (stats.region === "domestic") return domesticTargetHost;
      return null;
    };
    let activeTargetHost = selectTargetHost();
    let navRequestStarted = false;
    let regionProbeStarted = false;
    stats.targetHost = activeTargetHost || "";
    if (!activeTargetHost && regionPolicy !== "auto") {
      stats.reason = "region-target-disabled";
      return;
    }
    const observeRegion = (ipRegion, legalRegion, source) => {
      const region = classifyCdnRegion(ipRegion, legalRegion);
      if (region === "unknown") return false;
      stats.region = region;
      stats.regionSource = source;
      stats.ipRegion = normalizeRegionCode(ipRegion);
      stats.legalRegion = normalizeRegionCode(legalRegion);
      stats.regionReady = true;
      if (regionPolicy === "auto") {
        activeTargetHost = selectTargetHost();
        stats.targetHost = activeTargetHost || "";
        stats.reason = activeTargetHost ? "" : "region-target-disabled";
      }
      writeCdnRegionCache({ region, ipRegion: stats.ipRegion, legalRegion: stats.legalRegion });
      try {
        window.dispatchEvent(new CustomEvent("bilikit:cdn-region", { detail: { region } }));
      } catch {
      }
      return true;
    };
    const observeResponseRegion = (response, source) => {
      if (!response || !response.headers) return false;
      try {
        // api.bilibili.com 通常是跨源 CORS 响应，未暴露的自定义头在 Chromium
        // 中即使被 try/catch 包住也会在控制台产生 Refused to get unsafe header；
        // 跨源场景直接走 nav JSON 的 ip_region 回退，同源响应才读响应头。
        if (response.url && new URL(response.url, location.href).origin !== location.origin) return false;
        return observeRegion(
          response.headers.get("x-bili-metadata-ip-region"),
          response.headers.get("x-bili-metadata-legal-region"),
          source
        );
      } catch {
        return false;
      }
    };
    const observeXhrRegion = (xhr, source) => {
      try {
        if (xhr.responseURL && new URL(xhr.responseURL, location.href).origin !== location.origin) return false;
        return observeRegion(
          xhr.getResponseHeader("x-bili-metadata-ip-region"),
          xhr.getResponseHeader("x-bili-metadata-legal-region"),
          source
        );
      } catch {
        return false;
      }
    };
    const observeRegionBody = (payload, source) => {
      let data = payload;
      if (typeof data === "string") {
        try {
          data = parseJson(data);
        } catch {
          return false;
        }
      }
      if (!data || typeof data !== "object") return false;
      const body = data.data && typeof data.data === "object" ? data.data : data;
      return observeRegion(
        body.ip_region || body.ipRegion,
        body.legal_region || body.legalRegion,
        source
      );
    };
    const rewritePlayurl$1 = (root2, source, requestUrl = "") => {
      // 下载快照必须在 CDN 改写前复制。Mediabunny/播放使用的地址可以换节点，
      // 但下载工作台要保留 B 站原始签名地址，避免镜像节点按 Host/签名返回另一段内容。
      if (playbackPage) cacheDownloadPlayinfo(root2, "cdn-hook", requestUrl);
      let changed = false;
      if (activeTargetHost) changed = rewritePlayurl(root2, activeTargetHost, MODE, stats);
      if (changed) stats.lastSource = String(source || "").split("?")[0].slice(0, 160);
      return changed;
    };
    const PLAYURL_PATHS = [
      "/x/player/wbi/playurl",
      "/x/player/playurl",
      "/pgc/player/web/playurl",
      "/pgc/player/web/v2/playurl",
      "/pgc/player/api/playurl",
      "/pugv/player/web/playurl"
    ];
    const isPlayurl = (u) => typeof u === "string" && (PLAYURL_PATHS.some((p) => u.includes(p)) || /\/player\/[^/?#]*playurl/i.test(u));
    const nativeJsonParse = window.JSON && window.JSON.parse ? window.JSON.parse : JSON.parse;
    const parseJson = (text) => nativeJsonParse.call(window.JSON, text);
    const rewriteJsonText = (raw, source, requestUrl = "") => {
      if (typeof raw !== "string") return null;
      const hasCdnSignal = CDN_BODY_SIGNAL_RE.test(raw);
      if (!hasCdnSignal && !playbackPage) return null;
      try {
        const obj = parseJson(raw);
        // 播放页的轨道快照必须独立于 CDN 改写信号：签名域名/响应结构变化时，
        // 仍捕获本页 playurl；仅命中精确 playurl 路径的 fetch/XHR 会调用此函数。
        if (!hasCdnSignal) {
          cacheDownloadPlayinfo(obj, source, requestUrl);
          return null;
        }
        if (!rewritePlayurl$1(obj, source, requestUrl)) return null;
        return JSON.stringify(obj);
      } catch {
        return null;
      }
    };
    const buildResponse = (response, body) => {
      if (!window.Response || !window.Headers) return response;
      try {
        const headers = new window.Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return new window.Response(body, { status: response.status, statusText: response.statusText, headers });
      } catch {
        return response;
      }
    };
    if (playbackPage) {
      try {
        const parseMark = "__bilikitCdnJsonPatched";
        if (!window.JSON.parse[parseMark]) {
          patchedJsonParse = function(text, reviver) {
            const parsed = nativeJsonParse.call(this, text, reviver);
            if (typeof text === "string" && CDN_BODY_SIGNAL_RE.test(text)) rewritePlayurl$1(parsed, "JSON.parse");
            return parsed;
          };
          Object.defineProperty(patchedJsonParse, parseMark, { configurable: true, value: true });
          window.JSON.parse = patchedJsonParse;
        }
      } catch {
      }
    }
    const installGlobalHook = (name) => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window, name);
        if (descriptor && descriptor.configurable === false) return;
        let current;
        try {
          current = descriptor && descriptor.get ? descriptor.get.call(window) : descriptor && "value" in descriptor ? descriptor.value : window[name];
        } catch {
          current = window[name];
        }
        if (current) rewritePlayurl$1(current, name);
        const getter = () => current;
        const setter = (value) => {
          current = value;
          rewritePlayurl$1(current, name);
        };
        Object.defineProperty(window, name, {
          configurable: true,
          enumerable: descriptor ? descriptor.enumerable : true,
          get: getter,
          set: setter
        });
        globalHookRecords.set(name, { descriptor, getter, setter });
      } catch {
      }
    };
    if (playbackPage) {
      installGlobalHook("__playinfo__");
      installGlobalHook("__INITIAL_STATE__");
    }
    let origFetch = null;
    const removeFetchHook = networkHooks.addFetch("cdn-pick", (next) => {
      origFetch = next;
      return async function(input, _init) {
        const url = typeof input === "string" ? input : input && input.url || String(input || "");
        if (isNavUrl(url)) navRequestStarted = true;
        const resp = await origFetch.apply(this, arguments);
        const regionSeen = observeResponseRegion(resp, `fetch:${url}`);
        // 有些边缘响应不暴露地域响应头，但 nav JSON 仍带有 ip_region/legal_region；
        // 只解析这一条轻量接口，不扫描首页/信息流的普通 JSON。
        if (isNavUrl(url) && !regionSeen) {
          void resp.clone().json().then((payload) => {
            observeRegionBody(payload, `fetch-body:${url}`);
          }).catch(() => {
          });
        }
        if (!isPlayurl(url)) return resp;
        try {
          const body = rewriteJsonText(await resp.clone().text(), `fetch:${url}`, url);
          return body ? buildResponse(resp, body) : resp;
        } catch (_) {
          return resp;
        }
      };
    });
    const removeXhrHook = networkHooks.addXHR("cdn-pick", (OX) => class X extends OX {
        open(method, url, ...rest) {
          this.__cdnUrl = String(url);
          if (isNavUrl(this.__cdnUrl)) navRequestStarted = true;
          if (this.__bilikitRegionListener) {
            try {
              this.removeEventListener("readystatechange", this.__bilikitRegionListener);
            } catch {
            }
          }
          this.__bilikitRegionListener = () => {
            if (this.readyState !== 4) return;
            const source = `xhr:${this.__cdnUrl}`;
            const regionSeen = observeXhrRegion(this, source);
            if (isNavUrl(this.__cdnUrl) && !regionSeen) {
              try {
                const payload = this.responseType === "json" ? this.response : this.responseText;
                observeRegionBody(payload, `xhr-body:${this.__cdnUrl}`);
              } catch {
              }
            }
          };
          this.addEventListener("readystatechange", this.__bilikitRegionListener);
          return super.open(method, url, ...rest);
        }
        get responseText() {
          const rt = this.responseType;
          if (rt !== "" && rt !== "text") return super.responseText;
          return this.__cdnText(super.responseText);
        }
        get response() {
          const r = super.response;
          if (this.readyState !== 4 || !isPlayurl(this.__cdnUrl)) return r;
          if (typeof r === "string") return this.__cdnText(r);
          if (r && typeof r === "object") {
            try {
              rewritePlayurl$1(r, `xhr:${this.__cdnUrl}`, this.__cdnUrl);
            } catch (_) {
            }
          }
          return r;
        }
        __cdnText(raw) {
          if (this.readyState !== 4 || typeof raw !== "string" || !isPlayurl(this.__cdnUrl)) return raw;
          return rewriteJsonText(raw, `xhr:${this.__cdnUrl}`, this.__cdnUrl) || raw;
        }
      });
    const rewriteDirectMediaUrl = (value, source) => {
      if (!activeTargetHost || typeof value !== "string") return value;
      if (!shouldRewriteCdnUrl(value, MODE, activeTargetHost)) return value;
      const next = swapHost(value, activeTargetHost);
      if (next === value) return value;
      stats.directRewriteCount += 1;
      stats.lastSource = source;
      stats.lastTargetHost = activeTargetHost;
      try {
        stats.lastSourceHost = new URL(value, location.href).hostname;
      } catch {
      }
      stats.lastRewriteAt = Date.now();
      return next;
    };
    const patchMediaSource = (Ctor) => {
      if (!Ctor || !Ctor.prototype) return;
      const proto = Ctor.prototype;
      const mark = "__bilikitCdnMediaPatched";
      if (proto[mark]) return;
      try {
        const src = Object.getOwnPropertyDescriptor(proto, "src");
        if (src && typeof src.set === "function" && src.configurable !== false) {
          const wrappedSrcSetter = function(value) {
            src.set.call(this, rewriteDirectMediaUrl(String(value), `${Ctor.name}.src`));
          };
          Object.defineProperty(proto, "src", {
            ...src,
            set: wrappedSrcSetter
          });
          mediaPatchRecords.push({ proto, key: "src", descriptor: src, installed: Object.getOwnPropertyDescriptor(proto, "src") });
        }
        const nativeSetAttribute = proto.setAttribute;
        if (typeof nativeSetAttribute === "function") {
          const wrappedSetAttribute = function(name, value) {
            const key = String(name).toLowerCase();
            return nativeSetAttribute.call(this, name, key === "src" ? rewriteDirectMediaUrl(String(value), `${Ctor.name}.setAttribute`) : value);
          };
          proto.setAttribute = wrappedSetAttribute;
          mediaPatchRecords.push({ proto, key: "setAttribute", value: nativeSetAttribute, installed: wrappedSetAttribute });
        }
        Object.defineProperty(proto, mark, { configurable: true, value: true });
        mediaPatchRecords.push({ proto, key: mark, marker: true });
      } catch {
      }
    };
    patchMediaSource(window.HTMLMediaElement);
    patchMediaSource(window.HTMLSourceElement);
    if (regionPolicy === "auto" && !stats.regionReady && origFetch) {
      // 优先复用页面自己的 nav/XHR 响应。若页面尚未发起 nav，再发一次轻量探测，
      // 并用标记避免「页面 nav + BiliKit nav」在同一时刻重复探测。
      const probeRegion = () => {
        if (stats.regionReady || navRequestStarted || regionProbeStarted) return;
        regionProbeStarted = true;
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        regionProbeController = controller;
        regionProbeTimeout = setTimeout(() => {
          try {
            controller == null ? void 0 : controller.abort();
          } catch {
          }
        }, 1200);
        origFetch.call(window, "https://api.bilibili.com/x/web-interface/nav", {
          credentials: "include",
          cache: "no-store",
          signal: controller == null ? void 0 : controller.signal
        }).then((response) => {
          const regionSeen = observeResponseRegion(response, "region-probe");
          const body = isNavUrl("https://api.bilibili.com/x/web-interface/nav") && !regionSeen
            ? response.clone().json().then((payload) => observeRegionBody(payload, "region-probe-body")).catch(() => false)
            : Promise.resolve(false);
          return body.then(() => {
            try {
              response.body == null ? void 0 : response.body.cancel();
            } catch {
            }
          });
        }).catch(() => {
        }).finally(() => {
          clearTimeout(regionProbeTimeout);
          regionProbeTimeout = 0;
          regionProbeController = null;
        });
      };
      regionProbeTimers.push(setTimeout(probeRegion, 240));
      regionProbeTimers.push(setTimeout(probeRegion, 900));
    }
    if (playbackPage && isChromium && requestedAdaptive) {
      let issues = [];
      let lastIssueAt = 0;
      let reloadScheduled = false;
      const bufferedAhead = (video) => {
        if (!(video instanceof HTMLVideoElement) || !video.buffered) return 0;
        const now = video.currentTime || 0;
        for (let i = 0; i < video.buffered.length; i += 1) {
          if (now >= video.buffered.start(i) && now <= video.buffered.end(i)) return Math.max(0, video.buffered.end(i) - now);
        }
        return 0;
      };
      const isRealVideo = (video) => video instanceof HTMLVideoElement && !video.classList.contains("bk-feed-vpreview") && video.currentTime >= 1;
      const escalate = (reason) => {
        if (MODE === "force" || reloadScheduled) return;
        reloadScheduled = true;
        if (!writeAdaptiveForce(adaptiveKey, reason)) return;
        stats.adaptiveForced = true;
        adaptiveReloadTimer = setTimeout(() => {
          adaptiveReloadTimer = 0;
          try {
            location.reload();
          } catch {
          }
        }, 350);
      };
      const onIssue = (event) => {
        const video = event.target;
        if (!isRealVideo(video)) return;
        const reason = event.type;
        if (reason !== "error" && video.paused) return;
        const ahead = bufferedAhead(video);
        if (reason !== "error" && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && ahead >= 2.5) return;
        const now = Date.now();
        if (now - lastIssueAt < 1800) return;
        lastIssueAt = now;
        issues = issues.filter((item) => now - item < 45e3);
        issues.push(now);
        if (reason === "error" || issues.length >= 3) escalate(`${reason}:${issues.length}`);
      };
      const onPlaying = () => {
        issues = [];
      };
      document.addEventListener("waiting", onIssue, true);
      document.addEventListener("stalled", onIssue, true);
      document.addEventListener("error", onIssue, true);
      document.addEventListener("playing", onPlaying, true);
      mediaPatchRecords.push({ cleanup: () => {
        document.removeEventListener("waiting", onIssue, true);
        document.removeEventListener("stalled", onIssue, true);
        document.removeEventListener("error", onIssue, true);
        document.removeEventListener("playing", onPlaying, true);
      } });
    }
    let untrackCleanup = () => {};
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      removeFetchHook();
      removeXhrHook();
      regionProbeTimers.forEach(clearTimeout);
      if (regionProbeTimeout) clearTimeout(regionProbeTimeout);
      try { regionProbeController?.abort(); } catch {}
      if (adaptiveReloadTimer) clearTimeout(adaptiveReloadTimer);
      for (const [name, record] of globalHookRecords) {
        const current = Object.getOwnPropertyDescriptor(window, name);
        if (current?.get !== record.getter || current?.set !== record.setter) continue;
        if (record.descriptor) Object.defineProperty(window, name, record.descriptor);
        else delete window[name];
      }
      if (patchedJsonParse && window.JSON.parse === patchedJsonParse) window.JSON.parse = nativeJsonParse;
      for (const record of mediaPatchRecords.reverse()) {
        if (record.cleanup) {
          record.cleanup();
          continue;
        }
        if (record.marker) {
          if (record.proto[record.key] === true) delete record.proto[record.key];
        } else if (record.key === "src") {
          const current = Object.getOwnPropertyDescriptor(record.proto, record.key);
          if (current?.set === record.installed?.set) Object.defineProperty(record.proto, record.key, record.descriptor);
        } else if (record.proto[record.key] === record.installed) {
          record.proto[record.key] = record.value;
        }
      }
      if (window.__BILIKIT_CDN_PICK__) delete window.__BILIKIT_CDN_PICK__;
      untrackCleanup();
    };
    untrackCleanup = runtime.addCleanup(dispose);
    return dispose;
  }
  const cdnPick = {
    id: "cdn-pick",
    name: "CDN 优选",
    description: "Edge/Chromium 按 B 站返回的出口地域选择国内/境外节点，同时保留原始回退地址",
    category: "播放",
    runAt: "start",
    note: "播放页、首页和搜索页按 B 站返回的 IP 地域改写可替换的 bilivideo 直连地址，覆盖正式播放和悬停预览 playurl；首页/搜索/动态等 bfs 图片按 i0/i1/i2 实测节点改写。不扫描普通 JSON，不改变预览内容、清晰度或交互。自动模式读取 B 站接口的 IP 地域响应头或 nav JSON：CN/CHN 使用国内节点，HK/TW/MO 及其它代码使用境外节点，地域未确认前保留原生地址。MCDN 主地址不伪造签名；若 B 站同时下发签名完整的 bilivideo 直连备用地址，则优先使用直连，并保留 MCDN 回退。<br>可在控制台查看 <code>window.__BILIKIT_CDN_STATS__</code>、<code>window.__BILIKIT_HOME_FEED_STATS__</code> 和 <code>window.__BILIKIT_HOME_IMAGE_STATS__</code>。",
    settings: [
      {
        key: "regionPolicy",
        type: "select",
        label: "IP 地区策略",
        default: "auto",
        options: [
          { label: "自动检测（推荐）", value: "auto" },
          { label: "强制按国内出口", value: "domestic" },
          { label: "强制按境外出口", value: "foreign" }
        ],
        hint: "自动读取 x-bili-metadata-ip-region，响应头不可见时读取 nav JSON 的 ip_region；CN/CHN 走国内，其他已知代码走境外，未知时保持原生 CDN"
      },
      {
        key: "mode",
        type: "select",
        label: "改写模式",
        default: "smart",
        options: [
          { label: "智能（推荐）", value: "smart" },
          { label: "强制改写所有 CDN", value: "force" }
        ],
        hint: "智能模式针对海外镜像、Akamai、PCDN/IP；MCDN 优先使用 B 站提供的签名直连备用并保留代理回退，如果仍卡顿可切换强制模式"
      },
      {
        key: "adaptive",
        type: "toggle",
        label: "Edge 卡顿自适应",
        default: true,
        hint: "连续 waiting/stalled 或播放器报错时，自动切换到强制模式并刷新一次当前视频页"
      },
      {
        key: "targetHost",
        type: "select",
        label: "CDN 镜像节点",
        default: "upos-sz-mirrorhw.bilivideo.com",
        options: [
          { label: "华为 hw（当前实测较快）", value: "upos-sz-mirrorhw.bilivideo.com" },
          { label: "百度 bda2", value: "upos-sz-upcdnbda2.bilivideo.com" },
          { label: "阿里 ali", value: "upos-sz-mirrorali.bilivideo.com" },
          { label: "阿里 ali02", value: "upos-sz-mirrorali02.bilivideo.com" },
          { label: "阿里 alib", value: "upos-sz-mirroralib.bilivideo.com" },
          { label: "阿里 alio1", value: "upos-sz-mirroralio1.bilivideo.com" },
          { label: "腾讯 cos", value: "upos-sz-mirrorcos.bilivideo.com" },
          { label: "腾讯 cosb", value: "upos-sz-mirrorcosb.bilivideo.com" },
          { label: "腾讯 coso1", value: "upos-sz-mirrorcoso1.bilivideo.com" },
          { label: "华为 hwo1", value: "upos-sz-mirrorhwo1.bilivideo.com" },
          { label: "华为 08c", value: "upos-sz-mirror08c.bilivideo.com" },
          { label: "华为 08h", value: "upos-sz-mirror08h.bilivideo.com" },
          { label: "华为 08ct", value: "upos-sz-mirror08ct.bilivideo.com" },
          { label: "AWS 海外镜像", value: "upos-sz-mirrorawsov.bilivideo.com" },
          { label: "海外阿里 aliov", value: "upos-sz-mirroraliov.bilivideo.com" },
          { label: "海外腾讯 cosov", value: "upos-sz-mirrorcosov.bilivideo.com" },
          { label: "海外华为 hwov", value: "upos-sz-mirrorhwov.bilivideo.com" },
          { label: "华为 hwb（旧默认）", value: "upos-sz-mirrorhwb.bilivideo.com" },
          { label: "关闭（用 B 站默认分配）", value: "" }
        ],
        allowCustom: true,
        customPlaceholder: "upos-sz-mirrorXXX.bilivideo.com",
        hint: "自定义节点必须是 bilivideo.com、bilivideo.cn、bilivideo.net 或 acgvideo 受信后缀下的主机名"
      },
      {
        key: "foreignTargetHost",
        type: "select",
        label: "境外 CDN 镜像节点",
        default: DEFAULT_FOREIGN_CDN_TARGET,
        options: [
          { label: "海外阿里 aliov（默认）", value: DEFAULT_FOREIGN_CDN_TARGET },
          { label: "关闭境外改写", value: "" }
        ],
        allowCustom: true,
        customPlaceholder: "upos-sz-mirrorXXX.bilivideo.com",
        hint: "只在检测到非 CN 出口时使用；境外节点异常时可关闭，让 B 站自行分配"
      }
    ],
    init: init$5
  };
  function rootBootstrapBackground(dark, readyState) {
    return dark && readyState === "loading" ? "#18191c" : "";
  }
  function init$4(cfg) {
    if (window.top !== window.self && !location.hash.includes("bk-drawer")) return;
    if (window.__BILIKIT_THEME_SYNC__) return;
    window.__BILIKIT_THEME_SYNC__ = true;
    const runtime = getRuntimeCoordinator();
    const COOKIE_NAME = "theme_style";
    const COOKIE_DOMAIN = ".bilibili.com";
    const THEME_LINK_RE = /\/bili-theme\/(light|dark)\.css/;
    const mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const wantDark = () => getBiliKitTheme() === "dark";
    function readCookie2(name) {
      const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
      return m ? m[1] : null;
    }
    function setCookie(name, value) {
      if (readCookie2(name) === value) return;
      document.cookie = `${name}=${value}; path=/; domain=${COOKIE_DOMAIN}; max-age=31536000; SameSite=Lax`;
    }
    function swapThemeStylesheet(doc, dark) {
      const want = dark ? "/dark.css" : "/light.css";
      for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
        if (!THEME_LINK_RE.test(link.href)) continue;
        if (!link.href.includes(want)) link.href = link.href.replace(/\/(light|dark)\.css/, want);
      }
    }
    function syncComponentTheme(dark) {
      if (isHomePage() || isSearchPage()) return;
      const want = dark ? "dark" : "light";
      for (const el2 of document.querySelectorAll("bili-comments")) {
        try {
          if (el2.theme !== want) el2.theme = want;
        } catch (_) {
        }
      }
    }
    function apply() {
      const dark = wantDark();
      setCookie(COOKIE_NAME, dark ? "dark" : "light");
      swapThemeStylesheet(document, dark);
      const root2 = document.documentElement;
      // document-start 时 HTML 根节点可能尚未创建；DOMContentLoaded 会再次调用 apply。
      if (!root2) return;
      root2.classList.toggle("bili_dark", dark);
      root2.classList.toggle("night-mode", dark);
      root2.style.backgroundColor = rootBootstrapBackground(dark, document.readyState);
      syncComponentTheme(dark);
      emitBiliKitThemeChange();
    }
    apply();
    runtime.listen(document, "DOMContentLoaded", apply, { once: true });
    if (mql) {
      if (typeof mql.addEventListener === "function") runtime.listen(mql, "change", apply);
      else if (typeof mql.addListener === "function") {
        mql.addListener(apply);
        runtime.addCleanup(() => mql.removeListener(apply));
      }
    }
    runtime.listen(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") apply();
    });
    runtime.listen(window, SETTINGS_EVENT, apply);
    runtime.listen(window, "storage", (e) => {
      if (!e.key || e.key === "bilikit:settings") apply();
    });
    let syncPending = 0;
    let commentObserver = null;
    let commentPoll = 0;
    const scheduleComponentSync = () => {
      if (syncPending) return;
      const frame = runtime.frame(() => {
        syncPending = 0;
        syncComponentTheme(wantDark());
      });
      syncPending = frame;
    };
    function watchComments() {
      // 首页和搜索页没有评论树；跳过轮询，避免在信息流加载期间持续查找不存在的 #commentapp。
      if (isHomePage() || isSearchPage()) return;
      const app = document.querySelector("#commentapp");
      if (app) {
        commentObserver = runtime.createObserver(scheduleComponentSync);
        commentObserver?.observe(app, { childList: true, subtree: true });
        if (commentPoll) clearInterval(commentPoll);
        commentPoll = 0;
        return;
      }
      let tries = 0;
      commentPoll = setInterval(() => {
        const a = document.querySelector("#commentapp");
        if (a) {
          clearInterval(commentPoll);
          commentPoll = 0;
          commentObserver = runtime.createObserver(scheduleComponentSync);
          commentObserver?.observe(a, { childList: true, subtree: true });
        } else if (++tries > 40) {
          clearInterval(commentPoll);
          commentPoll = 0;
        }
      }, 500);
    }
    if (document.readyState === "loading") runtime.listen(document, "DOMContentLoaded", watchComments, { once: true });
    else watchComments();
    const dispose = () => {
      if (commentPoll) clearInterval(commentPoll);
      commentPoll = 0;
      if (syncPending) syncPending.cancel();
      syncPending = 0;
      commentObserver?.disconnectAndForget();
      commentObserver = null;
      if (window.__BILIKIT_THEME_SYNC__) delete window.__BILIKIT_THEME_SYNC__;
    };
    runtime.addCleanup(dispose);
    return dispose;
  }
  const themeSync = {
    id: "theme-sync",
    name: "主题同步",
    description: "跟随系统深浅色，全站无刷新实时切换",
    category: "界面",
    runAt: "start",
    settings: [
      {
        key: "mode",
        type: "select",
        label: "主题模式",
        default: "auto",
        options: [
          { label: "跟随系统", value: "auto" },
          { label: "始终深色", value: "dark" },
          { label: "始终浅色", value: "light" }
        ],
        hint: "跟随系统深浅，或强制固定一种"
      }
    ],
    init: init$4
  };
  const PROFILE_ICON_BASE = "https://i0.hdslb.com/bfs/seed/jinkela/short/webui/user-profile/img/";
  function normalizeCommentSex(value) {
    return value === "男" || value === "女" ? value : null;
  }
  function commentSexIconUrl(sex) {
    return `${PROFILE_ICON_BASE}gender_${sex === "男" ? "male" : "female"}.png@.avif`;
  }
  function init$3(cfg) {
    // 首页和搜索页没有评论组件，不安装全树 MutationObserver，也不启动兜底定时器。
    if (isHomePage() || isSearchPage()) return;
    if (window.__BILIKIT_COMMENT_LOC__) return;
    window.__BILIKIT_COMMENT_LOC__ = true;
    const runtime = getRuntimeCoordinator();
    const PIN = cfg.get("pin") || "";
    const SHOW_SEX = cfg.get("showSex") !== false;
    function resolveLocation(el2) {
      let n = el2, hop = 0;
      while (n && hop++ < 8) {
        for (const key of ["data", "reply", "_data"]) {
          const d = n[key];
          const loc = d && d.reply_control && d.reply_control.location;
          if (typeof loc === "string" && loc) return loc;
        }
        const root2 = n.getRootNode ? n.getRootNode() : null;
        n = root2 instanceof ShadowRoot ? root2.host : n.parentElement;
      }
      return null;
    }
    const format = (loc) => loc.replace(/^\s*IP属地[:：]\s*/, "");
    let observers = [];
    const injectedNodes = new Set();
    const observed = /* @__PURE__ */ new WeakSet();
    function observeRoot(sr) {
      if (observed.has(sr)) return;
      observed.add(sr);
      const mo = runtime.createObserver((muts) => {
        for (const m of muts) {
          if (m.type !== "childList") continue;
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && !n.isContentEditable) {
              schedule();
              return;
            }
          }
        }
      });
      mo?.observe(sr, { childList: true, subtree: true });
      if (mo) observers.push(mo);
    }
    function process(el2) {
      if (el2.localName === "bili-comment-user-info") injectSex(el2);
      else if (el2.localName === "bili-comment-action-buttons-renderer") injectLocation(el2);
    }
    function walk(root2) {
      process(root2);
      let nodes;
      try {
        nodes = root2.querySelectorAll("*");
      } catch (_) {
        return;
      }
      for (const n of nodes) {
        process(n);
        const sr = n.shadowRoot;
        if (sr) {
          observeRoot(sr);
          walk(sr);
        }
      }
    }
    function injectSex(userInfo) {
      var _a, _b;
      if (!SHOW_SEX) return false;
      const sr = userInfo.shadowRoot;
      if (!sr || sr.querySelector(".bilikit-sex")) return false;
      const userName = sr.querySelector("#user-name");
      const sex = normalizeCommentSex((_b = (_a = userInfo.data) == null ? void 0 : _a.member) == null ? void 0 : _b.sex);
      if (!userName || !sex) return false;
      const icon = document.createElement("img");
      icon.className = "bilikit-sex";
      icon.src = commentSexIconUrl(sex);
      icon.width = 16;
      icon.height = 16;
      icon.alt = "";
      icon.decoding = "async";
      icon.draggable = false;
      icon.title = sex;
      icon.setAttribute("role", "img");
      icon.setAttribute("aria-label", sex);
      icon.style.cssText = "display:block;flex:0 0 16px;width:16px;height:16px;margin-left:6px;object-fit:contain;vertical-align:middle;";
      userName.after(icon);
      injectedNodes.add(icon);
      return true;
    }
    let nativeGap = "";
    function blockGap(sr) {
      if (!nativeGap) {
        const sib = sr.querySelector("#like") || sr.querySelector("#reply") || sr.querySelector("#dislike");
        const m = sib ? getComputedStyle(sib).marginLeft : "";
        if (m && m !== "0px") nativeGap = m;
      }
      return nativeGap || "16px";
    }
    function injectLocation(ab) {
      const sr = ab.shadowRoot;
      if (!sr || sr.querySelector(".bilikit-loc")) return false;
      const pubdate = sr.querySelector("#pubdate");
      if (!pubdate) return false;
      const loc = resolveLocation(ab);
      if (!loc) {
        return false;
      }
      const span = document.createElement("span");
      span.className = "bilikit-loc";
      span.textContent = PIN + format(loc);
      span.style.cssText = `margin-left:calc(${blockGap(sr)} / 2);color:var(--text3,#9499a0);font-size:inherit;white-space:nowrap;`;
      pubdate.after(span);
      injectedNodes.add(span);
      return true;
    }
    let topRoot = null;
    let rafId = 0;
    function schedule() {
      if (rafId || !topRoot) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        walk(topRoot);
      });
    }
    function bind(comments) {
      const sr = comments.shadowRoot;
      if (!sr) return;
      for (const o of observers) o.disconnectAndForget();
      observers = [];
      topRoot = sr;
      observeRoot(sr);
      walk(sr);
    }
    let current = null;
    let currentApp = null;
    let appObserver = null;
    function releaseCommentTree() {
      for (const o of observers) o.disconnectAndForget();
      observers = [];
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      current = null;
      topRoot = null;
    }
    function tryBind() {
      const c = currentApp == null ? void 0 : currentApp.querySelector("bili-comments");
      if (c && c !== current && c.shadowRoot) {
        current = c;
        bind(c);
      }
    }
    function watch(app) {
      if (app === currentApp && appObserver) {
        tryBind();
        return;
      }
      appObserver == null ? void 0 : appObserver.disconnectAndForget();
      releaseCommentTree();
      currentApp = app;
      appObserver = runtime.createObserver(tryBind);
      appObserver?.observe(app, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-params"]
      });
      tryBind();
    }
    function ensureApp() {
      if (currentApp == null ? void 0 : currentApp.isConnected) return;
      if (currentApp) {
        appObserver == null ? void 0 : appObserver.disconnectAndForget();
        appObserver = null;
        currentApp = null;
        releaseCommentTree();
      }
      const app = document.querySelector("#commentapp");
      if (app) watch(app);
    }
    ensureApp();
    const appPoll = setInterval(() => {
      if (currentApp == null ? void 0 : currentApp.isConnected) return;
      ensureApp();
    }, 2e3);
    const dispose = () => {
      clearInterval(appPoll);
      appObserver?.disconnectAndForget();
      appObserver = null;
      releaseCommentTree();
      for (const node of injectedNodes) node.remove();
      injectedNodes.clear();
      if (window.__BILIKIT_COMMENT_LOC__) delete window.__BILIKIT_COMMENT_LOC__;
    };
    runtime.addCleanup(dispose);
    return dispose;
  }
  const commentLocation = {
    id: "comment-location",
    name: "评论信息",
    description: "姓名旁显示性别，时间旁显示 IP 属地",
    category: "界面",
    runAt: "idle",
    settings: [
      { key: "showSex", type: "toggle", label: "姓名旁显示性别", default: true, hint: "直接读取评论已有数据；保密用户不显示，不额外请求接口" },
      { key: "pin", type: "text", label: "地名前缀符", default: "", placeholder: "如 📍 ", hint: "显示在属地前，默认无；想加自己填" }
    ],
    init: init$3
  };
  function isWakeLockIgnoredVideo(v) {
    return v.classList.contains("bk-feed-vpreview");
  }
  function init$2() {
    const nav = navigator;
    // 搜索页的原生悬停预览不是正式播放；不要为它申请屏幕唤醒锁。
    if (!isPlayPage()) return;
    if (!("wakeLock" in navigator)) return;
    if (window.__BILIKIT_WAKE_LOCK__) return;
    window.__BILIKIT_WAKE_LOCK__ = true;
    const runtime = getRuntimeCoordinator();
    let enabled = true;
    const log = (...args) => {
    };
    let sentinel = null;
    let currentVideo = null;
    let retryTimer = null;
    let acquiring = false;
    async function requestWakeLock() {
      if (!enabled || sentinel || acquiring) return;
      if (!currentVideo || currentVideo.paused) return;
      if (document.visibilityState !== "visible") return;
      acquiring = true;
      try {
        const acquired = await nav.wakeLock.request("screen");
        if (!enabled) {
          await acquired.release();
          return;
        }
        sentinel = acquired;
        log("acquired");
        const onRelease = () => {
          if (sentinel === acquired) sentinel = null;
          log("released");
          if (enabled && currentVideo && !currentVideo.paused) retryWakeLock();
        };
        acquired.addEventListener("release", onRelease, { once: true });
        if (!currentVideo || currentVideo.paused || document.visibilityState !== "visible") {
          log("stale acquire, releasing");
          await acquired.release();
        }
      } catch (err) {
        retryWakeLock();
      } finally {
        acquiring = false;
      }
    }
    function retryWakeLock() {
      if (!enabled || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        requestWakeLock();
      }, 2e3);
    }
    async function releaseWakeLock() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      try {
        if (sentinel) {
          const active = sentinel;
          sentinel = null;
          await active.release();
          log("manually released");
        }
      } catch {
      }
    }
    const onMediaStop = (e) => {
      if (e.target === currentVideo) releaseWakeLock();
    };
    const onEmptied = (e) => {
      const v = e.target;
      if (v !== currentVideo) return;
      runtime.timeout(() => {
        if (enabled && v === currentVideo && (v.paused || v.ended || !v.isConnected)) void releaseWakeLock();
      }, 800);
    };
    function bindVideo(v) {
      if (currentVideo === v) return;
      if (currentVideo) {
        currentVideo.removeEventListener("pause", onMediaStop);
        currentVideo.removeEventListener("ended", onMediaStop);
        currentVideo.removeEventListener("emptied", onEmptied);
      }
      currentVideo = v;
      v.addEventListener("pause", onMediaStop);
      v.addEventListener("ended", onMediaStop);
      v.addEventListener("emptied", onEmptied);
    }
    const onPlaying = (e) => {
      if (!(e.target instanceof HTMLVideoElement)) return;
      if (isWakeLockIgnoredVideo(e.target)) return;
      bindVideo(e.target);
      void requestWakeLock();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && currentVideo && !currentVideo.paused) {
        void requestWakeLock();
      }
    };
    runtime.listen(document, "playing", onPlaying, true);
    runtime.listen(document, "visibilitychange", onVisibilityChange);
    const initial = document.querySelector("video");
    if (initial && !initial.paused) {
      bindVideo(initial);
      void requestWakeLock();
    }
    const dispose = () => {
      enabled = false;
      void releaseWakeLock();
      if (currentVideo) {
        currentVideo.removeEventListener("pause", onMediaStop);
        currentVideo.removeEventListener("ended", onMediaStop);
        currentVideo.removeEventListener("emptied", onEmptied);
        currentVideo = null;
      }
      if (window.__BILIKIT_WAKE_LOCK__) delete window.__BILIKIT_WAKE_LOCK__;
    };
    runtime.addCleanup(dispose);
    return dispose;
  }
  const wakeLock = {
    id: "wake-lock",
    name: "防睡眠",
    description: "播放视频时阻止 Safari 休眠 / 屏保",
    category: "播放",
    runAt: "idle",
    init: init$2
  };
  const urlOf = (input) => {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    if (input && typeof input.href === "string") return input.href;
    try {
      return String(input);
    } catch {
      return "";
    }
  };
  function fixSearchApiUrl(value) {
    const url = urlOf(value);
    if (!url.includes("/api.bilibili.comx/web-interface/search")) return "";
    return url.replace(/\.com(?!\/)/i, ".com/");
  }
  function installSearchUrlFix() {
    if (window.__BILIKIT_SEARCH_URL_FIX__) return;
    window.__BILIKIT_SEARCH_URL_FIX__ = true;
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    const removeFetchHook = networkHooks.addFetch("search-url-fix", (next) => function(input, init2) {
        const fixed = fixSearchApiUrl(input);
        if (!fixed) return next.apply(this, arguments);
        let realInput = fixed;
        if (input instanceof Request) {
          try {
            realInput = new Request(fixed, input);
          } catch {
          }
        }
        return next.call(this, realInput, init2);
      });
    const removeXhrHook = networkHooks.addXHR("search-url-fix", (BaseXHR) => class X extends BaseXHR {
        open(method, url, ...rest) {
          const fixed = fixSearchApiUrl(url);
          return super.open(method, fixed || url, ...rest);
        }
      });
    const dispose = () => {
      removeFetchHook();
      removeXhrHook();
      if (window.__BILIKIT_SEARCH_URL_FIX__) delete window.__BILIKIT_SEARCH_URL_FIX__;
    };
    runtime.addCleanup(dispose);
    return dispose;
  }
  function requestToInit(req) {
    const headers = {};
    try {
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } catch {
    }
    return { method: req.method, headers, credentials: req.credentials, referrer: req.referrer, signal: req.signal };
  }
  function installNetHook(rules) {
    if (window.__BILIKIT_NET_HOOK__) return window.__BILIKIT_NET_HOOK_DISPOSE__ || null;
    window.__BILIKIT_NET_HOOK__ = true;
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    // 同一个接口通常会被 fetch/XHR 反复访问；缓存规则判断，避免每次都遍历全部规则。
    const ruleCache = new Map();
    const findRule = (url) => {
      const key = String(url || "").split("#", 1)[0];
      if (ruleCache.has(key)) return ruleCache.get(key);
      const rule = rules.find((r) => r.match(key));
      if (ruleCache.size >= 128) ruleCache.clear();
      ruleCache.set(key, rule || null);
      return rule || null;
    };
    const removeFetchHook = networkHooks.addFetch("no-login-net", (origFetch) => function(input, init2) {
        var _a;
        const url = urlOf(input);
        const rule = findRule(url);
        if (!rule) return origFetch.apply(this, arguments);
        let realInput = input;
        let realInit = init2;
        const rw = (_a = rule.rewriteRequest) == null ? void 0 : _a.call(rule, url);
        if (rw && (rw.url || rw.credentials)) {
          if (input instanceof Request && !rw.url) {
            realInput = new Request(input, rw.credentials ? { credentials: rw.credentials } : {});
            realInit = init2;
          } else {
            const base = input instanceof Request ? requestToInit(input) : init2 || {};
            realInput = rw.url || url;
            realInit = { ...base, ...rw.credentials ? { credentials: rw.credentials } : {} };
          }
        }
        const response = origFetch.call(this, realInput, realInit);
        if (!rule.rewriteResponse && !rule.onResponse) return response;
        return response.then(async (resp) => {
          if (rule.onResponse) {
            try {
              void resp.clone().json().then((payload) => rule.onResponse(payload, url)).catch(() => {
              });
            } catch {
            }
          }
          if (!rule.rewriteResponse) return resp;
          try {
            const text = await resp.clone().text();
            const out = rule.rewriteResponse(JSON.parse(text), url);
            const headers = new Headers(resp.headers);
            headers.delete("content-length");
            headers.delete("content-encoding");
            return new Response(JSON.stringify(out), { status: resp.status, statusText: resp.statusText, headers });
          } catch {
            return resp;
          }
        });
      });
    const removeXhrHook = networkHooks.addXHR("no-login-net", (OX) => class X extends OX {
        constructor() {
          super(...arguments);
          this.__nlUrl = "";
          this.__nlOpenArgs = ["GET", ""];
          this.__nlHeaders = [];
          this.__nlGeneration = 0;
          this.__nlObservedResponseGeneration = -1;
          this.__nlAborted = false;
        }
        open(method, url, ...rest) {
          var _a, _b, _c;
          this.__nlGeneration++;
          this.__nlObservedResponseGeneration = -1;
          this.__nlAborted = false;
          this.__nlUrl = String(url);
          this.__nlOpenArgs = [method, url, ...rest];
          this.__nlHeaders = [];
          this.__nlRule = findRule(this.__nlUrl);
          this.__nlRw = (_b = (_a = this.__nlRule) == null ? void 0 : _a.rewriteRequest) == null ? void 0 : _b.call(_a, this.__nlUrl);
          return super.open(method, ((_c = this.__nlRw) == null ? void 0 : _c.url) || url, ...rest);
        }
        abort() {
          this.__nlAborted = true;
          this.__nlGeneration++;
          return super.abort();
        }
        setRequestHeader(name, value) {
          try {
            this.__nlHeaders.push([name, value]);
          } catch {
          }
          return super.setRequestHeader(name, value);
        }
        __nlApplyCreds(c) {
          if (c === "omit") this.withCredentials = false;
          else if (c) this.withCredentials = true;
        }
        send(body) {
          var _a, _b, _c;
          if (((_a = this.__nlRule) == null ? void 0 : _a.awaitRewrite) && !((_b = this.__nlRw) == null ? void 0 : _b.url)) {
            const generation = this.__nlGeneration;
            const openArgs = [...this.__nlOpenArgs];
            const headers = [...this.__nlHeaders];
            const stillCurrent = () => !this.__nlAborted && this.__nlGeneration === generation;
            const sendCurrent = (rw) => {
              if (!stillCurrent()) return;
              try {
                if (rw == null ? void 0 : rw.url) {
                  const [method, _oldUrl, ...rest] = openArgs;
                  super.open(method, rw.url, ...rest);
                  for (const h of headers) {
                    try {
                      super.setRequestHeader(h[0], h[1]);
                    } catch {
                    }
                  }
                }
                this.__nlApplyCreds(rw == null ? void 0 : rw.credentials);
              } catch {
              }
              if (!stillCurrent()) return;
              try {
                super.send(body);
              } catch {
              }
            };
            this.__nlRule.awaitRewrite(this.__nlUrl).then((rw) => {
              sendCurrent(rw);
            }, () => sendCurrent());
            return;
          }
          this.__nlApplyCreds((_c = this.__nlRw) == null ? void 0 : _c.credentials);
          return super.send(body);
        }
        get responseText() {
          var _a;
          const rt = this.responseType;
          if (rt !== "" && rt !== "text") return super.responseText;
          const raw = super.responseText;
          this.__nlObserveResponse(raw);
          if (this.readyState === 4 && ((_a = this.__nlRule) == null ? void 0 : _a.rewriteResponse) && typeof raw === "string") {
            try {
              return JSON.stringify(this.__nlRule.rewriteResponse(JSON.parse(raw), this.__nlUrl));
            } catch {
              return raw;
            }
          }
          return raw;
        }
        get response() {
          var _a;
          const raw = super.response;
          this.__nlObserveResponse(raw);
          if (this.readyState === 4 && ((_a = this.__nlRule) == null ? void 0 : _a.rewriteResponse)) {
            if (typeof raw === "string") {
              try {
                return JSON.stringify(this.__nlRule.rewriteResponse(JSON.parse(raw), this.__nlUrl));
              } catch {
                return raw;
              }
            }
            if (raw && typeof raw === "object") {
              try {
                return this.__nlRule.rewriteResponse(raw, this.__nlUrl);
              } catch {
                return raw;
              }
            }
          }
          return raw;
        }
        __nlObserveResponse(raw) {
          if (this.readyState !== 4 || !this.__nlRule?.onResponse || this.__nlObservedResponseGeneration === this.__nlGeneration) return;
          this.__nlObservedResponseGeneration = this.__nlGeneration;
          try {
            const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (payload && typeof payload === "object") this.__nlRule.onResponse(payload, this.__nlUrl);
          } catch {
          }
        }
      });
    const dispose = () => {
      removeFetchHook();
      removeXhrHook();
      if (window.__BILIKIT_NET_HOOK_DISPOSE__ === dispose) delete window.__BILIKIT_NET_HOOK_DISPOSE__;
      if (window.__BILIKIT_NET_HOOK__) delete window.__BILIKIT_NET_HOOK__;
    };
    window.__BILIKIT_NET_HOOK_DISPOSE__ = dispose;
    return dispose;
  }
  const MIXIN_TAB = [
    46,
    47,
    18,
    2,
    53,
    8,
    23,
    32,
    15,
    50,
    10,
    31,
    58,
    3,
    45,
    35,
    27,
    43,
    5,
    49,
    33,
    9,
    42,
    19,
    29,
    28,
    14,
    39,
    12,
    38,
    41,
    13,
    37,
    48,
    7,
    16,
    24,
    55,
    40,
    61,
    26,
    17,
    0,
    1,
    60,
    51,
    30,
    4,
    22,
    25,
    54,
    21,
    56,
    59,
    6,
    63,
    57,
    62,
    11,
    36,
    20,
    34,
    44,
    52
  ];
  const mixinKey = (orig) => MIXIN_TAB.map((n) => orig[n]).join("").slice(0, 32);
  const keyFromUrl = (u) => u ? u.slice(u.lastIndexOf("/") + 1, u.lastIndexOf(".")) : "";
  function signParams(params, imgKey, subKey, wts) {
    const mk = mixinKey(imgKey + subKey);
    const q = { ...params, wts };
    const query = Object.keys(q).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(q[k]).replace(/[!'()*]/g, ""))}`).join("&");
    return `${query}&w_rid=${md5(query + mk)}`;
  }
  const LS = "bilikit:wbi-core";
  const today = () => Math.floor(Date.now() / 864e5);
  let cache = null;
  function readKeys() {
    try {
      const img = keyFromUrl(localStorage.getItem("wbi_img_url") || "");
      const sub = keyFromUrl(localStorage.getItem("wbi_sub_url") || "");
      if (img && sub) return { img, sub };
    } catch {
    }
    if (cache && cache.day === today()) return { img: cache.img, sub: cache.sub };
    try {
      const c = JSON.parse(localStorage.getItem(LS) || "null");
      if (c && c.day === today() && c.img && c.sub) {
        cache = c;
        return { img: c.img, sub: c.sub };
      }
    } catch {
    }
    return null;
  }
  let warmInFlight = null;
  function doWarm(pureFetch) {
    if (warmInFlight) return warmInFlight;
    warmInFlight = pureFetch("https://api.bilibili.com/x/web-interface/nav", { credentials: "omit" }).then((r) => r.json()).then((j) => {
      var _a;
      const w = (_a = j == null ? void 0 : j.data) == null ? void 0 : _a.wbi_img;
      const img = keyFromUrl((w == null ? void 0 : w.img_url) || ""), sub = keyFromUrl((w == null ? void 0 : w.sub_url) || "");
      if (img && sub) {
        cache = { img, sub, day: today() };
        try {
          localStorage.setItem(LS, JSON.stringify(cache));
        } catch {
        }
      }
    }).catch(() => {
    }).finally(() => {
      warmInFlight = null;
    });
    return warmInFlight;
  }
  function warmKeys(pureFetch) {
    if (readKeys()) return;
    doWarm(pureFetch);
  }
  function ensureKeys(pureFetch, timeoutMs = 1500) {
    if (readKeys()) return Promise.resolve(true);
    const timed = new Promise((res) => setTimeout(res, timeoutMs));
    return Promise.race([doWarm(pureFetch), timed]).then(() => !!readKeys());
  }
  function signQuery(params) {
    const keys = readKeys();
    if (!keys) return null;
    return signParams(params, keys.img, keys.sub, Math.floor(Date.now() / 1e3));
  }
  function playurlParams(url) {
    const [base, qs = ""] = url.split("?");
    const params = Object.fromEntries(new URLSearchParams(qs));
    delete params.w_rid;
    delete params.wts;
    params.qn = "80";
    params.try_look = "1";
    params.platform = "pc";
    params.fnval = "4048";
    params.fourk = "1";
    return { base, params };
  }
  const AUTH_CACHE_KEY = "bilikit:no-login-auth";
  const VALID_TTL_MS = 5 * 60 * 1e3;
  function cookieValue(cookie, name) {
    for (const part of cookie.split(";")) {
      const item = part.trim();
      const eq = item.indexOf("=");
      if (eq < 0 || item.slice(0, eq) !== name) continue;
      const value = item.slice(eq + 1);
      return value || null;
    }
    return null;
  }
  function loginCookieFingerprint(cookie) {
    const value = cookieValue(cookie, "DedeUserID__ckMd5");
    return value ? md5(value) : null;
  }
  function readCachedStatus(storage, fingerprint, now) {
    try {
      const record = JSON.parse(storage.getItem(AUTH_CACHE_KEY) || "null");
      if (!record || record.fingerprint !== fingerprint) return "unknown";
      if (record.status === "invalid") return "invalid";
      if (record.status === "valid" && now - record.checkedAt <= VALID_TTL_MS) return "valid";
    } catch {
    }
    return "unknown";
  }
  function initialAuthAction(cookie, storage, now = Date.now()) {
    const fingerprint = loginCookieFingerprint(cookie);
    if (!fingerprint) return "activate-guest";
    const cached = readCachedStatus(storage, fingerprint, now);
    if (cached === "invalid") return "activate-guest";
    if (cached === "valid") return "skip";
    return "verify";
  }
  function loginStatusFromNav(json) {
    var _a, _b;
    if ((json == null ? void 0 : json.code) === 0 && ((_a = json == null ? void 0 : json.data) == null ? void 0 : _a.isLogin) === true) return "valid";
    if (((json == null ? void 0 : json.code) === 0 || (json == null ? void 0 : json.code) === -101) && ((_b = json == null ? void 0 : json.data) == null ? void 0 : _b.isLogin) === false) return "invalid";
    return "unknown";
  }
  async function verifyLogin(pureFetch, timeoutMs = 2500) {
    const controller = new AbortController();
    let timer;
    const request = pureFetch("https://api.bilibili.com/x/web-interface/nav", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) return "unknown";
      return loginStatusFromNav(await response.json());
    }).catch(() => "unknown");
    const timeout = new Promise((resolve2) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve2("unknown");
      }, timeoutMs);
    });
    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  function rememberVerifiedLogin(storage, fingerprint, status, now = Date.now()) {
    if (status === "unknown") return "skip";
    try {
      const record = { fingerprint, status, checkedAt: now };
      storage.setItem(AUTH_CACHE_KEY, JSON.stringify(record));
      return status === "invalid" ? "reload" : "skip";
    } catch {
      return "skip";
    }
  }
  const AUTH_HOSTS = ["message.bilibili.com", "account.bilibili.com", "member.bilibili.com", "pay.bilibili.com", "big.bilibili.com"];
  const AUTH_PATHS = ["/history", "/watchlater", "/favlist", "/medialist", "/account", "/pincenter"];
  function needsRealLogin() {
    if (AUTH_HOSTS.includes(location.hostname)) return true;
    return AUTH_PATHS.some((p) => location.pathname.includes(p));
  }
  function clearFakeUid() {
    try {
      if (/DedeUserID=/.test(document.cookie)) document.cookie = "DedeUserID=; path=/; domain=.bilibili.com; max-age=0";
    } catch {
    }
  }
  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
  function init$1(_cfg) {
    var _a;
    if (window.__BILIKIT_NO_LOGIN__) return;
    if (window.top !== window.self && !location.hash.includes("bk-drawer")) return;
    if (location.hostname === "passport.bilibili.com") return;
    const homePage = isHomePage();
    const searchPage = isSearchPage();
    if (homePage) {
      // 首页信息流不需要免登录响应改写；保留 B 站原生 fetch/XHR，避免全量 hook
      // 包住推荐接口和悬停预览请求。视频页、动态页仍按原逻辑提供免登录能力。
      if (!loginCookieFingerprint(document.cookie)) clearFakeUid();
      return;
    }
    const fingerprint = loginCookieFingerprint(document.cookie);
    const authStorage = fingerprint ? getSessionStorage() : null;
    const authAction = fingerprint ? authStorage ? initialAuthAction(document.cookie, authStorage) : "skip" : "activate-guest";
    if (authAction === "skip") return;
    if (authAction === "verify") {
      if (window.top !== window.self || window.__BILIKIT_NO_LOGIN_AUTH_CHECK__) return;
      window.__BILIKIT_NO_LOGIN_AUTH_CHECK__ = true;
      const pureFetch2 = (_a = window.fetch) == null ? void 0 : _a.bind(window);
      if (!fingerprint || !authStorage || !pureFetch2) return;
      void verifyLogin(pureFetch2).then((status) => {
        if (loginCookieFingerprint(document.cookie) !== fingerprint) return;
        if (rememberVerifiedLogin(authStorage, fingerprint, status) !== "reload") return;
        try {
          location.reload();
        } catch {
        }
      });
      return;
    }
    if (needsRealLogin()) {
      clearFakeUid();
      return;
    }
    if (searchPage) {
      // 搜索结果只保留 B 站自身的接口地址修复；不伪造登录态、不改响应，
      // 也不安装免登录完整规则，避免干扰搜索结果和原生悬停预览。
      if (!fingerprint) clearFakeUid();
      return installSearchUrlFix();
    }
    window.__BILIKIT_NO_LOGIN__ = true;
    showGuestNotice();
    installLogoutIntercept();
    if (!/DedeUserID=/.test(document.cookie)) {
      try {
        document.cookie = `DedeUserID=${Math.floor(Math.random() * 2 ** 50)}; path=/; domain=.bilibili.com`;
      } catch {
      }
    }
    try {
      const st = document.createElement("style");
      st.textContent = ".van-message.van-message-error{display:none!important}";
      (document.head || document.documentElement).appendChild(st);
    } catch {
    }
    try {
      // 免登录模式仍隐藏 __playinfo__，但不能把下载工作台需要的当前 DASH
      // 响应一并丢掉。兼容 SSR 已存在和页面稍后赋值两种时序，只缓存到本页内存。
      let hiddenPlayinfo = null;
      try {
        hiddenPlayinfo = window.__playinfo__;
      } catch {
      }
      if (hiddenPlayinfo) cacheDownloadPlayinfo(hiddenPlayinfo, "no-login-global");
      Object.defineProperty(window, "__playinfo__", {
        configurable: true,
        get: () => null,
        set: (value) => {
          hiddenPlayinfo = value;
          cacheDownloadPlayinfo(value, "no-login-global");
        }
      });
    } catch {
    }
    try {
      const sc = document.createElement("script");
      sc.textContent = "const playurlSSRData = {}";
      (document.head || document.documentElement).appendChild(sc);
      sc.remove();
    } catch {
    }
    const pureFetch = window.fetch.bind(window);
    warmKeys(pureFetch);
    const MID = Math.floor(Math.random() * 1e15);
    const MOCK_USER = {
      isLogin: true,
      is_login: true,
      mid: MID,
      uname: "bilibili",
      face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
      email_verified: 1,
      mobile_verified: 1,
      money: 0,
      moral: 70,
      level_info: { current_level: 6, current_min: 28800, current_exp: 29050, next_exp: "--" },
      official: { role: 0, title: "", desc: "", type: -1 },
      officialVerify: { type: -1, desc: "" },
      vipStatus: 0,
      vipType: 0
    };
    const MOCK_MYINFO = {
      profile: {
        mid: MID,
        name: "bilibili",
        sex: "保密",
        face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
        sign: "",
        rank: 1e4,
        level: 6,
        jointime: 0,
        moral: 70,
        silence: 0,
        email_status: 0,
        tel_status: 1,
        identification: 0,
        vip: {
          type: 0,
          status: 0,
          due_date: 0,
          vip_pay_type: 0,
          theme_type: 0,
          label: { path: "", text: "", label_theme: "", text_color: "", bg_style: 0, bg_color: "", border_color: "", use_img_label: true, img_label_uri_hans: "", img_label_uri_hant: "", img_label_uri_hans_static: "", img_label_uri_hant_static: "", label_id: 0, label_goto: null },
          avatar_subscript: 0,
          nickname_color: "",
          role: 0,
          avatar_subscript_url: "",
          tv_vip_status: 0,
          tv_vip_pay_type: 0,
          tv_due_date: 0,
          avatar_icon: { icon_resource: {} },
          ott_info: { vip_type: 0, pay_type: 0, pay_channel_id: "", status: 0, overdue_time: 0 },
          super_vip: { is_super_vip: false }
        },
        pendant: { pid: 0, name: "", image: "", expire: 0, image_enhance: "", image_enhance_frame: "", n_pid: 0 },
        nameplate: { nid: 0, name: "", image: "", image_small: "", level: "", condition: "" },
        official: { role: 0, title: "", desc: "", type: -1 },
        birthday: 315504e3,
        is_tourist: 0,
        is_fake_account: 0,
        pin_prompting: 0,
        is_deleted: 0,
        in_reg_audit: 0,
        is_rip_user: false,
        profession: { id: 0, name: "", show_name: "", is_show: 0, category_one: "", realname: "", title: "", department: "", certificate_no: "", certificate_show: false },
        face_nft: 0,
        face_nft_new: 0,
        is_senior_member: 0,
        honours: { mid: MID, colour: { dark: "#CE8620", normal: "#F0900B" }, tags: null, is_latest_100honour: 0 },
        digital_id: "",
        digital_type: -2,
        attestation: { type: 0, common_info: { title: "", prefix: "", prefix_title: "" }, splice_info: { title: "" }, icon: "", desc: "" },
        expert_info: { title: "", state: 0, type: 0, desc: "" },
        name_render: null,
        country_code: "86",
        handle: ""
      },
      level_exp: { current_level: 6, current_min: 28800, current_exp: 29050, next_exp: "--" },
      coins: 0,
      following: 0,
      follower: 0
    };
    const rules = [
      // space/v2/myinfo：伪造成功响应压掉空间页「会话失效 → 自刷」路径（真登录成功不动）
      {
        match: (u) => u.includes("/x/space/v2/myinfo"),
        rewriteResponse: (j) => {
          var _a2;
          try {
            if ((j == null ? void 0 : j.code) === 0 && ((_a2 = j == null ? void 0 : j.data) == null ? void 0 : _a2.profile)) return j;
          } catch {
          }
          return { code: 0, message: "0", ttl: 1, data: MOCK_MYINFO };
        }
      },
      // nav：合并成「已登录」，保留 wbi_img 等原字段（→ 登录态 UI + 动态可见）
      {
        match: (u) => u.includes("/x/web-interface/nav"),
        rewriteResponse: (j) => {
          var _a2;
          try {
            if ((_a2 = j == null ? void 0 : j.data) == null ? void 0 : _a2.isLogin) return j;
            j.code = 0;
            j.message = "0";
            j.data = Object.assign({}, j.data, MOCK_USER);
          } catch {
          }
          return j;
        }
      },
      // reply：匿名请求（假 cookie 会被拒，去掉反而正常返公开评论）→ 视频/动态下方评论
      {
        match: (u) => u.includes("/x/v2/reply/wbi/main") || u.includes("/x/v2/reply/reply"),
        rewriteRequest: () => ({ credentials: "omit" })
      },
      // player/wbi/v2：改 login_mid / 等级 / 字幕字段 → 播放器 UI 认账（清晰度、字幕可选）
      {
        match: (u) => !searchPage && u.includes("/x/player/wbi/v2"),
        rewriteResponse: (j) => {
          try {
            const d = j == null ? void 0 : j.data;
            if (d) {
              d.login_mid = MID;
              d.need_login_subtitle = false;
              if (d.level_info) d.level_info.current_level = 6;
            }
          } catch {
          }
          return j;
        }
      },
      // relation：与 UP 的关注关系——假 cookie 下真接口返 -101 → 关注按钮/粉丝数报错、
      // 视频页红 toast 的源头之一。mock 成「无关注关系」（照抄 beefreely useRelation）。
      // 注意 match 写全 'web-interface/relation?'：别误吞 archive/relation（下一条单独管）。
      {
        match: (u) => u.includes("/x/web-interface/relation?"),
        rewriteResponse: (j) => {
          try {
            if ((j == null ? void 0 : j.code) === 0 && (j == null ? void 0 : j.data)) return j;
          } catch {
          }
          return { code: 0, message: "0", ttl: 1, data: {
            relation: { mid: 0, attribute: 0, mtime: 0, tag: null, special: 0 },
            be_relation: { mid: 0, attribute: 0, mtime: 0, tag: null, special: 0 }
          } };
        }
      },
      // archive/relation：与本视频的互动状态（点赞/投币/收藏）——同样返 -101 触发未登录提示。
      // mock 成「均未互动」（照抄 beefreely useArchiveRelation）。
      {
        match: (u) => u.includes("/x/web-interface/archive/relation"),
        rewriteResponse: (j) => {
          try {
            if ((j == null ? void 0 : j.code) === 0 && (j == null ? void 0 : j.data)) return j;
          } catch {
          }
          return { code: 0, message: "0", ttl: 1, data: {
            attention: false,
            favorite: false,
            season_fav: false,
            like: false,
            dislike: false,
            coin: 0
          } };
        }
      },
      // 搜索页热搜接口拼接损坏（B 站自身 bug，只在未登录时出现）：api.bilibili.comx/... 少了个 /
      // → 404、热搜/搜索结果拿不到。补上斜杠（照抄 beefreely useSearch）。
      {
        match: (u) => u.includes("/api.bilibili.comx/web-interface/search"),
        rewriteRequest: (u) => ({ url: u.replace(/\.com(?!\/)/, ".com/") })
      },
      // 番剧/PGC（ogv/player/playview）：把 user_status.is_login 掰成 true → 播放器不再弹
      // 「登录后观看」、清晰度不锁最低。PGC 无需重签 playurl，is_login 即全部机制（beefreely 同）。
      {
        match: (u) => !searchPage && u.includes("/ogv/player/playview"),
        rewriteResponse: (j) => {
          var _a2;
          try {
            if ((_a2 = j == null ? void 0 : j.data) == null ? void 0 : _a2.user_status) j.data.user_status.is_login = true;
          } catch {
          }
          return j;
        }
      },
      // playurl：塞 qn=80(1080p) + try_look=1(试看)、去掉旧签名重签 wbi → 1080p 取流。
      // iPad/移动 Safari 触发 B 站触屏判定 → 播放器发 platform=html5(MP4)，服务端对 html5 的免登录
      // 试看只给到 480p，qn=80 也被打回。故强行掰回桌面 DASH 路径：platform=pc + fnval=4048(全 DASH)
      // + fourk=1，让服务端按桌面策略放行 1080p 试看（桌面本就这套，零风险；iPad 靠 MSE 放 DASH）。
      {
        // 搜索页的 playurl 属于 B 站原生悬停预览：保持原请求参数，避免
        // 免登录模块把低清预览放大成 1080p/DASH。
        match: (u) => !searchPage && u.includes("/x/player/wbi/playurl"),
        // 捕获本页实际返回的轨道供下载工作台使用；不重写或延迟播放响应。
        onResponse: (payload, url) => cacheDownloadPlayinfo(payload, "no-login-hook", url),
        // 快路径：key 已缓存 → 同步签名，零延迟
        rewriteRequest: (u) => {
          try {
            const { base, params } = playurlParams(u);
            const signed = signQuery(params);
            if (!signed) return;
            return { url: `${base}?${signed}` };
          } catch {
            return;
          }
        },
        // 首次播放时 WBI 密钥可能尚未缓存；等待密钥可避免首个播放请求落到低清路径，
        // 超时则保留原请求。
        awaitRewrite: async (u) => {
          try {
            if (!await ensureKeys(pureFetch, 1500)) return;
            const { base, params } = playurlParams(u);
            const signed = signQuery(params);
            return signed ? { url: `${base}?${signed}` } : void 0;
          } catch {
            return;
          }
        }
      }
    ];
    return installNetHook(rules);
  }
  const NOTICE_KEY = "no-login.notified";
  const NOTICE_CSS = `
.bk-nl-toast{ position:fixed; left:50%; bottom:24px; transform:translateX(-50%) translateY(10px);
  z-index:2147483000; display:flex; align-items:center; gap:10px; max-width:min(94vw,540px);
  padding:11px 12px 11px 15px; border-radius:12px; background:rgba(22,23,28,.94); color:#e3e5e7;
  border:1px solid rgba(255,255,255,.1); box-shadow:0 8px 32px rgba(0,0,0,.42);
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
  font-family:-apple-system,"PingFang SC",sans-serif; font-size:13px; line-height:1.5;
  opacity:0; transition:opacity .28s ease, transform .28s ease; }
.bk-nl-toast.on{ opacity:1; transform:translateX(-50%) translateY(0); }
.bk-nl-toast .bk-nl-txt{ flex:1; min-width:0; }
.bk-nl-toast .bk-nl-txt b{ color:#fff; font-weight:600; }
.bk-nl-toast .bk-nl-sub{ color:rgba(255,255,255,.5); font-size:11px; margin-top:2px; }
.bk-nl-toast .bk-nl-btn{ flex:0 0 auto; height:30px; padding:0 13px; border-radius:8px; cursor:pointer; white-space:nowrap;
  font-size:12.5px; font-weight:500; font-family:inherit; transition:background .15s ease, border-color .15s ease; }
.bk-nl-toast .bk-nl-off{ border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:#e3e5e7; }
.bk-nl-toast .bk-nl-off:hover{ background:rgba(255,255,255,.13); }
.bk-nl-toast .bk-nl-login{ border:1px solid transparent; background:#fb7299; color:#fff; }
.bk-nl-toast .bk-nl-login:hover{ background:#fb8bab; }
.bk-nl-toast .bk-nl-x{ flex:0 0 auto; width:22px; height:22px; padding:0; border:none; background:none;
  color:rgba(255,255,255,.4); font-size:17px; line-height:1; cursor:pointer; transition:color .15s ease; }
.bk-nl-toast .bk-nl-x:hover{ color:rgba(255,255,255,.75); }`;
  function exitToLogin() {
    clearFakeUid();
    const login = "https://passport.bilibili.com/login?gourl=" + encodeURIComponent(location.href);
    try {
      (window.top || window).location.href = login;
    } catch {
      location.href = login;
    }
  }
  function disableNoLogin() {
    try {
      setModuleEnabled("no-login", false);
    } catch {
    }
    clearFakeUid();
    try {
      location.reload();
    } catch {
    }
  }
  function showGuestNotice() {
    if (window.top !== window.self) return;
    if (get(NOTICE_KEY, false)) return;
    const run = () => {
      var _a, _b, _c;
      if (!document.body) return;
      set(NOTICE_KEY, true);
      try {
        let dismiss = function() {
          if (fadeTimer) {
            clearTimeout(fadeTimer);
            fadeTimer = null;
          }
          box.classList.remove("on");
          setTimeout(() => {
            try {
              box.remove();
            } catch {
            }
          }, 320);
        };
        const style = document.createElement("style");
        style.textContent = NOTICE_CSS;
        (document.head || document.documentElement).appendChild(style);
        const box = document.createElement("div");
        box.className = "bk-nl-toast";
        box.innerHTML = '<div class="bk-nl-txt"><b>已开启免登录</b>——未登录也能看评论 / 1080p。<div class="bk-nl-sub">想用自己的账号点「我要登录」；不需要此功能点「关闭功能」。</div></div><button class="bk-nl-btn bk-nl-off" type="button">关闭功能</button><button class="bk-nl-btn bk-nl-login" type="button">我要登录</button><button class="bk-nl-x" type="button" aria-label="忽略">×</button>';
        document.body.appendChild(box);
        requestAnimationFrame(() => box.classList.add("on"));
        let fadeTimer = setTimeout(dismiss, 8e3);
        const stopFade = () => {
          if (fadeTimer) {
            clearTimeout(fadeTimer);
            fadeTimer = null;
          }
        };
        (_a = box.querySelector(".bk-nl-x")) == null ? void 0 : _a.addEventListener("click", dismiss);
        (_b = box.querySelector(".bk-nl-off")) == null ? void 0 : _b.addEventListener("click", () => {
          stopFade();
          disableNoLogin();
        });
        (_c = box.querySelector(".bk-nl-login")) == null ? void 0 : _c.addEventListener("click", () => {
          stopFade();
          exitToLogin();
        });
      } catch {
      }
    };
    if (document.body) run();
    else document.addEventListener("DOMContentLoaded", run, { once: true });
  }
  function isLogoutClick(start) {
    var _a;
    let el2 = start;
    for (let i = 0; el2 && i < 6; i++, el2 = el2.parentElement) {
      const cls = typeof el2.className === "string" ? el2.className : "";
      if (/(^|[\s_-])logout/i.test(cls)) return true;
      const href = (_a = el2.getAttribute) == null ? void 0 : _a.call(el2, "href");
      if (href && /login\/exit/i.test(href)) return true;
      const txt = (el2.textContent || "").trim();
      if (txt === "退出登录") return true;
    }
    return false;
  }
  function installLogoutIntercept() {
    if (window.__BILIKIT_NL_LOGOUT__) return;
    window.__BILIKIT_NL_LOGOUT__ = true;
    document.addEventListener("click", (e) => {
      try {
        if (!isLogoutClick(e.target)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        exitToLogin();
      } catch {
      }
    }, true);
  }
  const noLogin = {
    id: "no-login",
    name: "免登录",
    description: "未登录也能看评论 / 他人动态 / 1080p（装它即可替代 beefreely，避免脚本冲突）",
    note: "开启后未登录也能：看视频/动态下方<b>评论</b>、看他人<b>动态</b>、看 <b>1080p</b> 视频。装了它就能卸载 beefreely 等免登录脚本，避免多个脚本抢改请求导致的时好时坏。<br><b>取舍（务必知悉）</b>：① 纯<b>只读</b>——页面「以为」你已登录（显示假账号），但发评论/点赞/投币/收藏/历史同步等需真鉴权的操作都会失败；② <b>看不到评论 IP 属地</b>——评论走匿名请求，B 站服务端只对真登录返回属地字段，免登录下拿不到（「评论信息」里的性别仍可显示）；③ 1080p 上限为官方<b>试看</b>，4K/HDR/大会员专享清晰度仍拿不到；④ 仅<b>未登录</b>时生效，检测到已登录会自动让路、不干扰真账号。<br>若浏览器残留了服务端已失效的登录状态，会自动确认并<b>刷新一次</b>后恢复免登录，不会清除你的 Cookie。<br><b>默认开启</b>：只在未登录时激活（已登录零影响），首次激活会在底部弹一次可关闭的提示。这样无痕/未登录浏览打开即 1080p，无需每次手动开。<br><b>想真正登录</b>：直接点顶栏用户菜单里的「退出登录」即可——会跳到登录页，登录后自动回到当前页面；免登录本身<b>不会被关掉</b>，下次未登录时照常自动生效。",
    category: "增强",
    // 默认开：仅未登录时激活（真登录由 nav 确认后 return、零影响），首次激活弹一次性可关提示告知。
    // 目的：无痕模式存不住任何页面侧开关（localStorage/cookie 关窗即清、@grant none 无法用 GM 存储跨会话），
    // 唯一能让「无痕未登录时默认免登录」成立的就是把默认值设对；用一次性披露弹框换取透明、避免静默吓到人。
    defaultEnabled: true,
    runAt: "start",
    init: init$1
  };
  const DRAWER_HISTORY_KEY = "__bilikitDrawer";
  const DRAWER_ORIGIN_KEY = "__bilikitDrawerOrigin";
  const DRAWER_FRAME_PREFIX = "bilikit-drawer:";
  const DRAWER_DOCUMENT_NAV_KEY = "bilikit-drawer-document-navigation";
  const DRAWER_MARK = "#bk-drawer";
  const DRAWER_WEB_MARK = "#bk-drawer-web";
  function canReuseDrawerDocument(loaded, route) {
    return !!loaded.token && loaded.token === route.token && loaded.url === route.url && loaded.webFull === route.webFull;
  }
  function drawerFrameName(route) {
    return `${DRAWER_FRAME_PREFIX}${route.token}:${route.webFull ? "web" : "plain"}`;
  }
  function readDrawerFrameName(name) {
    if (!name.startsWith(DRAWER_FRAME_PREFIX)) return null;
    const rest = name.slice(DRAWER_FRAME_PREFIX.length);
    const split = rest.lastIndexOf(":");
    if (split <= 0) return null;
    const token = rest.slice(0, split);
    const mode = rest.slice(split + 1);
    if (!/^[0-9a-z-]{8,}$/i.test(token) || mode !== "web" && mode !== "plain") return null;
    return { token, webFull: mode === "web" };
  }
  function drawerMark(hash) {
    if (hash === DRAWER_MARK) return DRAWER_MARK;
    if (hash === DRAWER_WEB_MARK) return DRAWER_WEB_MARK;
    return null;
  }
  function safeDrawerVideoUrl(target, expectedOrigin) {
    try {
      const next = new URL(target);
      if (next.origin !== expectedOrigin || !/(^|\.)bilibili\.com$/i.test(next.hostname)) return null;
      if (!/^\/(?:video\/(?:BV[0-9A-Za-z]+|av\d+)|bangumi\/play\/(?:ep|ss)\d+|cheese\/play\/(?:ep|ss)\d+|list\/|festival\/)/i.test(next.pathname)) return null;
      if (drawerMark(next.hash)) next.hash = "";
      return next.href;
    } catch {
      return null;
    }
  }
  function drawerPlayableId(target, base = target) {
    var _a, _b, _c;
    try {
      const url = new URL(target, base);
      const path = url.pathname;
      const video = (_a = path.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)/i)) == null ? void 0 : _a[1];
      if (video) return `video:${video.toLowerCase()}`;
      const bangumi = (_b = path.match(/^\/bangumi\/play\/((?:ep|ss)\d+)/i)) == null ? void 0 : _b[1];
      if (bangumi) return `bangumi:${bangumi.toLowerCase()}`;
      const cheese = (_c = path.match(/^\/cheese\/play\/((?:ep|ss)\d+)/i)) == null ? void 0 : _c[1];
      if (cheese) return `cheese:${cheese.toLowerCase()}`;
      if (/^\/(?:list|festival)\//i.test(path)) {
        const bvid = url.searchParams.get("bvid");
        if (bvid && /^BV[0-9A-Za-z]+$/i.test(bvid)) return `video:${bvid.toLowerCase()}`;
        const aid = url.searchParams.get("aid") || url.searchParams.get("oid");
        if (aid && /^\d+$/.test(aid)) return `video:av${aid}`;
      }
      return null;
    } catch {
      return null;
    }
  }
  function shouldReplaceDrawerDocument(current, target, allowSeasonCanonicalization = false) {
    let currentUrl;
    let targetUrl;
    try {
      currentUrl = new URL(current);
      targetUrl = new URL(target, currentUrl);
    } catch {
      return false;
    }
    if (currentUrl.origin !== targetUrl.origin) return false;
    const from = drawerPlayableId(currentUrl.href);
    const to = drawerPlayableId(targetUrl.href);
    if (!from && !to) return false;
    if (!from || !to) return true;
    if (from === to) {
      if (from.startsWith("video:")) {
        const fromPart = currentUrl.searchParams.get("p") || "1";
        const toPart = targetUrl.searchParams.get("p") || "1";
        if (fromPart !== toPart) return true;
        const routeFamily = (url) => {
          if (/^\/video\//i.test(url.pathname)) return "video";
          if (/^\/list\//i.test(url.pathname)) return "list";
          if (/^\/festival\//i.test(url.pathname)) return "festival";
          return "other";
        };
        if (routeFamily(currentUrl) !== routeFamily(targetUrl)) return true;
      }
      return false;
    }
    if (allowSeasonCanonicalization) {
      const canonicalizedBangumi = from.startsWith("bangumi:ss") && to.startsWith("bangumi:ep");
      const canonicalizedCheese = from.startsWith("cheese:ss") && to.startsWith("cheese:ep");
      if (canonicalizedBangumi || canonicalizedCheese) return false;
    }
    return true;
  }
  function drawerDisplayUrl(target, currentHref) {
    try {
      const current = new URL(currentHref);
      const next = new URL(target, current);
      if (next.origin !== current.origin) return null;
      if (drawerMark(next.hash)) next.hash = "";
      return next.href;
    } catch {
      return null;
    }
  }
  function withDrawerRoute(state, route) {
    const base = state && typeof state === "object" && !Array.isArray(state) ? state : {};
    const out = { ...base, [DRAWER_HISTORY_KEY]: route };
    delete out[DRAWER_ORIGIN_KEY];
    return out;
  }
  function withDrawerOrigin(state, token) {
    const base = state && typeof state === "object" && !Array.isArray(state) ? state : {};
    const out = { ...base, [DRAWER_ORIGIN_KEY]: token };
    delete out[DRAWER_HISTORY_KEY];
    return out;
  }
  function readDrawerOrigin(state) {
    if (!state || typeof state !== "object") return null;
    const token = state[DRAWER_ORIGIN_KEY];
    return typeof token === "string" ? token : null;
  }
  function readDrawerRoute(state) {
    if (!state || typeof state !== "object") return null;
    const route = state[DRAWER_HISTORY_KEY];
    if (!route || typeof route !== "object") return null;
    const r = route;
    if (typeof r.token !== "string" || !r.token || typeof r.url !== "string" || typeof r.cover !== "string" || typeof r.webFull !== "boolean" || typeof r.immersive !== "boolean") return null;
    return r;
  }
  function isPlayPage(pathname = location.pathname) {
    return /^\/(video\/|bangumi\/play\/|cheese\/play\/|list\/|festival\/)/.test(pathname);
  }
  function isSearchPage(pathname = location.pathname, hostname = location.hostname) {
    return hostname === "search.bilibili.com" || hostname === "www.bilibili.com" && /^\/search(?:\/|$)/.test(pathname);
  }
  function isHomePage(pathname = location.pathname, hostname = location.hostname) {
    return (hostname === "www.bilibili.com" || hostname === "bilibili.com") && (pathname === "/" || pathname === "/index.html");
  }
  const TITLE_SUFFIX = /[_-](哔哩哔哩|bilibili|番剧|动画|电影|电视剧|纪录片|综艺|国创|在线观看|全集)([_-]?(哔哩哔哩|bilibili|番剧|动画|电影|电视剧|纪录片|综艺|国创|在线观看|全集))*$/i;
  function videoIdOf(href, base = "https://www.bilibili.com") {
    var _a, _b, _c, _d;
    try {
      const u = new URL(href, base);
      const p = u.pathname;
      return ((_b = (_a = p.match(/\/video\/(BV\w+|av\d+)/i)) == null ? void 0 : _a[1]) == null ? void 0 : _b.toLowerCase()) || ((_d = (_c = p.match(/\/(?:bangumi|cheese)\/play\/((ep|ss)\d+)/i)) == null ? void 0 : _c[1]) == null ? void 0 : _d.toLowerCase()) || (u.searchParams.get("bvid") || "").toLowerCase() || "";
    } catch {
      return "";
    }
  }
  function shouldFlattenVideoNavigation(current, target) {
    try {
      const fromUrl = new URL(current);
      const toUrl = new URL(target, fromUrl);
      if (fromUrl.origin !== toUrl.origin) return false;
      const from = videoIdOf(fromUrl.href, fromUrl.href);
      const to = videoIdOf(toUrl.href, fromUrl.href);
      return !!from && !!to && from !== to;
    } catch {
      return false;
    }
  }
  function cleanTitle(raw) {
    return (raw || "").replace(TITLE_SUFFIX, "").trim();
  }
  function dedupeArrival(stack, curId, base = "https://www.bilibili.com", backRestore = false) {
    if (!curId) return stack;
    let s = stack;
    if (backRestore) {
      let i = s.length - 1;
      while (i >= 0 && videoIdOf(s[i].url, base) !== curId) i--;
      if (i >= 0) s = s.slice(0, i + 1);
    }
    let n = s.length;
    while (n && videoIdOf(s[n - 1].url, base) === curId) n--;
    return n !== s.length ? s.slice(0, n) : s;
  }
  const STACK_KEY = WAYBACK_STACK_KEY;
  const STACK_MAX = 20;
  const NS$1 = "bwb";
  function init(cfg) {
    if (!isPlayPage()) return;
    if (window.top !== window.self && !location.hash.includes("bk-drawer")) return;
    if (window.__BILIKIT_WAY_BACK__) return;
    window.__BILIKIT_WAY_BACK__ = true;
    const runtime = getRuntimeCoordinator();
    const resumeTime = cfg.get("resumeTime") !== false;
    const inDrawer2 = window.top !== window.self;
    const drawerMark2 = (location.hash.match(/#bk-drawer(?:-web)?/) || [""])[0] || (inDrawer2 ? "#bk-drawer" : "");
    const JUMP_FLAG = "bilikit-wb-jump";
    if (inDrawer2) {
      try {
        const continuedUrl = sessionStorage.getItem(DRAWER_DOCUMENT_NAV_KEY) || "";
        sessionStorage.removeItem(DRAWER_DOCUMENT_NAV_KEY);
        const continued = !!continuedUrl && videoIdOf(continuedUrl, location.href) === videoIdOf(location.href, location.href);
        if (sessionStorage.getItem(JUMP_FLAG)) sessionStorage.removeItem(JUMP_FLAG);
        else if (!continued) sessionStorage.removeItem(STACK_KEY);
      } catch {
      }
    }
    const videoIdOf$1 = (href) => videoIdOf(href, location.href);
    const readStack = () => {
      try {
        const a = JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
        return Array.isArray(a) ? a : [];
      } catch {
        return [];
      }
    };
    const writeStack = (s) => {
      try {
        sessionStorage.setItem(STACK_KEY, JSON.stringify(s.slice(-STACK_MAX)));
      } catch {
      }
    };
    const titleById = /* @__PURE__ */ new Map();
    const noteTitle = () => {
      const id = videoIdOf$1(location.href), t = cleanTitle(document.title);
      if (!id || !t) return;
      titleById.delete(id);
      titleById.set(id, t);
      while (titleById.size > STACK_MAX * 2) titleById.delete(titleById.keys().next().value);
    };
    let titleEl = null;
    const titleMo = new MutationObserver(() => {
      if (titleEl && !titleEl.isConnected) {
        titleEl = null;
        titleMo.disconnect();
        watchTitle();
      }
      noteTitle();
      updateNowRow();
    });
    function watchTitle() {
      const el2 = document.querySelector("title");
      if (el2 && el2 !== titleEl) {
        titleMo.disconnect();
        titleEl = el2;
        titleMo.observe(el2, { childList: true, characterData: true, subtree: true });
        noteTitle();
      }
    }
    watchTitle();
    const onDomReady = () => watchTitle();
    document.addEventListener("DOMContentLoaded", onDomReady);
    let playerVideo = null;
    const getVideo = () => playerVideo && playerVideo.isConnected ? playerVideo : document.querySelector("video");
    const currentVideoTime = () => {
      const v = getVideo();
      return v && Number.isFinite(v.currentTime) ? v.currentTime : 0;
    };
    let lastPlayedT = 0;
    let lastTU = 0;
    const onTimeUpdate = (e) => {
      const now = performance.now();
      if (now - lastTU < 1e3) return;
      lastTU = now;
      const v = e.target;
      if (!(v && v.tagName === "VIDEO" && Number.isFinite(v.currentTime))) return;
      const inPlayer = !!v.closest("#bilibili-player, .bpx-player-container");
      if (inPlayer) playerVideo = v;
      if ((inPlayer || !playerVideo) && v.currentTime > 0) lastPlayedT = v.currentTime;
    };
    document.addEventListener("timeupdate", onTimeUpdate, true);
    const departureTime = () => {
      const t = currentVideoTime();
      return t > 0 ? t : lastPlayedT;
    };
    function recordEntry(prevHref, prevTitle, t, rerender = true) {
      const id = videoIdOf$1(prevHref);
      if (!id) return;
      const stack = readStack();
      if (stack.length && videoIdOf$1(stack[stack.length - 1].url) === id) return;
      stack.push({ url: prevHref, title: titleById.get(id) || cleanTitle(prevTitle) || id, t: resumeTime && t > 0 ? Math.floor(t) : 0 });
      const trimmed = stack.length > STACK_MAX ? stack.slice(-STACK_MAX) : stack;
      writeStack(trimmed);
      if (rerender) renderChip(trimmed);
    }
    const removeHistoryHook = runtime.networkHooks().addHistory("way-back", "pushState", (next) => function(...args) {
      try {
        const url = args[2];
        if (url != null) {
          const prevId = videoIdOf$1(location.href);
          const curId = videoIdOf$1(new URL(url, location.href).href);
          if (prevId && curId && prevId !== curId) {
            if (!(prevId.startsWith("ss") && curId.startsWith("ep"))) {
              recordEntry(location.href, document.title, departureTime());
              lastPlayedT = 0;
            }
          }
        }
        watchTitle();
      } catch {
      }
      return next.apply(this, args);
    });
    let leavingViaJump = false;
    const onPageHide = () => {
      if (leavingViaJump) return;
      recordEntry(location.href, document.title, departureTime(), false);
    };
    window.addEventListener("pagehide", onPageHide);
    function jumpTo(i) {
      const stack = readStack();
      if (i < 0) i = stack.length - 1;
      const entry = stack[i];
      if (!entry) return;
      writeStack(stack.slice(0, i));
      leavingViaJump = true;
      let href = entry.url;
      try {
        const u = new URL(entry.url, location.href);
        if (entry.t > 5) u.searchParams.set("t", String(entry.t));
        href = u.href;
      } catch {
      }
      if (drawerMark2) {
        if (!href.includes("#")) href += drawerMark2;
        try {
          sessionStorage.setItem(JUMP_FLAG, "1");
        } catch {
        }
      }
      location.replace(href);
    }
    const jumpToUrl = (url) => {
      const s = readStack();
      for (let i = s.length - 1; i >= 0; i--) if (s[i].url === url) return jumpTo(i);
    };
    function dedupeOnArrival(backRestore = false) {
      const curId = videoIdOf$1(location.href);
      if (!curId) return;
      const stack = readStack();
      const out = dedupeArrival(stack, curId, location.href, backRestore);
      if (out.length !== stack.length) writeStack(out);
    }
    const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10H11"/></svg>';
    const CSS2 = `
.${NS$1}-root{ position:fixed; left:16px; bottom:24px; z-index:99990; font-family:-apple-system,"PingFang SC",sans-serif; }
.${NS$1}-chip{ display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 13px; border-radius:18px; cursor:pointer;
  background:rgba(22,23,28,.9); border:1px solid rgba(255,255,255,.1); color:#e3e5e7; box-shadow:0 3px 14px rgba(0,0,0,.3);
  font-size:13px; font-weight:500; opacity:.5; transition:opacity .18s ease, transform .16s ease;
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }
.${NS$1}-root:hover .${NS$1}-chip{ opacity:1; }
.${NS$1}-chip:active{ transform:scale(.96); }
.${NS$1}-chip svg{ width:16px; height:16px; color:#fb7299; }
.${NS$1}-empty .${NS$1}-chip{ opacity:.32; cursor:default; }
.${NS$1}-empty .${NS$1}-chip svg{ color:rgba(255,255,255,.5); }
.${NS$1}-list{ position:absolute; left:0; bottom:calc(100% + 8px); width:290px;
  background:#1c1d22; border:1px solid rgba(255,255,255,.08); border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.5);
  opacity:0; visibility:hidden; transform:translateY(6px); pointer-events:none;
  /* 离开延迟 .15s 再淡出：给指针跨间隙迁移留宽限，不丢 hover */
  transition:opacity .16s ease .15s, transform .16s ease .15s, visibility 0s linear .31s; }
.${NS$1}-root:hover .${NS$1}-list{ opacity:1; visibility:visible; transform:none; pointer-events:auto; transition-delay:0s; }
/* 滚动收在内层，卡片自身不裁剪 → ::after 悬停桥才能伸出盒外（放 .list 上会被 overflow 裁掉=没有桥） */
.${NS$1}-scroll{ overflow:hidden auto; max-height:60vh; min-height:0; border-radius:12px; }
/* 胶囊与列表间隙的悬停桥：从卡片盒外伸出、指针穿过间隙仍算在列表上，hover 不断链 */
.${NS$1}-list::after{ content:''; position:absolute; top:100%; left:0; right:0; height:12px; }
.${NS$1}-head{ font-size:11px; color:rgba(255,255,255,.35); padding:9px 12px 5px; }
.${NS$1}-item{ display:flex; align-items:center; gap:9px; padding:8px 12px; cursor:pointer; }
.${NS$1}-item:hover{ background:rgba(251,114,153,.16); }
.${NS$1}-item:hover .${NS$1}-num{ background:#fb7299; color:#fff; }
.${NS$1}-item:hover .${NS$1}-title{ color:#fb7299; }
.${NS$1}-num{ flex:0 0 auto; width:19px; height:19px; border-radius:50%; background:rgba(255,255,255,.08); color:rgba(255,255,255,.55);
  font-size:11px; display:flex; align-items:center; justify-content:center; transition:background .14s ease, color .14s ease; }
.${NS$1}-title{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; color:rgba(255,255,255,.82); }
.${NS$1}-time{ flex:0 0 auto; font-size:11px; color:rgba(255,255,255,.4); font-variant-numeric:tabular-nums; }
/* 「正在播放」行（序号 0）：不可点、带动画声波条 */
.${NS$1}-now{ cursor:default; border-top:1px solid rgba(255,255,255,.06); }
.${NS$1}-now:hover{ background:none; }
.${NS$1}-now .${NS$1}-num{ background:rgba(255,255,255,.06); }
.${NS$1}-now:hover .${NS$1}-title{ color:rgba(255,255,255,.4); }
.${NS$1}-now .${NS$1}-title{ color:rgba(255,255,255,.4); }
.${NS$1}-bars{ flex:0 0 auto; display:flex; align-items:flex-end; gap:2px; height:12px; }
.${NS$1}-bars i{ width:2.5px; height:12px; background:#fb7299; border-radius:1px; transform-origin:bottom; transform:scaleY(.33); }
/* 只在面板展开(hover)时才跑动画——收起时(99% 时间)零成本；用 transform:scaleY 代替 height 动画，
   走合成层、不触发每帧布局（原 height 动画是发热主因之一）。 */
.${NS$1}-root:hover .${NS$1}-playing .${NS$1}-bars i{ animation:${NS$1}-eq .9s ease-in-out infinite; }
.${NS$1}-playing .${NS$1}-bars i:nth-child(2){ animation-delay:.3s; }
.${NS$1}-playing .${NS$1}-bars i:nth-child(3){ animation-delay:.6s; }
@keyframes ${NS$1}-eq{ 0%,100%{ transform:scaleY(.33); } 50%{ transform:scaleY(1); } }
@media (prefers-color-scheme: light){
  .${NS$1}-chip{ background:rgba(255,255,255,.95); border-color:rgba(0,0,0,.08); color:#18191c; box-shadow:0 3px 14px rgba(0,0,0,.14); }
  .${NS$1}-empty .${NS$1}-chip svg{ color:rgba(0,0,0,.35); }
  .${NS$1}-list{ background:#fff; border-color:rgba(0,0,0,.08); box-shadow:0 12px 40px rgba(0,0,0,.18); }
  .${NS$1}-head{ color:rgba(0,0,0,.4); }
  .${NS$1}-num{ background:rgba(0,0,0,.06); color:rgba(0,0,0,.5); }
  .${NS$1}-title{ color:rgba(0,0,0,.85); }
  .${NS$1}-time{ color:rgba(0,0,0,.4); }
  .${NS$1}-now{ border-top-color:rgba(0,0,0,.06); }
  .${NS$1}-now .${NS$1}-title, .${NS$1}-now:hover .${NS$1}-title{ color:rgba(0,0,0,.4); }
  .${NS$1}-now .${NS$1}-num{ background:rgba(0,0,0,.05); }
}
`;
    let root2 = null;
    let listEl = null;
    let countEl = null;
    let nowRow = null;
    let nowTitleEl = null;
    const fmtTime = (t) => {
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      return `${m}:${s < 10 ? "0" : ""}${s}`;
    };
    function ensureChip() {
      if (root2 || !document.body) return;
      const style = document.createElement("style");
      style.textContent = CSS2;
      root2 = document.createElement("div");
      root2.className = `${NS$1}-root`;
      const list = document.createElement("div");
      list.className = `${NS$1}-list`;
      const scroll = document.createElement("div");
      scroll.className = `${NS$1}-scroll`;
      list.appendChild(scroll);
      listEl = scroll;
      const chip = document.createElement("div");
      chip.className = `${NS$1}-chip`;
      chip.title = "回退上一个视频（悬停看来时路）";
      chip.innerHTML = `${BACK_SVG}<span class="${NS$1}-count">0</span>`;
      countEl = chip.querySelector(`.${NS$1}-count`);
      chip.addEventListener("click", () => {
        if (readStack().length) jumpTo(-1);
      });
      root2.append(style, list, chip);
      root2.addEventListener("mouseleave", () => {
        if (rebuildHeldByHover) rebuildList();
      });
      document.body.appendChild(root2);
    }
    function updateNowRow() {
      if (!nowRow || !nowTitleEl) return;
      nowTitleEl.textContent = titleById.get(videoIdOf$1(location.href)) || cleanTitle(document.title) || "正在播放";
      const v = getVideo();
      nowRow.classList.toggle(`${NS$1}-playing`, !!v && !v.paused);
    }
    let rebuildQueued = false;
    let rebuildHeldByHover = false;
    function renderChip(known) {
      if (!document.body) return;
      ensureChip();
      if (!root2) return;
      const stack = known || readStack();
      root2.classList.toggle(`${NS$1}-empty`, !stack.length);
      if (countEl) countEl.textContent = String(stack.length);
      if (!rebuildQueued) {
        rebuildQueued = true;
        queueMicrotask(rebuildList);
      }
    }
    function rebuildList() {
      rebuildQueued = false;
      if (!listEl || !root2) return;
      if (root2.matches(":hover")) {
        rebuildHeldByHover = true;
        return;
      }
      rebuildHeldByHover = false;
      const stack = readStack();
      listEl.textContent = "";
      const head = document.createElement("div");
      head.className = `${NS$1}-head`;
      head.textContent = stack.length ? `来时路 · ${stack.length} 层` : "还没有来时路 · 当前是起点";
      listEl.appendChild(head);
      stack.forEach((entry, i) => {
        const item = document.createElement("div");
        item.className = `${NS$1}-item`;
        item.title = entry.title;
        const num2 = document.createElement("span");
        num2.className = `${NS$1}-num`;
        num2.textContent = String(stack.length - i);
        const title = document.createElement("span");
        title.className = `${NS$1}-title`;
        title.textContent = entry.title;
        item.append(num2, title);
        if (entry.t > 5) {
          const tm = document.createElement("span");
          tm.className = `${NS$1}-time`;
          tm.textContent = fmtTime(entry.t);
          item.appendChild(tm);
        }
        item.addEventListener("click", () => jumpToUrl(entry.url));
        listEl.appendChild(item);
      });
      nowRow = document.createElement("div");
      nowRow.className = `${NS$1}-item ${NS$1}-now`;
      const num = document.createElement("span");
      num.className = `${NS$1}-num`;
      num.textContent = "0";
      nowTitleEl = document.createElement("span");
      nowTitleEl.className = `${NS$1}-title`;
      const bars = document.createElement("span");
      bars.className = `${NS$1}-bars`;
      bars.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      nowRow.append(num, nowTitleEl, bars);
      listEl.appendChild(nowRow);
      updateNowRow();
      listEl.scrollTop = listEl.scrollHeight;
    }
    document.addEventListener("play", updateNowRow, true);
    document.addEventListener("pause", updateNowRow, true);
    function onReady(backRestore = false) {
      dedupeOnArrival(backRestore);
      renderChip();
    }
    const onInitialReady = () => onReady();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onInitialReady, { once: true });
    else onReady();
    const onPageShow = (e) => {
      if (!e.persisted) return;
      leavingViaJump = false;
      onReady(true);
    };
    window.addEventListener("pageshow", onPageShow);
    let untrackCleanup = () => {};
    const dispose = () => {
      removeHistoryHook();
      document.removeEventListener("DOMContentLoaded", onDomReady);
      document.removeEventListener("DOMContentLoaded", onInitialReady);
      document.removeEventListener("timeupdate", onTimeUpdate, true);
      document.removeEventListener("play", updateNowRow, true);
      document.removeEventListener("pause", updateNowRow, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      titleMo.disconnect();
      root2?.remove();
      root2 = null;
      if (window.__BILIKIT_WAY_BACK__) delete window.__BILIKIT_WAY_BACK__;
      untrackCleanup();
    };
    untrackCleanup = runtime.addCleanup(dispose);
    return dispose;
  }
  /*
   * 收藏夹修复是独立实现，只使用 B 站收藏夹公开元数据接口和当前页面 DOM。
   * 目标仓库为 GPL-3.0，本模块没有复制其源码、依赖或第三方缓存实现；缓存只保存
   * 当前用户本地已经读取到的公开元数据，不保存 Cookie、签名地址或媒体地址。
   */
  const FAVORITES_FIX_CACHE_KEY = "bilikit:favorites-fix:v1";
  const FAVORITES_FIX_CACHE_LIMIT = 240;
  const FAVORITES_FIX_STYLE_ID = "bilikit-favorites-fix-style";
  const FAVORITES_FIX_HOVER_PANEL_ID = "bilikit-favfix-hover-panel";
  const FAVORITES_FIX_GENERIC_TITLE_RE = /^(?:已失效视频|视频去哪了呢？|该视频或许已被删除了|该视频或许已经被删除了|视频去哪了|)$/i;
  const FAVORITES_FIX_LOADING_TITLE_RE = /^(?:正在加载数据(?:\.\.\.|…)?|加载中(?:\.\.\.|…)?|正在查询(?:\.\.\.|…)?|查询中(?:\.\.\.|…)?)$/i;
  const FAVORITES_FIX_PLACEHOLDER_COVER_RE = /\/bfs\/archive\/(?:be27fd62c99036dce67efface486fb0a88ffed06|404|error)[^/]*\.(?:jpg|jpeg|png|webp)/i;
  const FAVORITES_FIX_EXTERNAL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  // BiliPlus 批量接口是主来源；Jijidown 只并发补查主来源缺失的字段，并限制并发数。
  const FAVORITES_FIX_EXTERNAL_CONCURRENCY = 3;
  const FAVORITES_FIX_TID_NAMES = Object.freeze({
    1: "动画",
    3: "音乐",
    4: "游戏",
    5: "资讯",
    11: "电视剧",
    13: "番剧",
    23: "电影",
    27: "综合",
    36: "知识",
    119: "娱乐",
    129: "舞蹈",
    155: "时尚",
    160: "生活",
    167: "国创",
    177: "纪录片",
    181: "影视",
    188: "科技"
  });
  const FAVORITES_FIX_HOVER_STATE = { panel: null, anchor: null, media: null, hideTimer: 0 };
  const FAVORITES_FIX_STATS = {
    version: VERSION,
    enabled: false,
    page: "",
    source: "",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    cardCount: 0,
    apiCount: 0,
    restoredCount: 0,
    updatedCount: 0,
    cachedCount: 0,
    externalRequestCount: 0,
    externalHitCount: 0,
    externalMissCount: 0,
    externalSource: "",
    targetCount: 0,
    titleRecoveredCount: 0,
    coverRecoveredCount: 0,
    unresolvedCount: 0,
    tooltipCount: 0,
    lastFailure: "",
    lastError: "",
    lastAt: 0
  };
  try {
    window.__BILIKIT_FAVORITES_FIX_STATS__ = FAVORITES_FIX_STATS;
  } catch {
  }
  function isFavoritesFixPage(pathname = location.pathname, hostname = location.hostname) {
    return hostname === "space.bilibili.com" && /^\/\d+\/favlist(?:\/|$)/i.test(pathname);
  }
  function parseFavoritesFixUrl(value = location.href) {
    try {
      const url = new URL(value, location.href);
      const midMatch = url.pathname.match(/^\/(\d+)\/favlist(?:\/|$)/i);
      const params = url.searchParams;
      const page = Math.max(1, Number(params.get("pn") || params.get("page") || 1) || 1);
      const fidValue = params.get("fid");
      return {
        supported: !!midMatch,
        mid: midMatch ? midMatch[1] : "",
        fid: /^\d+$/.test(fidValue || "") ? fidValue : "",
        page,
        keyword: params.get("keyword") || params.get("search") || "",
        order: params.get("order") || "mtime",
        type: params.get("type") || "0",
        tid: params.get("tid") || "0",
        routeKey: `${url.origin}${url.pathname}?${url.searchParams.toString()}`
      };
    } catch {
      return { supported: false, mid: "", fid: "", page: 1, keyword: "", order: "mtime", type: "0", tid: "0", routeKey: "" };
    }
  }
  function favoritesFixNormalizeId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/(?:^|\/)(BV[0-9A-Za-z]+|av\d+)(?:[/?#]|$)/i) || raw.match(/^(BV[0-9A-Za-z]+|av\d+)$/i);
    if (!match) return "";
    const id = match[1];
    return /^av/i.test(id) ? `av${id.slice(2)}` : id;
  }
  function favoritesFixKey(value) {
    const id = typeof value === "object" ? (value.bvid || value.bv_id || value.videoId || value.aid || value.id) : value;
    return favoritesFixNormalizeId(id).toLowerCase() || (id ? `av${String(id).replace(/^av/i, "")}` : "");
  }
  function favoritesFixUniqueIds(values) {
    const output = [];
    const seen = new Set();
    for (const value of values) {
      const id = favoritesFixNormalizeId(value);
      if (!id) continue;
      const key = id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(id);
    }
    return output;
  }
  function favoritesFixCardIdentityKeys(card) {
    if (!card) return [];
    const nodes = [card, ...(card.querySelectorAll?.("[data-bvid], [data-bv-id], [bvid], [bv_id], [data-aid], [data-avid], [aid], [avid], [data-id], [data-video-id], [data-videoid], [data-resource-id]") || [])];
    const read = (attributes, numeric = false) => nodes.flatMap((node) => attributes.flatMap((attribute) => {
      const datasetKey = attribute.startsWith("data-") ? attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : "";
      const value = node?.getAttribute?.(attribute) ?? node?.dataset?.[datasetKey] ?? node?.[attribute] ?? "";
      if (!value) return [];
      const normalized = favoritesFixNormalizeId(value);
      if (normalized) return [normalized];
      return numeric && /^\d+$/.test(String(value).trim()) ? [`av${String(value).trim()}`] : [];
    }));
    const videoIds = read(["data-bvid", "data-bv-id", "bvid", "bv_id", "video_id", "data-video-id", "data-videoid"]);
    const audioVideoIds = read(["data-aid", "data-avid", "aid", "avid", "data-av"], true);
    const linkIds = [...(card.querySelectorAll?.("a[href]") || [])].flatMap((link) => [favoritesFixNormalizeId(link.getAttribute("href") || "")]);
    const numericIds = read(["data-id", "data-video-id", "data-videoid", "data-resource-id"], true);
    return favoritesFixUniqueIds([...videoIds, ...audioVideoIds, ...linkIds, ...numericIds]);
  }
  function favoritesFixMediaIdentityKeys(media) {
    if (!media) return [];
    const ids = [];
    if (media.bvid) ids.push(media.bvid);
    if (media.aid) ids.push(`av${String(media.aid).replace(/^av/i, "")}`);
    if (media.id) ids.push(media.id);
    return favoritesFixUniqueIds(ids);
  }
  function favoritesFixFindMediaForCard(card, byKey) {
    if (!byKey?.get) return null;
    for (const id of favoritesFixCardIdentityKeys(card)) {
      const media = byKey.get(id.toLowerCase());
      if (media) return media;
    }
    return null;
  }
  function favoritesFixSetMediaIndex(index, media) {
    for (const id of favoritesFixMediaIdentityKeys(media)) index.set(id.toLowerCase(), media);
    return index;
  }
  function favoritesFixCategoryName(tid) {
    const value = Number(tid);
    return Number.isFinite(value) && value > 0 ? FAVORITES_FIX_TID_NAMES[value] || "" : "";
  }
  function favoritesFixString(value, max = 4000) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
  }
  function favoritesFixIsGenericTitle(value) {
    return FAVORITES_FIX_GENERIC_TITLE_RE.test(favoritesFixString(value, 300));
  }
  function favoritesFixIsLoadingTitle(value) {
    return FAVORITES_FIX_LOADING_TITLE_RE.test(favoritesFixString(value, 300));
  }
  function favoritesFixIsUnusableTitle(value) {
    return favoritesFixIsGenericTitle(value) || favoritesFixIsLoadingTitle(value);
  }
  function favoritesFixCardTitleElements(card) {
    if (!card?.querySelectorAll) return [];
    const elements = [];
    const seen = new Set();
    for (const selector of [
      ".bili-video-card__title a",
      ".bili-video-card__title",
      ".bili-video-card__title *",
      "a.title",
      ".title",
      ".title *"
    ]) {
      for (const element of card.querySelectorAll(selector)) {
        if (!element || seen.has(element)) continue;
        seen.add(element);
        elements.push(element);
      }
    }
    return elements;
  }
  function favoritesFixClearLoadingLabels(card, fallbackTitle = "已失效视频") {
    if (!card?.querySelectorAll) return false;
    const replacement = favoritesFixString(fallbackTitle, 800) || "已失效视频";
    let changed = false;
    const elements = [];
    const seen = new Set();
    for (const element of [
      ...favoritesFixCardTitleElements(card),
      ...card.querySelectorAll(".bili-video-card__details, .bili-video-card__details *")
    ]) {
      if (!element || seen.has(element)) continue;
      seen.add(element);
      elements.push(element);
    }
    for (const element of elements) {
      if (!element || element.children?.length || element.closest?.(".bk-favfix-menu, script, style")) continue;
      if (!favoritesFixIsLoadingTitle(element.textContent)) continue;
      if (String(element.textContent).trim() === replacement) continue;
      element.textContent = replacement;
      changed = true;
    }
    if (typeof document !== "undefined" && typeof document.createTreeWalker === "function" && card.nodeType) {
      const roots = [...card.querySelectorAll(".bili-video-card__title, .title, .bili-video-card__details")];
      for (const root of roots) {
        const walker = document.createTreeWalker(root, 4);
        let node = walker.nextNode();
        while (node) {
          const parent = node.parentElement;
          if (!parent?.closest?.(".bk-favfix-menu, script, style") && favoritesFixIsLoadingTitle(node.nodeValue)) {
            node.nodeValue = String(node.nodeValue).replace(node.nodeValue.trim(), replacement);
            changed = true;
          }
          node = walker.nextNode();
        }
      }
    }
    return changed;
  }
  function favoritesFixNormalizeCover(value) {
    const raw = favoritesFixString(value, 1200);
    if (!raw) return "";
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href;
    } catch {
      return "";
    }
  }
  function favoritesFixIsPlaceholderCover(value) {
    return FAVORITES_FIX_PLACEHOLDER_COVER_RE.test(String(value || ""));
  }
  function favoritesFixNormalizeExternalCover(value) {
    const cover = favoritesFixNormalizeCover(value);
    if (!cover) return "";
    try {
      const url = new URL(cover);
      if (url.protocol === "http:") url.protocol = "https:";
      return url.href;
    } catch {
      return "";
    }
  }
  function favoritesFixNormalizeExternalState(value) {
    if (!value || typeof value !== "object") return null;
    const status = value.status === "hit" || value.status === "miss" ? value.status : "";
    const checkedAt = Number(value.checkedAt) || 0;
    if (!status || !checkedAt) return null;
    return {
      status,
      source: favoritesFixString(value.source, 80),
      checkedAt
    };
  }
  function favoritesFixExternalCheckFresh(value, now = Date.now()) {
    const state = favoritesFixNormalizeExternalState(value);
    return !!state && now - state.checkedAt >= 0 && now - state.checkedAt < FAVORITES_FIX_EXTERNAL_CACHE_TTL;
  }
  function favoritesFixCachedExternalUseful(record) {
    if (!record || typeof record !== "object") return false;
    const title = favoritesFixString(record.title, 800);
    const cover = favoritesFixNormalizeCover(record.cover);
    return !favoritesFixIsUnusableTitle(title) || !!(cover && !favoritesFixIsPlaceholderCover(cover));
  }
  function favoritesFixNeedsExternal(media) {
    return favoritesFixIsUnusableTitle(media?.title) || !media?.cover || favoritesFixIsPlaceholderCover(media?.cover);
  }
  function favoritesFixNormalizeExternalMetadata(source, raw) {
    const item = raw && typeof raw === "object" ? raw : {};
    const title = favoritesFixString(item.title || item.name, 800);
    const cover = favoritesFixNormalizeExternalCover(item.cover || item.pic || item.image || item.img);
    const intro = favoritesFixString(item.intro || item.desc || item.description, 1800);
    const upper = item.upper && typeof item.upper === "object" ? item.upper : item.up && typeof item.up === "object" ? item.up : {};
    const normalizedTitle = !favoritesFixIsUnusableTitle(title) ? title : "";
    const normalizedCover = cover && !favoritesFixIsPlaceholderCover(cover) ? cover : "";
    return {
      source,
      title: normalizedTitle,
      cover: normalizedCover,
      intro,
      upper: {
        mid: String(item.mid || item.upid || upper.mid || upper.id || ""),
        name: favoritesFixString(item.author || item.up_name || upper.name || upper.author, 120)
      },
      valid: !!(normalizedTitle || normalizedCover)
    };
  }
  function favoritesFixParseExternalPayload(source, payload) {
    if (source === "biliplus") {
      if (!payload || Number(payload.code) !== 0 || !payload.data || typeof payload.data !== "object") return null;
      const data = payload.data;
      const first = data.title || data.pic ? data : data[Object.keys(data)[0]];
      return first && typeof first === "object" ? favoritesFixNormalizeExternalMetadata(source, first) : null;
    }
    if (source === "jijidown") {
      if (!payload || Number(payload.code) < 0 || payload.res && typeof payload.res !== "object" && !payload.title) return null;
      const item = payload.res && typeof payload.res === "object" ? payload.res : payload;
      return favoritesFixNormalizeExternalMetadata(source, item);
    }
    return null;
  }
  function favoritesFixDuration(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
  }
  function favoritesFixMetric(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  function favoritesFixPickMetric(primary, fallback) {
    return primary !== null && primary !== undefined ? primary : fallback !== null && fallback !== undefined ? fallback : null;
  }
  function favoritesFixCachedMetric(value) {
    const metric = favoritesFixMetric(value);
    // 早期版本把接口缺失的统计保存成 0；旧 0 不能覆盖本次接口返回的真实资料。
    return metric === 0 ? null : metric;
  }
  function favoritesFixFormatDuration(value) {
    const seconds = favoritesFixDuration(value);
    if (!seconds) return "时长未知";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  function favoritesFixNormalizePages(value) {
    if (!Array.isArray(value)) return [];
    return value.map((page, index) => {
      const item = page && typeof page === "object" ? page : {};
      return {
        page: Math.max(1, Number(item.page) || index + 1),
        title: favoritesFixString(item.title || item.part, 500),
        duration: favoritesFixDuration(item.duration),
        cid: String(item.cid || item.id || "")
      };
    }).filter((page) => page.title || page.duration || page.cid);
  }
  function favoritesFixNormalizeAid(value) {
    const raw = String(value == null ? "" : value).trim();
    return /^(?:av)?\d+$/i.test(raw) ? raw.replace(/^av/i, "") : "";
  }
  function favoritesFixNormalizeMedia(raw, index = 0) {
    const item = raw && typeof raw === "object" ? raw : {};
    const bvid = favoritesFixString(item.bvid || item.bv_id || item.video_id, 80).match(/BV[0-9A-Za-z]+/i)?.[0] || "";
    const aid = favoritesFixNormalizeAid(item.aid ?? item.avid ?? item.id);
    const upper = item.upper && typeof item.upper === "object" ? item.upper : {};
    const count = item.cnt_info && typeof item.cnt_info === "object" ? item.cnt_info : {};
    const attr = Number(item.attr);
    return {
      id: item.id || aid,
      aid,
      bvid,
      title: favoritesFixString(item.title, 800),
      cover: favoritesFixNormalizeCover(item.cover || item.pic),
      intro: favoritesFixString(item.intro || item.desc, 1800),
      duration: favoritesFixDuration(item.duration),
      page: Math.max(1, Number(item.page) || index + 1),
      pages: favoritesFixNormalizePages(item.pages || item.page_list),
      tid: Number(item.tid) || 0,
      tname: favoritesFixString(item.tname || item.category_name || item.type_name, 120) || favoritesFixCategoryName(item.tid),
      upper: { mid: String(upper.mid || upper.id || ""), name: favoritesFixString(upper.name || upper.author, 120) },
      stats: {
        play: favoritesFixMetric(count.play ?? count.view),
        danmaku: favoritesFixMetric(count.danmaku),
        collect: favoritesFixMetric(count.collect),
        thumbUp: favoritesFixMetric(count.thumb_up),
        coin: favoritesFixMetric(count.coin),
        reply: favoritesFixMetric(count.reply)
      },
      favTime: Number(item.fav_time) || 0,
      pubTime: Number(item.pubtime) || 0,
      attr: Number.isFinite(attr) ? attr : null,
      hidden: item.rights?.autoplay === 0
    };
  }
  function favoritesFixMergeMedia(api, cached, external) {
    const fresh = favoritesFixNormalizeMedia(api);
    const old = cached && typeof cached === "object" ? cached : {};
    const freshAid = favoritesFixNormalizeAid(fresh.aid);
    const oldAid = favoritesFixNormalizeAid(old.aid ?? old.avid ?? old.id);
    const freshBvid = favoritesFixString(fresh.bvid, 80);
    const oldBvid = favoritesFixString(old.bvid || old.bv_id || old.video_id, 80).match(/BV[0-9A-Za-z]+/i)?.[0] || "";
    const aid = freshAid || oldAid;
    const bvid = freshBvid || oldBvid;
    const pages = fresh.pages.length ? fresh.pages : favoritesFixNormalizePages(old.pages);
    const apiTitle = fresh.title;
    const cachedTitle = favoritesFixString(old.title, 800);
    const apiCover = fresh.cover;
    const cachedCover = favoritesFixNormalizeCover(old.cover);
    const recoveredTitle = external && !favoritesFixIsGenericTitle(external.title) ? favoritesFixString(external.title, 800) : "";
    const recoveredCover = external?.cover && !favoritesFixIsPlaceholderCover(external.cover) ? favoritesFixNormalizeExternalCover(external.cover) : "";
    const externalState = favoritesFixNormalizeExternalState(external) || favoritesFixNormalizeExternalState(old.external);
    const externalUpper = external?.upper && typeof external.upper === "object" ? external.upper : {};
    const oldStats = old.stats && typeof old.stats === "object" ? old.stats : {};
    const freshStats = fresh.stats && typeof fresh.stats === "object" ? fresh.stats : {};
    return {
      ...fresh,
      id: fresh.id || old.id || aid,
      aid,
      bvid,
      title: recoveredTitle || (!favoritesFixIsUnusableTitle(apiTitle) ? apiTitle : !favoritesFixIsUnusableTitle(cachedTitle) ? cachedTitle : apiTitle),
      cover: recoveredCover || (apiCover && !favoritesFixIsPlaceholderCover(apiCover) ? apiCover : cachedCover || apiCover),
      intro: fresh.intro || favoritesFixString(external?.intro, 1800) || favoritesFixString(old.intro, 1800),
      duration: fresh.duration || favoritesFixDuration(old.duration),
      pages,
      tid: fresh.tid || Number(old.tid) || 0,
      tname: fresh.tname || favoritesFixString(old.tname, 120) || favoritesFixCategoryName(fresh.tid || old.tid),
      favTime: fresh.favTime || Number(old.favTime) || 0,
      pubTime: fresh.pubTime || Number(old.pubTime) || 0,
      attr: fresh.attr !== null && fresh.attr !== undefined ? fresh.attr : old.attr !== null && old.attr !== undefined ? old.attr : null,
      upper: { ...old.upper, ...externalUpper, ...fresh.upper, name: fresh.upper.name || externalUpper.name || old.upper?.name || "", mid: fresh.upper.mid || externalUpper.mid || old.upper?.mid || "" },
      stats: {
        play: favoritesFixPickMetric(freshStats.play, favoritesFixCachedMetric(oldStats.play)),
        danmaku: favoritesFixPickMetric(freshStats.danmaku, favoritesFixCachedMetric(oldStats.danmaku)),
        collect: favoritesFixPickMetric(freshStats.collect, favoritesFixCachedMetric(oldStats.collect)),
        thumbUp: favoritesFixPickMetric(freshStats.thumbUp, favoritesFixCachedMetric(oldStats.thumbUp)),
        coin: favoritesFixPickMetric(freshStats.coin, favoritesFixCachedMetric(oldStats.coin)),
        reply: favoritesFixPickMetric(freshStats.reply, favoritesFixCachedMetric(oldStats.reply))
      },
      external: externalState
    };
  }
  function favoritesFixTitle(media) {
    if (!media) return "";
    if (!favoritesFixIsUnusableTitle(media.title)) return favoritesFixString(media.title, 800);
    if (media.pages?.length === 1 && !favoritesFixIsUnusableTitle(media.pages[0].title)) {
      return `${media.pages[0].title}（根据分 P 推断）`;
    }
    return "";
  }
  function favoritesFixDisplayTitle(media) {
    const title = favoritesFixTitle(media);
    if (title) return title;
    const id = favoritesFixString(media?.aid || media?.bvid, 120).replace(/^av/i, "");
    return id ? `查不到标题（${id}）【鼠标悬停查看简介】` : "查不到标题【鼠标悬停查看简介】";
  }
  function favoritesFixMergeEntries(domEntries, apiEntries) {
    const dom = new Map((domEntries || []).map((entry) => [favoritesFixKey(entry), entry]).filter(([key]) => key));
    return (apiEntries || []).map((entry, index) => {
      const media = favoritesFixNormalizeMedia(entry, index);
      const previous = dom.get(favoritesFixKey(media));
      return { ...previous, ...media };
    });
  }
  function favoritesFixCacheRecord(media) {
    return {
      aid: String(media.aid || ""),
      bvid: favoritesFixString(media.bvid, 80),
      title: favoritesFixString(media.title, 800),
      cover: favoritesFixNormalizeCover(media.cover),
      intro: favoritesFixString(media.intro, 1800),
      duration: favoritesFixDuration(media.duration),
      pages: favoritesFixNormalizePages(media.pages).slice(0, 200),
      tid: Number(media.tid) || 0,
      tname: favoritesFixString(media.tname, 120),
      upper: { mid: String(media.upper?.mid || ""), name: favoritesFixString(media.upper?.name, 120) },
      stats: media.stats && typeof media.stats === "object" ? {
        play: favoritesFixMetric(media.stats.play),
        danmaku: favoritesFixMetric(media.stats.danmaku),
        collect: favoritesFixMetric(media.stats.collect),
        thumbUp: favoritesFixMetric(media.stats.thumbUp),
        coin: favoritesFixMetric(media.stats.coin),
        reply: favoritesFixMetric(media.stats.reply)
      } : {},
      favTime: Number(media.favTime) || 0,
      pubTime: Number(media.pubTime) || 0,
      attr: media.attr !== null && media.attr !== undefined ? Number(media.attr) : null,
      external: favoritesFixNormalizeExternalState(media.external),
      at: Date.now()
    };
  }
  function favoritesFixReadCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES_FIX_CACHE_KEY) || "null");
      if (raw && typeof raw === "object" && raw.entries && typeof raw.entries === "object") return raw;
    } catch {
    }
    return { version: 1, entries: {} };
  }
  function favoritesFixWriteCache(cache) {
    try {
      const entries = cache && typeof cache.entries === "object" ? cache.entries : {};
      const keys = Object.keys(entries).slice(-FAVORITES_FIX_CACHE_LIMIT);
      const bounded = {};
      for (const key of keys) bounded[key] = entries[key];
      localStorage.setItem(FAVORITES_FIX_CACHE_KEY, JSON.stringify({ version: 1, entries: bounded }));
    } catch {
    }
  }
  function favoritesFixDeleteCache(key) {
    const cache = favoritesFixReadCache();
    delete cache.entries[key];
    favoritesFixWriteCache(cache);
  }
  function favoritesFixExternalUrl(source, media) {
    const aid = String(media?.aid || "").replace(/^av/i, "");
    if (!/^\d+$/.test(aid)) return "";
    if (source === "biliplus") return `https://www.biliplus.com/api/aidinfo?aid=${encodeURIComponent(aid)}`;
    if (source === "jijidown") return `https://www.jijidown.com/api/v1/video/get_info?id=${encodeURIComponent(aid)}`;
    return "";
  }
  function favoritesFixMergeExternalPart(recovered, parsed, source) {
    if (!parsed?.valid) return;
    if (!recovered.title && parsed.title) recovered.title = parsed.title;
    if (!recovered.cover && parsed.cover) recovered.cover = parsed.cover;
    if (!recovered.intro && parsed.intro) recovered.intro = parsed.intro;
    if (!recovered.upper.name && parsed.upper?.name) recovered.upper.name = parsed.upper.name;
    if (!recovered.upper.mid && parsed.upper?.mid) recovered.upper.mid = parsed.upper.mid;
    if (!recovered.source.includes(source)) recovered.source.push(source);
  }
  async function favoritesFixFetchExternalMetadata(media, biliplusRecord = null) {
    const recovered = { title: "", cover: "", intro: "", upper: {}, source: [], status: "miss", checkedAt: Date.now() };
    const aid = String(media?.aid || "").replace(/^av/i, "");
    if (biliplusRecord && aid) {
      const parsed = favoritesFixParseExternalPayload("biliplus", { code: 0, data: { [aid]: biliplusRecord } });
      favoritesFixMergeExternalPart(recovered, parsed, "biliplus");
    }
    if (!(recovered.title && recovered.cover)) {
      const url = favoritesFixExternalUrl("jijidown", media);
      if (url) {
        FAVORITES_FIX_STATS.externalRequestCount += 1;
        try {
          const payload = await favoritesFixRequestJson(url, "收藏夹公开元数据接口", 6000);
          favoritesFixMergeExternalPart(recovered, favoritesFixParseExternalPayload("jijidown", payload), "jijidown");
        } catch {
        }
      }
    }
    if (recovered.title || recovered.cover) {
      recovered.status = "hit";
      recovered.source = recovered.source.join("+");
      FAVORITES_FIX_STATS.externalHitCount += 1;
    } else {
      recovered.source = "none";
      FAVORITES_FIX_STATS.externalMissCount += 1;
    }
    return recovered;
  }
  async function favoritesFixRecoverExternal(entries, cache, onRecovered) {
    const output = [...entries];
    const candidates = output.map((media, index) => ({ media, index, key: favoritesFixKey(media) })).filter(({ media, key }) => {
      const cached = key ? cache.entries[key] : null;
      const cachedExternalFresh = favoritesFixExternalCheckFresh(cached?.external);
      return !!key && !!media?.aid && favoritesFixNeedsExternal(media) && (!cachedExternalFresh || !favoritesFixCachedExternalUseful(cached));
    });
    const biliplusRecords = {};
    const aids = [...new Set(candidates.map(({ media }) => String(media.aid || "").replace(/^av/i, "")).filter((aid) => /^\d+$/.test(aid)))];
    if (aids.length) {
      // 先一次性读取快速主来源；下面的慢速接口只能补主来源没有返回的条目。
      FAVORITES_FIX_STATS.externalRequestCount += 1;
      try {
        const url = `https://www.biliplus.com/api/aidinfo?aid=${aids.join(",")}`;
        const payload = await favoritesFixRequestJson(url, "收藏夹公开元数据接口", 6000);
        if (Number(payload?.code) === 0 && payload.data && typeof payload.data === "object") {
          Object.assign(biliplusRecords, payload.data);
        }
      } catch {
      }
    }
    let cursor = 0;
    const worker = async () => {
      while (cursor < candidates.length) {
        const candidate = candidates[cursor++];
        const cached = cache.entries[candidate.key];
        const aid = String(candidate.media.aid || "").replace(/^av/i, "");
        const recovered = await favoritesFixFetchExternalMetadata(candidate.media, biliplusRecords[aid]);
        const merged = favoritesFixMergeMedia(candidate.media, cached, recovered);
        output[candidate.index] = merged;
        cache.entries[candidate.key] = favoritesFixCacheRecord(merged);
        if (recovered.status === "hit") FAVORITES_FIX_STATS.externalSource = recovered.source;
        try {
          onRecovered?.(merged, candidate.key, recovered);
        } catch {
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(FAVORITES_FIX_EXTERNAL_CONCURRENCY, candidates.length) }, () => worker()));
    return output;
  }
  function favoritesFixRequestJson(url, label = "收藏夹接口", timeout = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let request = null;
      let controller = null;
      let timer = 0;
      const limit = Math.max(1000, Number(timeout) || 8000);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      const fail = (error) => finish(reject, error instanceof Error ? error : new Error(String(error || `${label}请求失败`)));
      const abort = () => {
        try { request?.abort?.(); } catch { }
        try { controller?.abort?.(); } catch { }
      };
      timer = setTimeout(() => {
        abort();
        fail(new Error(`${label}请求超时`));
      }, limit);
      if (typeof GM_xmlhttpRequest === "function") {
        try {
          request = GM_xmlhttpRequest({
            method: "GET",
            url,
            responseType: "json",
            timeout: limit,
            headers: { Accept: "application/json" },
            onload: (response) => {
              if (Number(response.status) < 200 || Number(response.status) >= 300) {
                fail(new Error(`${label}返回 HTTP ${response.status}`));
                return;
              }
              let value = response.response;
              if (!value && response.responseText) {
                try { value = JSON.parse(response.responseText); } catch { value = null; }
              }
              if (!value || typeof value !== "object") fail(new Error(`${label}没有返回 JSON`));
              else finish(resolve, value);
            },
            onerror: () => fail(new Error(`${label}网络请求失败`)),
            ontimeout: () => fail(new Error(`${label}请求超时`))
          });
        } catch (error) {
          fail(error instanceof Error ? error : new Error("收藏夹接口不可用"));
        }
        return;
      }
      controller = typeof AbortController === "function" ? new AbortController() : null;
      fetch(url, { credentials: "include", headers: { Accept: "application/json" }, signal: controller?.signal }).then(async (response) => {
        if (!response.ok) throw new Error(`${label}返回 HTTP ${response.status}`);
        return response.json();
      }).then((value) => finish(resolve, value), fail);
    });
  }
  function favoritesFixApiUrl(endpoint, info, page, pageSize) {
    const params = new URLSearchParams({
      media_id: info.fid,
      pn: String(page),
      ps: String(pageSize),
      keyword: info.keyword,
      order: info.order,
      type: info.type,
      tid: info.tid,
      platform: "web"
    });
    return `https://api.bilibili.com${endpoint}?${params.toString()}`;
  }
  function favoritesFixParseApiResponse(payload) {
    if (!payload || Number(payload.code) !== 0 || !payload.data) return null;
    const data = payload.data;
    const medias = Array.isArray(data.medias) ? data.medias : Array.isArray(data.list) ? data.list : [];
    return { info: data.info && typeof data.info === "object" ? data.info : {}, medias };
  }
  async function favoritesFixFetchPage(info, targetCount) {
    const pageSize = Math.max(20, Math.min(40, Math.max(20, Number(targetCount) || 20)));
    const page = Math.max(1, Number(info.page) || 1);
    const modernUi = !!document.querySelector(".fav-list-main .items");
    const wideScreen = Number(window.innerWidth) > 1760;
    let publicPages;
    if (!modernUi) {
      publicPages = [page];
    } else if (!wideScreen) {
      // 新版窄屏每个界面页由两个公开接口页组成（每页 20 条）。
      publicPages = [(page - 1) * 2 + 1, (page - 1) * 2 + 2];
    } else {
      // 新版宽屏按 5 个界面页滑动 9 个接口页，页面边界与 B 站网格保持一致。
      const base = Math.floor((page - 1) * 9 / 5);
      const count = page % 5 === 0 || page % 5 === 1 ? 2 : 3;
      publicPages = Array.from({ length: count }, (_, index) => base + index + 1);
    }
    const publicMedias = [];
    const publicResults = await Promise.all(publicPages.map(async (apiPage) => {
      try {
        const payload = await favoritesFixRequestJson(
          favoritesFixApiUrl("/medialist/gateway/base/spaceDetail", info, apiPage, 20),
          "收藏夹公开接口",
          8000
        );
        return favoritesFixParseApiResponse(payload);
      } catch {
        return null;
      }
    }));
    for (const parsed of publicResults) {
      if (parsed?.medias?.length) publicMedias.push(...parsed.medias);
    }
    const publicResult = publicResults.find((result) => result?.medias?.length) || null;
    if (publicResult && publicMedias.length) {
      const unique = [];
      const seen = new Set();
      for (const media of publicMedias) {
        const key = favoritesFixKey(media);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        unique.push(media);
      }
      const medias = modernUi && wideScreen
        ? unique.slice(page % 5 === 1 ? 0 : (5 - (page - 1) % 5) * 4, page % 5 === 1 ? 36 : (5 - (page - 1) % 5) * 4 + 36)
        : unique;
      return { source: "public", info: publicResult.info, medias, canRecoverHidden: !info.keyword && info.tid === "0" && info.type === "0" };
    }
    const privatePayload = await favoritesFixRequestJson(favoritesFixApiUrl("/x/v3/fav/resource/list", info, info.page, pageSize));
    const privateResult = favoritesFixParseApiResponse(privatePayload);
    if (!privateResult) throw new Error("公开和鉴权收藏夹接口都没有返回可用数据");
    return { source: "private", info: privateResult.info, medias: privateResult.medias, canRecoverHidden: false };
  }
  function favoritesFixResolveInfo() {
    const info = parseFavoritesFixUrl(location.href);
    if (info.fid) return info;
    const active = document.querySelector(".fav-sidebar-item.vui_sidebar-item--active, .fav-sidebar-item[aria-current='page'], [data-fid].is-active");
    const fid = active?.getAttribute("data-fid") || active?.id?.match(/\d+/)?.[0] || "";
    if (fid) info.fid = fid;
    return info;
  }
  function favoritesFixIsRepairTarget(card) {
    if (!card?.querySelector) return false;
    if (card.dataset?.bilikitFavoritesTarget === "1") return true;
    const modernTitle = card.querySelector(".bili-video-card__title a");
    if (modernTitle) {
      const modernTitles = [...(card.querySelectorAll?.(".bili-video-card__title, .bili-video-card__title *") || [])];
      if (modernTitles.some((element) => favoritesFixString(element.textContent, 300) === "已失效视频")) return true;
      const detailsText = favoritesFixString(card.querySelector(".bili-video-card__details")?.textContent, 1200);
      return favoritesFixIsLoadingTitle(modernTitle.textContent) && /已失效视频/.test(detailsText);
    }
    const legacyTitle = card.querySelector("a.title, .title");
    if (legacyTitle) return favoritesFixString(legacyTitle.textContent, 300) === "已失效视频" || !!card.classList?.contains?.("disabled");
    return !!card.classList?.contains?.("disabled");
  }
  function favoritesFixCollectCards() {
    const main = document.querySelector(".fav-list-main") || document.querySelector(".fav-content") || document.body;
    const container = main?.querySelector(".items") || main;
    const cards = [...(main?.querySelectorAll?.(".items__item, li.small-item") || [])].filter((card) => {
      return favoritesFixCardIdentityKeys(card).length > 0;
    });
    return { main, container, cards, targetCards: cards.filter(favoritesFixIsRepairTarget) };
  }
  function favoritesFixCardId(card) {
    return favoritesFixCardIdentityKeys(card)[0] || "";
  }
  function favoritesFixCardTitleElement(card) {
    return favoritesFixCardTitleElements(card)[0] || null;
  }
  function favoritesFixCardImage(card) {
    return card?.querySelector(".bili-video-card__cover img, .cover img, img");
  }
  function favoritesFixCardCoverLink(card) {
    return card?.querySelector(".bili-video-card__cover a, .bili-cover-card, a.cover, .cover");
  }
  function favoritesFixMediaFromCard(card) {
    const ids = favoritesFixCardIdentityKeys(card);
    const bvid = ids.find((id) => /^BV/i.test(id)) || "";
    const aidId = ids.find((id) => /^av\d+$/i.test(id)) || "";
    const id = bvid || aidId;
    const isAv = /^av\d+$/i.test(id);
    const subtitle = favoritesFixDateText(card);
    const author = favoritesFixString(subtitle.split(/\s*·\s*/)[0], 120);
    return {
      id: isAv ? id.slice(2) : id,
      aid: aidId ? aidId.slice(2) : isAv ? id.slice(2) : "",
      bvid,
      title: "已失效视频",
      cover: "",
      intro: "",
      duration: 0,
      page: 1,
      pages: [],
      tid: 0,
      tname: "",
      upper: { mid: "", name: author && !/^收藏于/.test(author) ? author : "" },
      stats: { play: null, danmaku: null, collect: null, thumbUp: null, coin: null, reply: null },
      favTime: 0,
      pubTime: 0,
      attr: null,
      hidden: false
    };
  }
  function favoritesFixDateText(card) {
    const node = card?.querySelector(".bili-video-card__subtitle, .meta.pubdate");
    return node?.textContent || "";
  }
  function favoritesFixFormatDate(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "未读取到";
    try {
      return new Date(timestamp * 1000).toLocaleString();
    } catch {
      return "未读取到";
    }
  }
  function favoritesFixFormatCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number.toLocaleString() : "未读取到";
  }
  function favoritesFixFailureReason(media) {
    if (media?.attr === 0) return "未失效（0）";
    if (media?.attr === 9) return "UP 主自己删除（9）";
    if (media?.attr === 1) return "其他原因删除或退回（1）";
    if (media?.attr !== null && media?.attr !== undefined) return `原因编号意义未明（${media.attr}）`;
    return "未知";
  }
  function favoritesFixUnknown(value, fallback = "未读取到") {
    const text = favoritesFixString(value, 4000);
    return text || fallback;
  }
  function favoritesFixPageDetails(media) {
    return favoritesFixNormalizePages(media?.pages).map((page) => `P${page.page} ${favoritesFixUnknown(page.title, "未命名")}（${favoritesFixFormatDuration(page.duration)}）`).join("\n");
  }
  function favoritesFixCardDetails(media) {
    const pages = favoritesFixNormalizePages(media?.pages);
    const pageDetails = favoritesFixPageDetails(media);
    return [
      `标题：${favoritesFixDisplayTitle(media)}`,
      `BV号：${favoritesFixUnknown(media?.bvid)}`,
      `AV号：${favoritesFixUnknown(media?.aid)}`,
      `UP主：${favoritesFixUnknown(media?.upper?.name, "账号已注销")}`,
      `简介：${favoritesFixUnknown(media?.intro)}`,
      `分区：${favoritesFixUnknown(media?.tname || (media?.tid ? `分区 ${media.tid}` : ""))}`,
      `时长：${favoritesFixFormatDuration(media?.duration)}`,
      `发布时间：${favoritesFixFormatDate(media?.pubTime)}`,
      `收藏时间：${favoritesFixFormatDate(media?.favTime)}`,
      `分P数量：${pages.length || "未读取到"}`,
      pageDetails ? `子P标题：\n${pageDetails}` : "子P标题：未读取到",
      `播放数：${favoritesFixFormatCount(media?.stats?.play)}`,
      `收藏数：${favoritesFixFormatCount(media?.stats?.collect)}`,
      `弹幕数：${favoritesFixFormatCount(media?.stats?.danmaku)}`,
      `点赞数：${favoritesFixFormatCount(media?.stats?.thumbUp)}`,
      `投币数：${favoritesFixFormatCount(media?.stats?.coin)}`,
      `回复数：${favoritesFixFormatCount(media?.stats?.reply)}`,
      `失效原因：${favoritesFixFailureReason(media)}`
    ].join("\n");
  }
  function favoritesFixHasPlaceholderCover(image) {
    if (!image) return false;
    const source = image.currentSrc || image.getAttribute?.("src") || image.src || image.getAttribute?.("data-src") || "";
    const alt = favoritesFixString(image.getAttribute?.("alt") || image.alt, 120);
    return favoritesFixIsPlaceholderCover(source) || /图片链接失效|视频已失效|封面失效/i.test(alt);
  }
  function favoritesFixHoverLine(parent, label, value, className = "") {
    const row = document.createElement("div");
    row.className = `bk-favfix-hover-line${className ? ` ${className}` : ""}`;
    const labelEl = document.createElement("span");
    labelEl.className = "bk-favfix-hover-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "bk-favfix-hover-value";
    valueEl.textContent = favoritesFixUnknown(value);
    row.append(labelEl, valueEl);
    parent.appendChild(row);
    return row;
  }
  function favoritesFixRenderHoverPanel(media) {
    const panel = FAVORITES_FIX_HOVER_STATE.panel;
    if (!panel || !media) return;
    panel.textContent = "";
    const eyebrow = document.createElement("div");
    eyebrow.className = "bk-favfix-hover-eyebrow";
    eyebrow.textContent = "BiliKit · 失效收藏资料";
    const title = document.createElement("div");
    title.className = "bk-favfix-hover-title";
    title.textContent = favoritesFixDisplayTitle(media);
    const identity = document.createElement("div");
    identity.className = "bk-favfix-hover-identity";
    identity.textContent = `AV ${favoritesFixUnknown(media.aid)} · BV ${favoritesFixUnknown(media.bvid)}`;
    panel.append(eyebrow, title, identity);

    const basic = document.createElement("div");
    basic.className = "bk-favfix-hover-section";
    favoritesFixHoverLine(basic, "UP主", media.upper?.name || "账号已注销");
    favoritesFixHoverLine(basic, "分区", media.tname || (media.tid ? `分区 ${media.tid}` : ""));
    favoritesFixHoverLine(basic, "时长", favoritesFixFormatDuration(media.duration));
    favoritesFixHoverLine(basic, "发布时间", favoritesFixFormatDate(media.pubTime));
    favoritesFixHoverLine(basic, "收藏时间", favoritesFixFormatDate(media.favTime));
    panel.appendChild(basic);

    const intro = document.createElement("div");
    intro.className = "bk-favfix-hover-section bk-favfix-hover-intro";
    const introLabel = document.createElement("div");
    introLabel.className = "bk-favfix-hover-section-title";
    introLabel.textContent = "简介";
    const introText = document.createElement("div");
    introText.className = "bk-favfix-hover-description";
    introText.textContent = favoritesFixUnknown(media.intro);
    intro.append(introLabel, introText);
    panel.appendChild(intro);

    const pages = document.createElement("div");
    pages.className = "bk-favfix-hover-section";
    const pagesLabel = document.createElement("div");
    pagesLabel.className = "bk-favfix-hover-section-title";
    pagesLabel.textContent = `分P（${favoritesFixNormalizePages(media.pages).length || "未读取到"}）`;
    const pagesText = document.createElement("div");
    pagesText.className = "bk-favfix-hover-description";
    pagesText.textContent = favoritesFixPageDetails(media) || "未读取到";
    pages.append(pagesLabel, pagesText);
    panel.appendChild(pages);

    const stats = document.createElement("div");
    stats.className = "bk-favfix-hover-grid";
    for (const [label, value] of [
      ["播放", media.stats?.play],
      ["收藏", media.stats?.collect],
      ["弹幕", media.stats?.danmaku],
      ["点赞", media.stats?.thumbUp],
      ["投币", media.stats?.coin],
      ["回复", media.stats?.reply]
    ]) favoritesFixHoverLine(stats, label, favoritesFixFormatCount(value));
    panel.appendChild(stats);

    const reason = document.createElement("div");
    reason.className = "bk-favfix-hover-reason";
    reason.textContent = `失效原因：${favoritesFixFailureReason(media)}`;
    panel.appendChild(reason);
  }
  function favoritesFixEnsureHoverPanel() {
    if (FAVORITES_FIX_HOVER_STATE.panel?.isConnected) return FAVORITES_FIX_HOVER_STATE.panel;
    if (typeof document === "undefined" || !document.body) return null;
    const panel = document.createElement("div");
    panel.id = FAVORITES_FIX_HOVER_PANEL_ID;
    panel.className = "bk-favfix-hover-panel";
    panel.hidden = true;
    panel.setAttribute("role", "tooltip");
    applyBiliKitTheme(panel);
    panel.addEventListener("pointerenter", () => {
      clearTimeout(FAVORITES_FIX_HOVER_STATE.hideTimer);
    });
    panel.addEventListener("pointerleave", favoritesFixScheduleHoverHide);
    document.body.appendChild(panel);
    FAVORITES_FIX_HOVER_STATE.panel = panel;
    return panel;
  }
  function favoritesFixPositionHoverPanel() {
    const panel = FAVORITES_FIX_HOVER_STATE.panel;
    const anchor = FAVORITES_FIX_HOVER_STATE.anchor;
    if (!panel || panel.hidden || !anchor?.getBoundingClientRect) return;
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const margin = 12;
    const gap = 12;
    panel.style.width = `${Math.max(0, Math.min(380, viewportWidth - margin * 2))}px`;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    let left = anchorRect.right + gap;
    if (left + panelRect.width > viewportWidth - margin) left = anchorRect.left - panelRect.width - gap;
    left = Math.max(margin, Math.min(left, viewportWidth - panelRect.width - margin));
    let top = anchorRect.top;
    if (top + panelRect.height > viewportHeight - margin) top = viewportHeight - panelRect.height - margin;
    top = Math.max(margin, Math.min(top, viewportHeight - panelRect.height - margin));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }
  function favoritesFixScheduleHoverHide() {
    clearTimeout(FAVORITES_FIX_HOVER_STATE.hideTimer);
    FAVORITES_FIX_HOVER_STATE.hideTimer = setTimeout(() => {
      const panel = FAVORITES_FIX_HOVER_STATE.panel;
      if (!panel?.matches(":hover") && !FAVORITES_FIX_HOVER_STATE.anchor?.matches?.(":hover")) {
        panel.hidden = true;
        panel.removeAttribute("data-open");
        FAVORITES_FIX_HOVER_STATE.anchor = null;
        FAVORITES_FIX_HOVER_STATE.media = null;
      }
    }, 180);
  }
  function favoritesFixShowHoverPanel(anchor, media) {
    const panel = favoritesFixEnsureHoverPanel();
    if (!panel) return;
    const changedAnchor = FAVORITES_FIX_HOVER_STATE.anchor !== anchor;
    clearTimeout(FAVORITES_FIX_HOVER_STATE.hideTimer);
    FAVORITES_FIX_HOVER_STATE.anchor = anchor;
    FAVORITES_FIX_HOVER_STATE.media = media;
    if (changedAnchor) {
      panel.scrollTop = 0;
      panel.scrollLeft = 0;
    }
    favoritesFixRenderHoverPanel(media);
    panel.hidden = false;
    panel.dataset.open = "1";
    favoritesFixPositionHoverPanel();
    FAVORITES_FIX_STATS.tooltipCount = document.querySelectorAll("[data-bilikit-favfix-hover='1']").length;
  }
  function favoritesFixMediaForHover(card) {
    const owner = card?.closest?.(".items__item, li.small-item") || card;
    return owner?.__bkFavoritesMedia || card?.__bkFavoritesMedia || favoritesFixMediaFromCard(owner || card);
  }
  function favoritesFixSyncHoverTarget(card, media) {
    const link = favoritesFixCardCoverLink(card);
    const image = favoritesFixCardImage(card);
    if (!link) return false;
    const enabled = favoritesFixHasPlaceholderCover(image);
    if (enabled) {
      if (!link.dataset.bkFavfixOriginalAria && link.hasAttribute("aria-label")) link.dataset.bkFavfixOriginalAria = link.getAttribute("aria-label");
      link.dataset.bilikitFavoritesHover = "1";
      link.setAttribute("aria-label", favoritesFixDisplayTitle(media));
      link.classList.add("bk-favfix-hover-target");
    } else {
      delete link.dataset.bilikitFavoritesHover;
      link.classList.remove("bk-favfix-hover-target");
      if (link.dataset.bkFavfixOriginalAria) link.setAttribute("aria-label", link.dataset.bkFavfixOriginalAria);
      else link.removeAttribute("aria-label");
      delete link.dataset.bkFavfixOriginalAria;
      if (FAVORITES_FIX_HOVER_STATE.anchor === link) favoritesFixScheduleHoverHide();
    }
    if (FAVORITES_FIX_HOVER_STATE.anchor === link) {
      FAVORITES_FIX_HOVER_STATE.media = media;
      favoritesFixRenderHoverPanel(media);
      favoritesFixPositionHoverPanel();
    }
    return enabled;
  }
  function favoritesFixInstallHoverHandlers(runtime) {
    const targetFromEvent = (event) => event.target?.closest?.("[data-bilikit-favorites-hover='1']") || null;
    const contains = (parent, child) => !!child && (child === parent || parent.contains?.(child));
    runtime.listen(document, "pointerover", (event) => {
      const target = targetFromEvent(event);
      if (target && !contains(target, event.relatedTarget)) {
        const card = target.closest(".bili-video-card");
        if (card) favoritesFixShowHoverPanel(target, favoritesFixMediaForHover(card));
      }
    }, true);
    runtime.listen(document, "pointerout", (event) => {
      const target = targetFromEvent(event);
      if (target && !contains(target, event.relatedTarget)) favoritesFixScheduleHoverHide();
    }, true);
    runtime.listen(document, "focusin", (event) => {
      const target = targetFromEvent(event);
      if (target) {
        const card = target.closest(".bili-video-card");
        if (card) favoritesFixShowHoverPanel(target, favoritesFixMediaForHover(card));
      }
    }, true);
    runtime.listen(document, "focusout", (event) => {
      const target = targetFromEvent(event);
      if (target && !contains(target, event.relatedTarget)) favoritesFixScheduleHoverHide();
    }, true);
    runtime.listen(window, "resize", favoritesFixPositionHoverPanel, { passive: true });
    runtime.listen(window, "scroll", favoritesFixPositionHoverPanel, { passive: true, capture: true });
    runtime.listen(window, BILIKIT_THEME_EVENT, () => {
      const panel = FAVORITES_FIX_HOVER_STATE.panel;
      if (panel) applyBiliKitTheme(panel);
    });
  }
  async function favoritesFixCopy(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
  function favoritesFixMenuText(media) {
    return favoritesFixCardDetails(media);
  }
  function favoritesFixEnsureMenu(card, media, onClear) {
    let root = card.querySelector(":scope > .bk-favfix-menu, .bili-video-card__details > .bk-favfix-menu");
    if (!root) {
      const host = card.querySelector(".bili-video-card__details") || card;
      root = document.createElement("div");
      root.className = "bk-favfix-menu";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "bk-favfix-menu-trigger";
      trigger.textContent = "BiliKit";
      trigger.setAttribute("aria-label", "BiliKit 收藏夹工具");
      const panel = document.createElement("div");
      panel.className = "bk-favfix-menu-panel";
      const actions = [
        ["copy", "复制视频信息"],
        ["cover", "查看封面"],
        ["up", "打开 UP 主空间"],
        ["clear", "清除本地缓存"]
      ];
      for (const [action, label] of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = label;
        panel.appendChild(button);
      }
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        root.classList.toggle("open");
      });
      panel.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const current = root.__bkMedia || media;
        const key = favoritesFixKey(current);
        if (button.dataset.action === "copy") {
          button.textContent = await favoritesFixCopy(favoritesFixMenuText(current)) ? "已复制" : "复制失败";
        } else if (button.dataset.action === "cover") {
          if (current.cover && !favoritesFixIsPlaceholderCover(current.cover)) window.open(current.cover, "_blank", "noopener");
        } else if (button.dataset.action === "up") {
          if (current.upper?.mid) window.open(`https://space.bilibili.com/${encodeURIComponent(current.upper.mid)}`, "_blank", "noopener");
        } else if (button.dataset.action === "clear") {
          favoritesFixDeleteCache(key);
          onClear?.(key);
          root.classList.remove("open");
        }
      });
      root.append(trigger, panel);
      host.appendChild(root);
    }
    root.__bkMedia = media;
    return root;
  }
  function favoritesFixUpdateSubtitle(card, media) {
    const name = media?.upper?.name;
    if (!name || name === "账号已注销") return;
    const subtitle = card.querySelector(".bili-video-card__subtitle");
    if (!subtitle) return;
    const spans = [...subtitle.querySelectorAll("span")];
    const dateSpan = spans.find((span) => /收藏于/.test(span.textContent || ""));
    if (dateSpan) {
      const text = dateSpan.textContent || "";
      const suffix = text.indexOf("·") >= 0 ? text.slice(text.indexOf("·")) : "";
      dateSpan.textContent = `${name} ${suffix}`.trim();
    }
  }
  function favoritesFixSetCardCover(image, cover) {
    if (!image || !cover || favoritesFixIsPlaceholderCover(cover)) return false;
    const current = image.currentSrc || image.getAttribute("src") || image.src || "";
    const same = current === cover && (!image.getAttribute("srcset") || image.getAttribute("srcset") === cover);
    if (same) return false;
    image.setAttribute("src", cover);
    for (const attribute of ["data-src", "data-lazy-src", "data-original"]) {
      if (image.hasAttribute(attribute)) image.setAttribute(attribute, cover);
    }
    image.removeAttribute("srcset");
    image.removeAttribute("data-srcset");
    return true;
  }
  function favoritesFixApplyCard(card, media, options = {}) {
    if (!card || !media) return false;
    const ownedTarget = card.dataset?.bilikitFavoritesTarget === "1";
    if (!options.allowNonTarget && !ownedTarget && !favoritesFixIsRepairTarget(card)) return false;
    const effectiveMedia = card.__bkFavoritesMedia
      ? favoritesFixMergeMedia(media, card.__bkFavoritesMedia)
      : favoritesFixNormalizeMedia(media);
    let changed = false;
    const title = favoritesFixTitle(effectiveMedia);
    const titleEl = favoritesFixCardTitleElement(card);
    const currentTitle = titleEl?.textContent || "";
    const fallbackTitle = favoritesFixDisplayTitle(effectiveMedia);
    if (titleEl && fallbackTitle && (favoritesFixIsGenericTitle(currentTitle) || favoritesFixIsLoadingTitle(currentTitle) || !favoritesFixIsGenericTitle(fallbackTitle))) {
      if (currentTitle.trim() !== fallbackTitle) {
        titleEl.textContent = fallbackTitle;
        changed = true;
      }
    }
    for (const element of [titleEl, card.querySelector?.(".bili-video-card__title")]) element?.removeAttribute?.("title");
    if (favoritesFixClearLoadingLabels(card, fallbackTitle)) changed = true;
    const image = favoritesFixCardImage(card);
    if (favoritesFixSetCardCover(image, effectiveMedia.cover)) changed = true;
    favoritesFixUpdateSubtitle(card, effectiveMedia);
    card.removeAttribute("title");
    card.dataset.bilikitFavoritesFix = "1";
    card.dataset.bilikitFavoritesTarget = "1";
    card.__bkFavoritesMedia = effectiveMedia;
    favoritesFixSyncHoverTarget(card, effectiveMedia);
    if (changed || title) card.classList.add("bk-favfix-restored");
    if (options.showMenu !== false) favoritesFixEnsureMenu(card, effectiveMedia, options.onClear);
    return changed;
  }
  function favoritesFixBuildRecoveredCard(media, options = {}) {
    const item = document.createElement("div");
    item.className = "items__item bk-favfix-recovered-item";
    const card = document.createElement("div");
    card.className = "bili-video-card";
    const wrap = document.createElement("div");
    wrap.className = "bili-video-card__wrap";
    const cover = document.createElement("div");
    cover.className = "bili-video-card__cover";
    const coverLink = document.createElement("a");
    coverLink.className = "bili-cover-card";
    coverLink.href = `https://www.bilibili.com/video/${media.bvid || `av${media.aid}`}/`;
    const thumbnail = document.createElement("div");
    thumbnail.className = "bili-cover-card__thumbnail";
    const image = document.createElement("img");
    image.alt = favoritesFixTitle(media) || "已恢复收藏视频";
    image.loading = "lazy";
    if (media.cover && !favoritesFixIsPlaceholderCover(media.cover)) image.src = media.cover;
    thumbnail.appendChild(image);
    const stats = document.createElement("div");
    stats.className = "bili-cover-card__stats";
    const duration = document.createElement("span");
    duration.textContent = favoritesFixFormatDuration(media.duration);
    stats.appendChild(duration);
    coverLink.append(thumbnail, stats);
    cover.appendChild(coverLink);
    const details = document.createElement("div");
    details.className = "bili-video-card__details";
    const title = document.createElement("div");
    title.className = "bili-video-card__title bili-video-card__title--pr";
    const titleLink = document.createElement("a");
    titleLink.href = coverLink.href;
    titleLink.textContent = favoritesFixTitle(media) || media.title || "已失效视频";
    title.appendChild(titleLink);
    const subtitle = document.createElement("div");
    subtitle.className = "bili-video-card__subtitle";
    const author = document.createElement("a");
    author.className = "bili-video-card__author";
    if (media.upper?.mid) author.href = `https://space.bilibili.com/${encodeURIComponent(media.upper.mid)}`;
    const authorText = document.createElement("span");
    authorText.textContent = `${media.upper?.name || "账号已注销"} · 收藏夹恢复`;
    author.appendChild(authorText);
    subtitle.appendChild(author);
    details.append(title, subtitle);
    wrap.append(cover, details);
    card.appendChild(wrap);
    item.appendChild(card);
    favoritesFixApplyCard(card, media, { ...options, allowNonTarget: true });
    return item;
  }
  function favoritesFixRecoverMissing(container, cards, entries, options = {}) {
    if (!container || !options.enabled) return 0;
    const existing = new Map();
    for (const card of cards) {
      for (const key of favoritesFixCardIdentityKeys(card)) existing.set(key.toLowerCase(), card);
    }
    let restored = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const media = entries[index];
      const mediaKeys = favoritesFixMediaIdentityKeys(media);
      const key = favoritesFixKey(media);
      // 公开接口返回但 DOM 暂时没有的条目也可能只是懒加载或筛选结果；
      // 只有接口明确标记为隐藏时才允许恢复，避免把普通缺失误插入页面。
      if (options.onlyHidden && !media.hidden) continue;
      if (!key || mediaKeys.some((id) => existing.has(id.toLowerCase())) || !media.bvid && !media.aid) continue;
      const node = favoritesFixBuildRecoveredCard(media, options);
      let next = null;
      for (let nextIndex = index + 1; nextIndex < entries.length; nextIndex += 1) {
        const nextCard = favoritesFixMediaIdentityKeys(entries[nextIndex]).map((id) => existing.get(id.toLowerCase())).find(Boolean);
        const nextItem = nextCard?.closest?.(".items__item, li.small-item");
        if (nextItem?.parentElement === container) {
          next = nextItem;
          break;
        }
      }
      container.insertBefore(node, next || null);
      const restoredCard = node.querySelector(".bili-video-card") || node;
      for (const id of mediaKeys) existing.set(id.toLowerCase(), restoredCard);
      restored += 1;
    }
    return restored;
  }
  function favoritesFixInstallStyle() {
    if (document.getElementById(FAVORITES_FIX_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = FAVORITES_FIX_STYLE_ID;
    style.textContent = `
.bk-favfix-restored .bili-video-card__title a{color:var(--brand_blue,#00aeec)!important}
.bk-favfix-recovered-item{outline:1px solid color-mix(in srgb,var(--brand_blue,#00aeec) 55%,transparent);border-radius:8px}
.bk-favfix-restored .bili-video-card__details,.bk-favfix-recovered-item .bili-video-card__details{position:relative}
.bk-favfix-menu{position:absolute;right:0;top:-2px;z-index:8;font-size:12px}
.bk-favfix-menu-trigger{border:1px solid rgba(128,128,128,.28);border-radius:5px;background:var(--bg1,#fff);color:var(--text2,#61666d);padding:2px 6px;cursor:pointer;font:inherit}
.bk-favfix-menu-panel{display:none;position:absolute;right:0;top:calc(100% + 4px);min-width:132px;padding:4px;border:1px solid rgba(128,128,128,.28);border-radius:8px;background:var(--bg1,#fff);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.bk-favfix-menu.open .bk-favfix-menu-panel{display:grid;gap:2px}
.bk-favfix-menu-panel button{border:0;border-radius:5px;background:transparent;color:var(--text1,#18191c);padding:6px 8px;text-align:left;cursor:pointer;font:inherit;white-space:nowrap}
.bk-favfix-menu-panel button:hover{background:rgba(0,174,236,.12);color:var(--brand_blue,#00aeec)}
.bk-favfix-hover-panel{position:fixed;z-index:2147483000;box-sizing:border-box;width:min(380px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));overflow:auto;padding:14px 16px;border:1px solid var(--line_regular,rgba(0,0,0,.14));border-radius:12px;background:var(--bg1,#fff);color:var(--text1,#18191c);box-shadow:0 16px 44px rgba(0,0,0,.22);font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;word-break:break-word;overflow-wrap:anywhere;color-scheme:light dark}
.bk-favfix-hover-panel.bk-theme-light{--bg1:#fff;--text1:#18191c;--text2:#61666d;--text3:#9499a0;--line_regular:rgba(0,0,0,.12);color-scheme:light}
.bk-favfix-hover-panel.bk-theme-dark{--bg1:#23252b;--text1:#e3e5e7;--text2:#b8bdc4;--text3:#8b9199;--line_regular:rgba(255,255,255,.12);color-scheme:dark}
.bk-favfix-hover-panel[hidden]{display:none}
.bk-favfix-hover-eyebrow{margin-bottom:5px;color:var(--text3,#9499a0);font-size:11px;letter-spacing:.02em}
.bk-favfix-hover-title{font-size:16px;font-weight:650;line-height:1.35;color:var(--text1,#18191c)}
.bk-favfix-hover-identity{margin-top:4px;color:var(--text2,#61666d);font-size:11px;font-variant-numeric:tabular-nums}
.bk-favfix-hover-section{margin-top:12px;padding-top:10px;border-top:1px solid var(--line_regular,rgba(0,0,0,.1))}
.bk-favfix-hover-line{display:flex;gap:10px;min-width:0;margin:3px 0}
.bk-favfix-hover-label{flex:0 0 54px;color:var(--text3,#9499a0);font-size:12px}
.bk-favfix-hover-value{min-width:0;flex:1;color:var(--text1,#18191c);white-space:pre-wrap}
.bk-favfix-hover-section-title{margin-bottom:4px;color:var(--text2,#61666d);font-size:12px;font-weight:600}
.bk-favfix-hover-description{max-height:112px;overflow:auto;color:var(--text1,#18191c);white-space:pre-wrap}
.bk-favfix-hover-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line_regular,rgba(0,0,0,.1))}
.bk-favfix-hover-grid .bk-favfix-hover-line{display:block;margin:0}
.bk-favfix-hover-grid .bk-favfix-hover-label,.bk-favfix-hover-grid .bk-favfix-hover-value{display:block}
.bk-favfix-hover-grid .bk-favfix-hover-value{margin-top:1px;font-variant-numeric:tabular-nums}
.bk-favfix-hover-reason{margin-top:12px;padding-top:10px;border-top:1px solid var(--line_regular,rgba(0,0,0,.1));color:var(--text2,#61666d);font-size:12px}
@media(max-width:480px){.bk-favfix-hover-panel{padding:12px;width:calc(100vw - 16px);max-height:calc(100vh - 16px)}.bk-favfix-hover-title{font-size:15px}.bk-favfix-hover-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-color-scheme:dark){.bk-favfix-menu-trigger,.bk-favfix-menu-panel{background:#23252b;color:#e3e5e7}.bk-favfix-menu-panel button{color:#e3e5e7}}
`;
    (document.head || document.documentElement).appendChild(style);
  }
  function favoritesFixRefreshStats() {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    const cards = [...document.querySelectorAll("[data-bilikit-favorites-target='1']")];
    let titleRecoveredCount = 0;
    let coverRecoveredCount = 0;
    let unresolvedCount = 0;
    for (const card of cards) {
      const media = card.__bkFavoritesMedia;
      const hasTitle = !!favoritesFixTitle(media);
      const hasCover = !!media?.cover && !favoritesFixIsPlaceholderCover(media.cover);
      if (hasTitle) titleRecoveredCount += 1;
      if (hasCover) coverRecoveredCount += 1;
      if (!hasTitle && !hasCover) unresolvedCount += 1;
    }
    FAVORITES_FIX_STATS.targetCount = cards.length;
    FAVORITES_FIX_STATS.titleRecoveredCount = titleRecoveredCount;
    FAVORITES_FIX_STATS.coverRecoveredCount = coverRecoveredCount;
    FAVORITES_FIX_STATS.unresolvedCount = unresolvedCount;
    FAVORITES_FIX_STATS.tooltipCount = document.querySelectorAll("[data-bilikit-favfix-hover='1']").length;
    if (unresolvedCount) FAVORITES_FIX_STATS.lastFailure = "部分失效收藏仍未恢复公开标题或封面";
    else if (!FAVORITES_FIX_STATS.lastError) FAVORITES_FIX_STATS.lastFailure = "";
  }
  function initFavoritesFix(cfg) {
    if (!isFavoritesFixPage() || window.__BILIKIT_FAVORITES_FIX__) return;
    window.__BILIKIT_FAVORITES_FIX__ = true;
    FAVORITES_FIX_STATS.enabled = true;
    favoritesFixInstallStyle();
    const recoverHidden = cfg.get("recoverHidden") !== false;
    const showMenu = cfg.get("showMenu") !== false;
    const runtime = getRuntimeCoordinator();
    favoritesFixInstallHoverHandlers(runtime);
    const state = { running: false, generation: 0, loadedRoute: "", loadedSignature: "", timer: null, observer: null };
    const closeMenus = (event) => {
      if (event.target.closest?.(".bk-favfix-menu")) return;
      document.querySelectorAll(".bk-favfix-menu.open").forEach((menu) => menu.classList.remove("open"));
    };
    runtime.listen(document, "click", closeMenus, true);
    const getSignature = (cards) => cards.map((card) => {
      const keys = favoritesFixCardIdentityKeys(card).map((key) => key.toLowerCase());
      return keys.length ? `${keys.join("+")}:${favoritesFixIsRepairTarget(card) ? "target" : "stable"}` : "";
    }).filter(Boolean).join(",");
    const schedule = (force = false) => {
      if (force) {
        state.loadedRoute = "";
        state.loadedSignature = "";
      }
      if (state.timer) return;
      state.timer = runtime.timeout(() => {
        state.timer = null;
        void run();
      }, 180);
    };
    const run = async () => {
      if (state.running || !isFavoritesFixPage()) return;
      const info = favoritesFixResolveInfo();
      if (!info.supported || !info.fid) return;
      const view = favoritesFixCollectCards();
      const signature = getSignature(view.cards);
      if (state.loadedRoute === info.routeKey && state.loadedSignature === signature) return;
      if (!view.cards.length) {
        schedule();
        return;
      }
      state.running = true;
      const generation = ++state.generation;
      FAVORITES_FIX_STATS.page = info.routeKey;
      FAVORITES_FIX_STATS.cardCount = view.cards.length;
      FAVORITES_FIX_STATS.targetCount = view.targetCards.length;
      FAVORITES_FIX_STATS.requestCount += 1;
      FAVORITES_FIX_STATS.lastAt = Date.now();
      try {
        const result = await favoritesFixFetchPage(info, view.cards.length);
        if (generation !== state.generation || !isFavoritesFixPage()) return;
        const cache = favoritesFixReadCache();
        const entries = result.medias.map((media, index) => favoritesFixMergeMedia(media, cache.entries[favoritesFixKey(media)]));
        const byKey = entries.reduce((index, entry) => favoritesFixSetMediaIndex(index, entry), new Map());
        const targetKeys = new Set(view.targetCards.flatMap((card) => favoritesFixCardIdentityKeys(card).map((key) => key.toLowerCase())));
        let changed = 0;
        for (const card of view.targetCards) {
          const media = favoritesFixFindMediaForCard(card, byKey) || favoritesFixMediaFromCard(card);
          const key = favoritesFixKey(media);
          if (favoritesFixFindMediaForCard(card, byKey)) cache.entries[key] = favoritesFixCacheRecord(media);
          if (favoritesFixApplyCard(card, media, { showMenu, onClear: () => schedule(true) })) changed += 1;
        }
        const restored = recoverHidden && result.canRecoverHidden
          ? favoritesFixRecoverMissing(view.container, view.cards, entries, { enabled: true, onlyHidden: true, showMenu, onClear: () => schedule(true) })
          : 0;
        for (const media of entries) {
          const key = favoritesFixKey(media);
          if (key) cache.entries[key] = favoritesFixCacheRecord(media);
        }
        favoritesFixWriteCache(cache);
        const nextView = favoritesFixCollectCards();
        state.loadedRoute = info.routeKey;
        state.loadedSignature = getSignature(nextView.cards);
        FAVORITES_FIX_STATS.source = result.source;
        FAVORITES_FIX_STATS.successCount += 1;
        FAVORITES_FIX_STATS.apiCount = entries.length;
        FAVORITES_FIX_STATS.restoredCount += restored;
        FAVORITES_FIX_STATS.updatedCount += changed;
        FAVORITES_FIX_STATS.cachedCount = Object.keys(cache.entries).length;
        FAVORITES_FIX_STATS.lastError = "";
        favoritesFixRefreshStats();
        const existingKeys = new Set(view.cards.flatMap((card) => favoritesFixCardIdentityKeys(card).map((key) => key.toLowerCase())));
        const externalEntries = entries.filter((media) => {
          const key = favoritesFixKey(media);
          return targetKeys.has(key) || result.canRecoverHidden && media.hidden && !existingKeys.has(key);
        });
        void favoritesFixRecoverExternal(externalEntries, cache, (media, key) => {
          if (generation !== state.generation || !isFavoritesFixPage()) return;
          const currentView = favoritesFixCollectCards();
          const recoveredKeys = new Set(favoritesFixMediaIdentityKeys(media).map((id) => id.toLowerCase()));
          recoveredKeys.add(key);
          const card = currentView.cards.find((item) => favoritesFixCardIdentityKeys(item).some((id) => recoveredKeys.has(id.toLowerCase())));
          if (card && (favoritesFixIsRepairTarget(card) || card.dataset?.bilikitFavoritesTarget === "1" || card.closest?.(".bk-favfix-recovered-item")) && favoritesFixApplyCard(card, media, { showMenu, onClear: () => schedule(true) })) {
            FAVORITES_FIX_STATS.updatedCount += 1;
          }
          cache.entries[key] = favoritesFixCacheRecord(media);
          favoritesFixWriteCache(cache);
          FAVORITES_FIX_STATS.cachedCount = Object.keys(cache.entries).length;
          favoritesFixRefreshStats();
        }).catch((error) => {
          if (generation !== state.generation || !isFavoritesFixPage()) return;
          FAVORITES_FIX_STATS.lastError = error instanceof Error ? error.message.slice(0, 180) : "收藏夹外部元数据恢复失败";
        });
      } catch (error) {
        if (generation !== state.generation) return;
        for (const card of view.targetCards) {
          favoritesFixApplyCard(card, favoritesFixMediaFromCard(card), { showMenu, onClear: () => schedule(true) });
        }
        state.loadedRoute = info.routeKey;
        state.loadedSignature = getSignature(favoritesFixCollectCards().cards);
        FAVORITES_FIX_STATS.failureCount += 1;
        FAVORITES_FIX_STATS.lastError = error instanceof Error ? error.message.slice(0, 180) : "收藏夹修复失败";
        FAVORITES_FIX_STATS.lastFailure = FAVORITES_FIX_STATS.lastError;
        favoritesFixRefreshStats();
        console.warn("[BiliKit] 收藏夹元数据读取失败：", error);
      } finally {
        state.running = false;
      }
    };
    const attachObserver = () => {
      const target = document.querySelector(".fav-list-main") || document.querySelector("#app") || document.body;
      if (!target || state.observer) return;
      state.observer = runtime.createObserver(() => {
        let cleaned = false;
        for (const card of target.querySelectorAll?.("[data-bilikit-favorites-target='1'], .bk-favfix-recovered-item .bili-video-card") || []) {
          const media = card.__bkFavoritesMedia;
          if (favoritesFixClearLoadingLabels(card, favoritesFixDisplayTitle(media || favoritesFixMediaFromCard(card)))) cleaned = true;
        }
        if (!cleaned && !state.running) schedule();
      });
      state.observer?.observe(target, { childList: true, subtree: true });
    };
    runtime.listen(window, "popstate", () => schedule(true));
    runtime.listen(window, "pageshow", () => schedule(true));
    if (document.readyState === "loading") runtime.listen(document, "DOMContentLoaded", () => { attachObserver(); schedule(); }, { once: true });
    else { attachObserver(); schedule(); }
    favoritesFixRefreshStats();
    window.__BILIKIT_FAVORITES_FIX_API__ = { refresh: () => schedule(true), clear: () => { localStorage.removeItem(FAVORITES_FIX_CACHE_KEY); schedule(true); } };
  }
  const favoritesFix = {
    id: "favorites-fix",
    name: "收藏夹修复",
    description: "恢复失效收藏和公开收藏夹中被隐藏的视频，并补全资料与悬停提示",
    category: "增强",
    defaultEnabled: true,
    runAt: "idle",
    note: "仅在 space.bilibili.com 的收藏夹页运行。优先使用 B 站官方收藏夹公开元数据接口；标题或封面仍为占位时，会按 AV 号查询有限的公开元数据来源，只接受明确有效的结果。标题和封面独立恢复，仍为占位的目标封面可悬停查看完整资料，缓存只保存公开元数据和短期命中状态。",
    settings: [
      { key: "recoverHidden", type: "toggle", label: "恢复公开收藏夹中的隐藏视频", default: true, hint: "只插入 B 站公开接口明确标记为隐藏、且当前页面没有的条目；搜索和筛选页面不自动补齐" },
      { key: "showMenu", type: "toggle", label: "显示收藏夹工具菜单", default: true, hint: "在卡片右上角提供复制信息、查看封面、打开 UP 主空间和清除单条缓存" }
    ],
    init: initFavoritesFix
  };
  const wayBack = {
    id: "way-back",
    name: "回程",
    description: "视频页左下角回退栈：记住来时路，点一下跳回上一个视频并续播（顶层与抽屉内都生效）",
    category: "播放",
    defaultEnabled: true,
    runAt: "start",
    // 需在 B 站用 pushState 跳视频之前包上
    settings: [
      { key: "resumeTime", type: "toggle", label: "跳回时续播", default: true, hint: "跳回上一个视频时带上离开时的播放进度（?t=），从原处接着看" }
    ],
    init
  };
  function initDownloadWorkspace() {
    // downloadWorkspace 在 registry 中排在 no-login 前面，因此这里安装捕获器
    // 仍早于免登录模块读取首份 SSR/playurl 响应；捕获器和播放器入口都由
    // 当前模块的生命周期统一管理。
    const disposeCapture = installDownloadCapture();
    const disposeEntry = installPlayerDownloadEntry();
    return () => {
      disposeEntry?.();
      disposeCapture?.();
      cancelDownloadActiveFetch("下载工作台模块已关闭");
      cancelDownloadBatch("下载工作台模块已关闭");
      closeDownloadWorkspaceForNavigation("download-module-disabled");
      clearDownloadPlayinfoCache("download-module-disabled");
    };
  }
  const downloadWorkspace = {
    id: "download-workspace",
    name: "下载工作台",
    description: "控制下载列表的进度、速度、文件大小和预计时间显示",
    category: "播放",
    runAt: "start",
    settings: [
      { key: "showOverview", type: "toggle", label: "显示全局下载摘要", default: true, hint: "显示总速度、综合保存进度和三类预计剩余时间" },
      { key: "showGlobalSpeed", type: "toggle", label: "显示总下载速度", default: true, hint: "按所有活动任务的媒体字节汇总，不包含保存阶段" },
      { key: "showGlobalEta", type: "toggle", label: "显示全局预计时间", default: true, hint: "显示下载和总计的预计剩余时间" },
      { key: "showGlobalProgress", type: "toggle", label: "显示全局综合进度", default: true, hint: "只显示按任务媒体大小加权的综合进度" },
      { key: "showFileSize", type: "toggle", label: "显示预计文件大小", default: true, hint: "优先使用响应长度，没有长度时按轨道码率和时长估算" },
      { key: "showTaskProgress", type: "toggle", label: "显示任务阶段进度", default: true, hint: "显示每个任务的下载、转码和总进度" },
      { key: "refreshIntervalMs", type: "number", label: "进度刷新间隔（毫秒）", default: 500, min: 250, max: 2000, step: 50, hint: "范围 250–2000 毫秒；数值越小更新越频繁" },
      { key: "remuxSampleMinMs", type: "number", label: "本地合并估算样本最短耗时（毫秒）", default: 3000, min: 3000, max: 5000, step: 250, hint: "只用于总计时间估算，不单独显示预计转码；范围 3000–5000 毫秒" }
    ],
    init: initDownloadWorkspace
  };
  const NS = "bk";
  const NEWTAB_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  const CLOSE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const CSS = `
/* 按钮体**跟随页面主题**（--bg1/--text2）：浅色页浅按钮、深色页深按钮。
   凸显靠**阴影随主题反相**：浅色→黑色投影压出立体，深色→白色辉光(halo)把深按钮从暗遮罩里托起来（见 @media dark）。 */
.${NS}-dctrls button{ width:40px; height:40px; border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--line_regular,#e3e5e7); background:var(--bg1,#fff); color:var(--text2,#61666d); cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.5); transition:color .16s ease, transform .16s ease, box-shadow .16s ease, opacity .18s ease; }
.${NS}-dctrls button:hover{ color:var(--brand_blue,#00aeec); transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.6); }
.${NS}-dctrls button:active{ transform:scale(.94); }
/* 深色模式：按钮体仍跟主题（深底），阴影反相为白色辉光，把深按钮从暗遮罩里托起来 */
@media (prefers-color-scheme: dark){ .${NS}-dctrls button{ box-shadow:0 0 8px rgba(255,255,255,.45); } .${NS}-dctrls button:hover{ box-shadow:0 0 12px rgba(255,255,255,.6); } }
@keyframes bk-dspin{ to{ transform:rotate(360deg); } }
.${NS}-dmask{ position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,.5); opacity:0; pointer-events:none; transition:opacity .3s ease; }
.${NS}-dmask.on{ opacity:1; pointer-events:auto; }
.${NS}-drawer{ position:fixed; left:0; right:0; bottom:0; height:calc(100% - 64px); z-index:100001; display:flex; flex-direction:column; background:var(--bg1,#fff); border-radius:14px 14px 0 0; box-shadow:0 -8px 40px rgba(0,0,0,.35); transform:translateY(100%); transition:transform .32s cubic-bezier(.32,.72,0,1); overflow:hidden; }
.${NS}-drawer.on{ transform:translateY(0); }
.${NS}-drawer.parked{ visibility:hidden; }
.${NS}-dframe{ flex:1; width:100%; border:0; display:block; }
.${NS}-dload{ position:absolute; inset:0; z-index:1; display:flex; align-items:center; justify-content:center; background:#18191c; opacity:0; pointer-events:none; transition:opacity .3s ease; }
.${NS}-drawer.loading .${NS}-dload{ opacity:1; }
.${NS}-dload-cover{ position:absolute; inset:0; background-size:cover; background-position:center; filter:blur(24px) brightness(.6); transform:scale(1.1); }
.${NS}-dspin{ position:relative; width:42px; height:42px; border:3px solid rgba(255,255,255,.2); border-top-color:var(--brand_blue,#00aeec); border-radius:50%; animation:bk-dspin .8s linear infinite; }
@media (prefers-color-scheme: light){ .${NS}-dload{ background:#f4f4f5; } .${NS}-dspin{ border-color:rgba(0,0,0,.12); border-top-color:var(--brand_blue,#00aeec); } }
.${NS}-dctrls{ position:fixed; top:14px; right:18px; z-index:100002; display:flex; gap:10px; opacity:0; pointer-events:none; transition:opacity .3s ease; }
.${NS}-dctrls.on{ opacity:1; pointer-events:auto; }
.${NS}-drawer.download-mode .bk-newtab{ display:none!important; }
.bk-download-workspace{ --bk-dw-bg:#18191c; --bk-dw-surface:#23252b; --bk-dw-text-primary:#e3e5e7; --bk-dw-text-secondary:#b7bbc3; --bk-dw-text-tertiary:#9499a0; --bk-dw-line:rgba(255,255,255,.14); position:absolute; inset:0; z-index:2; overflow:auto; background:var(--bk-dw-bg); color:var(--bk-dw-text-primary); padding:30px 24px 36px; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; }
.bk-download-workspace.bk-theme-light{ --bk-dw-bg:#fff; --bk-dw-surface:#fff; --bk-dw-text-primary:#18191c; --bk-dw-text-secondary:#61666d; --bk-dw-text-tertiary:#9499a0; --bk-dw-line:rgba(0,0,0,.14); }
.bk-dw-inner{ width:min(820px,100%); margin:0 auto; }
.bk-dw-header h1,.bk-dw-task-heading,.bk-dw-video-title{ color:var(--bk-dw-text-primary); }
.bk-dw-header h1{ margin:0; font-size:24px; line-height:1.25; font-weight:650; letter-spacing:-.02em; }
.bk-dw-header p,.bk-dw-meta,.bk-dw-note{ color:var(--bk-dw-text-tertiary); }
.bk-dw-header p{ margin:8px 0 22px; }
.bk-dw-video-title{ font-size:17px; font-weight:600; overflow-wrap:anywhere; }
.bk-dw-meta{ margin:7px 0 22px; font-size:13px; }
.bk-dw-selectors{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.bk-dw-episodes{ margin:18px 0 20px; padding:14px; border:1px solid var(--bk-dw-line); border-radius:12px; background:var(--bk-dw-surface); }
.bk-dw-episodes-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.bk-dw-episodes-head h2{ margin:0; color:var(--bk-dw-text-primary); font-size:16px; }
.bk-dw-episodes-tools{ display:flex; flex-wrap:wrap; gap:8px; }
.bk-dw-episodes-tools button{ min-height:32px; border:1px solid var(--bk-dw-line); border-radius:8px; padding:0 10px; background:transparent; color:var(--bk-dw-text-secondary); font:inherit; cursor:pointer; }
.bk-dw-episode-list{ display:grid; gap:6px; max-height:290px; overflow:auto; }
.bk-dw-episode{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; min-height:42px; padding:7px 9px; border-radius:9px; color:var(--bk-dw-text-secondary); }
.bk-dw-episode-group{ border:1px solid var(--bk-dw-line); background:color-mix(in srgb,var(--bk-dw-text-primary) 3%,transparent); }
.bk-dw-episode-child{ margin-left:26px; padding-left:12px; border-left:2px solid var(--bk-dw-line); }
.bk-dw-episode:hover,.bk-dw-episode.current{ background:color-mix(in srgb,var(--bk-dw-text-primary) 7%,transparent); }
.bk-dw-episode input{ width:18px; height:18px; accent-color:var(--brand_blue,#00aeec); }
.bk-dw-episode-main{ min-width:0; display:grid; gap:1px; }
.bk-dw-episode-title{ color:var(--bk-dw-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bk-dw-episode-meta{ color:var(--bk-dw-text-tertiary); font-size:12px; }
.bk-dw-episode-duration{ color:var(--bk-dw-text-secondary); font-variant-numeric:tabular-nums; white-space:nowrap; }
.bk-dw-episode.invalid{ color:var(--bk-dw-text-tertiary); opacity:.7; }
.bk-dw-episode.invalid .bk-dw-episode-title,.bk-dw-episode.invalid .bk-dw-episode-meta{ color:var(--bk-dw-text-tertiary); }
.bk-dw-field{ display:grid; gap:7px; min-width:0; color:var(--bk-dw-text-secondary); font-size:13px; }
.bk-dw-field select{ width:100%; min-height:44px; border:1px solid var(--bk-dw-line); border-radius:10px; padding:0 12px; background:var(--bk-dw-surface); color:var(--bk-dw-text-primary); font:inherit; }
.bk-dw-actions{ display:flex; flex-wrap:wrap; gap:10px; margin:20px 0 12px; }
.bk-dw-action,.bk-dw-task-action{ min-height:44px; border:1px solid var(--bk-dw-line); border-radius:11px; padding:0 16px; background:var(--bk-dw-surface); color:var(--bk-dw-text-primary); font:inherit; font-size:14px; font-weight:600; cursor:pointer; }
.bk-dw-action.primary,.bk-dw-task-action.primary{ border-color:var(--brand_blue,#00aeec); background:var(--brand_blue,#00aeec); color:#fff; }
.bk-dw-action:disabled{ opacity:.45; cursor:not-allowed; }
.bk-dw-note{ margin:14px 0 28px; font-size:12px; }
.bk-dw-task-heading{ margin:0; font-size:16px; }
.bk-dw-overview{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px 14px; margin:0 0 10px; padding:9px 11px; border:1px solid var(--bk-dw-line); border-radius:10px; background:var(--bk-dw-surface); }
.bk-dw-overview-item{ min-width:0; display:flex; align-items:baseline; justify-content:space-between; gap:8px; color:var(--bk-dw-text-tertiary); font-size:12px; }
.bk-dw-overview-label{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bk-dw-overview-value{ color:var(--bk-dw-text-secondary); font-variant-numeric:tabular-nums; white-space:nowrap; }
.bk-dw-task-metrics{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px 10px; color:var(--bk-dw-text-tertiary); font-size:12px; font-variant-numeric:tabular-nums; }
.bk-dw-task-metric{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bk-dw-task-progress-row{ display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; }
.bk-dw-task-progress-row progress{ min-width:0; }
.bk-dw-task-progress-value{ color:var(--bk-dw-text-secondary); font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.bk-dw-task-size{ color:var(--bk-dw-text-tertiary); font-size:12px; font-variant-numeric:tabular-nums; }
.bk-dw-tasks{ display:grid; gap:9px; }
.bk-dw-empty{ margin:0; padding:16px; border:1px dashed var(--bk-dw-line); border-radius:12px; color:var(--bk-dw-text-tertiary); }
.bk-dw-task{ display:grid; gap:9px; padding:14px; border:1px solid var(--bk-dw-line); border-radius:12px; background:var(--bk-dw-surface); }
.bk-dw-task-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.bk-dw-task-head strong{ min-width:0; overflow-wrap:anywhere; color:var(--bk-dw-text-primary); }
.bk-dw-task-detail{ margin:0; color:var(--bk-dw-text-tertiary); font-size:12px; overflow-wrap:anywhere; }
.bk-dw-status{ color:var(--bk-dw-text-tertiary); font-size:12px; white-space:nowrap; }
.bk-dw-status.complete{ color:#2e8b57; }
.bk-dw-status.error,.bk-dw-status.canceled{ color:#d04a4a; }
.bk-dw-task progress{ width:100%; height:7px; accent-color:var(--brand_blue,#00aeec); }
.bk-dw-task-action{ justify-self:start; min-height:36px; font-size:13px; }
@media(max-width:640px){ .bk-download-workspace{ padding:26px 16px 28px; } .bk-dw-selectors{ grid-template-columns:1fr; } .bk-dw-overview{ grid-template-columns:repeat(2,minmax(0,1fr)); } .bk-dw-task-metrics{ grid-template-columns:1fr; } .bk-dw-header h1{ font-size:21px; } }
@media(prefers-reduced-motion:reduce){ .bk-download-workspace *, .bk-download-workspace *::before, .bk-download-workspace *::after{ scroll-behavior:auto!important; animation:none!important; transition:none!important; } }
`;
  let styled = false;
  let mask = null;
  let panel = null;
  let frame = null;
  let ctrls = null;
  let loadCover = null;
  let closeTimer = null;
  let loadTimer = null;
  let drawerOpen = false;
  let curUrl = "";
  let curWebFull = false;
  let curImmersive = false;
  let gotReady = false;
  let gotWebfull = false;
  let historyActive = false;
  let historyOwned = false;
  let historyClosing = false;
  let historyOriginUrl = "";
  let historyOriginState = null;
  let activeRoute = null;
  let historyCloseFallback = null;
  let pendingOpen = null;
  let frameToken = "";
  let frameRouteToken = "";
  let framePublicUrl = "";
  let frameWebFull = false;
  let frameReady = false;
  let pendingFrameReplace = null;
  let queuedFrameReplace = null;
  let suspendRetryTimer = null;
  let downloadWorkspaceRoot = null;
  let downloadWorkspaceMode = false;
  let DOWNLOAD_WORKSPACE_ROOT = null;
  function disposeDownloadWorkspaceRoot() {
    cancelDownloadBatch("下载工作台已重新打开");
    if (!downloadWorkspaceRoot) return;
    try { downloadWorkspaceRoot.__bkDispose?.(); } catch {}
    downloadWorkspaceRoot.remove();
    downloadWorkspaceRoot = null;
    DOWNLOAD_WORKSPACE_ROOT = null;
    DOWNLOAD_WORKSPACE_CATALOG = [];
    DOWNLOAD_WORKSPACE_COLLECTION = [];
  }
  function closeDownloadWorkspaceForNavigation(reason = "") {
    cancelDownloadBatch(reason || "页面导航已取消批量任务");
    disposeDownloadWorkspaceRoot();
    downloadWorkspaceMode = false;
    panel == null ? void 0 : panel.classList.remove("download-mode");
    if (frame) frame.style.display = "";
  }
  const FRAME_LANDING_TIMEOUT = 15e3;
  const nativePushState = History.prototype.pushState;
  const nativeReplaceState = History.prototype.replaceState;
  function newHistoryToken() {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }
  function displayUrlFor(route) {
    return drawerDisplayUrl(route.url, location.href) || location.href;
  }
  function replaceDrawerHistory(route) {
    try {
      const state = withDrawerRoute(history.state, route);
      nativeReplaceState.call(history, state, "", displayUrlFor(route));
      activeRoute = route;
      historyActive = true;
      historyOwned = true;
      return true;
    } catch {
      return false;
    }
  }
  function pushDrawerHistory(route) {
    historyOriginUrl = location.href;
    historyOriginState = history.state;
    try {
      nativeReplaceState.call(history, withDrawerOrigin(historyOriginState, route.token), "", historyOriginUrl);
      nativePushState.call(history, withDrawerRoute(historyOriginState, route), "", displayUrlFor(route));
      activeRoute = route;
      historyActive = true;
      historyOwned = true;
      return true;
    } catch {
      try {
        nativeReplaceState.call(history, historyOriginState, "", historyOriginUrl);
      } catch {
      }
      historyActive = false;
      historyOwned = false;
      return false;
    }
  }
  function syncDrawerHistory(url) {
    if (!drawerOpen || historyClosing || !historyActive || !activeRoute) return;
    const expectedOrigin = new URL(activeRoute.url, location.href).origin;
    const publicUrl = safeDrawerVideoUrl(url, expectedOrigin);
    if (!publicUrl) return;
    if (curUrl && curUrl !== publicUrl) closeDownloadWorkspaceForNavigation("drawer-location");
    curUrl = publicUrl;
    framePublicUrl = publicUrl;
    replaceDrawerHistory({ ...activeRoute, url: publicUrl });
  }
  function finishHistoryClose() {
    if (historyCloseFallback) {
      clearTimeout(historyCloseFallback);
      historyCloseFallback = null;
    }
    historyClosing = false;
    historyActive = false;
    try {
      nativeReplaceState.call(history, historyOriginState, "", historyOriginUrl);
    } catch {
    }
    const next = pendingOpen;
    pendingOpen = null;
    if (next) queueMicrotask(() => openDrawer(next.url, next.cover, next.webFull, next.immersive));
  }
  function consumeDrawerHistory() {
    if (!historyOwned || !historyActive || !activeRoute || historyClosing) return;
    historyClosing = true;
    replaceDrawerHistory(activeRoute);
    try {
      history.back();
    } catch {
      finishHistoryClose();
      return;
    }
    historyCloseFallback = setTimeout(() => {
      if (!historyClosing) return;
      historyOwned = false;
      finishHistoryClose();
    }, 1200);
  }
  function tryReveal() {
    var _a;
    if (!drawerOpen) return false;
    if (!gotReady) return false;
    if (curWebFull && curImmersive && !gotWebfull) return false;
    setLoading(false);
    try {
      frame == null ? void 0 : frame.focus({ preventScroll: true });
    } catch {
    }
    try {
      (_a = frameWin()) == null ? void 0 : _a.focus();
    } catch {
    }
    return true;
  }
  function frameWin() {
    try {
      return (frame == null ? void 0 : frame.contentWindow) || null;
    } catch {
      return null;
    }
  }
  function postFrameCommand(type) {
    var _a;
    if (!frame || !frameToken || !framePublicUrl) return;
    let origin;
    try {
      origin = new URL(framePublicUrl, location.href).origin;
    } catch {
      return;
    }
    try {
      (_a = frame.contentWindow) == null ? void 0 : _a.postMessage({ type, token: frameToken }, origin);
    } catch {
    }
  }
  function stopSuspendRetries() {
    if (suspendRetryTimer) {
      clearInterval(suspendRetryTimer);
      suspendRetryTimer = null;
    }
  }
  function suspendFrameWithRetry() {
    stopSuspendRetries();
    postFrameCommand("bk-drawer-suspend");
    let left = 12;
    suspendRetryTimer = setInterval(() => {
      if (drawerOpen || --left <= 0) {
        stopSuspendRetries();
        return;
      }
      postFrameCommand("bk-drawer-suspend");
    }, 150);
  }
  function cancelPendingFrameReplace() {
    if (!pendingFrameReplace) return;
    if (pendingFrameReplace.timer) clearTimeout(pendingFrameReplace.timer);
    pendingFrameReplace = null;
  }
  function rebuildFrameDocument(route, marked) {
    cancelPendingFrameReplace();
    queuedFrameReplace = null;
    const previous = frame;
    if (previous == null ? void 0 : previous.isConnected) previous.remove();
    frame = createFrame();
    if (loadCover) loadCover.style.backgroundImage = route.cover ? `url("${route.cover}")` : "";
    setLoading(true);
    finishFrameReplace(route, marked);
    panel.insertBefore(frame, panel.firstChild);
  }
  function armFrameLandingWatchdog(pending) {
    if (pending.phase !== "navigate") return;
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      if (pendingFrameReplace !== pending) return;
      if (!drawerOpen) {
        pending.timer = null;
        return;
      }
      const fallback = queuedFrameReplace || { route: pending.route, marked: pending.marked };
      rebuildFrameDocument(fallback.route, fallback.marked);
    }, FRAME_LANDING_TIMEOUT);
  }
  function finishFrameReplace(route, marked, fresh, nextToken = newHistoryToken()) {
    cancelPendingFrameReplace();
    frameRouteToken = route.token;
    frameToken = nextToken;
    framePublicUrl = route.url;
    frameWebFull = route.webFull;
    frameReady = false;
    gotReady = false;
    gotWebfull = false;
    frame.name = drawerFrameName({ token: frameToken, webFull: route.webFull });
    {
      frame.src = marked;
    }
  }
  function acceptFrameReplace(pending) {
    if (pending.phase !== "navigate" || !pending.nextToken || pending.accepted) return;
    pending.accepted = true;
    frameRouteToken = pending.route.token;
    frameToken = pending.nextToken;
    framePublicUrl = pending.route.url;
    frameWebFull = pending.route.webFull;
    frameReady = false;
    gotReady = false;
    gotWebfull = false;
    frame.name = drawerFrameName({ token: frameToken, webFull: frameWebFull });
  }
  function recoverFrameReplace(route) {
    if ((pendingFrameReplace == null ? void 0 : pendingFrameReplace.route) !== route) return;
    const failedPhase = pendingFrameReplace.phase;
    cancelPendingFrameReplace();
    if (failedPhase === "suspend" && !frameReady && drawerOpen) {
      const fallback = queuedFrameReplace || { route, marked: route.url.split("#")[0] + (route.webFull ? DRAWER_WEB_MARK : DRAWER_MARK) };
      rebuildFrameDocument(fallback.route, fallback.marked);
      return;
    }
    if ((activeRoute == null ? void 0 : activeRoute.token) === route.token && activeRoute.url === route.url && framePublicUrl) {
      const restored = { ...activeRoute, url: framePublicUrl, webFull: frameWebFull };
      activeRoute = restored;
      curUrl = restored.url;
      curWebFull = restored.webFull;
      if (drawerOpen && historyActive && !historyClosing) replaceDrawerHistory(restored);
    }
    const queued = queuedFrameReplace;
    queuedFrameReplace = null;
    if (drawerOpen && queued) {
      replaceFrameDocument(queued.route, queued.marked, false);
      return;
    }
    setLoading(false);
    if (drawerOpen && frameReady && tryReveal()) postFrameCommand("bk-drawer-resume");
  }
  function requestFrameReplace(route, marked) {
    var _a;
    const previousToken = frameToken;
    let previousOrigin;
    try {
      previousOrigin = new URL(framePublicUrl, location.href).origin;
    } catch {
      recoverFrameReplace(route);
      return;
    }
    const nextToken = newHistoryToken();
    if (pendingFrameReplace == null ? void 0 : pendingFrameReplace.timer) clearTimeout(pendingFrameReplace.timer);
    pendingFrameReplace = { route, marked, phase: "navigate", nextToken, accepted: false, timer: null };
    armFrameLandingWatchdog(pendingFrameReplace);
    try {
      (_a = frame.contentWindow) == null ? void 0 : _a.postMessage({
        type: "bk-drawer-replace",
        token: previousToken,
        nextToken,
        url: marked,
        webFull: route.webFull
      }, previousOrigin);
    } catch {
      recoverFrameReplace(route);
    }
  }
  function replaceFrameDocument(route, marked, fresh) {
    cancelPendingFrameReplace();
    if (loadCover) loadCover.style.backgroundImage = route.cover ? `url("${route.cover}")` : "";
    setLoading(true);
    if (fresh) {
      finishFrameReplace(route, marked);
      return;
    }
    const timer = setTimeout(() => {
      if ((pendingFrameReplace == null ? void 0 : pendingFrameReplace.route) !== route) return;
      recoverFrameReplace(route);
    }, 350);
    pendingFrameReplace = { route, marked, phase: "suspend", timer };
    postFrameCommand("bk-drawer-suspend");
  }
  function setLoading(on) {
    panel == null ? void 0 : panel.classList.toggle("loading", on);
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (on) loadTimer = setTimeout(() => setLoading(false), 6e3);
  }
  function createFrame() {
    const f = document.createElement("iframe");
    f.className = `${NS}-dframe`;
    f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write";
    f.allowFullscreen = true;
    f.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads");
    f.addEventListener("load", () => {
      if (!drawerOpen && f === frame) postFrameCommand("bk-drawer-suspend");
    });
    return f;
  }
  function ensureDom() {
    if (mask) return;
    if (!styled) {
      styled = true;
      const s = document.createElement("style");
      s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    }
    mask = document.createElement("div");
    mask.className = `${NS}-dmask`;
    panel = document.createElement("div");
    panel.className = `${NS}-drawer`;
    window.addEventListener("message", (e) => {
      if (e.source !== frameWin()) return;
      const route = activeRoute;
      if (!route || !e.data || typeof e.data !== "object") return;
      const pendingAtArrival = pendingFrameReplace;
      const fromCurrentDocument = e.data.token === frameToken;
      const fromPendingDocument = (pendingAtArrival == null ? void 0 : pendingAtArrival.phase) === "navigate" && e.data.token === pendingAtArrival.nextToken;
      if (!fromCurrentDocument && !fromPendingDocument) return;
      let expectedOrigin;
      try {
        expectedOrigin = new URL(fromPendingDocument ? pendingAtArrival.route.url : framePublicUrl, location.href).origin;
      } catch {
        return;
      }
      if (e.origin !== expectedOrigin) return;
      if (fromPendingDocument && (pendingAtArrival == null ? void 0 : pendingAtArrival.nextToken)) {
        acceptFrameReplace(pendingAtArrival);
        cancelPendingFrameReplace();
        const queued = queuedFrameReplace;
        queuedFrameReplace = null;
        if (drawerOpen && queued) {
          replaceFrameDocument(queued.route, queued.marked, false);
          return;
        }
      }
      if (e.data.type === "bk-drawer-download-open") {
        const snapshot = normalizeDownloadSnapshot(e.data.workbench);
        if (snapshot && downloadSnapshotMatchesDrawerRoute(snapshot)) openDownloadWorkspace(snapshot, e.data.catalog, e.data.collection);
      } else if (e.data.type === "bk-drawer-download-update") {
        const snapshot = normalizeDownloadSnapshot(e.data.workbench);
        if (snapshot && downloadSnapshotMatchesDrawerRoute(snapshot) && downloadWorkspaceMode && downloadWorkspaceRoot?.isConnected &&
          (Number(downloadWorkspaceRoot.dataset.bkVideoTrackCount) === 0 || Number(downloadWorkspaceRoot.dataset.bkAudioTrackCount) === 0)) {
          openDownloadWorkspace(snapshot, DOWNLOAD_WORKSPACE_CATALOG, DOWNLOAD_WORKSPACE_COLLECTION);
        }
      } else if (e.data.type === "bk-drawer-download-fetch-status") {
        if (downloadWorkspaceMode && downloadWorkspaceRoot?.isConnected) {
          updateDownloadWorkspaceFetchStatus(e.data);
        }
      } else if (e.data.type === "bk-drawer-ready") {
        if (pendingFrameReplace) return;
        frameReady = true;
        gotReady = true;
        if (!drawerOpen) postFrameCommand("bk-drawer-suspend");
        else if (tryReveal()) postFrameCommand("bk-drawer-resume");
      } else if (e.data.type === "bk-drawer-suspended") {
        stopSuspendRetries();
        const pending = pendingFrameReplace;
        if ((pending == null ? void 0 : pending.phase) === "suspend" && drawerOpen) requestFrameReplace(pending.route, pending.marked);
      } else if (e.data.type === "bk-drawer-replacing" && (pendingFrameReplace == null ? void 0 : pendingFrameReplace.phase) === "navigate" && e.data.nextToken === pendingFrameReplace.nextToken) {
        const pending = pendingFrameReplace;
        acceptFrameReplace(pending);
      } else if (e.data.type === "bk-drawer-replace-failed" && (pendingFrameReplace == null ? void 0 : pendingFrameReplace.phase) === "navigate" && e.data.nextToken === pendingFrameReplace.nextToken) {
        recoverFrameReplace(pendingFrameReplace.route);
      } else if (e.data.type === "bk-drawer-navigating" && typeof e.data.url === "string" && typeof e.data.nextToken === "string" && /^[0-9a-z-]{8,}$/i.test(e.data.nextToken)) {
        const expectedOrigin2 = new URL(framePublicUrl, location.href).origin;
        const publicUrl = safeDrawerVideoUrl(e.data.url, expectedOrigin2);
        if (!publicUrl) return;
        closeDownloadWorkspaceForNavigation("drawer-navigating");
        const superseded = pendingFrameReplace;
        const latestParentTarget = drawerOpen ? queuedFrameReplace || (superseded ? { route: superseded.route, marked: superseded.marked } : null) : null;
        cancelPendingFrameReplace();
        const internalRoute = {
          ...route,
          token: frameRouteToken || route.token,
          url: publicUrl,
          webFull: frameWebFull
        };
        const internalMarked = publicUrl.split("#")[0] + (internalRoute.webFull ? DRAWER_WEB_MARK : DRAWER_MARK);
        pendingFrameReplace = {
          route: internalRoute,
          marked: internalMarked,
          phase: "navigate",
          nextToken: e.data.nextToken,
          accepted: false,
          timer: null
        };
        armFrameLandingWatchdog(pendingFrameReplace);
        acceptFrameReplace(pendingFrameReplace);
        const sameAsParent = (latestParentTarget == null ? void 0 : latestParentTarget.route.url) === publicUrl && latestParentTarget.route.webFull === internalRoute.webFull;
        queuedFrameReplace = sameAsParent ? null : latestParentTarget;
        if (!queuedFrameReplace) {
          curUrl = publicUrl;
          activeRoute = internalRoute;
          if (drawerOpen && historyActive && !historyClosing) replaceDrawerHistory(internalRoute);
        }
        if (drawerOpen) setLoading(true);
      } else if (e.data.type === "bk-drawer-webfull") {
        if (pendingFrameReplace) return;
        gotWebfull = true;
        if (tryReveal()) postFrameCommand("bk-drawer-resume");
      } else if (e.data.type === "bk-drawer-reveal-timeout") {
        if (pendingFrameReplace) return;
        gotWebfull = true;
        if (drawerOpen && gotReady && tryReveal()) postFrameCommand("bk-drawer-resume");
      } else if (e.data.type === "bk-drawer-close") closeDrawer();
      else if (e.data.type === "bk-drawer-location" && typeof e.data.url === "string") {
        if (!pendingFrameReplace) syncDrawerHistory(e.data.url);
      }
    });
    window.addEventListener("popstate", (e) => {
      const stateRoute = readDrawerRoute(e.state);
      const token = (activeRoute == null ? void 0 : activeRoute.token) || "";
      const route = (stateRoute == null ? void 0 : stateRoute.token) === token ? stateRoute : null;
      const atOrigin = !!token && (readDrawerOrigin(e.state) === token || !route && location.href === historyOriginUrl);
      if (historyClosing) {
        e.stopImmediatePropagation();
        if (atOrigin) {
          finishHistoryClose();
          return;
        }
        try {
          history.back();
        } catch {
          finishHistoryClose();
        }
        return;
      }
      if (route) {
        e.stopImmediatePropagation();
        historyActive = true;
        historyOwned = true;
        activeRoute = route;
        showDrawer(route);
        return;
      }
      if (!historyActive && historyOwned && activeRoute) {
        const display = drawerDisplayUrl(activeRoute.url, historyOriginUrl);
        if (display === location.href) {
          e.stopImmediatePropagation();
          replaceDrawerHistory(activeRoute);
          showDrawer(activeRoute);
          return;
        }
      }
      if (historyActive && historyOwned) {
        e.stopImmediatePropagation();
        historyActive = false;
        try {
          nativeReplaceState.call(history, historyOriginState, "", historyOriginUrl);
        } catch {
        }
        hideDrawer();
        return;
      }
      if (panel == null ? void 0 : panel.classList.contains("on")) {
        queueMicrotask(() => {
          activeRoute = null;
          hideDrawer();
        });
      }
    }, true);
    setInterval(() => {
      var _a;
      if (!drawerOpen || !historyActive || historyClosing || !activeRoute) return;
      if (((_a = readDrawerRoute(history.state)) == null ? void 0 : _a.token) === activeRoute.token) return;
      replaceDrawerHistory(activeRoute);
    }, 500);
    const load2 = document.createElement("div");
    load2.className = `${NS}-dload`;
    loadCover = document.createElement("div");
    loadCover.className = `${NS}-dload-cover`;
    const spinner = document.createElement("div");
    spinner.className = `${NS}-dspin`;
    load2.append(loadCover, spinner);
    panel.appendChild(load2);
    ctrls = document.createElement("div");
    ctrls.className = `${NS}-dctrls`;
    ctrls.innerHTML = `<button class="bk-newtab" title="在新标签页打开" aria-label="在新标签页打开">${NEWTAB_SVG}</button><button class="bk-close" title="关闭" aria-label="关闭">${CLOSE_SVG}</button>`;
    ctrls.querySelector(".bk-newtab").addEventListener("click", () => {
      if (curUrl) {
        openBiliKitVideoTab(
          curUrl,
          get(NEW_TAB_HISTORY_FLATTEN_KEY, DEFAULT_NEW_TAB_HISTORY_FLATTEN)
        );
      }
      closeDrawer();
    });
    ctrls.querySelector(".bk-close").addEventListener("click", closeDrawer);
    mask.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (panel == null ? void 0 : panel.classList.contains("on"))) closeDrawer();
    });
    document.body.append(mask, panel, ctrls);
  }
  function showDrawer(route) {
    ensureDom();
    closeDownloadWorkspaceForNavigation("drawer-show");
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    drawerOpen = true;
    panel.classList.remove("parked");
    curUrl = route.url;
    curWebFull = route.webFull;
    curImmersive = route.immersive;
    const marked = route.url.split("#")[0] + (route.webFull ? DRAWER_WEB_MARK : DRAWER_MARK);
    const fresh = !frame;
    if (!frame) frame = createFrame();
    const irreversibleReplace = (pendingFrameReplace == null ? void 0 : pendingFrameReplace.phase) === "navigate" ? pendingFrameReplace : null;
    if (irreversibleReplace) {
      const sameTarget = irreversibleReplace.route.url === route.url && irreversibleReplace.route.webFull === route.webFull;
      queuedFrameReplace = sameTarget ? null : { route, marked };
      if (!irreversibleReplace.timer) armFrameLandingWatchdog(irreversibleReplace);
      setLoading(true);
    } else {
      cancelPendingFrameReplace();
      const reuseLoadedDocument = frameReady && canReuseDrawerDocument(
        { token: frameRouteToken, url: framePublicUrl, webFull: frameWebFull },
        route
      );
      const alreadyNavigating = !frameReady && frameRouteToken === route.token && framePublicUrl === route.url && frameWebFull === route.webFull;
      if (alreadyNavigating) {
        setLoading(true);
      } else if (!reuseLoadedDocument) {
        replaceFrameDocument(route, marked, fresh);
      } else {
        if (tryReveal()) postFrameCommand("bk-drawer-resume");
      }
    }
    if (fresh) panel.insertBefore(frame, panel.firstChild);
    if (frame) frame.style.display = "";
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => {
      mask.classList.add("on");
      panel.classList.add("on");
      ctrls.classList.add("on");
    });
  }
  function openDownloadWorkspace(snapshot, catalog = null, collection = null) {
    const model = normalizeDownloadSnapshot(snapshot);
    if (!model) return;
    ensureDom();
    disposeDownloadWorkspaceRoot();
    if (frame) {
      postFrameCommand("bk-drawer-suspend");
      frame.style.display = "none";
    }
    downloadWorkspaceMode = true;
    const basePage = isPlayPage() ? currentDownloadPageIdentity() : {
      videoId: model.videoId,
      bvid: model.bvid,
      aid: model.aid,
      cid: model.cid,
      page: model.page,
      title: model.title,
      duration: model.duration,
      routeKey: model.routeKey || `${model.videoId}|p=${model.page}|cid=${model.cid}`,
      stateMatchesUrl: true,
      urlVideoId: model.videoId,
      requiresCid: false
    };
    const initialCatalog = Array.isArray(catalog) && catalog.length
      ? catalog
      : readDownloadEpisodeCatalogFromDom(basePage);
    const initialCollection = Array.isArray(collection) && collection.length
      ? collection
      : readDownloadCollectionCatalog(basePage);
    downloadWorkspaceRoot = createUnifiedDownloadWorkspace(model, initialCatalog, initialCollection);
    const catalogController = new AbortController();
    downloadWorkspaceRoot.__bkCatalogController = catalogController;
    panel.appendChild(downloadWorkspaceRoot);
    panel.classList.add("download-mode");
    panel.classList.remove("parked");
    setLoading(false);
    drawerOpen = true;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => {
      mask.classList.add("on");
      panel.classList.add("on");
      ctrls.classList.add("on");
    });
    // 当前 BV 的 view 响应同时包含 pages 和 ugc_season。一次读取后再拆成
    // 普通分 P与合集叶子列表，避免打开工作台时并行发送两次相同的 view 请求。
    void fetchDownloadCatalogBundle(basePage, catalogController.signal, initialCatalog, initialCollection).then((bundle) => {
      if (!downloadWorkspaceRoot?.isConnected || downloadWorkspaceRoot.__bkCatalogController !== catalogController) return;
      downloadWorkspaceRoot.__bkRefreshDownloadCatalog?.(bundle?.catalog || []);
      downloadWorkspaceRoot.__bkRefreshDownloadCollection?.(bundle?.collection || []);
    });
  }
  window.__BILIKIT_OPEN_DOWNLOAD_WORKSPACE__ = openDownloadWorkspace;
  function openDrawer(url, cover = "", webFull = false, immersive = false) {
    if (historyClosing) {
      pendingOpen = { url, cover, webFull, immersive };
      return;
    }
    const existing = historyActive ? activeRoute : null;
    const route = {
      // history 会话 token 跨 Document 沿用；window.name 里的 Document nonce 每次换页更新。
      token: (existing == null ? void 0 : existing.token) || frameRouteToken || newHistoryToken(),
      url,
      cover,
      webFull,
      immersive
    };
    if (existing) {
      replaceDrawerHistory(route);
    } else {
      activeRoute = route;
      pushDrawerHistory(route);
    }
    showDrawer(route);
  }
  function hideDrawer() {
    if (!panel || !mask || !ctrls) return;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    drawerOpen = false;
    closeDownloadWorkspaceForNavigation("drawer-hide");
    queuedFrameReplace = null;
    if ((pendingFrameReplace == null ? void 0 : pendingFrameReplace.phase) === "suspend") cancelPendingFrameReplace();
    suspendFrameWithRetry();
    try {
      frame == null ? void 0 : frame.blur();
    } catch {
    }
    try {
      window.focus();
    } catch {
    }
    mask.classList.remove("on");
    panel.classList.remove("on");
    ctrls.classList.remove("on");
    setLoading(false);
    document.documentElement.style.overflow = "";
    closeTimer = setTimeout(() => {
      if (drawerOpen) return;
      panel == null ? void 0 : panel.classList.add("parked");
    }, 340);
  }
  function closeDrawer() {
    hideDrawer();
    if (historyOwned && historyActive) consumeDrawerHistory();
  }
  const PC_HOSTS = ["https://api.bilibili.com", "https://s1.hdslb.com", "https://i0.hdslb.com", "https://i1.hdslb.com", "https://i2.hdslb.com"];
  const SEARCH_PRECONNECT_HOSTS = ["https://api.bilibili.com", "https://i0.hdslb.com", "https://i1.hdslb.com", "https://i2.hdslb.com"];
  const HOME_PRECONNECT_HOSTS = ["https://s1.hdslb.com", "https://api.bilibili.com", "https://i0.hdslb.com", "https://api.vc.bilibili.com"];
  // 信息流封面/横幅的优先级观察范围；CDN 改写本身会覆盖所有 i0/i1/i2 的 bfs 图片。
  const BILI_MEDIA_IMAGE_RE = /^(?:https?:)?\/\/(?:i[0-2]\.)?hdslb\.com\/bfs\/(?:archive|banner|live|bangumi|feed-admin|sycp\/|upower\/|new_dyn\/|storyff\/)/i;
  const BILI_CDN_IMAGE_RE = /^\/bfs\//i;
  const HOME_IMAGE_HOSTS = ["i0.hdslb.com", "i1.hdslb.com", "i2.hdslb.com"];
  const HOME_IMAGE_DEFAULT_HOST = "i0.hdslb.com";
  const HOME_IMAGE_CACHE_KEY = "bilikit:home-image-cdn:v4";
  const HOME_IMAGE_CACHE_FALLBACK_KEYS = [];
  const HOME_IMAGE_CACHE_TTL = 15 * 60 * 1e3;
  const HOME_FEED_PRELOAD_ROWS_DEFAULT = 6;
  const HOME_FEED_PRELOAD_ROWS_MIN = 4;
  const HOME_FEED_PRELOAD_ROWS_MAX = 10;
  const HOME_FEED_AUTO_LOAD_DELAY = 3e3;
  const HOME_FEED_AUTO_LOAD_ROWS_DEFAULT = 10;
  const HOME_FEED_AUTO_LOAD_ROWS_MIN = 5;
  const HOME_FEED_AUTO_LOAD_ROWS_MAX = 15;
  const HOME_FEED_PRELOAD_MIN = 420;
  const HOME_FEED_PRELOAD_MAX = 2600;
  const HOME_FEED_PRELOAD_BATCH_MIN = 12;
  const HOME_FEED_PRELOAD_BATCH_MAX = 36;
  const HOME_FEED_AUTO_LOAD_MAX_PROBES = 3;
  const HOME_FEED_AUTO_LOAD_TIMEOUT = 8e3;
  const HOME_FEED_AUTO_LOAD_RETRY_DELAY = 800;
  const HOME_FEED_AUTO_LOAD_DOM_SETTLE = 120;
  const HOME_FEED_AUTO_LOAD_INTERNAL_SCROLL_GRACE = 500;
  const HOME_FEED_CARD_RE = /(?:^|\s)(?:feed-card|floor-single-card|bili-feed-card|bili-video-card)(?:\s|$)/;
  const HOME_FEED_CARD_SELECTOR = ".feed-card, .floor-single-card, .bili-feed-card, .bili-video-card";
  const HOME_FEED_FEED_HEARTBEAT_TTL = 15e3;
  const HOME_FEED_LAYOUT_FIX_ATTR = "data-bk-feed-layout";
  const HOME_FEED_LAYOUT_MARGIN_ATTR = "data-bk-feed-layout-margin";
  function clampHomeFeedNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }
  function isAppFeedActive() {
    let alive = 0;
    try {
      alive = Number(localStorage.getItem("bilikit:alive.feed") || 0);
    } catch {
    }
    return Date.now() - alive < HOME_FEED_FEED_HEARTBEAT_TTL || !!document.querySelector(".bk-feed-fab");
  }
  const PC_WINDOW = 12e3;
  let lastPc = -Infinity;
  function getRuntimeCoordinator() {
    const key = "__BILIKIT_PERFORMANCE_RUNTIME__";
    const current = window[key];
    if (current && !current.disposed) return current;
    const cleanups = [];
    const services = new Map();
    const addGlobalCleanup = (cleanup) => trackCleanup(cleanups, cleanup);
    const api = {
      disposed: false,
      installed: true,
      addCleanup(cleanup) {
        if (typeof cleanup !== "function") return () => {};
        if (api.disposed) {
          try { cleanup(); } catch {}
          return () => {};
        }
        return trackCleanup(activeModuleCleanupScope || cleanups, cleanup);
      },
      addGlobalCleanup(cleanup) {
        if (api.disposed) {
          try { cleanup?.(); } catch {}
          return () => {};
        }
        return addGlobalCleanup(cleanup);
      },
      listen(target, type, listener, options) {
        target?.addEventListener?.(type, listener, options);
        const untrack = api.addCleanup(() => target?.removeEventListener?.(type, listener, options));
        return () => {
          target?.removeEventListener?.(type, listener, options);
          untrack();
        };
      },
      createObserver(callback) {
        if (typeof MutationObserver !== "function") return null;
        const nativeObserver = new MutationObserver(callback);
        const untrack = api.addCleanup(() => nativeObserver.disconnect());
        return {
          observe: (...args) => nativeObserver.observe(...args),
          disconnect: () => nativeObserver.disconnect(),
          disconnectAndForget: () => {
            nativeObserver.disconnect();
            untrack();
          }
        };
      },
      timeout(callback, delay) {
        let active = true;
        let untrack = () => {};
        let timer = setTimeout(() => {
          active = false;
          untrack();
          callback();
        }, delay);
        const cancel = () => {
          if (!active) return;
          active = false;
          clearTimeout(timer);
          timer = 0;
          untrack();
        };
        untrack = api.addCleanup(cancel);
        return { cancel };
      },
      frame(callback) {
        let active = true;
        let untrack = () => {};
        const frame = requestAnimationFrame((time) => {
          active = false;
          untrack();
          callback(time);
        });
        const cancel = () => {
          if (!active) return;
          active = false;
          cancelAnimationFrame(frame);
          untrack();
        };
        untrack = api.addCleanup(cancel);
        return { cancel };
      },
      service(name, factory) {
        if (services.has(name)) return services.get(name);
        const previousScope = activeModuleCleanupScope;
        activeModuleCleanupScope = null;
        let service;
        try {
          service = factory(api);
        } finally {
          activeModuleCleanupScope = previousScope;
        }
        services.set(name, service);
        if (typeof service?.dispose === "function") addGlobalCleanup(() => service.dispose());
        return service;
      },
      networkHooks() {
        return api.service("network-hooks", () => createBiliKitNetworkHookManager(window, history));
      },
      dispose() {
        if (api.disposed) return;
        api.disposed = true;
        while (cleanups.length) {
          try { cleanups.pop()(); } catch {}
        }
        services.clear();
        try { delete window[key]; } catch {}
      }
    };
    const onPageHide = (event) => {
      if (!event.persisted) api.dispose();
    };
    window.addEventListener("pagehide", onPageHide);
    addGlobalCleanup(() => window.removeEventListener("pagehide", onPageHide));
    try {
      Object.defineProperty(window, key, { configurable: true, value: api });
    } catch {
      window[key] = api;
    }
    return api;
  }
  function getHomeFeedCoordinator() {
    if (!isHomeDocument()) return null;
    const runtime = getRuntimeCoordinator();
    return runtime.service("home-feed", (owner) => {
      const subscribers = new Set();
      const resources = new Set();
      const pendingNodes = new Set();
      const pendingResources = new Set();
      const stats = { enabled: true, rootChanges: 0, mutationBatches: 0, addedNodes: 0, resourceChanges: 0, flushes: 0 };
      let feedRoot = null;
      let rootObserver = null;
      let shellObserver = null;
      let shellTargets = [];
      let pending = false;
      let pendingReason = "initialize";
      let pendingRootChange = false;
      let frameHandle = null;
      const resourceElement = (node) => node instanceof HTMLImageElement || node instanceof HTMLSourceElement || node instanceof HTMLVideoElement;
      const collect = (nodes) => {
        for (const node of nodes) {
          if (!node || node.nodeType !== 1) continue;
          if (resourceElement(node)) resources.add(node);
          node.querySelectorAll?.("img,source,video").forEach((item) => resources.add(item));
        }
      };
      const syncRoot = () => {
        const nextRoot = document.querySelector(".container.is-version8");
        if (nextRoot === feedRoot) return;
        rootObserver?.disconnectAndForget();
        rootObserver = null;
        feedRoot = nextRoot;
        resources.clear();
        stats.rootChanges += 1;
        pendingRootChange = true;
        pendingReason = "root-change";
        if (feedRoot) {
          rootObserver = owner.createObserver((mutations) => {
            stats.mutationBatches += 1;
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                pendingNodes.add(node);
                stats.addedNodes += 1;
              }
            }
            for (const resource of resources) if (!feedRoot.contains(resource)) resources.delete(resource);
            pendingReason = "child-list";
            schedule();
          });
          rootObserver?.observe(feedRoot, { childList: true });
          for (const child of feedRoot.children) pendingNodes.add(child);
        }
        syncShellObserver();
        schedule();
      };
      const syncShellObserver = () => {
        const currentRoot = document.querySelector(".container.is-version8");
        const targets = [];
        if (currentRoot) {
          if (currentRoot.parentElement) targets.push(currentRoot.parentElement);
        } else {
          targets.push(document.querySelector("#app") || document.body || document.documentElement);
        }
        const uniqueTargets = [...new Set(targets.filter(Boolean))];
        if (uniqueTargets.length === shellTargets.length && uniqueTargets.every((target, index) => target === shellTargets[index])) return;
        shellObserver?.disconnectAndForget();
        shellTargets = uniqueTargets;
        shellObserver = owner.createObserver((mutations) => {
          if (!feedRoot || !feedRoot.isConnected) {
            const rootCandidate = mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && (
              node.matches?.(".container.is-version8") || node.querySelector?.(".container.is-version8")
            )));
            if (rootCandidate || feedRoot && !feedRoot.isConnected) {
              syncRoot();
              syncShellObserver();
            } else {
              const app = document.querySelector("#app");
              if (app && !shellTargets.includes(app)) syncShellObserver();
            }
            return;
          }
          const shouldResolveRoot = mutations.some((mutation) => {
            if ([...mutation.removedNodes].some((node) => node === feedRoot || node.contains?.(feedRoot))) return true;
            return [...mutation.addedNodes].some((node) => node.nodeType === 1 && (
              node.contains?.(feedRoot) || node.matches?.(".container.is-version8") || node.querySelector?.(".container.is-version8")
            ));
          });
          if (shouldResolveRoot) {
            syncRoot();
            syncShellObserver();
          }
        });
        for (const target of shellTargets) shellObserver?.observe(target, {
          childList: true,
          subtree: !currentRoot
        });
      };
      const flush = () => {
        pending = false;
        frameHandle = null;
        const root = feedRoot;
        if (pendingRootChange && root) {
          pendingNodes.clear();
          for (const child of root.children) pendingNodes.add(child);
        }
        const addedNodes = [...pendingNodes];
        const changedResources = [...pendingResources];
        pendingNodes.clear();
        pendingResources.clear();
        collect(addedNodes);
        for (const resource of changedResources) resources.add(resource);
        for (const resource of resources) if (!root?.contains(resource)) resources.delete(resource);
        const event = {
          root,
          addedNodes,
          resources: [...resources],
          changedResources,
          images: [...resources].filter((item) => item instanceof HTMLImageElement),
          rootChanged: pendingRootChange,
          reason: pendingReason
        };
        pendingRootChange = false;
        stats.flushes += 1;
        stats.resourceChanges += changedResources.length;
        for (const subscriber of subscribers) {
          try { subscriber(event); } catch (error) { console.error("[BiliKit][feed-runtime]", error); }
        }
      };
      function schedule() {
        if (pending || owner.disposed) return;
        pending = true;
        frameHandle = owner.frame(flush);
      }
      const subscribe = (callback) => {
        subscribers.add(callback);
        syncRoot();
        syncShellObserver();
        pendingReason = "subscribe";
        schedule();
        const untrack = owner.addCleanup(() => subscribers.delete(callback));
        return () => {
          subscribers.delete(callback);
          untrack();
        };
      };
      const resourceChanged = (resource) => {
        if (!feedRoot || !resourceElement(resource) || !feedRoot.contains(resource)) return;
        pendingResources.add(resource);
        pendingReason = "resource-change";
        schedule();
      };
      const schedulePageSync = () => {
        syncShellObserver();
        syncRoot();
      };
      const dispose = () => {
        rootObserver?.disconnectAndForget();
        shellObserver?.disconnectAndForget();
        frameHandle?.cancel();
        subscribers.clear();
        resources.clear();
        pendingNodes.clear();
        pendingResources.clear();
      };
      owner.listen(document, "readystatechange", schedulePageSync);
      owner.listen(document, "DOMContentLoaded", schedulePageSync, { once: true });
      owner.listen(window, "pageshow", schedulePageSync);
      if (isHomePage()) owner.listen(window, "resize", () => {
        pendingReason = "resize";
        schedule();
      }, { passive: true });
      try {
        Object.defineProperty(window, "__BILIKIT_HOME_FEED_COORDINATOR_STATS__", { configurable: true, get: () => ({ ...stats }) });
      } catch {}
      syncShellObserver();
      syncRoot();
      return { subscribe, resourceChanged, getResources: () => [...resources], dispose };
    });
  }
  function getHomeFeedLayoutCoordinator() {
    if (!isHomeDocument()) return null;
    const runtime = getRuntimeCoordinator();
    return runtime.service("home-feed-layout", (owner) => {
      const resumeListeners = new Set();
      const afterResumeCallbacks = new Map();
      const activeTokens = new Set();
      const stats = {
        pauseDepth: 0,
        beginCount: 0,
        endCount: 0,
        deferredCount: 0,
        resumeCount: 0,
        lastReason: "",
        pending: false
      };
      let tokenId = 0;
      let pendingReasons = new Set();
      const begin = (reason = "unspecified") => {
        const token = { id: ++tokenId, reason, active: true };
        activeTokens.add(token);
        stats.beginCount += 1;
        stats.pauseDepth = activeTokens.size;
        return token;
      };
      const defer = (reason = "layout-update") => {
        if (!activeTokens.size) return false;
        stats.deferredCount += 1;
        stats.pending = true;
        pendingReasons.add(reason);
        return true;
      };
      const onResume = (callback) => {
        if (typeof callback !== "function") return () => {};
        resumeListeners.add(callback);
        const untrack = owner.addCleanup(() => resumeListeners.delete(callback));
        return () => {
          resumeListeners.delete(callback);
          untrack();
        };
      };
      const afterResume = (callback) => {
        if (typeof callback !== "function") return () => {};
        if (activeTokens.size) {
          const untrack = owner.addCleanup(() => afterResumeCallbacks.delete(callback));
          afterResumeCallbacks.set(callback, untrack);
          return () => {
            afterResumeCallbacks.delete(callback);
            untrack();
          };
        }
        const frame = owner.frame(callback);
        return () => frame.cancel();
      };
      const end = (token) => {
        if (!token || !activeTokens.has(token) || !token.active) return false;
        token.active = false;
        activeTokens.delete(token);
        stats.endCount += 1;
        stats.pauseDepth = activeTokens.size;
        if (activeTokens.size) return true;
        const wasPending = stats.pending;
        const reason = [...pendingReasons].join(",") || token.reason || "resume";
        stats.pending = false;
        pendingReasons = new Set();
        if (!wasPending) {
          const callbacks = [...afterResumeCallbacks.entries()];
          afterResumeCallbacks.clear();
          for (const [callback, untrack] of callbacks) {
            untrack();
            owner.frame(callback);
          }
          return true;
        }
        stats.resumeCount += 1;
        stats.lastReason = reason;
        for (const callback of resumeListeners) {
          try { callback({ reason, deferred: true }); } catch (error) { console.error("[BiliKit][layout-runtime]", error); }
        }
        const callbacks = [...afterResumeCallbacks.entries()];
        afterResumeCallbacks.clear();
        for (const [callback, untrack] of callbacks) {
          untrack();
          owner.frame(callback);
        }
        return true;
      };
      const dispose = () => {
        resumeListeners.clear();
        afterResumeCallbacks.clear();
        activeTokens.clear();
        pendingReasons.clear();
      };
      owner.addCleanup(dispose);
      return {
        begin,
        end,
        defer,
        isPaused: () => activeTokens.size > 0,
        onResume,
        afterResume,
        getStats: () => ({ ...stats })
      };
    });
  }
  function installHomeFeedRequestPriority() {
    if (!isBilibiliDocument() || window.__BILIKIT_HOME_FEED_REQUEST_PRIORITY__) return;
    if (typeof window.fetch !== "function") return;
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    let nativeFetch = null;
    const stats = { highPriorityRequests: 0, lowPriorityRequests: 0, retryRequests: 0, retry5xx: 0, retryNetworkErrors: 0, lastHighUrl: "", lastLowUrl: "", lastRetryUrl: "" };
    window.__BILIKIT_HOME_FEED_REQUEST_PRIORITY__ = true;
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_FEED_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    const retryFeedFetch = async (thisArg, input, baseInit, sourceSignal) => {
      let sourceSignalValue = sourceSignal;
      if (!sourceSignalValue && baseInit) sourceSignalValue = baseInit.signal;
      if (!sourceSignalValue && typeof Request === "function" && input instanceof Request) sourceSignalValue = input.signal;
      const retryable = (() => {
        const method = String(baseInit?.method || (typeof Request === "function" && input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
        return method === "GET" || method === "HEAD";
      })();
      if (!retryable) return nativeFetch.call(thisArg, input, baseInit);
      const waitForRetry = () => new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (canContinue) => {
          if (settled) return;
          settled = true;
          sourceSignalValue?.removeEventListener("abort", onAbort);
          timer?.cancel();
          resolve(canContinue);
        };
        const onAbort = () => finish(false);
        if (sourceSignalValue?.aborted) return finish(false);
        sourceSignalValue?.addEventListener("abort", onAbort, { once: true });
        timer = runtime.timeout(() => finish(!sourceSignalValue?.aborted), 300);
      });
      const retryOnce = async (reason) => {
        if (sourceSignalValue?.aborted || !await waitForRetry()) return null;
        stats.retryRequests += 1;
        if (reason === "5xx") stats.retry5xx += 1;
        else stats.retryNetworkErrors += 1;
        stats.lastRetryUrl = String(typeof input === "string" ? input : input && input.url || "");
        return nativeFetch.call(thisArg, input, baseInit);
      };
      let firstResponse;
      try {
        firstResponse = await nativeFetch.call(thisArg, input, baseInit);
      } catch (error) {
        if (sourceSignalValue?.aborted || error?.name === "AbortError" || !(error instanceof TypeError)) throw error;
        try {
          const retryResponse = await retryOnce("network");
          if (retryResponse) return retryResponse;
        } catch (retryError) {
          throw retryError;
        }
        throw error;
      }
      if (firstResponse.status < 500 || firstResponse.status >= 600) return firstResponse;
      try {
        const retryResponse = await retryOnce("5xx");
        if (retryResponse && (retryResponse.status < 500 || retryResponse.status >= 600)) return retryResponse;
        return retryResponse || firstResponse;
      } catch {
        // 服务器已给出 5xx 时，若兜底请求再次发生网络错误，仍把原响应交给 B 站自己的错误处理。
        return firstResponse;
      }
    };
    const wrappedFetch = function(input, init) {
      let url = "";
      try {
        url = typeof input === "string" ? input : input && input.url || String(input || "");
      } catch {
      }
      const isFeed = HOME_FEED_API_RE.test(url);
      const priority = isFeed || MEDIA_PLAYURL_API_RE.test(url) ? "high" : HOME_AUX_API_RE.test(url) ? "low" : "";
      if (!priority) return nativeFetch.apply(this, arguments);
      if (init != null && typeof init !== "object") return nativeFetch.apply(this, arguments);
      const nextInit = init && typeof init === "object" ? { ...init, priority: init.priority || priority } : { priority };
      if (priority === "high") {
        stats.highPriorityRequests += 1;
        stats.lastHighUrl = url;
      } else {
        stats.lowPriorityRequests += 1;
        stats.lastLowUrl = url;
      }
      if (isFeed) return retryFeedFetch(this, input, nextInit, init?.signal);
      return nativeFetch.call(this, input, nextInit);
    };
    const removeFetchHook = networkHooks.addFetch("home-feed-request-priority", (next) => {
      nativeFetch = next;
      return wrappedFetch;
    });
    runtime.addCleanup(() => {
      removeFetchHook();
      if (window.__BILIKIT_HOME_FEED_REQUEST_PRIORITY__) delete window.__BILIKIT_HOME_FEED_REQUEST_PRIORITY__;
    });
  }
  function readHomeImageCache(region) {
    const keys = [HOME_IMAGE_CACHE_KEY, ...HOME_IMAGE_CACHE_FALLBACK_KEYS];
    const now = Date.now();
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) {
        const value = readStorageJson(storage, key);
        if (!value || value.region !== region || now - Number(value.at || 0) > HOME_IMAGE_CACHE_TTL) continue;
        if (HOME_IMAGE_HOSTS.includes(value.host)) return value;
      }
    }
    return null;
  }
  function writeHomeImageCache(region, host) {
    const value = { region, host, at: Date.now() };
    writeStorageJson(sessionStorage, HOME_IMAGE_CACHE_KEY, value);
    writeStorageJson(localStorage, HOME_IMAGE_CACHE_KEY, value);
  }
  function currentHomeCdnRegion() {
    const cached = readCdnRegionCache();
    if (cached && ["domestic", "foreign"].includes(cached.region)) return { region: cached.region, source: "cache" };
    try {
      const stats = window.__BILIKIT_CDN_STATS__;
      if (stats && ["domestic", "foreign"].includes(stats.region)) return { region: stats.region, source: stats.regionSource || "cdn-stats" };
    } catch {
    }
    return { region: "unknown", source: "pending" };
  }
  function imageCdnUrl(value, targetHost) {
    if (typeof value !== "string" || !targetHost) return value;
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return value;
      // i0/i1/i2 使用同一套 bfs 对象存储；不限制具体业务目录，覆盖封面、横幅、头像、
      // 动态和搜索结果图片，但不触碰 s1 静态资源或第三方图片。
      if (!BILI_CDN_IMAGE_RE.test(url.pathname) || !/^i[0-2]\.hdslb\.com$/i.test(url.hostname)) return value;
      if (url.hostname.toLowerCase() === targetHost) return value;
      url.hostname = targetHost;
      return url.href;
    } catch {
      return value;
    }
  }
  function sameHomeImageObject(left, right) {
    try {
      const a = new URL(left, location.href);
      const b = new URL(right, location.href);
      return a.pathname === b.pathname && a.search === b.search && a.hash === b.hash;
    } catch {
      return false;
    }
  }
  function imageCdnSrcset(value, targetHost) {
    if (typeof value !== "string") return value;
    return value.split(",").map((part) => {
      const match = part.match(/^(\s*)(\S+)([\s\S]*)$/);
      if (!match) return part;
      return `${match[1]}${imageCdnUrl(match[2], targetHost)}${match[3]}`;
    }).join(",");
  }
  function isRewritableHomeImageUrl(value) {
    try {
      const url = new URL(value, location.href);
      return (url.protocol === "http:" || url.protocol === "https:") && BILI_CDN_IMAGE_RE.test(url.pathname) && /^i[0-2]\.hdslb\.com$/i.test(url.hostname);
    } catch {
      return false;
    }
  }
  async function chooseHomeImageCdn(region, stats, sampleUrl, runtime, forceProbe = false) {
    const cached = forceProbe ? null : readHomeImageCache(region);
    if (cached) {
      stats.host = cached.host;
      stats.hostSource = "cache";
      return cached.host;
    }
    const startedAt = performance.now();
    const probeBase = imageCdnUrl(sampleUrl, HOME_IMAGE_DEFAULT_HOST);
    if (!probeBase || !isRewritableHomeImageUrl(sampleUrl)) {
      stats.hostSource = "probe-waiting-for-feed-image";
      return null;
    }
    const results = await Promise.all(HOME_IMAGE_HOSTS.map((host) => new Promise((resolve) => {
      const image = new Image();
      image.dataset.bkHomeCdnProbe = "1";
      image.fetchPriority = "low";
      const start = performance.now();
      let settled = false;
      let timeout = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        timeout?.cancel();
        resolve({ host, ok, duration: Math.round(performance.now() - start) });
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      timeout = runtime.timeout(() => finish(false), 2400);
      image.src = imageCdnUrl(probeBase, host);
    })));
    const winner = results.filter((item) => item.ok).sort((a, b) => a.duration - b.duration)[0];
    const host = winner ? winner.host : null;
    if (host) writeHomeImageCache(region, host);
    stats.host = host || "";
    stats.hostSource = winner ? "active-probe" : "probe-failed-native";
    stats.probe = { duration: Math.round(performance.now() - startedAt), results };
    return host;
  }
  function installHomeImageCdn() {
    if (!isBilibiliDocument() || window.__BILIKIT_HOME_IMAGE_CDN__) return;
    window.__BILIKIT_HOME_IMAGE_CDN__ = true;
    const runtime = getRuntimeCoordinator();
    const feedCoordinator = getHomeFeedCoordinator();
    const regionInfo = currentHomeCdnRegion();
    const initialImageCache = ["domestic", "foreign"].includes(regionInfo.region) ? readHomeImageCache(regionInfo.region) : null;
    const stats = {
      enabled: true,
      region: regionInfo.region,
      regionSource: regionInfo.source,
      host: initialImageCache?.host || "",
      hostSource: initialImageCache ? "cache" : "native",
      rewriteCount: 0,
      fallbackCount: 0,
      lastSourceHost: "",
      lastTargetHost: "",
      probe: null,
      probeDeferred: !initialImageCache
    };
    let targetHost = initialImageCache?.host || null;
    const hostFailures = new Map();
    let hostSwitchTimer = null;
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_IMAGE_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    // CDN 节点偶尔会出现「探测成功、具体对象失败」的边缘情况。
    // 记录每个资源的原始地址，失败时只回退这一个 picture，避免卡片长期停在骨架或错排状态。
    const originalResources = new WeakMap();
    const rewrittenResources = new WeakMap();
    const fallbackOriginals = new WeakMap();
    const fallbackBound = new WeakSet();
    const fallbackArmed = new WeakSet();
    const fallbackRestoring = new WeakSet();
    const rememberOriginal = (element, name, value) => {
      if (!element || !value || fallbackRestoring.has(element)) return;
      let record = originalResources.get(element);
      if (!record) {
        record = {};
        originalResources.set(element, record);
      }
      const rewritten = rewrittenResources.get(element);
      if (!rewritten || rewritten[name] !== value) record[name] = value;
    };
    const restoreOriginalPicture = (image) => {
      if (!(image instanceof HTMLImageElement)) return;
      stats.fallbackCount += 1;
      let failedHost = targetHost;
      try { failedHost = new URL(image.currentSrc || image.src, location.href).hostname; } catch {}
      hostFailures.set(failedHost, (hostFailures.get(failedHost) || 0) + 1);
      const picture = image.closest("picture");
      const resources = picture ? [image, ...picture.querySelectorAll("source")] : [image];
      for (const resource of resources) {
        const record = originalResources.get(resource);
        if (!record) continue;
        fallbackRestoring.add(resource);
        try {
          for (const [name, value] of Object.entries(record)) {
            let originals = fallbackOriginals.get(resource);
            if (!originals) {
              originals = {};
              fallbackOriginals.set(resource, originals);
            }
            if (name.startsWith("data-")) resource.setAttribute(name, value);
            else if (name in resource) resource[name] = value;
            originals[name] = resource.getAttribute(name) ?? value;
          }
        } catch {
        } finally {
          fallbackRestoring.delete(resource);
        }
      }
      // 探测图标成功不代表每个 bfs 对象都能从该节点取到。连续失败时
      // 临时切到探测结果中的下一个节点，并更新短期缓存，避免每次刷新
      // 又把整页图片送回同一个失效节点。
      if (failedHost === targetHost && (hostFailures.get(failedHost) || 0) >= 3) {
        const probed = Array.isArray(stats.probe?.results) ? stats.probe.results
          .filter((item) => item && item.ok)
          .sort((a, b) => Number(a.duration) - Number(b.duration))
          .map((item) => item.host) : [];
        const nextHost = uniqueStrings([...probed, ...HOME_IMAGE_HOSTS])
          .find((host) => host !== failedHost && (hostFailures.get(host) || 0) < 3);
        if (nextHost) {
          targetHost = nextHost;
          stats.host = nextHost;
          stats.hostSource = "fallback-switch";
          if (["domestic", "foreign"].includes(stats.region)) writeHomeImageCache(stats.region, nextHost);
          if (!hostSwitchTimer) {
            hostSwitchTimer = runtime.timeout(() => {
              hostSwitchTimer = null;
              scanPendingHomeResources();
            }, 0);
          }
        }
      }
    };
    const bindFallback = (element) => {
      const image = element instanceof HTMLImageElement ? element : element.closest?.("picture")?.querySelector("img");
      if (!(image instanceof HTMLImageElement) || fallbackBound.has(image)) return;
      fallbackBound.add(image);
      fallbackArmed.add(image);
    };
    const rewrite = (element, name, value) => {
      if (!element || !targetHost || element.dataset?.bkHomeCdnProbe === "1" || fallbackRestoring.has(element)) return value;
      const fallbackRecord = fallbackOriginals.get(element);
      if (fallbackRecord && name in fallbackRecord) {
        if (fallbackRecord[name] === value) return value;
        delete fallbackRecord[name];
      }
      if (name === "poster" || element.closest?.("video, [class*='preview'], [class*='Preview'], [class*='hover-video'], [class*='HoverVideo'], [class*='image--hover']")) return value;
      if (isSource(element)) {
        const displayedImage = element.closest("picture")?.querySelector("img");
        if (displayedImage?.complete && displayedImage.naturalWidth > 0) return value;
      }
      if (isImage(element) && element.complete && element.naturalWidth > 0 && name === "srcset") return value;
      if (isImage(element) && element.complete && element.naturalWidth > 0 && name === "src") {
        const current = element.currentSrc || element.getAttribute("src") || "";
        if (current && sameHomeImageObject(current, value)) return value;
      }
      const next = name === "srcset" ? imageCdnSrcset(value, targetHost) : imageCdnUrl(value, targetHost);
      if (next !== value) {
        rememberOriginal(element, name, value);
        let rewritten = rewrittenResources.get(element);
        if (!rewritten) {
          rewritten = {};
          rewrittenResources.set(element, rewritten);
        }
        rewritten[name] = next;
        bindFallback(element);
        stats.rewriteCount += 1;
        try {
          stats.lastSourceHost = new URL(String(value), location.href).hostname;
        } catch {
        }
        stats.lastTargetHost = targetHost;
      }
      return next;
    };
    const patchProperty = (proto, name) => {
      if (!proto) return;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (!descriptor || typeof descriptor.set !== "function" || descriptor.configurable === false) return;
        const setter = function(value) {
          const requested = String(value);
          const next = rewrite(this, name, requested);
          const current = this.getAttribute?.(name);
          if (isImage(this) && name === "src" && this.complete && this.naturalWidth > 0
              && sameHomeImageObject(this.currentSrc || current || "", requested)) return;
          if (current === next && (name !== "src" || !isImage(this) || this.complete && this.naturalWidth > 0)) return;
          descriptor.set.call(this, next);
          feedCoordinator?.resourceChanged(this);
        };
        Object.defineProperty(proto, name, {
          ...descriptor,
          set: setter
        });
        runtime.addCleanup(() => {
          if (Object.getOwnPropertyDescriptor(proto, name)?.set === setter) Object.defineProperty(proto, name, descriptor);
        });
      } catch {
      }
    };
    const patchAttributes = (proto, names) => {
      if (!proto || typeof proto.setAttribute !== "function") return;
      try {
        const nativeSetAttribute = proto.setAttribute;
        const originalDescriptor = Object.getOwnPropertyDescriptor(proto, "setAttribute");
      const wrappedSetAttribute = function(name, value) {
          const key = String(name).toLowerCase();
          const previous = names.includes(key) ? this.getAttribute(key) : null;
          const next = names.includes(key) && !["data-src", "data-lazy-src"].includes(key)
            ? rewrite(this, key, String(value)) : value;
          if (key === "src" && this instanceof HTMLImageElement && this.complete && this.naturalWidth > 0
              && sameHomeImageObject(this.currentSrc || previous || "", String(value))) return;
          if (previous === next && (key !== "src" || !(this instanceof HTMLImageElement) || this.complete && this.naturalWidth > 0)) return;
          const result = nativeSetAttribute.call(this, name, next);
          if (names.includes(key)) feedCoordinator?.resourceChanged(this);
          return result;
        };
        proto.setAttribute = wrappedSetAttribute;
        runtime.addCleanup(() => {
          if (proto.setAttribute !== wrappedSetAttribute) return;
          if (originalDescriptor) Object.defineProperty(proto, "setAttribute", originalDescriptor);
          else delete proto.setAttribute;
        });
      } catch {
      }
    };
    try {
      patchProperty(HTMLImageElement.prototype, "src");
      patchProperty(HTMLImageElement.prototype, "srcset");
      patchAttributes(HTMLImageElement.prototype, ["src", "srcset", "data-src", "data-lazy-src"]);
      patchProperty(window.HTMLSourceElement?.prototype, "src");
      patchProperty(window.HTMLSourceElement?.prototype, "srcset");
      patchAttributes(window.HTMLSourceElement?.prototype, ["src", "srcset"]);
      patchProperty(window.HTMLVideoElement?.prototype, "poster");
      patchAttributes(window.HTMLVideoElement?.prototype, ["poster"]);
    } catch {
    }
    runtime.listen(document, "error", (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !fallbackArmed.has(image)) return;
      fallbackArmed.delete(image);
      fallbackBound.delete(image);
      restoreOriginalPicture(image);
    }, true);
    const isImage = (element) => element instanceof HTMLImageElement;
    const isSource = (element) => typeof HTMLSourceElement === "function" && element instanceof HTMLSourceElement;
    const isVideo = (element) => typeof HTMLVideoElement === "function" && element instanceof HTMLVideoElement;
    const isResourceElement = (element) => isImage(element) || isSource(element) || isVideo(element);
    const scan = (root) => {
      if (!root || !targetHost) return;
      const resources = Array.isArray(root) ? root.filter(isResourceElement)
        : isResourceElement(root) ? [root] : [...root.querySelectorAll?.("img,source,video") || []];
      for (const resource of resources) {
        // 已经完成的图片不要为了换节点重新下载；框架后续通过属性/属性 setter
        // 更新时仍会经过上面的拦截器，因此不会漏掉后续信息流。
        if (isImage(resource) && resource.complete && resource.naturalWidth > 0) continue;
        if (isSource(resource)) {
          const displayedImage = resource.closest("picture")?.querySelector("img");
          if (displayedImage?.complete && displayedImage.naturalWidth > 0) continue;
        }
        if (isImage(resource) || isSource(resource)) {
          const source = resource.getAttribute("src") || resource.src || "";
          const next = rewrite(resource, "src", source);
          if (next !== source) resource.src = next;
          if (isImage(resource)) {
            for (const name of ["data-src", "data-lazy-src"]) {
              const lazySource = resource.getAttribute(name);
              if (!lazySource) continue;
              const nextLazySource = rewrite(resource, name, lazySource);
              if (nextLazySource !== lazySource) resource.setAttribute(name, nextLazySource);
            }
          }
        }
        const srcset = resource.getAttribute("srcset");
        if (srcset) {
          const nextSrcset = rewrite(resource, "srcset", srcset);
          if (nextSrcset !== srcset) resource.srcset = nextSrcset;
        }
        if (isVideo(resource)) {
          const poster = resource.getAttribute("poster") || resource.poster || "";
          const nextPoster = rewrite(resource, "poster", poster);
          if (nextPoster !== poster) resource.poster = nextPoster;
        }
      }
    };
    const attach = () => {
      if (feedCoordinator) {
        feedCoordinator.subscribe(({ addedNodes, changedResources }) => {
          for (const node of addedNodes) scan(node);
          for (const resource of changedResources) scan(resource);
        });
        return;
      }
      // document-start 时 body 还不存在，但 documentElement 通常已经存在；观察 html
      // 可以捕获 body 创建和首批图片，避免等到 DOMContentLoaded 才开始改写。
      const root = document.body || document.documentElement;
      if (!root) {
        document.addEventListener("readystatechange", attach, { once: true });
        return;
      }
      scan(root);
      let pending = false;
      const roots = new Set();
      const observer = runtime.createObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes") {
            if (isResourceElement(mutation.target)) roots.add(mutation.target);
            continue;
          }
          for (const node of mutation.addedNodes) if (node.nodeType === 1) roots.add(node);
        }
        if (pending || !roots.size) return;
        pending = true;
        runtime.frame(() => {
          pending = false;
          const current = [...roots];
          roots.clear();
          current.forEach(scan);
          if (!targetHost) scheduleProbe(false);
        });
      });
      observer?.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "poster"]
      });
      runtime.addCleanup(() => {
        if (window.__BILIKIT_HOME_IMAGE_CDN__) delete window.__BILIKIT_HOME_IMAGE_CDN__;
      });
    };
    attach();
    let probeStarted = false;
    let probeRunning = false;
    let probeRegion = "";
    let lastProbeAt = 0;
    let probeUnlocked = !!initialImageCache;
    let forceProbePending = false;
    let networkProbeTimer = null;
    const scanPendingHomeResources = () => {
      if (!targetHost) return;
      if (feedCoordinator) {
        scan(feedCoordinator.getResources().filter((resource) => !(isImage(resource) && resource.complete && resource.naturalWidth > 0)));
        return;
      }
      scan(document.body || document.documentElement);
    };
    const pickProbeImage = () => {
      const resources = feedCoordinator?.getResources() || [...document.querySelectorAll("img[src],img[srcset]")].slice(0, 80);
      const candidates = resources.filter((resource) => {
        if (!(resource instanceof HTMLImageElement) || !resource.isConnected || !resource.currentSrc && !resource.src) return false;
        if (resource.closest("video, [class*='preview'], [class*='Preview'], [class*='hover-video'], [class*='HoverVideo'], [class*='image--hover']")) return false;
        const source = resource.currentSrc || resource.src;
        return BILI_MEDIA_IMAGE_RE.test(source) && isRewritableHomeImageUrl(source);
      }) || [];
      candidates.sort((a, b) => Number(b.complete && b.naturalWidth > 0) - Number(a.complete && a.naturalWidth > 0));
      return candidates[0]?.currentSrc || candidates[0]?.src || "";
    };
    const scheduleProbe = (forceProbe = false) => {
      const regionState = currentHomeCdnRegion();
      const nextRegion = regionState.region;
      if (!["domestic", "foreign"].includes(nextRegion)) return;
      // 没有缓存时，等首屏 load/空闲窗口再测速，避免三个探测请求和首页首轮
      // 图片争抢连接；有缓存时仍可在 document-start 立即复用最快节点。
      if (!probeUnlocked && !readHomeImageCache(nextRegion) && !forceProbe) return;
      if (probeRunning) {
        forceProbePending = forceProbePending || forceProbe;
        return;
      }
      if (probeStarted && probeRegion === nextRegion && !forceProbe && targetHost) return;
      if (probeStarted && probeRegion === nextRegion && !forceProbe && Date.now() - lastProbeAt < 10e3) return;
      if (!forceProbe && !probeUnlocked && !readHomeImageCache(nextRegion)) return;
      const sampleUrl = pickProbeImage();
      if (!sampleUrl) {
        stats.hostSource = "probe-waiting-for-feed-image";
        return;
      }
      probeStarted = true;
      probeRegion = nextRegion;
      lastProbeAt = Date.now();
      probeRunning = true;
      const run = async () => {
        stats.region = nextRegion;
        stats.regionSource = regionState.source;
        stats.probeDeferred = false;
        targetHost = await chooseHomeImageCdn(nextRegion, stats, sampleUrl, runtime, forceProbe);
        if (!targetHost) return;
        if (currentHomeCdnRegion().region !== nextRegion) return;
        scanPendingHomeResources();
      };
      void run().finally(() => {
        probeRunning = false;
        const currentRegion = currentHomeCdnRegion().region;
        if (forceProbePending || currentRegion !== probeRegion) {
          const forceNext = forceProbePending;
          forceProbePending = false;
          runtime.timeout(() => scheduleProbe(forceNext), 0);
        }
      });
    };
    const queueNetworkProbe = () => {
      if (!navigator.onLine) return;
      networkProbeTimer?.cancel();
      networkProbeTimer = runtime.timeout(() => {
        networkProbeTimer = null;
        scheduleProbe(true);
      }, 450);
    };
    runtime.listen(window, "bilikit:cdn-region", () => {
      if (!networkProbeTimer) scheduleProbe(false);
    });
    runtime.listen(window, "online", queueNetworkProbe);
    runtime.listen(navigator.connection, "change", queueNetworkProbe);
    feedCoordinator?.subscribe(({ addedNodes, changedResources }) => {
      if (!targetHost) scheduleProbe(false);
      for (const node of addedNodes) scan(node);
      for (const resource of changedResources) scan(resource);
    });
    const unlockProbe = () => {
      probeUnlocked = true;
      scheduleProbe();
    };
    if (!initialImageCache && document.readyState === "complete") {
      if (typeof requestIdleCallback === "function") requestIdleCallback(unlockProbe, { timeout: 2500 });
      else runtime.timeout(unlockProbe, 1500);
    } else {
      runtime.listen(window, "load", () => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(unlockProbe, { timeout: 2500 });
        else runtime.timeout(unlockProbe, 1500);
      }, { once: true });
      // load 被页面异常阻塞时仍不永久失去自适应，只在首轮内容完成后再兜底。
      runtime.timeout(unlockProbe, 10e3);
    }
    runtime.addCleanup(() => {
      hostSwitchTimer?.cancel();
      networkProbeTimer?.cancel();
      if (window.__BILIKIT_HOME_IMAGE_CDN__) delete window.__BILIKIT_HOME_IMAGE_CDN__;
    });
  }
  function preconnect(hosts = PC_HOSTS) {
    const root = document.head || document.documentElement;
    if (!root) return;
    const now = performance.now();
    if (now - lastPc < PC_WINDOW) return;
    const wanted = [...new Set(hosts)];
    if (!wanted.length) return;
    const normalized = (value) => String(value || "").replace(/\/+$/, "");
    const existing = new Set();
    document.querySelectorAll('link[rel~="preconnect"][href]').forEach((link) => {
      existing.add(normalized(link.href));
    });
    for (const href of wanted) {
      if (existing.has(normalized(href))) continue;
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = href;
      l.crossOrigin = "anonymous";
      root.appendChild(l);
      existing.add(normalized(href));
    }
    lastPc = now;
  }
  function installSearchPreconnect() {
    if (!isSearchPage() || window.__BILIKIT_SEARCH_PRECONNECT__) return;
    window.__BILIKIT_SEARCH_PRECONNECT__ = true;
    const run = () => preconnect(SEARCH_PRECONNECT_HOSTS);
    if (document.head) run();
    else document.addEventListener("DOMContentLoaded", run, { once: true });
  }
  function installHomePreconnect() {
    if (!isHomePage() || window.__BILIKIT_HOME_PRECONNECT__) return;
    window.__BILIKIT_HOME_PRECONNECT__ = true;
    preconnect(HOME_PRECONNECT_HOSTS);
  }
  function installHomeFeedLayoutStability() {
    if (!isHomePage() || window.__BILIKIT_HOME_FEED_LAYOUT__) return;
    window.__BILIKIT_HOME_FEED_LAYOUT__ = true;
    const style = document.createElement("style");
    style.textContent = [
      `.container.is-version8 > [${HOME_FEED_LAYOUT_FIX_ATTR}="1"],.container.is-version8 > [${HOME_FEED_LAYOUT_MARGIN_ATTR}="0"]{margin-top:0!important}`,
      `.container.is-version8 > [${HOME_FEED_LAYOUT_MARGIN_ATTR}="24"]{margin-top:24px!important}`,
      `.container.is-version8 > [${HOME_FEED_LAYOUT_MARGIN_ATTR}="40"]{margin-top:40px!important}`
    ].join("");
    const appendStyle = () => {
      const root = document.head || document.documentElement;
      if (root && !style.isConnected) root.appendChild(style);
    };
    const runtime = getRuntimeCoordinator();
    runtime.listen(document, "DOMContentLoaded", appendStyle, { once: true });
    appendStyle();
    runtime.addCleanup(() => style.remove());
    const originalMargins = new WeakMap();
    const stats = {
      enabled: true,
      normalizedCount: 0,
      lastNormalizedCount: 0,
      normalizedRows: 0,
      layoutDeferredDuringAutoLoad: 0,
      layoutResumeRepairs: 0,
      lastRepairReason: "initial"
    };
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_LAYOUT_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    const feedCoordinator = getHomeFeedCoordinator();
    const layoutCleanup = runtime.addCleanup(() => {
      if (window.__BILIKIT_HOME_FEED_LAYOUT__) delete window.__BILIKIT_HOME_FEED_LAYOUT__;
    });
    let pending = false;
    let feedRoot = null;
    let lastSignature = "";
    let scheduledReason = "initial";
    const CARD_RE = /(?:^|\s)(?:feed-card|floor-single-card|bili-feed-card|bili-video-card|load-more-anchor)(?:\s|$)/;
    const layoutCoordinator = getHomeFeedLayoutCoordinator();
    const schedule = (reason = "feed-update") => {
      if (layoutCoordinator?.defer(reason)) {
        stats.layoutDeferredDuringAutoLoad = layoutCoordinator.getStats().deferredCount;
        return;
      }
      if (pending) return;
      scheduledReason = reason;
      pending = true;
      runtime.frame(apply);
    };
    const apply = () => {
      pending = false;
      if (layoutCoordinator?.isPaused()) {
        layoutCoordinator.defer("apply-paused");
        stats.layoutDeferredDuringAutoLoad = layoutCoordinator.getStats().deferredCount;
        return;
      }
      const repairReason = scheduledReason;
      scheduledReason = "feed-update";
      const root = feedRoot && feedRoot.isConnected ? feedRoot : document.querySelector(".container.is-version8");
      if (!root) return;
      if (root !== feedRoot) {
        feedRoot = root;
        lastSignature = "";
      }
      const children = [...root.children];
      // 按整页网格的逻辑行处理，而不是只处理首个推荐楼层。
      // B 站不同楼层混用了 0/24/40px 顶部间距，导致第三排开始错位。
      const candidates = children.filter((el) => {
        return CARD_RE.test(String(el.className || "")) && getComputedStyle(el).display !== "none" && el.offsetWidth > 0;
      });
      const active = new Set(candidates);
      root.querySelectorAll(`:scope > [${HOME_FEED_LAYOUT_FIX_ATTR}="1"], :scope > [${HOME_FEED_LAYOUT_MARGIN_ATTR}]`).forEach((el) => {
        if (!active.has(el)) {
          el.removeAttribute(HOME_FEED_LAYOUT_FIX_ATTR);
          el.removeAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR);
          originalMargins.delete(el);
        }
      });
      const rows = new Map();
      for (const element of candidates) {
        let margin = originalMargins.get(element);
        // 数据属性不会被 B 站悬停预览的 class/style 重绘覆盖；保留首次记录的
        // 原始间距，避免 CSS 修复值把网格行误判成已统一。
        if (margin == null) {
          margin = Number.parseFloat(getComputedStyle(element).marginTop) || 0;
          originalMargins.set(element, margin);
        }
        // offsetTop 包含当前卡片自己的 margin；减去原始 margin 后可识别
        // 同一 CSS Grid 行中混用 0/24/40px 的卡片。
        const rowTop = Math.round((element.offsetTop - margin) * 10) / 10;
        if (!rows.has(rowTop)) rows.set(rowTop, []);
        rows.get(rowTop).push({ element, margin });
      }
      const signature = [...rows.entries()].map(([rowTop, row]) => {
        return `${rowTop}:${row.map((item) => `${children.indexOf(item.element)}=${item.margin}`).join(",")}`;
      }).join("|");
      let needsRepair = false;
      for (const row of rows.values()) {
        const targetMargin = Math.min(...row.map((item) => item.margin));
        const mixed = row.some((item) => Math.abs(item.margin - targetMargin) > 1);
        for (const item of row) {
          const shouldNormalize = mixed && Math.abs(item.margin - targetMargin) > 1;
          const marker = item.element.getAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR);
          if (shouldNormalize && marker !== String(Math.round(targetMargin))) {
            needsRepair = true;
          } else if (!shouldNormalize && (item.element.hasAttribute(HOME_FEED_LAYOUT_FIX_ATTR) || item.element.hasAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR))) {
            needsRepair = true;
          }
        }
      }
      // 签名相同不代表外部代码没有移除我们之前写入的稳定样式；
      // 只有在布局签名和实际修复状态都未变化时才跳过本轮。
      if (signature === lastSignature && !needsRepair) return;
      stats.lastRepairReason = repairReason;
      if (repairReason.startsWith("resume:")) stats.layoutResumeRepairs += 1;
      lastSignature = signature;
      let normalizedCount = 0;
      let normalizedRows = 0;
      for (const row of rows.values()) {
        const targetMargin = Math.min(...row.map((item) => item.margin));
        const mixed = row.some((item) => Math.abs(item.margin - targetMargin) > 1);
        if (mixed) normalizedRows += 1;
        for (const item of row) {
          const shouldNormalize = mixed && Math.abs(item.margin - targetMargin) > 1;
          if (shouldNormalize) {
            const target = String(Math.round(targetMargin));
            if (target === "0") item.element.setAttribute(HOME_FEED_LAYOUT_FIX_ATTR, "1");
            else item.element.removeAttribute(HOME_FEED_LAYOUT_FIX_ATTR);
            item.element.setAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR, target);
            normalizedCount += 1;
          } else {
            item.element.removeAttribute(HOME_FEED_LAYOUT_FIX_ATTR);
            item.element.removeAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR);
          }
        }
      }
      stats.normalizedCount = normalizedCount;
      stats.lastNormalizedCount = normalizedCount;
      stats.normalizedRows = normalizedRows;
    };
    const unsubscribe = feedCoordinator?.subscribe(({ root, rootChanged, addedNodes, reason }) => {
      if (rootChanged || !feedRoot?.isConnected) feedRoot = root;
      if (rootChanged || addedNodes.length || reason === "resize") schedule(reason || "feed-update");
    });
    runtime.addCleanup(unsubscribe);
    const unsubscribeResume = layoutCoordinator?.onResume(({ reason }) => {
      stats.layoutDeferredDuringAutoLoad = layoutCoordinator.getStats().deferredCount;
      schedule(`resume:${reason}`);
    });
    runtime.addCleanup(unsubscribeResume);
    runtime.addCleanup(() => {
      for (const element of feedRoot?.querySelectorAll?.(`[${HOME_FEED_LAYOUT_FIX_ATTR}], [${HOME_FEED_LAYOUT_MARGIN_ATTR}]`) || []) {
        element.removeAttribute(HOME_FEED_LAYOUT_FIX_ATTR);
        element.removeAttribute(HOME_FEED_LAYOUT_MARGIN_ATTR);
      }
      layoutCleanup();
    });
    schedule();
  }
  function installHomeFeedAdHiding(cfg) {
    if (!isHomePage() || window.__BILIKIT_HOME_AD_HIDING__) return;
    window.__BILIKIT_HOME_AD_HIDING__ = true;
    const enabled = cfg?.get?.("hideAds") !== false;
    const stats = {
      enabled,
      selector: ".floor-single-card",
      detected: 0,
      hidden: 0,
      lastScanAt: 0,
      lastSkipReason: enabled ? "" : "disabled"
    };
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_AD_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    if (!enabled) return;
    const runtime = getRuntimeCoordinator();
    const style = document.createElement("style");
    style.dataset.bilikit = "home-ad-hiding";
    style.textContent = [
      ".container.is-version8 .floor-single-card{display:none!important}",
      ".container.is-version8 .feed-card:has(.floor-single-card){display:none!important}"
    ].join("");
    const appendStyle = () => {
      const root = document.head || document.documentElement;
      if (root && !style.isConnected) root.appendChild(style);
    };
    const scan = () => {
      const slots = [...document.querySelectorAll(".container.is-version8 .floor-single-card")];
      const hiddenCards = new Set(slots.map((slot) => slot.closest(".feed-card") || slot));
      stats.detected = slots.length;
      stats.hidden = hiddenCards.size;
      stats.lastScanAt = Date.now();
    };
    appendStyle();
    runtime.listen(document, "DOMContentLoaded", appendStyle, { once: true });
    const feedCoordinator = getHomeFeedCoordinator();
    const unsubscribe = feedCoordinator?.subscribe((event) => {
      if (event.rootChanged || event.addedNodes.length) scan();
    });
    runtime.addCleanup(unsubscribe);
    runtime.addCleanup(() => {
      style.remove();
      if (window.__BILIKIT_HOME_AD_HIDING__) delete window.__BILIKIT_HOME_AD_HIDING__;
      if (window.__BILIKIT_HOME_AD_STATS__) delete window.__BILIKIT_HOME_AD_STATS__;
    });
    scan();
  }
  function installHomeFeedImagePriority(cfg) {
    if (!isHomePage() || window.__BILIKIT_HOME_FEED_PRIORITY__) return;
    if (typeof IntersectionObserver !== "function") return;
    window.__BILIKIT_HOME_FEED_PRIORITY__ = true;
    const preloadRows = clampHomeFeedNumber(
      cfg?.get?.("preloadRows"),
      HOME_FEED_PRELOAD_ROWS_MIN,
      HOME_FEED_PRELOAD_ROWS_MAX,
      HOME_FEED_PRELOAD_ROWS_DEFAULT
    );
    const runtime = getRuntimeCoordinator();
    const feedCoordinator = getHomeFeedCoordinator();
    const stats = {
      enabled: true,
      preloadRows,
      preloadDistance: 0,
      preloadBatchLimit: 0,
      observedImages: 0,
      preloadedImages: 0,
      highPriorityImages: 0,
      mutationBatches: 0,
      scannedCards: 0
    };
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_FEED_PRIORITY_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    let observer = null;
    let feedRoot = null;
    let preloadDistance = 0;
    let observed = new WeakMap();
    const promoted = new WeakMap();
    const preloadQueue = [];
    let idleHandle = 0;
    let idleKind = "";
    let preloadWindowTop = NaN;
    let preloadWindowCount = 0;
    const getFeedRoot = () => document.querySelector(".container.is-version8");
    const getCardElements = (root) => [...root?.children || []].filter((element) => {
      return HOME_FEED_CARD_RE.test(String(element.className || "")) && element.offsetWidth > 0;
    });
    const getColumnCount = (root) => {
      const cards = getCardElements(root);
      if (!cards.length) return 4;
      const top = cards[0].getBoundingClientRect().top;
      return Math.max(1, cards.filter((element) => Math.abs(element.getBoundingClientRect().top - top) < 8).length);
    };
    const getPreloadDistance = (root) => {
      const grid = getComputedStyle(root);
      const gap = Number.parseFloat(grid.rowGap || grid.gap) || 20;
      const sample = getCardElements(root)[0];
      const height = sample ? sample.getBoundingClientRect().height : 207;
      return Math.round(Math.min(HOME_FEED_PRELOAD_MAX, Math.max(HOME_FEED_PRELOAD_MIN, (height + gap) * preloadRows)));
    };
    const getPreloadBatchLimit = (root) => {
      return Math.min(HOME_FEED_PRELOAD_BATCH_MAX, Math.max(HOME_FEED_PRELOAD_BATCH_MIN, getColumnCount(root) * preloadRows));
    };
    const inHomeFeed = (img) => {
      const root = img.closest(".container.is-version8");
      if (!root || img.closest(".recommended-swipe")) return false;
      if (img.closest("video, [class*='preview'], [class*='Preview'], [class*='hover-video'], [class*='HoverVideo'], [class*='image--hover']")) return false;
      const card = img.closest(HOME_FEED_CARD_SELECTOR);
      if (!card || card.querySelector("video")) return false;
      const images = [...card.querySelectorAll("img")];
      return images.length <= 1 || img === images[0];
    };
    const cancelIdle = () => {
      if (!idleHandle) return;
      if (idleKind === "ric" && typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
      else clearTimeout(idleHandle);
      idleHandle = 0;
      idleKind = "";
    };
    const drainQueue = () => {
      idleHandle = 0;
      idleKind = "";
      let budget = 4;
      while (preloadQueue.length && budget-- > 0) {
        const item = preloadQueue.shift();
        const img = item?.img;
        if (!(img instanceof HTMLImageElement) || !img.isConnected || img.complete && img.naturalWidth > 0) continue;
        try {
          img.fetchPriority = "low";
          if (img.loading === "lazy") img.loading = "eager";
          stats.preloadedImages += 1;
        } catch {
        }
      }
      if (preloadQueue.length) scheduleIdleDrain();
    };
    const scheduleIdleDrain = () => {
      if (idleHandle) return;
      if (typeof requestIdleCallback === "function") {
        idleKind = "ric";
        idleHandle = requestIdleCallback(drainQueue, { timeout: 1200 });
      } else {
        idleKind = "timeout";
        idleHandle = setTimeout(drainQueue, 180);
      }
    };
    const watch = (img) => {
      if (!(img instanceof HTMLImageElement) || !inHomeFeed(img)) return;
      const source = img.currentSrc || img.src || img.getAttribute("src") || "";
      if (!BILI_MEDIA_IMAGE_RE.test(source) || observed.get(img) === source) return;
      observed.set(img, source);
      stats.observedImages += 1;
      observer.observe(img);
    };
    const scan = (root) => {
      if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
      if (root instanceof HTMLImageElement) watch(root);
      root.querySelectorAll?.("img").forEach(watch);
    };
    const promote = (img, bounds) => {
      if (!(img instanceof HTMLImageElement)) return false;
      const source = img.currentSrc || img.src || img.getAttribute("src") || "";
      if (promoted.get(img) === source) return true;
      const needsLoad = !img.complete || !img.naturalWidth;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (!Number.isFinite(preloadWindowTop) || Math.abs(scrollTop - preloadWindowTop) > Math.max(160, preloadDistance)) {
        preloadWindowTop = scrollTop;
        preloadWindowCount = 0;
      }
      const batchLimit = getPreloadBatchLimit(feedRoot);
      stats.preloadBatchLimit = batchLimit;
      if (needsLoad && preloadWindowCount >= batchLimit) return false;
      promoted.set(img, source);
      const inViewport = bounds.bottom > 0 && bounds.top < window.innerHeight
        && bounds.right > 0 && bounds.left < window.innerWidth;
      try {
        img.fetchPriority = inViewport ? "high" : "low";
        if (inViewport) stats.highPriorityImages += 1;
      } catch {
      }
      if (needsLoad) {
        preloadWindowCount += 1;
        if (inViewport) {
          try {
            if (img.loading === "lazy") img.loading = "eager";
            stats.preloadedImages += 1;
          } catch {
          }
        } else {
          preloadQueue.push({ img, source });
          scheduleIdleDrain();
        }
      }
      return true;
    };
    const rebuildObserver = (requestedRoot) => {
      const root = requestedRoot?.isConnected ? requestedRoot : getFeedRoot();
      if (!root) return false;
      const distance = getPreloadDistance(root);
      if (observer && root === feedRoot && Math.abs(distance - preloadDistance) < 24) return false;
      observer?.disconnect();
      observed = new WeakMap();
      feedRoot = root;
      preloadDistance = distance;
      stats.preloadDistance = distance;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          if (promote(img, entry.boundingClientRect)) observer.unobserve(img);
        }
      }, { rootMargin: `0px 0px ${distance}px 0px` });
      return true;
    };
    const processFeedUpdate = (event) => {
      stats.mutationBatches += 1;
      feedRoot = event.root || feedRoot;
      const observerRebuilt = rebuildObserver(feedRoot);
      if (event.rootChanged || observerRebuilt) scan(feedRoot);
      for (const node of event.addedNodes) {
        scan(node);
        stats.scannedCards += 1;
      }
      for (const resource of event.changedResources) {
        if (resource instanceof HTMLImageElement) watch(resource);
      }
    };
    const unsubscribe = feedCoordinator?.subscribe(processFeedUpdate);
    runtime.addCleanup(unsubscribe);
    runtime.addCleanup(() => {
      cancelIdle();
      preloadQueue.length = 0;
      observer?.disconnect();
      if (window.__BILIKIT_HOME_FEED_PRIORITY__) delete window.__BILIKIT_HOME_FEED_PRIORITY__;
    });
  }
  function installHomeFeedAutoLoad(cfg) {
    if (!isHomePage() || window.__BILIKIT_HOME_AUTO_LOAD__) return;
    window.__BILIKIT_HOME_AUTO_LOAD__ = true;
    const enabled = cfg?.get?.("autoLoad") !== false;
    const targetRows = clampHomeFeedNumber(
      cfg?.get?.("autoLoadRows"),
      HOME_FEED_AUTO_LOAD_ROWS_MIN,
      HOME_FEED_AUTO_LOAD_ROWS_MAX,
      HOME_FEED_AUTO_LOAD_ROWS_DEFAULT
    );
    const stats = {
      enabled,
      delayMs: HOME_FEED_AUTO_LOAD_DELAY,
      targetRows,
      feedDetected: false,
      triggerCount: 0,
      batchCount: 0,
      probeMode: "sync-immediate-restore",
      visibleProbeCount: 0,
      layoutDeferred: 0,
      anchorCorrections: 0,
      maxAnchorDelta: 0,
      lastCancelReason: "",
      completedBatches: 0,
      appendedRows: 0,
      lastAppendedRows: 0,
      lastResult: "idle",
      lastSkipReason: ""
    };
    try {
      Object.defineProperty(window, "__BILIKIT_HOME_AUTO_LOAD_STATS__", { configurable: true, get: () => ({ ...stats }) });
    } catch {
    }
    const runtime = getRuntimeCoordinator();
    const feedCoordinator = getHomeFeedCoordinator();
    if (!enabled) {
      stats.lastSkipReason = "disabled";
      return;
    }
    let feedRoot = null;
    let idleTimer = null;
    let batch = null;
    let pendingRestoreState = null;
    let lastTrustedScrollAt = 0;
    const layoutCoordinator = getHomeFeedLayoutCoordinator();
    const getFeedRoot = () => feedRoot?.isConnected ? feedRoot : document.querySelector(".container.is-version8");
    const getCards = (root) => [...root?.children || []].filter((element) => {
      return HOME_FEED_CARD_RE.test(String(element.className || "")) && element.offsetWidth > 0;
    });
    const snapshot = (root) => {
      const cards = getCards(root);
      const rows = [];
      for (const card of cards) {
        const top = Math.round(card.getBoundingClientRect().top);
        if (!rows.some((value) => Math.abs(value - top) < 8)) rows.push(top);
      }
      return { cards: cards.length, rows: rows.length };
    };
    const captureAnchor = (root, scroller) => {
      const cards = getCards(root);
      const anchor = cards.find((card) => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });
      if (!anchor) return null;
      return {
        element: anchor,
        top: anchor.getBoundingClientRect().top,
        scrollTop: scroller.scrollTop || window.scrollY || 0
      };
    };
    const currentScrollTop = (scroller) => Math.max(0, scroller.scrollTop || window.scrollY || 0);
    const setScrollTop = (scroller, value) => {
      scroller.scrollTop = value;
      if (Math.abs((scroller.scrollTop || 0) - value) > 1) window.scrollTo(0, value);
    };
    const clearIdleTimer = () => {
      idleTimer?.cancel();
      idleTimer = null;
    };
    const skip = (reason) => {
      stats.lastSkipReason = reason;
      stats.lastResult = "skipped";
    };
    const restoreAnchor = (state) => {
      if (!state.anchor || state.interrupted || !state.anchor.element?.isConnected) return;
      const currentTop = state.anchor.element.getBoundingClientRect().top;
      const delta = currentTop - state.anchor.top;
      const absoluteDelta = Math.abs(delta);
      stats.maxAnchorDelta = Math.max(stats.maxAnchorDelta, absoluteDelta);
      if (absoluteDelta < 1) return;
      const scroller = document.scrollingElement || document.documentElement;
      setScrollTop(scroller, currentScrollTop(scroller) + delta);
      stats.anchorCorrections += 1;
    };
    const completeBatch = (state, result) => {
      if (batch !== state) return;
      state.finishTimer?.cancel();
      state.timer?.cancel();
      state.verifyFrame?.cancel();
      const current = snapshot(getFeedRoot());
      const appended = Math.max(0, current.rows - state.beforeRows);
      stats.lastAppendedRows = appended;
      stats.appendedRows += appended;
      stats.completedBatches += 1;
      stats.lastResult = result;
      batch = null;
      pendingRestoreState = state;
      if (state.layoutToken && layoutCoordinator) {
        layoutCoordinator.afterResume(() => {
          if (pendingRestoreState === state) pendingRestoreState = null;
          restoreAnchor(state);
        });
        layoutCoordinator.end(state.layoutToken);
        stats.layoutDeferred = layoutCoordinator.getStats().deferredCount;
      } else {
        runtime.frame(() => {
          if (pendingRestoreState === state) pendingRestoreState = null;
          restoreAnchor(state);
        });
      }
    };
    const finishBatch = (state, result) => {
      if (batch !== state) return;
      if (state.finishing) return;
      state.finishing = true;
      if (state.finishTimer) {
        state.finishResult = result;
        return;
      }
      state.finishResult = result;
      state.finishTimer = runtime.timeout(() => {
        state.finishTimer = null;
        completeBatch(state, state.finishResult);
      }, HOME_FEED_AUTO_LOAD_DOM_SETTLE);
    };
    const emitNativeScroll = () => {
      try {
        window.dispatchEvent(new Event("scroll"));
        document.dispatchEvent(new Event("scroll"));
      } catch {
      }
    };
    const checkBatch = (state) => {
      if (batch !== state || state.finishing) return;
      if (state.interrupted) {
        finishBatch(state, "user-interrupted");
        return;
      }
      if (isAppFeedActive()) {
        stats.feedDetected = true;
        finishBatch(state, "feed-detected");
        return;
      }
      const current = snapshot(getFeedRoot());
      const appended = Math.max(0, current.rows - state.beforeRows);
      if (appended >= targetRows) {
        finishBatch(state, "target-reached");
        return;
      }
      if (Date.now() >= state.deadline || state.attempts >= HOME_FEED_AUTO_LOAD_MAX_PROBES) {
        finishBatch(state, appended ? "partial" : "no-append");
        return;
      }
      state.lastRows = current.rows;
      state.timer = runtime.timeout(() => triggerNativeLoad(state), appended > 0 ? HOME_FEED_AUTO_LOAD_RETRY_DELAY : HOME_FEED_AUTO_LOAD_RETRY_DELAY);
    };
    const triggerNativeLoad = (state) => {
      if (batch !== state || state.finishing) return;
      if (state.interrupted) {
        finishBatch(state, "user-interrupted");
        return;
      }
      if (isAppFeedActive()) {
        stats.feedDetected = true;
        finishBatch(state, "feed-detected");
        return;
      }
      const scroller = document.scrollingElement || document.documentElement;
      const originalTop = currentScrollTop(scroller);
      const bottomTop = Math.max(0, scroller.scrollHeight - window.innerHeight - 64);
      const probeTop = Math.max(originalTop, bottomTop);
      state.attempts += 1;
      stats.triggerCount += 1;
      state.originalTop = originalTop;
      state.probeTop = probeTop;
      state.internalScrollUntil = Date.now() + HOME_FEED_AUTO_LOAD_INTERNAL_SCROLL_GRACE;
      try {
        if (probeTop > originalTop + 8) setScrollTop(scroller, probeTop);
        emitNativeScroll();
        if (probeTop > originalTop + 8) setScrollTop(scroller, originalTop);
      } catch {
        try { setScrollTop(scroller, originalTop); } catch {
        }
        finishBatch(state, "probe-error");
        return;
      }
      state.verifyFrame?.cancel();
      state.verifyFrame = runtime.frame(() => {
        if (batch !== state || state.interrupted || probeTop <= originalTop + 8) return;
        const observedTop = currentScrollTop(scroller);
        if (Math.abs(observedTop - probeTop) <= 8) {
          stats.visibleProbeCount += 1;
          stats.lastCancelReason = "probe-visible";
          state.interrupted = true;
          finishBatch(state, "probe-visible");
        }
      });
      state.timer = runtime.timeout(() => checkBatch(state), HOME_FEED_AUTO_LOAD_RETRY_DELAY);
    };
    const runBatch = () => {
      idleTimer = null;
      if (batch || !enabled || document.visibilityState !== "visible") {
        if (!batch && document.visibilityState !== "visible") skip("page-hidden");
        return;
      }
      if (isAppFeedActive()) {
        stats.feedDetected = true;
        skip("feed-active");
        return;
      }
      if (Date.now() - lastTrustedScrollAt < HOME_FEED_AUTO_LOAD_DELAY - 100) return;
      const root = getFeedRoot();
      const before = snapshot(root);
      if (!root || before.cards === 0) {
        skip("feed-root-unavailable");
        return;
      }
      const scroller = document.scrollingElement || document.documentElement;
      if (scroller.scrollHeight <= window.innerHeight + 160) {
        skip("content-not-scrollable");
        return;
      }
      const anchor = captureAnchor(root, scroller);
      stats.lastCancelReason = "";
      batch = {
        beforeRows: before.rows,
        lastRows: before.rows,
        attempts: 0,
        deadline: Date.now() + HOME_FEED_AUTO_LOAD_TIMEOUT,
        originalTop: currentScrollTop(scroller),
        anchor,
        interrupted: false,
        finishing: false,
        probeTop: 0,
        internalScrollUntil: 0,
        verifyFrame: null,
        timer: null,
        finishTimer: null,
        finishResult: "partial",
        layoutToken: layoutCoordinator?.begin("auto-load") || null
      };
      stats.batchCount += 1;
      stats.lastResult = "running";
      triggerNativeLoad(batch);
    };
    const scheduleIdle = () => {
      clearIdleTimer();
      if (!enabled || batch || isAppFeedActive() || document.visibilityState !== "visible") return;
      idleTimer = runtime.timeout(runBatch, HOME_FEED_AUTO_LOAD_DELAY);
    };
    const onScroll = (event) => {
      if (event && event.isTrusted === false) return;
      lastTrustedScrollAt = Date.now();
      if (!batch && pendingRestoreState) {
        pendingRestoreState.interrupted = true;
        pendingRestoreState = null;
        stats.lastCancelReason = "user-scroll-after-load";
      }
      if (batch) {
        const state = batch;
        const scroller = document.scrollingElement || document.documentElement;
        const currentTop = currentScrollTop(scroller);
        const internal = Date.now() <= state.internalScrollUntil
          && (Math.abs(currentTop - state.originalTop) <= 8 || Math.abs(currentTop - state.probeTop) <= 8);
        if (internal) return;
        batch.interrupted = true;
        stats.lastCancelReason = "user-scroll";
        finishBatch(batch, "user-interrupted");
        return;
      }
      scheduleIdle();
    };
    runtime.listen(window, "scroll", onScroll, { passive: true });
    runtime.listen(document, "visibilitychange", () => {
      if (document.visibilityState !== "visible") clearIdleTimer();
    });
    const unsubscribe = feedCoordinator?.subscribe((event) => {
      feedRoot = event.root || feedRoot;
      if (layoutCoordinator) stats.layoutDeferred = layoutCoordinator.getStats().deferredCount;
      if (!batch || !event.addedNodes.length) return;
      const current = snapshot(feedRoot);
      if (current.rows - batch.beforeRows >= targetRows) finishBatch(batch, "target-reached");
    });
    runtime.addCleanup(unsubscribe);
    runtime.addCleanup(() => {
      clearIdleTimer();
      if (batch?.timer) batch.timer.cancel();
      if (batch?.finishTimer) batch.finishTimer.cancel();
      if (batch?.layoutToken && layoutCoordinator) layoutCoordinator.end(batch.layoutToken);
      batch = null;
      pendingRestoreState = null;
      if (window.__BILIKIT_HOME_AUTO_LOAD__) delete window.__BILIKIT_HOME_AUTO_LOAD__;
    });
  }
  const homeFeedLoad = {
    id: "home-feed-load",
    name: "首页加载",
    description: "控制首页广告位、封面预加载，以及原生首页在停止滚动后的有限自动加载",
    category: "推荐",
    runAt: "start",
    settings: [
      {
        key: "hideAds",
        type: "toggle",
        label: "隐藏首页广告位",
        default: true,
        hint: "隐藏首页信息流中的广告楼层，不影响普通视频卡片和视频悬停预览"
      },
      {
        key: "preloadRows",
        type: "number",
        label: "首页封面预加载行数",
        default: HOME_FEED_PRELOAD_ROWS_DEFAULT,
        min: HOME_FEED_PRELOAD_ROWS_MIN,
        max: HOME_FEED_PRELOAD_ROWS_MAX,
        step: 1,
        hint: "默认 6 行，可设置 4–10 行；只预加载封面，不处理视频悬停预览"
      },
      {
        key: "autoLoad",
        type: "toggle",
        label: "停止滚动后自动加载",
        default: true,
        hint: "停止滚动约 3 秒后触发一批原生首页加载；检测到 BiliKit Feed 时自动停用"
      },
      {
        key: "autoLoadRows",
        type: "number",
        label: "自动加载行数",
        default: HOME_FEED_AUTO_LOAD_ROWS_DEFAULT,
        min: HOME_FEED_AUTO_LOAD_ROWS_MIN,
        max: HOME_FEED_AUTO_LOAD_ROWS_MAX,
        step: 1,
        hint: "每次停止滚动最多加载 5–15 行，默认 10 行"
      }
    ],
    init: (cfg) => {
      installHomeFeedAdHiding(cfg);
      installHomeFeedImagePriority(cfg);
      installHomeFeedAutoLoad(cfg);
    }
  };
  function isVideoUrl(u) {
    try {
      const url = new URL(u, location.href);
      if (!/(^|\.)bilibili\.com$/.test(url.hostname)) return false;
      return /^\/video\/(BV[0-9A-Za-z]+|av\d+)/i.test(url.pathname) || /^\/bangumi\/play\/(ep|ss)\d+/i.test(url.pathname);
    } catch {
      return false;
    }
  }
  function resolve(target) {
    if (!(target instanceof Element)) return null;
    // 视频卡片里的「稍后再看 / 不感兴趣 / 更多」属于 B 站原生操作。
    // 它们常常嵌在封面 <a> 内，必须在识别视频链接前放行，否则捕获阶段会截断原生请求。
    if (target.closest([
      "button",
      '[role="button"]',
      '[aria-haspopup="menu"]',
      ".bili-watch-later",
      ".bili-watch-later--wrap",
      ".bili-video-card__no-interest",
      ".bili-video-card__info--no-interest",
      ".bili-video-card__more"
    ].join(","))) return null;
    if (target.closest(".bk-feed-noopen")) return null;
    const pick = (root2, url) => {
      const img = root2.querySelector("img");
      return { url, cover: img && (img.currentSrc || img.src) || "" };
    };
    const a = target.closest("a[href]");
    if (a && isVideoUrl(a.href)) return pick(a, a.href.split("#")[0]);
    const card = target.closest("[data-bvid]");
    if (card && card.dataset.bvid && !target.closest(".bk-feed-face, .bk-feed-up")) {
      return pick(card, `https://www.bilibili.com/video/${card.dataset.bvid}`);
    }
    return null;
  }
