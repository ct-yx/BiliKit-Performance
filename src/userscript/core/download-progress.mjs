const DOWNLOAD_PROGRESS_DEFAULTS = {
  showOverview: true,
  showGlobalSpeed: true,
  showGlobalEta: true,
  showGlobalProgress: true,
  showFileSize: true,
  showTaskProgress: true,
  refreshIntervalMs: 500,
  remuxSampleMinMs: 3000
};

const ACTIVE_TASK_STATUSES = ["queued", "downloading", "remuxing", "saving"];
const VISIBLE_TASK_STATUSES = [
  "queued", "downloading", "remuxing", "saving", "complete", "partial", "ready-to-save"
];
const TERMINAL_TASK_STATUSES = ["complete", "partial", "error", "canceled"];

function createDefaultNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();
}

export function createBiliKitDownloadProgressController(options = {}) {
  const getSetting = typeof options.getSetting === "function"
    ? options.getSetting
    : (_key, fallback) => fallback;
  const getStats = typeof options.getStats === "function" ? options.getStats : () => ({});
  const getTasks = typeof options.getTasks === "function" ? options.getTasks : () => [];
  const getMergeQueue = typeof options.getMergeQueue === "function" ? options.getMergeQueue : () => [];
  const getMergeRunningJobs = typeof options.getMergeRunningJobs === "function" ? options.getMergeRunningJobs : () => [];
  const getMergeConcurrency = typeof options.getMergeConcurrency === "function" ? options.getMergeConcurrency : () => 1;
  const getMaxMergeConcurrency = typeof options.getMaxMergeConcurrency === "function" ? options.getMaxMergeConcurrency : () => 4;
  const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const now = typeof options.now === "function" ? options.now : createDefaultNow();
  const renderTasks = typeof options.onRenderTasks === "function" ? options.onRenderTasks : () => {};
  const setTimeoutFn = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;
  const clearTimeoutFn = typeof options.clearTimeout === "function" ? options.clearTimeout : clearTimeout;

  let progressTimer = 0;
  let progressLastAt = Date.now();
  let progressLastBytes = 0;
  let progressSpeed = 0;
  let progressSampling = false;
  let remuxModel = null;

  function setting(key) {
    const fallback = DOWNLOAD_PROGRESS_DEFAULTS[key];
    const value = getSetting(key, fallback);
    if (typeof fallback === "boolean") return value !== false;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (key === "refreshIntervalMs") return Math.min(2000, Math.max(250, Math.round(number / 50) * 50));
    if (key === "remuxSampleMinMs") return Math.min(5000, Math.max(3000, Math.round(number / 250) * 250));
    return number;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (!bytes) return "未知大小";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let index = 0;
    let number = bytes;
    while (number >= 1024 && index < units.length - 1) {
      number /= 1024;
      index += 1;
    }
    return `${number >= 100 || index === 0 ? number.toFixed(0) : number.toFixed(1)} ${units[index]}`;
  }

  function formatSpeed(value) {
    const speed = Number(value) || 0;
    return speed > 0 ? `${formatBytes(speed)}/s` : "--";
  }

  function formatEta(value) {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms <= 0) return "--";
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
    const hours = Math.floor(minutes / 60);
    return `${hours} 小时${minutes % 60 ? ` ${minutes % 60} 分` : ""}`;
  }

  function taskNeedsRemux(task) {
    return task?.mode === "merge";
  }

  function taskIsActive(task) {
    return !!task && ACTIVE_TASK_STATUSES.includes(task.status);
  }

  function taskSize(task) {
    const parts = Array.isArray(task?._downloadParts) ? task._downloadParts : [];
    const total = parts.reduce((sum, part) => sum + (
      Number(part.total) > 0 ? Number(part.total) : Number(part.estimated) || 0
    ), 0);
    return total || Number(task?.fileSizeEstimateBytes) || 0;
  }

  function taskLoaded(task) {
    return (Array.isArray(task?._downloadParts) ? task._downloadParts : [])
      .reduce((sum, part) => sum + Math.max(0, Number(part.loaded) || 0), 0);
  }

  function taskOverall(task) {
    const download = clamp(task.downloadProgress);
    const remux = taskNeedsRemux(task) ? clamp(task.remuxProgress) : 1;
    const save = clamp(task.saveProgress);
    return taskNeedsRemux(task)
      ? download * 0.7 + remux * 0.25 + save * 0.05
      : download * 0.95 + save * 0.05;
  }

  function normalizeTask(task) {
    if (!task) return;
    if (!Array.isArray(task._downloadParts)) task._downloadParts = [];
    if (task.status === "complete") {
      task.downloadProgress = 1;
      task.remuxProgress = taskNeedsRemux(task) ? 1 : task.remuxProgress || 1;
      task.saveProgress = 1;
    }
    task.loadedBytes = taskLoaded(task);
    task.totalBytes = taskSize(task);
    task.overallProgress = taskOverall(task);
    task.progress = Math.round(task.overallProgress * 100);
  }

  function updatePartProgress(task, index, loaded, total) {
    if (!task) return;
    if (!Array.isArray(task._downloadParts)) task._downloadParts = [];
    const part = task._downloadParts[index] || { loaded: 0, total: 0 };
    part.loaded = Math.max(part.loaded, Number(loaded) || 0);
    if (Number(total) > 0) part.total = Number(total);
    task._downloadParts[index] = part;
    const totalBytes = task._downloadParts.reduce((sum, item) => sum + Math.max(
      Number(item.total) || 0,
      Number(item.estimated) || 0
    ), 0);
    const loadedBytes = task._downloadParts.reduce((sum, item) => sum + (Number(item.loaded) || 0), 0);
    task.downloadProgress = totalBytes > 0 ? clamp(loadedBytes / totalBytes) : task.downloadProgress || 0;
    normalizeTask(task);
    ensureProgressTimer();
  }

  function resetPartProgress(task, index) {
    if (!task || !Array.isArray(task._downloadParts)) return;
    const part = task._downloadParts[index];
    if (!part) return;
    part.loaded = 0;
    part.total = 0;
    normalizeTask(task);
  }

  function setPartsComplete(task, sizes) {
    (sizes || []).forEach((size, index) => updatePartProgress(task, index, size, size));
    if (task) task.downloadProgress = 1;
    normalizeTask(task);
  }

  function setRemuxProgress(task, fraction) {
    if (!task) return;
    if (!task.remuxStartedAt) task.remuxStartedAt = now();
    task.remuxProgress = clamp(fraction);
    normalizeTask(task);
    ensureProgressTimer();
  }

  function setSaveProgress(task, fraction) {
    if (!task) return;
    if (!task.saveStartedAt) task.saveStartedAt = now();
    task.saveProgress = clamp(fraction);
    normalizeTask(task);
    ensureProgressTimer();
  }

  function readRemuxModel() {
    if (remuxModel) return remuxModel;
    const fallback = { weightedMsPerByte: 0, weight: 0, samples: [] };
    try {
      const stored = JSON.parse(storage?.getItem?.("bilikit:download-remux-model") || "null");
      if (stored && typeof stored === "object") {
        fallback.weightedMsPerByte = Number(stored.weightedMsPerByte) || 0;
        fallback.weight = Number(stored.weight) || 0;
        fallback.samples = Array.isArray(stored.samples)
          ? stored.samples.slice(-3).filter((sample) => sample && Number(sample.elapsedMs) > 0)
          : [];
      }
    } catch {
    }
    remuxModel = fallback;
    const stats = getStats();
    stats.remuxModelReady = fallback.weightedMsPerByte > 0;
    stats.remuxSampleCount = fallback.samples.length;
    return remuxModel;
  }

  function persistRemuxModel(model) {
    try {
      storage?.setItem?.("bilikit:download-remux-model", JSON.stringify({
        weightedMsPerByte: Number(model.weightedMsPerByte) || 0,
        weight: Number(model.weight) || 0,
        samples: model.samples.slice(-3).map((sample) => ({
          inputBytes: Math.max(0, Number(sample.inputBytes) || 0),
          mediaDuration: Math.max(0, Number(sample.mediaDuration) || 0),
          elapsedMs: Math.max(0, Number(sample.elapsedMs) || 0),
          qualityHeight: Math.max(0, Number(sample.qualityHeight) || 0),
          at: Number(sample.at) || Date.now()
        }))
      }));
    } catch {
    }
  }

  function recordRemuxSample(task, elapsedMs) {
    const inputBytes = Math.max(0, Number(task?.inputBytes) || Number(task?.totalBytes) || 0);
    const elapsed = Math.max(0, Number(elapsedMs) || 0);
    if (!inputBytes || elapsed < setting("remuxSampleMinMs")) return;
    const model = readRemuxModel();
    const rate = elapsed / inputBytes;
    const weight = Math.max(0, Number(model.weight) || 0);
    model.weightedMsPerByte = ((Number(model.weightedMsPerByte) || 0) * weight + rate) / (weight + 1);
    model.weight = weight + 1;
    model.samples.push({
      inputBytes,
      mediaDuration: Math.max(0, Number(task.mediaDuration) || 0),
      elapsedMs: elapsed,
      qualityHeight: Math.max(0, Number(task.qualityHeight) || 0),
      at: Date.now()
    });
    model.samples = model.samples.slice(-3);
    persistRemuxModel(model);
    const stats = getStats();
    stats.remuxModelReady = model.weightedMsPerByte > 0;
    stats.remuxSampleCount = model.samples.length;
    stats.lastRemuxSampleMs = elapsed;
  }

  function estimateRemuxMs(task) {
    const model = readRemuxModel();
    const bytes = Math.max(
      Number(task?.inputBytes) || 0,
      Number(task?.fileSizeEstimateBytes) || 0,
      Number(task?.totalBytes) || 0
    );
    if (!bytes) return 0;
    const duration = Math.max(0, Number(task?.mediaDuration) || 0);
    const height = Math.max(0, Number(task?.qualityHeight) || 0);
    const predictions = model.samples.map((sample) => {
      const sampleBytes = Math.max(1, Number(sample.inputBytes) || 0);
      const sampleDuration = Math.max(1, Number(sample.mediaDuration) || 0);
      const sampleHeight = Math.max(1, Number(sample.qualityHeight) || 0);
      const durationFactor = duration > 0 ? Math.pow(duration / sampleDuration, 0.25) : 1;
      const qualityFactor = height > 0 ? Math.pow(height / sampleHeight, 0.15) : 1;
      return Math.max(0, Number(sample.elapsedMs) || 0) * (bytes / sampleBytes) * durationFactor * qualityFactor;
    }).filter((value) => value > 0 && Number.isFinite(value));
    const rate = Number(model.weightedMsPerByte) || 0;
    const predictedTotal = predictions.length
      ? predictions.reduce((sum, value) => sum + value, 0) / predictions.length
      : rate ? bytes * rate : 0;
    if (!predictedTotal) return 0;
    if (task?.status === "remuxing" && Number(task.remuxProgress) > 0) {
      const elapsed = Math.max(0, now() - (Number(task.remuxStartedAt) || now()));
      const progressExpected = elapsed / clamp(task.remuxProgress, 0.01, 1);
      return Math.max(0, Math.max(predictedTotal, progressExpected) - elapsed);
    }
    return Math.max(0, predictedTotal);
  }

  function estimateTaskDownloadMs(task, speed) {
    const total = Math.max(Number(task?.totalBytes) || 0, Number(task?.fileSizeEstimateBytes) || 0);
    const loaded = Math.max(0, Number(task?.loadedBytes) || taskLoaded(task));
    if (!total || speed <= 0 || total <= loaded || TERMINAL_TASK_STATUSES.includes(task?.status) || ["remuxing", "saving"].includes(task?.status)) return 0;
    return (total - loaded) / speed * 1000;
  }

  function schedulePoolEta(estimates, concurrency) {
    const slots = Array.from({ length: Math.max(1, concurrency) }, () => 0);
    for (const estimate of estimates) {
      let slot = 0;
      for (let index = 1; index < slots.length; index += 1) if (slots[index] < slots[slot]) slot = index;
      slots[slot] += Math.max(0, Number(estimate) || 0);
    }
    return Math.max(0, ...slots);
  }

  function estimateMergePoolEta(jobs, speed, concurrency, activeDownloadCount = 1) {
    const maxConcurrency = Math.max(1, Number(getMaxMergeConcurrency()) || 4);
    const slots = Math.max(1, Math.min(maxConcurrency, Number(concurrency) || 1));
    const availableJobs = (Array.isArray(jobs) ? jobs : []).filter((job, index, list) => (
      job?.task && list.findIndex((item) => item.task === job.task) === index
      && !TERMINAL_TASK_STATUSES.includes(job.task.status)
    ));
    const perTaskSpeed = Number(speed) > 0 ? Number(speed) / Math.max(1, Number(activeDownloadCount) || 1) : 0;
    const downloadMs = availableJobs.map((job) => {
      const task = job.task;
      if (["remuxing", "saving"].includes(task.status)) return 0;
      return estimateTaskDownloadMs(task, perTaskSpeed);
    });
    const remuxMs = availableJobs.map((job) => job.task.status === "saving" ? 0 : estimateRemuxMs(job.task));
    const fullMs = availableJobs.map((job, index) => downloadMs[index] + remuxMs[index]);
    return {
      remuxEtaMs: schedulePoolEta(remuxMs, slots),
      totalEtaMs: schedulePoolEta(fullMs, slots)
    };
  }

  function estimateMergeEta(speed) {
    const running = [...(getMergeRunningJobs() || [])];
    const queued = [...(getMergeQueue() || [])];
    const jobs = [...running, ...queued];
    const maxConcurrency = Math.max(1, Number(getMaxMergeConcurrency()) || 4);
    const stats = getStats();
    const configuredConcurrency = Number(getMergeConcurrency()) || Number(stats.effectiveMergeConcurrency) || 1;
    const concurrency = Math.max(1, Math.min(maxConcurrency, configuredConcurrency));
    const activeDownloadCount = getTasks().filter((task) => task.status === "downloading").length || 1;
    return estimateMergePoolEta(jobs, speed, concurrency, activeDownloadCount);
  }

  function collectProgressStats(sampleSpeed = false) {
    const tasks = Array.isArray(getTasks()) ? getTasks() : [];
    const active = tasks.filter(taskIsActive);
    const visible = tasks.filter((task) => VISIBLE_TASK_STATUSES.includes(task.status));
    let loaded = 0;
    let total = 0;
    let remuxProgress = 0;
    let remuxCount = 0;
    let saveProgress = 0;
    let overallProgress = 0;
    for (const task of visible) {
      normalizeTask(task);
      loaded += task.loadedBytes || 0;
      total += task.totalBytes || 0;
      overallProgress += task.overallProgress || 0;
      saveProgress += task.saveProgress || 0;
      if (taskNeedsRemux(task)) {
        remuxProgress += task.remuxProgress || 0;
        remuxCount += 1;
      }
    }
    if (sampleSpeed) {
      const current = Date.now();
      const deltaMs = Math.max(1, current - progressLastAt);
      const deltaBytes = Math.max(0, loaded - progressLastBytes);
      const instantSpeed = deltaBytes * 1000 / deltaMs;
      progressSpeed = instantSpeed > 0 ? progressSpeed * 0.55 + instantSpeed * 0.45 : progressSpeed * 0.8;
      progressLastAt = current;
      progressLastBytes = loaded;
    }
    const remaining = Math.max(0, total - loaded);
    const downloadEta = progressSpeed > 0 && remaining > 0 ? remaining / progressSpeed * 1000 : 0;
    const mergeEta = estimateMergeEta(progressSpeed);
    const nonMergeRemaining = active.filter((task) => !taskNeedsRemux(task)).reduce((sum, task) => (
      sum + Math.max(0, Math.max(Number(task.totalBytes) || 0, Number(task.fileSizeEstimateBytes) || 0) - (Number(task.loadedBytes) || taskLoaded(task)))
    ), 0);
    const stats = getStats();
    stats.activeTaskCount = active.length;
    stats.globalDownloadSpeedBytes = progressSpeed;
    stats.globalLoadedBytes = loaded;
    stats.globalTotalBytes = total;
    const hasTasks = visible.length > 0;
    stats.globalDownloadProgress = hasTasks ? (total > 0 ? clamp(loaded / total) : active.length ? 0 : 1) : 0;
    stats.globalRemuxProgress = hasTasks ? (remuxCount ? clamp(remuxProgress / remuxCount) : 1) : 0;
    stats.globalSaveProgress = hasTasks ? clamp(saveProgress / visible.length) : 0;
    stats.globalOverallProgress = hasTasks ? clamp(overallProgress / visible.length) : 0;
    stats.downloadEtaMs = downloadEta;
    stats.remuxEtaMs = mergeEta.remuxEtaMs;
    const nonMergeDownloadEta = progressSpeed > 0 && nonMergeRemaining > 0
      ? nonMergeRemaining / progressSpeed * 1000
      : 0;
    stats.totalEtaMs = Math.max(mergeEta.totalEtaMs, nonMergeDownloadEta);
    return stats;
  }

  function progressTick() {
    progressTimer = 0;
    collectProgressStats(true);
    if (getTasks().some(taskIsActive)) ensureProgressTimer();
    else {
      progressSampling = false;
      progressSpeed = 0;
    }
    renderTasks();
  }

  function ensureProgressTimer() {
    const tasks = getTasks();
    if (!tasks.some(taskIsActive)) return;
    if (progressTimer) return;
    if (!progressSampling) {
      progressLastAt = Date.now();
      progressLastBytes = tasks.reduce((sum, task) => sum + (taskLoaded(task) || 0), 0);
      progressSpeed = 0;
      progressSampling = true;
    }
    progressTimer = setTimeoutFn(progressTick, setting("refreshIntervalMs"));
  }

  function resetProgressSampling() {
    if (progressTimer) {
      clearTimeoutFn(progressTimer);
      progressTimer = 0;
    }
    const tasks = getTasks();
    progressLastAt = Date.now();
    progressLastBytes = tasks.reduce((sum, task) => sum + (taskLoaded(task) || 0), 0);
    progressSampling = tasks.some(taskIsActive);
    if (progressSampling) ensureProgressTimer();
  }

  function dispose() {
    if (progressTimer) clearTimeoutFn(progressTimer);
    progressTimer = 0;
    progressSampling = false;
    progressSpeed = 0;
  }

  return {
    downloadWorkspaceSetting: setting,
    downloadClamp: clamp,
    downloadNow: now,
    formatDownloadBytes: formatBytes,
    formatDownloadSpeed: formatSpeed,
    formatDownloadEta: formatEta,
    downloadTaskNeedsRemux: taskNeedsRemux,
    downloadTaskIsActive: taskIsActive,
    getDownloadTaskSize: taskSize,
    getDownloadTaskLoaded: taskLoaded,
    calculateDownloadTaskOverall: taskOverall,
    normalizeDownloadTaskProgress: normalizeTask,
    updateDownloadPartProgress: updatePartProgress,
    resetDownloadPartProgress: resetPartProgress,
    setDownloadPartsComplete: setPartsComplete,
    setDownloadRemuxProgress: setRemuxProgress,
    setDownloadSaveProgress: setSaveProgress,
    readDownloadRemuxModel: readRemuxModel,
    persistDownloadRemuxModel: persistRemuxModel,
    recordDownloadRemuxSample: recordRemuxSample,
    estimateDownloadRemuxMs: estimateRemuxMs,
    estimateDownloadTaskDownloadMs: estimateTaskDownloadMs,
    scheduleDownloadPoolEta: schedulePoolEta,
    estimateDownloadMergePoolEta: estimateMergePoolEta,
    estimateDownloadMergeEtaMs: estimateMergeEta,
    collectDownloadProgressStats: collectProgressStats,
    downloadProgressTick: progressTick,
    ensureDownloadProgressTimer: ensureProgressTimer,
    resetDownloadProgressSampling: resetProgressSampling,
    dispose
  };
}
