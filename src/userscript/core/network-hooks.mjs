export function createBiliKitNetworkHookManager(host = window, historyTarget = host?.history) {
  const fetchEntries = new Map();
  const xhrEntries = new Map();
  const historyEntries = new Map();
  const native = {
    fetch: host?.fetch,
    XMLHttpRequest: host?.XMLHttpRequest,
    history: {}
  };
  for (const method of ["pushState", "replaceState"]) native.history[method] = historyTarget?.[method];
  let sequence = 0;
  let disposed = false;
  const ordered = (entries) => [...entries.values()].sort((left, right) => left.order - right.order);
  const rebuildFetch = () => {
    if (disposed || typeof native.fetch !== "function") return;
    let next = native.fetch;
    for (const entry of ordered(fetchEntries)) {
      try {
        const wrapped = entry.factory(next);
        if (typeof wrapped === "function") next = wrapped;
      } catch (error) {
        console.error(`[BiliKit] fetch hook「${entry.owner}」构建失败：`, error);
      }
    }
    host.fetch = next;
  };
  const rebuildXHR = () => {
    if (disposed || typeof native.XMLHttpRequest !== "function") return;
    let next = native.XMLHttpRequest;
    for (const entry of ordered(xhrEntries)) {
      try {
        const wrapped = entry.factory(next);
        if (wrapped) next = wrapped;
      } catch (error) {
        console.error(`[BiliKit] XMLHttpRequest hook「${entry.owner}」构建失败：`, error);
      }
    }
    host.XMLHttpRequest = next;
  };
  const rebuildHistory = (method) => {
    const original = native.history[method];
    if (disposed || typeof original !== "function") return;
    let next = original;
    for (const entry of ordered(historyEntries.get(method) || new Map())) {
      try {
        const wrapped = entry.factory(next);
        if (typeof wrapped === "function") next = wrapped;
      } catch (error) {
        console.error(`[BiliKit] history.${method} hook「${entry.owner}」构建失败：`, error);
      }
    }
    historyTarget[method] = next;
  };
  const add = (map, owner, factory, rebuild) => {
    if (!owner || typeof factory !== "function") return () => {};
    const entry = { owner: String(owner), factory, order: ++sequence };
    map.set(entry.owner, entry);
    rebuild();
    return () => {
      if (map.get(entry.owner) !== entry) return;
      map.delete(entry.owner);
      rebuild();
    };
  };
  return {
    addFetch(owner, factory) {
      return add(fetchEntries, owner, factory, rebuildFetch);
    },
    addXHR(owner, factory) {
      return add(xhrEntries, owner, factory, rebuildXHR);
    },
    addHistory(owner, method, factory) {
      if (!(method === "pushState" || method === "replaceState")) return () => {};
      let entries = historyEntries.get(method);
      if (!entries) historyEntries.set(method, entries = new Map());
      return add(entries, owner, factory, () => rebuildHistory(method));
    },
    remove(owner) {
      const key = String(owner || "");
      if (!key) return;
      if (fetchEntries.delete(key)) rebuildFetch();
      if (xhrEntries.delete(key)) rebuildXHR();
      for (const [method, entries] of historyEntries) {
        if (entries.delete(key)) rebuildHistory(method);
      }
    },
    getStats() {
      return {
        fetchOwners: ordered(fetchEntries).map((entry) => entry.owner),
        xhrOwners: ordered(xhrEntries).map((entry) => entry.owner),
        historyOwners: Object.fromEntries([...historyEntries].map(([method, entries]) => [method, ordered(entries).map((entry) => entry.owner)]))
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (typeof native.fetch === "function") host.fetch = native.fetch;
      if (typeof native.XMLHttpRequest === "function") host.XMLHttpRequest = native.XMLHttpRequest;
      for (const method of ["pushState", "replaceState"]) {
        if (typeof native.history[method] === "function") historyTarget[method] = native.history[method];
      }
      fetchEntries.clear();
      xhrEntries.clear();
      historyEntries.clear();
    }
  };
}
