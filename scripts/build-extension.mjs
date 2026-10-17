import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildPrimaryBody, readUserscriptMetadata, readUserscriptVersion } from "./lib/primary-bundle.mjs";
import { packageEdgeExtension } from "./lib/package-edge-extension.mjs";

const extensionSourceRoot = new URL("../src/extension/", import.meta.url);
const outputRoot = new URL("../extension/", import.meta.url);
const iconNames = ["16", "32", "48", "128"];

function replaceRequired(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Edge 专属构建适配未命中唯一位置：${label}（${count}）`);
  return source.replace(search, replacement);
}

function replaceRequiredRange(source, startMarker, endMarker, requiredMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  const range = start >= 0 && end > start ? source.slice(start, end) : "";
  const occurrences = (value, marker) => value.split(marker).length - 1;
  if (
    occurrences(source, startMarker) !== 1
    || occurrences(source, endMarker) !== 1
    || start < 0
    || end <= start
    || occurrences(range, requiredMarker) !== 1
  ) {
    throw new Error(`Edge 专属构建适配未命中唯一范围：${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

export function adaptExtensionVideoList(source) {
  const startMarker = "    const updateListStats = () => {";
  const endMarker = "    listHead.append(listHeading, listTools);";
  const replacement = `    const renderedEntries = new Map();
    const renderedGroups = new Map();
    const renderedEntryGroups = new Map();
    const groupRecords = new Map();
    const flatRows = [];
    const VIRTUAL_LIST_ROW_HEIGHT = 56;
    const VIRTUAL_LIST_OVERSCAN = 6;
    const virtualListStride = VIRTUAL_LIST_ROW_HEIGHT + 6;
    let selectedCollectionCount = 0;
    let selectedEntryCount = 0;
    let validEntryCount = 0;
    let currentListLabel = "";
    let bangumiSeasonCount = 0;
    let collectionGroupCount = 0;
    let renderedStart = -1;
    let renderedEnd = -1;
    let listRenderScheduled = false;
    const virtualSpacer = document.createElement("div");
    virtualSpacer.setAttribute("aria-hidden", "true");
    virtualSpacer.style.visibility = "hidden";
    virtualSpacer.style.pointerEvents = "none";
    list.style.display = "block";
    list.style.position = "relative";
    list.setAttribute("aria-label", "视频列表");
    const updateListStats = () => {
      DOWNLOAD_CAPTURE_STATS.selectedCount = selectedEntryCount;
      DOWNLOAD_CAPTURE_STATS.collectionSelectedCount = selectedCollectionCount;
      listHeading.textContent = videoListState.entries.length
        ? \`视频列表（已选 \${selectedEntryCount}/\${validEntryCount}）\`
        : "视频列表";
    };
    const updateSelectedListStats = () => updateListStats();
    const updateListSummary = () => {
      badges.textContent = [
        model.videoId || model.bvid,
        \`当前 \${currentListLabel}\`,
        videoListState.entries.length
          ? model.downloadScope === "bangumi"
            ? \`\${bangumiSeasonCount || 1} 个季度 · \${videoListState.entries.length} 个可选集\`
            : \`\${collectionGroupCount} 个合集视频 · \${videoListState.entries.length} 个可选 P\`
          : "列表等待更新",
        model.quality ? \`当前画质 \${model.videos.find((track) => track.id === model.quality)?.qualityLabel || model.quality}\` : "当前画质未知"
      ].filter(Boolean).join(" · ");
    };
    const renderDownloadVideoListEntry = (entry, child = false, rowIndex = 0) => {
      const valid = isDownloadVideoListEntryValid(entry);
      const item = document.createElement("label");
      item.className = \`bk-dw-episode\${child ? " bk-dw-episode-child" : ""}\${entry.current ? " current" : ""}\${valid ? "" : " invalid"}\`;
      item.dataset.bkListKey = entry.listKey;
      item.dataset.bkVirtualRow = String(rowIndex);
      item.style.position = "absolute";
      item.style.top = \`\${rowIndex * virtualListStride}px\`;
      item.style.left = "0";
      item.style.right = "0";
      item.style.height = \`\${VIRTUAL_LIST_ROW_HEIGHT}px\`;
      item.style.boxSizing = "border-box";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = valid && videoListState.selected.has(entry.listKey);
      checkbox.disabled = !valid;
      checkbox.setAttribute("aria-label", \`选择 \${entry.label || downloadVideoListLabel(entry)}\`);
      checkbox.addEventListener("change", () => {
        if (!valid) return;
        const wasSelected = videoListState.selected.has(entry.listKey);
        if (checkbox.checked) videoListState.selected.add(entry.listKey);
        else videoListState.selected.delete(entry.listKey);
        if (wasSelected !== checkbox.checked) selectedEntryCount += checkbox.checked ? 1 : -1;
        if (entry.downloadScope === "collection" && wasSelected !== checkbox.checked) {
          selectedCollectionCount += checkbox.checked ? 1 : -1;
        }
        const groupRecord = renderedEntryGroups.get(entry.listKey);
        if (groupRecord && wasSelected !== checkbox.checked) {
          groupRecord.selectedCount += checkbox.checked ? 1 : -1;
        }
        refreshListSelectionState({ entry });
      });
      const main = document.createElement("span");
      main.className = "bk-dw-episode-main";
      const entryTitle = document.createElement("span");
      entryTitle.className = "bk-dw-episode-title";
      const label = entry.label || downloadVideoListLabel(entry);
      const part = entry.collectionPageCount > 1 && entry.part && entry.part !== entry.title
        ? \`\${entry.title || "视频"} · \${entry.part}\`
        : entry.title || entry.part || "Bilibili 视频";
      entryTitle.textContent = \`\${valid ? "" : "⚠ "}\${label} · \${part}\`;
      const meta = document.createElement("span");
      meta.className = "bk-dw-episode-meta";
      const identity = entry.bvid || entry.videoId || (entry.aid ? \`av\${entry.aid}\` : "未知视频");
      meta.textContent = \`\${identity}\${entry.cid ? \` · CID \${entry.cid}\` : " · CID 待获取"}\${entry.collectionPageCount > 1 ? \` · P\${entry.page}\` : ""}\${entry.cidMismatch ? " · 目录 CID 不一致，已跳过" : ""}\`;
      main.append(entryTitle, meta);
      const duration = document.createElement("span");
      duration.className = "bk-dw-episode-duration";
      duration.textContent = entry.durationLabel || formatDownloadEpisodeDuration(entry.duration);
      item.append(checkbox, main, duration);
      renderedEntries.set(entry.listKey, { entry, item, checkbox });
      return item;
    };
    const renderDownloadVideoListGroup = (groupRecord, rowIndex) => {
      const { group } = groupRecord;
      const groupItem = document.createElement("label");
      groupItem.className = \`bk-dw-episode bk-dw-episode-group\${group.current ? " current" : ""}\${groupRecord.validCount ? "" : " invalid"}\`;
      groupItem.dataset.bkVirtualRow = String(rowIndex);
      groupItem.style.position = "absolute";
      groupItem.style.top = \`\${rowIndex * virtualListStride}px\`;
      groupItem.style.left = "0";
      groupItem.style.right = "0";
      groupItem.style.height = \`\${VIRTUAL_LIST_ROW_HEIGHT}px\`;
      groupItem.style.boxSizing = "border-box";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", \`选择 \${group.label} 的全部\${group.kind === "bangumi-season" ? "集" : "分 P"}\`);
      checkbox.addEventListener("change", () => {
        const checked = checkbox.checked;
        for (const entry of group.children) {
          if (!isDownloadVideoListEntryValid(entry)) continue;
          const wasSelected = videoListState.selected.has(entry.listKey);
          if (wasSelected === checked) continue;
          if (checked) videoListState.selected.add(entry.listKey);
          else videoListState.selected.delete(entry.listKey);
          selectedEntryCount += checked ? 1 : -1;
          groupRecord.selectedCount += checked ? 1 : -1;
          if (entry.downloadScope === "collection") selectedCollectionCount += checked ? 1 : -1;
        }
        refreshListSelectionState({ group });
      });
      const main = document.createElement("span");
      main.className = "bk-dw-episode-main";
      const entryTitle = document.createElement("span");
      entryTitle.className = "bk-dw-episode-title";
      entryTitle.textContent = \`\${group.label} · \${group.title || "Bilibili 视频"}\`;
      const meta = document.createElement("span");
      meta.className = "bk-dw-episode-meta";
      main.append(entryTitle, meta);
      const duration = document.createElement("span");
      duration.className = "bk-dw-episode-duration";
      duration.textContent = "选择全部";
      groupItem.append(checkbox, main, duration);
      renderedGroups.set(group.key, { group, checkbox, meta, groupRecord });
      updateRenderedGroup(group);
      return groupItem;
    };
    const updateRenderedGroup = (group) => {
      const groupRecord = groupRecords.get(group.key);
      const rendered = renderedGroups.get(group.key);
      if (!groupRecord || !rendered) return;
      const selectedCount = groupRecord.selectedCount;
      rendered.checkbox.checked = groupRecord.validCount > 0 && selectedCount === groupRecord.validCount;
      rendered.checkbox.indeterminate = selectedCount > 0 && selectedCount < groupRecord.validCount;
      rendered.checkbox.disabled = !groupRecord.validCount;
      const identity = group.bvid || group.videoId || (group.aid ? \`av\${group.aid}\` : "未知视频");
      const unit = group.kind === "bangumi-season" ? "集" : "P";
      rendered.meta.textContent = \`\${identity} · \${groupRecord.validCount} 个\${unit} · 已选 \${selectedCount} 个\${groupRecord.totalDuration ? \` · 总时长 \${formatDownloadEpisodeDuration(groupRecord.totalDuration)}\` : ""}\`;
    };
    const refreshListSelectionState = (target = {}) => {
      if (target.entry) {
        const renderedEntry = renderedEntries.get(target.entry.listKey);
        if (renderedEntry) renderedEntry.checkbox.checked = videoListState.selected.has(target.entry.listKey);
        const record = renderedEntryGroups.get(target.entry.listKey);
        if (record) updateRenderedGroup(record.group);
      } else if (target.group) {
        const groupRecord = groupRecords.get(target.group.key);
        for (const record of renderedEntries.values()) {
          if (renderedEntryGroups.get(record.entry.listKey) === groupRecord) {
            record.checkbox.checked = videoListState.selected.has(record.entry.listKey);
          }
        }
        if (groupRecord) updateRenderedGroup(groupRecord.group);
      } else {
        for (const record of renderedEntries.values()) record.checkbox.checked = videoListState.selected.has(record.entry.listKey);
        for (const record of groupRecords.values()) {
          updateRenderedGroup(record.group);
        }
      }
      updateSelectedListStats();
    };
    const renderVirtualWindow = () => {
      listRenderScheduled = false;
      if (!flatRows.length) return;
      const viewportHeight = list.clientHeight || 290;
      const firstVisible = Math.floor(list.scrollTop / virtualListStride);
      const nextStart = Math.max(0, firstVisible - VIRTUAL_LIST_OVERSCAN);
      const nextEnd = Math.min(flatRows.length, Math.ceil((list.scrollTop + viewportHeight) / virtualListStride) + VIRTUAL_LIST_OVERSCAN);
      if (nextStart === renderedStart && nextEnd === renderedEnd) return;
      renderedStart = nextStart;
      renderedEnd = nextEnd;
      renderedEntries.clear();
      renderedGroups.clear();
      list.replaceChildren(virtualSpacer);
      for (let rowIndex = renderedStart; rowIndex < renderedEnd; rowIndex += 1) {
        const row = flatRows[rowIndex];
        const node = row.kind === "group"
          ? renderDownloadVideoListGroup(row.groupRecord, rowIndex)
          : renderDownloadVideoListEntry(row.entry, row.child, rowIndex);
        list.appendChild(node);
      }
    };
    const scheduleVirtualWindow = () => {
      if (listRenderScheduled) return;
      listRenderScheduled = true;
      requestAnimationFrame(renderVirtualWindow);
    };
    list.addEventListener("scroll", scheduleVirtualWindow, { passive: true });
    const refreshList = () => {
      renderedEntries.clear();
      renderedGroups.clear();
      renderedEntryGroups.clear();
      groupRecords.clear();
      flatRows.length = 0;
      validEntryCount = 0;
      selectedEntryCount = 0;
      selectedCollectionCount = 0;
      const catalog = [];
      const collection = [];
      for (const entry of videoListState.entries) {
        if (entry.downloadScope === "collection") collection.push(entry);
        else catalog.push(entry);
        if (!isDownloadVideoListEntryValid(entry)) continue;
        validEntryCount += 1;
        if (videoListState.selected.has(entry.listKey)) {
          selectedEntryCount += 1;
          if (entry.downloadScope === "collection") selectedCollectionCount += 1;
        }
      }
      DOWNLOAD_WORKSPACE_CATALOG = catalog;
      DOWNLOAD_WORKSPACE_COLLECTION = collection;
      DOWNLOAD_CAPTURE_STATS.catalogCount = videoListState.entries.length;
      DOWNLOAD_CAPTURE_STATS.collectionCount = collection.length;
      const groupByKey = new Map();
      for (const group of videoListState.groups) {
        const children = group.children || [];
        const showGroup = group.kind === "bangumi-season" || group.kind === "collection" && children.length > 1;
        if (!showGroup) {
          if (children[0]) flatRows.push({ kind: "entry", entry: children[0], child: false });
          continue;
        }
        let groupValidCount = 0;
        let groupSelectedCount = 0;
        let totalDuration = 0;
        for (const entry of children) {
          if (!isDownloadVideoListEntryValid(entry)) continue;
          groupValidCount += 1;
          if (videoListState.selected.has(entry.listKey)) groupSelectedCount += 1;
          totalDuration += Number(entry.duration) || 0;
        }
        const groupRecord = {
          group,
          validCount: groupValidCount,
          selectedCount: groupSelectedCount,
          totalDuration
        };
        groupRecords.set(group.key, groupRecord);
        groupByKey.set(group.key, groupRecord);
        flatRows.push({ kind: "group", groupRecord });
        for (const entry of children) {
          flatRows.push({ kind: "entry", entry, child: true });
          renderedEntryGroups.set(entry.listKey, groupRecord);
        }
      }
      if (!flatRows.length) {
        list.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "bk-dw-empty";
        empty.textContent = "正在读取视频列表；若页面没有合集或分 P，当前视频仍可单独下载。";
        list.appendChild(empty);
      } else {
        const contentHeight = (flatRows.length - 1) * virtualListStride + VIRTUAL_LIST_ROW_HEIGHT;
        virtualSpacer.style.height = \`\${contentHeight}px\`;
        list.scrollTop = 0;
        renderedStart = -1;
        renderedEnd = -1;
        renderVirtualWindow();
      }
      const currentEntry = videoListState.entries.find((entry) => entry.current);
      currentListLabel = currentEntry?.label || (model.downloadScope === "bangumi"
        ? downloadVideoListLabel({ ...model, downloadScope: "bangumi", episodeIndex: model.episodeIndex, seasonIndex: model.seasonIndex, multiSeason: model.multiSeason })
        : downloadVideoListLabel({ page: model.page }));
      bangumiSeasonCount = videoListState.groups.filter((group) => group.kind === "bangumi-season").length;
      collectionGroupCount = videoListState.groups.filter((group) => group.kind === "collection").length;
      updateListStats();
      updateListSummary();
      root.dataset.bkDownloadScope = downloadBatchScopeForEntries(videoListState.entries);
    };
    listButton("全选", () => {
      const selected = new Set();
      for (const entry of videoListState.entries) {
        if (isDownloadVideoListEntryValid(entry)) selected.add(entry.listKey);
      }
      videoListState.selected = selected;
      selectedEntryCount = validEntryCount;
      selectedCollectionCount = videoListState.entries.reduce((count, entry) => (
        count + (entry.downloadScope === "collection" && isDownloadVideoListEntryValid(entry) ? 1 : 0)
      ), 0);
      for (const groupRecord of groupRecords.values()) groupRecord.selectedCount = groupRecord.validCount;
      refreshListSelectionState();
    });
    listButton("取消全选", () => {
      videoListState.selected.clear();
      selectedEntryCount = 0;
      selectedCollectionCount = 0;
      for (const groupRecord of groupRecords.values()) groupRecord.selectedCount = 0;
      refreshListSelectionState();
    });
`;
  return replaceRequiredRange(
    source,
    startMarker,
    endMarker,
    "const renderDownloadVideoListEntry = ",
    replacement,
    "视频列表局部更新"
  );
}

export function adaptExtensionBody(source) {
  let body = source
    .replace(/\bGM_xmlhttpRequest\b/g, "globalThis.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__")
    .replace(/\bGM_download\b/g, "globalThis.__BILIKIT_EDGE_GM_DOWNLOAD__");
  body = adaptExtensionVideoList(body);
  body = replaceRequired(
    body,
    "    normalizeDownloadTaskProgress(task);\n    collectDownloadProgressStats();\n    ensureDownloadProgressTimer();",
    "    normalizeDownloadTaskProgress(task);\n    ensureDownloadProgressTimer();",
    "下载进度更新不重复遍历所有任务"
  );
  body = replaceRequired(
    body,
    "    if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) requestAnimationFrame(renderDownloadTasks);",
    "    if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) globalThis.__BILIKIT_EDGE_SCHEDULE_TASK_RENDER__(renderDownloadTasks);",
    "下载任务 DOM 更新节流"
  );
  body = replaceRequired(
    body,
    "      if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) renderDownloadTasks();",
    "      if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) globalThis.__BILIKIT_EDGE_SCHEDULE_TASK_RENDER__(renderDownloadTasks);",
    "下载进度定时渲染节流"
  );
  return body;
}

async function buildMainContent(version) {
  const [adapter, primary] = await Promise.all([
    readFile(new URL("main-adapter.js", extensionSourceRoot), "utf8"),
    buildPrimaryBody({ version })
  ]);
  const extensionBody = adaptExtensionBody(primary.body);
  return `${adapter.trim()}\n\n${extensionBody}`;
}

export async function buildExtension() {
  const metadata = await readUserscriptMetadata();
  const version = readUserscriptVersion(metadata);
  await mkdir(outputRoot, { recursive: true });
  await mkdir(new URL("icons/", outputRoot), { recursive: true });
  const [manifestTemplate, bridge, serviceWorker, contentMain] = await Promise.all([
    readFile(new URL("manifest.template.json", extensionSourceRoot), "utf8"),
    readFile(new URL("bridge.js", extensionSourceRoot), "utf8"),
    readFile(new URL("service-worker.js", extensionSourceRoot), "utf8"),
    buildMainContent(version)
  ]);
  const manifest = manifestTemplate.replaceAll('"__VERSION__"', JSON.stringify(version));
  await Promise.all([
    writeFile(new URL("manifest.json", outputRoot), `${manifest.trim()}\n`),
    writeFile(new URL("content-main.js", outputRoot), contentMain),
    writeFile(new URL("content-bridge.js", outputRoot), bridge),
    writeFile(new URL("service-worker.js", outputRoot), serviceWorker),
    ...iconNames.map((size) => copyFile(
      new URL(`icons/icon${size}.png`, extensionSourceRoot),
      new URL(`icons/icon${size}.png`, outputRoot)
    ))
  ]);
  const { archivePath } = await packageEdgeExtension(version);
  return {
    version,
    outputRoot: fileURLToPath(outputRoot),
    archivePath,
    contentBytes: Buffer.byteLength(contentMain)
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await buildExtension();
  console.log(`Built Edge extension ${result.version}: ${result.contentBytes} bytes main content in ${result.outputRoot}`);
  console.log(`Packaged Edge extension with manifest.json at ZIP root: ${result.archivePath}`);
}
