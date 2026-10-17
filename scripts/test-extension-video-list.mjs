import assert from "node:assert/strict";
import vm from "node:vm";
import { adaptExtensionVideoList } from "./build-extension.mjs";

const updateMarker = "    const updateListStats = () => {";
const endMarker = "    listHead.append(listHeading, listTools);";
const fixture = [
  updateMarker,
  "      // builder fixture",
  "    };",
  "    const renderDownloadVideoListEntry = (entry, child = false) => {}；",
  endMarker
].join("\n").replace("{}；", "{};");

const adapted = adaptExtensionVideoList(fixture);
const start = adapted.indexOf("    const renderedEntries = new Map();");
const end = adapted.indexOf(endMarker, start);
assert(start >= 0 && end > start, "构建器没有输出视频列表适配代码");
const listCode = adapted.slice(start, end);
assert.throws(
  () => adaptExtensionVideoList(fixture.replace("const renderDownloadVideoListEntry", "const renderDownloadVideoListEntryChanged")),
  /未命中唯一范围/,
  "构建器标记变化时应立即失败"
);

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.scrollTop = 0;
    this.clientHeight = 290;
    this.textContent = "";
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set?.(name, value);
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ target: this, currentTarget: this });
    }
  }
}

const entries = Array.from({ length: 3331 }, (_, index) => {
  const collectionIndex = Math.floor(index / 32) + 1;
  return {
    listKey: `collection:${collectionIndex}:page:${index + 1}`,
    downloadScope: "collection",
    collectionIndex,
    collectionPageCount: 1,
    page: index + 1,
    duration: 180,
    title: `视频 ${index + 1}`,
    part: `P${index + 1}`,
    label: `C${collectionIndex} · P${index + 1}`,
    bvid: `BV${collectionIndex}`,
    videoId: `BV${collectionIndex}`,
    cid: String(index + 1),
    valid: true
  };
});
const groups = [];
for (const entry of entries) {
  let group = groups.at(-1);
  if (!group || group.collectionIndex !== entry.collectionIndex) {
    group = {
      key: `collection:${entry.collectionIndex}`,
      kind: "collection",
      collectionIndex: entry.collectionIndex,
      bvid: entry.bvid,
      label: `C${entry.collectionIndex}`,
      title: `合集 ${entry.collectionIndex}`,
      children: []
    };
    groups.push(group);
  }
  group.children.push(entry);
}

const createdTags = new Map();
const rafQueue = [];
const document = {
  createElement(tagName) {
    createdTags.set(tagName, (createdTags.get(tagName) || 0) + 1);
    return new FakeNode(tagName);
  }
};
let fullEntryListTraversals = 0;
let groupChildVisits = 0;
const trackedEntries = new Proxy(entries, {
  get(target, property, receiver) {
    if (property === Symbol.iterator) {
      return function* iterateEntries() {
        fullEntryListTraversals += 1;
        yield* target;
      };
    }
    if (["filter", "find", "forEach", "map", "reduce", "some", "every"].includes(property)) {
      return (...args) => {
        fullEntryListTraversals += 1;
        return Array.prototype[property].apply(target, args);
      };
    }
    return Reflect.get(target, property, receiver);
  }
});
for (const group of groups) {
  const children = group.children;
  group.children = new Proxy(children, {
    get(target, property, receiver) {
      if (property === Symbol.iterator) {
        return function* iterateGroupChildren() {
          groupChildVisits += target.length;
          yield* target;
        };
      }
      if (["filter", "find", "forEach", "map", "reduce", "some", "every"].includes(property)) {
        return (...args) => {
          groupChildVisits += target.length;
          return Array.prototype[property].apply(target, args);
        };
      }
      return Reflect.get(target, property, receiver);
    }
  });
}
const list = new FakeNode("div");
const listHeading = new FakeNode("h2");
const listTools = new FakeNode("div");
const badges = new FakeNode("p");
const root = new FakeNode("section");
const listHead = new FakeNode("header");
const model = { videoId: "BV-current", bvid: "BV-current", downloadScope: "collection", quality: "1080", videos: [], audios: [] };
const videoListState = { entries: trackedEntries, groups, selected: new Set([entries[0].listKey]) };
const DOWNLOAD_CAPTURE_STATS = {};
const context = vm.createContext({
  document,
  list,
  listHeading,
  listTools,
  listButton(label, callback) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", callback);
    listTools.appendChild(button);
    return button;
  },
  badges,
  root,
  listHead,
  model,
  videoListState,
  DOWNLOAD_CAPTURE_STATS,
  DOWNLOAD_WORKSPACE_CATALOG: [],
  DOWNLOAD_WORKSPACE_COLLECTION: [],
  isDownloadVideoListEntryValid: (entry) => entry.valid !== false,
  downloadVideoListLabel: (entry) => entry.label || "视频",
  formatDownloadEpisodeDuration: (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  downloadBatchScopeForEntries: () => "collection",
  setDownloadVideoListGroupSelection(selectedKeys, group, checked) {
    const next = new Set(selectedKeys);
    for (const entry of group.children) {
      if (checked) next.add(entry.listKey);
      else next.delete(entry.listKey);
    }
    return next;
  },
  requestAnimationFrame(callback) {
    rafQueue.push(callback);
    return rafQueue.length;
  }
});

