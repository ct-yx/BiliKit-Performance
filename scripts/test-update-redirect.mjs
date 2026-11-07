import { readUserscriptSource } from "./helpers/read-userscript-source.mjs";

const source = await readUserscriptSource();
const start = source.indexOf("  function installUpdateRedirect");
const end = source.indexOf("  function installSiteDrawer", start);
if (start < 0 || end < 0) throw new Error("无法定位更新跳转逻辑");

const section = source.slice(start, end);
if (!source.includes("GM.openInTab(url, { active: true, insert: true, setParent: true })")) {
  throw new Error("更新日志没有优先使用 GM.openInTab 新标签页打开");
}
if (!source.includes("GM_openInTab(url, { active: true, insert: true, setParent: true })")) {
  throw new Error("更新日志没有保留 GM_openInTab 兼容打开方式");
}
if (!source.includes('window.open(url, "_blank", "noopener,noreferrer")')) {
  throw new Error("更新跳转没有保留 window.open 兼容回退");
}
if (!section.includes("openUpdateChangelog(target.href)") || section.includes("location.replace(target.href)")) {
  throw new Error("更新跳转仍会替换当前 Bilibili 页面");
}

console.log("更新跳转测试通过：优先使用 GM.openInTab 新开标签页并保留兼容回退。");