const harness = vm.runInContext(`(() => {\n${listCode}\nreturn {\n  refreshList,\n  refreshListSelectionState,\n  renderedEntries,\n  renderedGroups,\n  renderedEntryGroups,\n  flatRows,\n  getRenderedRange: () => [renderedStart, renderedEnd]\n};\n})()`, context);
const labelCount = () => createdTags.get("label") || 0;
const flushAnimationFrames = () => {
  while (rafQueue.length) rafQueue.shift()();
};

harness.refreshList();
fullEntryListTraversals = 0;
groupChildVisits = 0;
assert(labelCount() <= 30, `3331 项初次渲染只应创建可视窗口节点，实际创建 ${labelCount()} 个 label`);
assert.equal(harness.flatRows.length, entries.length + groups.length, "虚拟行应保留合集标题和所有视频行");
assert(harness.renderedEntries.size <= 20, "可见条目数应受视口高度约束");
assert.equal(videoListState.selected.size, 1, "初始选中状态被保留");

const beforeToggleLabelCount = labelCount();
const visibleEntry = [...harness.renderedEntries.values()].find(({ entry }) => !videoListState.selected.has(entry.listKey));
assert(visibleEntry, "初始虚拟窗口中缺少可测试的视频项");
visibleEntry.checkbox.checked = true;
visibleEntry.checkbox.dispatch("change");
visibleEntry.checkbox.dispatch("change");
assert(videoListState.selected.has(visibleEntry.entry.listKey), "单项勾选没有更新全量选择状态");
assert.equal(fullEntryListTraversals, 0, "单项勾选不得遍历 3331 项目录");
const selectedGroupRecord = harness.renderedEntryGroups.get(visibleEntry.entry.listKey);
assert.equal(groupChildVisits, 0, "单项勾选不得遍历合集子项");
assert.equal(selectedGroupRecord.selectedCount, 2, "重复 change 事件不得让合集计数漂移");
assert([...harness.renderedGroups.values()].some(({ group, meta }) => group.key === selectedGroupRecord.group.key && meta.textContent.includes("已选 2 个")), "单项勾选后合集统计没有即时更新");
assert.equal(labelCount(), beforeToggleLabelCount, "单项勾选不应创建或重建列表 DOM");

visibleEntry.checkbox.checked = false;
visibleEntry.checkbox.dispatch("change");
assert(!videoListState.selected.has(visibleEntry.entry.listKey), "取消单项勾选没有更新全量选择状态");
assert.equal(selectedGroupRecord.selectedCount, 1, "取消单项勾选没有同步合集计数");
assert.equal(groupChildVisits, 0, "取消单项勾选不得遍历合集子项");
assert.equal(fullEntryListTraversals, 0, "取消单项勾选不得遍历完整目录");

const visibleGroup = [...harness.renderedGroups.values()][0];
assert(visibleGroup?.checkbox, "初始虚拟窗口应呈现合集父项");
visibleGroup.checkbox.checked = true;
visibleGroup.checkbox.dispatch("change");
assert.equal(groupChildVisits, visibleGroup.group.children.length, "组全选只应遍历该组合集一次");
assert.equal(fullEntryListTraversals, 0, "组全选不得遍历完整 3331 项目录");
assert(visibleGroup.group.children.every((entry) => videoListState.selected.has(entry.listKey)), "合集全选未更新离屏子项状态");
assert.equal(labelCount(), beforeToggleLabelCount, "合集全选不应创建或重建列表 DOM");

const previousRange = harness.getRenderedRange();
list.scrollTop = 1800;
list.dispatch("scroll");
flushAnimationFrames();
assert.notDeepEqual(harness.getRenderedRange(), previousRange, "滚动后虚拟列表窗口应移动");
assert(harness.renderedEntries.size <= 20, "滚动后可见条目数仍应受视口高度约束");

const afterScrollLabelCount = labelCount();
groupChildVisits = 0;
listTools.children.find((button) => button.textContent === "全选").dispatch("click");
assert.equal(videoListState.selected.size, entries.length, "全选没有覆盖所有有效条目");
assert.equal(groupChildVisits, 0, "全选更新渲染组状态时不得再次扫描组子项");
assert.equal(labelCount(), afterScrollLabelCount, "全选不应重建列表 DOM");
groupChildVisits = 0;
listTools.children.find((button) => button.textContent === "取消全选").dispatch("click");
assert.equal(videoListState.selected.size, 0, "取消全选没有清空选择状态");
assert.equal(groupChildVisits, 0, "取消全选不得扫描任何组子项");
assert.equal(labelCount(), afterScrollLabelCount, "取消全选不应重建列表 DOM");

console.log("扩展虚拟视频列表测试通过：3331 项窗口化、选择局部更新、滚动换窗和构建器标记回归均正常。");
